'use strict';

const express = require('express');
const { authenticate } = require('../../api/middleware/auth');
const { enforceTenantStatus } = require('../../api/middleware/tenant-status');

const router = express.Router();

// 1. Auth routes (Public login/refresh, protected logout/me)
router.use('/auth', require('./auth-routes'));

// 2. Expense routes (Protected)
router.use('/expenses', authenticate, enforceTenantStatus, require('./expense-routes'));

// 3. Workflow routes (Protected)
router.use('/workflows', authenticate, enforceTenantStatus, require('./workflow-routes'));

// 4. Billing routes (Public /plans, Protected others)
router.use('/billing', (req, res, next) => {
    // Explicitly allow public access to the plans endpoint
    if (req.path === '/plans' && req.method === 'GET') {
        return next();
    }
    // All other billing routes require authentication
    return authenticate(req, res, next);
}, enforceTenantStatus, require('./billing-routes'));

// 5. Admin routes (Protected by role hierarchy)
router.use('/admin', authenticate, enforceTenantStatus, require('./admin-routes'));

module.exports = router;
