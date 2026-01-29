'use strict';

const expenseRepository = require('./expense-repository');
const { expense: expensePolicy } = require('../policy');
const expenseStateMachine = require('./expense-state-machine');
const workflowService = require('../workflow/workflow-service');
const auditService = require('../../core/audit/audit-service');
const billingService = require('../billing/billing-service');
const jobRepository = require('../../core/jobs/job-repository');
const featureGate = require('../../core/feature-gate');
const logger = require('../../core/logger');
const { getClient } = require('../../core/database/pool');
const { ValidationError, ForbiddenError, NotFoundError, ConflictError } = require('../../core/errors');
const { tenantQuery } = require('../../core/database/tenant-query');

/**
 * Service for Expense lifecycle and business logic.
 * Orchestrates domain actions and delegates authorization to policies.
 */
class ExpenseService {
    /**
     * Create a new expense in DRAFT mode.
     */
    async createExpense(tenantId, userId, data, userPermissions) {
        const action = 'EXPENSE_CREATE';
        logger.info({ tenantId, userId, action }, 'Attempting to create expense');

        // Feature Gate check
        await featureGate.assertEnabled(tenantId, 'expenses');

        // Delegate authorization to policy
        expensePolicy.canCreateExpense({ id: userId, permissions: userPermissions });

        this.validateExpenseData(data);
        await this.validateCategory(tenantId, data.categoryId);

        try {
            const expense = await expenseRepository.create(tenantId, {
                ...data,
                userId,
                status: expenseStateMachine.STATES.DRAFT
            });

            await auditService.log({
                tenantId,
                userId,
                action,
                entityType: 'expense',
                entityId: expense.expense_id,
                metadata: { amount: expense.amount, currency: expense.currency }
            });

            await billingService.recordUsage(tenantId, 'expenses_created');

            // Optional OCR feature gate check before enqueuing
            if (await featureGate.isEnabled(tenantId, 'ocr')) {
                await jobRepository.enqueue(tenantId, 'ocr', { expenseId: expense.expense_id });
            }

            return expense;
        } catch (err) {
            logger.error({ err, tenantId, userId, action }, 'Failed to create expense');
            throw err;
        }
    }

    /**
     * Update an existing DRAFT expense.
     */
    async updateExpense(tenantId, userId, expenseId, data, userPermissions) {
        const action = 'EXPENSE_UPDATE';
        logger.info({ tenantId, userId, expenseId, action }, 'Attempting to update expense');

        const expense = await expenseRepository.findById(tenantId, expenseId);
        if (!expense) {
            throw new NotFoundError(`Expense ${expenseId} not found`);
        }

        // Delegate authorization and invariant checks to policy
        expensePolicy.canUpdateExpense({ id: userId, permissions: userPermissions }, expense);

        this.validateExpenseData(data);
        if (data.categoryId) {
            await this.validateCategory(tenantId, data.categoryId);
        }

        try {
            const updated = await expenseRepository.update(tenantId, expenseId, data);

            await auditService.log({
                tenantId,
                userId,
                action,
                entityType: 'expense',
                entityId: expenseId,
                metadata: { changes: data }
            });

            return updated;
        } catch (err) {
            logger.error({ err, tenantId, userId, expenseId, action }, 'Failed to update expense');
            throw err;
        }
    }

    /**
     * Submit an expense for approval.
     */
    async submitExpense(tenantId, userId, expenseId, userPermissions) {
        const action = 'EXPENSE_SUBMIT';
        logger.info({ tenantId, userId, expenseId, action }, 'Attempting to submit expense');

        // Transactional submit with row-level locking for concurrency safety
        const client = await getClient();
        try {
            await client.query('BEGIN');

            const expense = await expenseRepository.findByIdForUpdate(client, tenantId, expenseId);
            if (!expense) {
                throw new NotFoundError(`Expense ${expenseId} not found`);
            }

            // Idempotency: skip if already processed
            if (expense.status === expenseStateMachine.STATES.SUBMITTED || expense.status === expenseStateMachine.STATES.APPROVED) {
                logger.debug({ tenantId, expenseId, status: expense.status }, 'Submission already processed, skipping');
                await client.query('ROLLBACK');
                return expense;
            }

            // Delegate authorization to policy
            expensePolicy.canSubmitExpense({ id: userId, permissions: userPermissions }, expense);

            // Validate state transition
            expenseStateMachine.assertTransition(expense.status, expenseStateMachine.STATES.SUBMITTED);

            const submittedExpense = await expenseRepository.updateStatus(tenantId, expenseId, expenseStateMachine.STATES.SUBMITTED, client);

            await auditService.log({
                tenantId,
                userId,
                action,
                entityType: 'expense',
                entityId: expenseId
            });

            await workflowService.startWorkflow(tenantId, expenseId, client);

            await client.query('COMMIT');
            logger.info({ tenantId, userId, expenseId, action }, 'Expense submitted successfully');
            return submittedExpense;
        } catch (err) {
            await client.query('ROLLBACK');
            logger.error({ err, tenantId, userId, expenseId, action }, 'Failed to submit expense');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Get expense with ownership/view verification.
     */
    async getExpense(tenantId, userId, expenseId, userPermissions) {
        const action = 'EXPENSE_GET';
        const expense = await expenseRepository.findById(tenantId, expenseId);

        if (!expense) {
            return null;
        }

        // Delegate authorization to policy
        expensePolicy.canViewExpense({ id: userId, permissions: userPermissions }, expense);

        return expense;
    }

    /**
     * List expenses with automatic user-based scoping.
     */
    async listExpenses(tenantId, userId, filters, userPermissions) {
        const action = 'EXPENSE_LIST';
        const searchFilters = { ...filters };

        // Delegate data scoping to policy
        const userIdFilter = expensePolicy.getAuthorizedListUserId({ id: userId, permissions: userPermissions });
        if (userIdFilter) {
            searchFilters.userId = userIdFilter;
        }

        return expenseRepository.list(tenantId, searchFilters);
    }

    /**
     * Internal: Validates that category belongs to the tenant.
     */
    async validateCategory(tenantId, categoryId) {
        const query = 'SELECT 1 FROM expense_categories WHERE tenant_id = $1 AND category_id = $2 AND deleted_at IS NULL';
        const result = await tenantQuery(tenantId, query, [tenantId, categoryId]);

        if (result.rowCount === 0) {
            throw new ValidationError('Invalid or inaccessible category');
        }
    }

    /**
     * Internal: Basic validation for expense fields.
     */
    validateExpenseData(data) {
        if (!data.amount || data.amount <= 0) {
            throw new ValidationError('Invalid amount');
        }
        if (!data.currency || data.currency.length !== 3) {
            throw new ValidationError('Invalid currency code');
        }
        if (!data.categoryId) {
            throw new ValidationError('Category is required');
        }
        if (!data.merchant) {
            throw new ValidationError('Merchant is required');
        }
        if (!data.date) {
            throw new ValidationError('Date is required');
        }
    }
}

module.exports = new ExpenseService();
