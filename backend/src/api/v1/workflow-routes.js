'use strict';

const express = require('express');
const workflowService = require('../../domain/workflow/workflow-service');
const { requirePermission } = require('../../api/middleware/auth');

const router = express.Router();

/**
 * List pending approvals for the current user.
 */
router.get('/pending', requirePermission('expense:approve'), async (req, res, next) => {
    try {
        const approvals = await workflowService.getPendingApprovals(req.user.tenantId, req.user.id);
        res.success(approvals);
    } catch (err) {
        next(err);
    }
});

/**
 * Approve a specific step.
 */
router.post('/steps/:id/approve', requirePermission('expense:approve'), async (req, res, next) => {
    try {
        const { comment } = req.body;
        await workflowService.approveStep(req.user.tenantId, req.user.id, req.params.id, comment);
        res.success({ message: 'Step approved successfully' });
    } catch (err) {
        next(err);
    }
});

/**
 * Reject a specific step.
 */
router.post('/steps/:id/reject', requirePermission('expense:approve'), async (req, res, next) => {
    try {
        const { comment } = req.body;
        await workflowService.rejectStep(req.user.tenantId, req.user.id, req.params.id, comment);
        res.success({ message: 'Step rejected successfully' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
