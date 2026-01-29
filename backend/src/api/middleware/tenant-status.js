'use strict';

const billingRepository = require('../../domain/billing/billing-repository');
const { ForbiddenError } = require('../../core/errors');

/**
 * Middleware to enforce tenant status (active, suspended, churned).
 * Blocks requests if the tenant is not active.
 */
const enforceTenantStatus = async (req, res, next) => {
    if (!req.user || !req.user.tenantId) {
        return next();
    }

    try {
        const tenant = await billingRepository.getTenant(req.user.tenantId);

        if (!tenant) {
            return res.status(403).json({ error: 'Tenant record not found' });
        }

        if (tenant.status === 'suspended') {
            return res.status(403).json({
                error: {
                    message: 'Your organization is suspended. Please contact support or resolve billing issues.',
                    code: 'TENANT_SUSPENDED'
                }
            });
        }

        if (tenant.status === 'churned') {
            return res.status(403).json({
                error: {
                    message: 'Your organization account is closed.',
                    code: 'TENANT_CHURNED'
                }
            });
        }

        next();
    } catch (err) {
        next(err);
    }
};

module.exports = { enforceTenantStatus };
