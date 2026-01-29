'use strict';

const express = require('express');
const billingService = require('../../domain/billing/billing-service');
const featureService = require('../../domain/billing/feature-service');
const { NotFoundError } = require('../../core/errors');
const router = express.Router();

/**
 * Get current subscription info.
 */
router.get('/subscription', async (req, res, next) => {
    try {
        const subscription = await billingService.getSubscription(req.user.tenantId);
        if (!subscription) {
            return next(new NotFoundError('No active subscription'));
        }
        res.success(subscription);
    } catch (err) {
        next(err);
    }
});

/**
 * Get available plans.
 */
router.get('/plans', async (req, res, next) => {
    try {
        const plans = await billingService.getPlans();
        res.success(plans);
    } catch (err) {
        next(err);
    }
});

/**
 * Get enabled features for the current tenant.
 */
router.get('/features', async (req, res, next) => {
    try {
        const features = await featureService.getEnabledFeatures(req.user.tenantId);
        res.success({ features });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
