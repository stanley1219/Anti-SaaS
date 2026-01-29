'use strict';

const featureService = require('../../domain/billing/feature-service');
const { ForbiddenError } = require('../../core/errors');

/**
 * Middleware to require a specific feature entitlement.
 * Must be used after authenticate middleware.
 */
const requireFeature = (featureKey) => {
    return async (req, res, next) => {
        if (!req.user || !req.user.tenantId) {
            return next(new ForbiddenError('Tenant context required'));
        }

        try {
            const isEnabled = await featureService.isFeatureEnabled(req.user.tenantId, featureKey);

            if (!isEnabled) {
                return res.status(403).json({
                    error: {
                        message: `Feature '${featureKey}' is not enabled on your current plan.`,
                        code: 'FEATURE_GATED',
                        featureKey
                    }
                });
            }

            next();
        } catch (err) {
            next(err);
        }
    };
};

module.exports = { requireFeature };
