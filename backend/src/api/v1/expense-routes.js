'use strict';

const express = require('express');
const expenseService = require('../../domain/expense/expense-service');
const { requirePermission } = require('../../api/middleware/auth');
const { validate } = require('../../api/middleware/validator');
const { NotFoundError } = require('../../core/errors');

const router = express.Router();

const expenseCreateSchema = {
    body: {
        amount: { required: true, type: 'number' },
        currency: { required: true, type: 'string' },
        categoryId: { required: true },
        merchant: { required: true, type: 'string' },
        date: { required: true }
    }
};

/**
 * List expenses
 */
router.get('/', async (req, res, next) => {
    try {
        const filters = {
            status: req.query.status,
            limit: parseInt(req.query.limit) || 20,
            offset: parseInt(req.query.offset) || 0
        };

        const result = await expenseService.listExpenses(
            req.user.tenantId,
            req.user.id,
            filters,
            req.user.permissions
        );
        res.success(result);
    } catch (err) {
        next(err);
    }
});

/**
 * Get single expense
 */
router.get('/:id', async (req, res, next) => {
    try {
        const expense = await expenseService.getExpense(
            req.user.tenantId,
            req.user.id,
            req.params.id,
            req.user.permissions
        );

        if (!expense) return next(new NotFoundError('Expense not found'));
        res.success(expense);
    } catch (err) {
        next(err);
    }
});

/**
 * Create new expense (DRAFT)
 */
router.post('/', validate(expenseCreateSchema), requirePermission('expense:create'), async (req, res, next) => {
    try {
        const expense = await expenseService.createExpense(
            req.user.tenantId,
            req.user.id,
            req.body,
            req.user.permissions
        );
        res.success(expense, 201);
    } catch (err) {
        next(err);
    }
});

/**
 * Update draft expense
 */
router.patch('/:id', async (req, res, next) => {
    try {
        const expense = await expenseService.updateExpense(
            req.user.tenantId,
            req.user.id,
            req.params.id,
            req.body,
            req.user.permissions
        );
        res.success(expense);
    } catch (err) {
        next(err);
    }
});

/**
 * Submit expense for approval
 */
router.post('/:id/submit', async (req, res, next) => {
    try {
        const expense = await expenseService.submitExpense(
            req.user.tenantId,
            req.user.id,
            req.params.id,
            req.user.permissions
        );
        res.success(expense);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
