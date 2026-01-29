'use strict';

const workflowRepository = require('./workflow-repository');
const expenseRepository = require('../expense/expense-repository');
const expenseStateMachine = require('../expense/expense-state-machine');
const auditService = require('../../core/audit/audit-service');
const logger = require('../../core/logger');
const { getClient } = require('../../core/database/pool');
const { ValidationError, ForbiddenError, NotFoundError, ConflictError } = require('../../core/errors');

class WorkflowService {
    /**
     * Instantiate a workflow for a newly submitted expense.
     */
    async startWorkflow(tenantId, expenseId, existingClient = null) {
        const workflow = await workflowRepository.findActiveWorkflow(tenantId);

        const client = existingClient || await getClient();
        const shouldManageTransaction = !existingClient;

        try {
            if (shouldManageTransaction) await client.query('BEGIN');

            if (!workflow) {
                logger.warn({ tenantId, expenseId }, 'No active workflow found for tenant. Auto-approving.');

                const expense = await expenseRepository.findByIdForUpdate(client, tenantId, expenseId);
                if (expense) {
                    expenseStateMachine.assertTransition(expense.status, expenseStateMachine.STATES.APPROVED);
                    await expenseRepository.updateStatus(tenantId, expenseId, expenseStateMachine.STATES.APPROVED, client);
                }

                if (shouldManageTransaction) await client.query('COMMIT');
                return;
            }

            const approvers = workflow.config?.approvers || [];
            if (approvers.length === 0) {
                const expense = await expenseRepository.findByIdForUpdate(client, tenantId, expenseId);
                if (expense) {
                    expenseStateMachine.assertTransition(expense.status, expenseStateMachine.STATES.APPROVED);
                    await expenseRepository.updateStatus(tenantId, expenseId, expenseStateMachine.STATES.APPROVED, client);
                }

                if (shouldManageTransaction) await client.query('COMMIT');
                return;
            }

            const chainId = await workflowRepository.createApprovalChain(tenantId, expenseId, workflow.workflow_id, client);

            for (let i = 0; i < approvers.length; i++) {
                await workflowRepository.createApprovalStep(tenantId, chainId, approvers[i], i + 1, client);
            }

            if (shouldManageTransaction) await client.query('COMMIT');
            logger.info({ tenantId, expenseId, chainId }, 'Approval workflow started');
        } catch (err) {
            if (shouldManageTransaction) await client.query('ROLLBACK');
            throw err;
        } finally {
            if (shouldManageTransaction) client.release();
        }
    }

    /**
     * Approve a step in the workflow.
     */
    async approveStep(tenantId, userId, stepId, comment) {
        const client = await getClient();
        try {
            await client.query('BEGIN');

            // Fetch step with lock for safety
            const query = `
        SELECT s.*, c.expense_id, c.status as chain_status
        FROM approval_steps s
        JOIN approval_chains c ON s.chain_id = c.chain_id AND s.tenant_id = c.tenant_id
        WHERE s.tenant_id = $1 AND s.step_id = $2
        FOR UPDATE OF s
      `;
            const result = await client.query(query, [tenantId, stepId]);
            const step = result.rows[0];

            if (!step) throw new NotFoundError('Approval step not found');
            if (step.approver_user_id !== userId) throw new ForbiddenError('You are not the designated approver for this step');
            if (step.status !== 'pending' || step.chain_status !== 'pending') {
                throw new ConflictError('This step or workflow is no longer active');
            }

            // Verify it's the current step (sequential)
            const nextPending = await workflowRepository.getNextPendingStep(tenantId, step.chain_id);
            if (nextPending.step_id !== step.step_id) {
                throw new ConflictError('Approvals must be performed in sequence');
            }

            // Record action
            await workflowRepository.createAction(tenantId, stepId, userId, 'approved', comment, client);
            await workflowRepository.updateStepStatus(tenantId, stepId, 'approved', client);

            // Check if this was the last step
            const nextStep = await workflowRepository.getNextPendingStep(tenantId, step.chain_id);
            if (!nextStep) {
                // Last step approved -> Approve Chain and Expense
                await workflowRepository.updateChainStatus(tenantId, step.chain_id, 'approved', client);

                // Concurrency Safety: Lock and validate expense transition
                const expense = await expenseRepository.findByIdForUpdate(client, tenantId, step.expense_id);
                if (expense) {
                    expenseStateMachine.assertTransition(expense.status, expenseStateMachine.STATES.APPROVED);
                    await expenseRepository.updateStatus(tenantId, step.expense_id, expenseStateMachine.STATES.APPROVED, client);

                    await auditService.log({
                        tenantId,
                        userId: 'SYSTEM',
                        action: 'EXPENSE_APPROVED',
                        entityType: 'expense',
                        entityId: step.expense_id,
                        metadata: { chainId: step.chain_id }
                    });
                }
            }

            await auditService.log({
                tenantId,
                userId,
                action: 'STEP_APPROVED',
                entityType: 'approval_step',
                entityId: stepId,
                metadata: { comment }
            });

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Reject a workflow step.
     */
    async rejectStep(tenantId, userId, stepId, comment) {
        if (!comment) throw new ValidationError('Rejection reason is required');

        const client = await getClient();
        try {
            await client.query('BEGIN');

            const query = `
        SELECT s.*, c.expense_id, c.status as chain_status
        FROM approval_steps s
        JOIN approval_chains c ON s.chain_id = c.chain_id AND s.tenant_id = c.tenant_id
        WHERE s.tenant_id = $1 AND s.step_id = $2
        FOR UPDATE OF s
      `;
            const result = await client.query(query, [tenantId, stepId]);
            const step = result.rows[0];

            if (!step) throw new NotFoundError('Approval step not found');
            if (step.approver_user_id !== userId) throw new ForbiddenError('You are not the designated approver for this step');
            if (step.status !== 'pending' || step.chain_status !== 'pending') {
                throw new ConflictError('This step or workflow is no longer active');
            }

            // Record action and reject both step and chain
            await workflowRepository.createAction(tenantId, stepId, userId, 'rejected', comment, client);
            await workflowRepository.updateStepStatus(tenantId, stepId, 'rejected', client);
            await workflowRepository.updateChainStatus(tenantId, step.chain_id, 'rejected', client);

            // Update expense back to REJECTED (allowing re-edit)
            // Concurrency Safety: Lock and validate expense transition
            const expense = await expenseRepository.findByIdForUpdate(client, tenantId, step.expense_id);
            if (expense) {
                expenseStateMachine.assertTransition(expense.status, expenseStateMachine.STATES.REJECTED);
                await expenseRepository.updateStatus(tenantId, step.expense_id, expenseStateMachine.STATES.REJECTED, client);

                await auditService.log({
                    tenantId,
                    userId,
                    action: 'STEP_REJECTED',
                    entityType: 'approval_step',
                    entityId: stepId,
                    metadata: { comment }
                });

                await auditService.log({
                    tenantId,
                    userId: 'SYSTEM',
                    action: 'EXPENSE_REJECTED',
                    entityType: 'expense',
                    entityId: step.expense_id,
                    metadata: { chainId: step.chain_id, reason: comment }
                });
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * List pending approvals for the current user.
     */
    async getPendingApprovals(tenantId, userId) {
        return workflowRepository.findPendingStepsForUser(tenantId, userId);
    }
}

module.exports = new WorkflowService();
