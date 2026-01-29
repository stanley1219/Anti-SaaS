'use strict';

const billingRepository = require('./billing-repository');
const auditService = require('../../core/audit/audit-service');
const logger = require('../../core/logger');
const { ValidationError, ForbiddenError, NotFoundError } = require('../../core/errors');

class BillingService {
    /**
     * Get current subscription for a tenant.
     */
    async getSubscription(tenantId) {
        return billingRepository.getSubscription(tenantId);
    }

    /**
     * Get all available subscription plans.
     */
    async getPlans() {
        return billingRepository.getPlans();
    }

    /**
     * Record usage of a specific metric (e.g. expenses_created).
     */
    async recordUsage(tenantId, metric, amount = 1) {
        const period = new Date().toISOString().slice(0, 7); // YYYY-MM
        await billingRepository.incrementUsage(tenantId, metric, period, amount);
    }

    /**
     * Suspend a tenant (e.g. for non-payment).
     */
    async suspendTenant(tenantId, reason) {
        const tenant = await billingRepository.getTenant(tenantId);
        if (!tenant) throw new NotFoundError('Tenant not found');

        const subscription = await billingRepository.getSubscription(tenantId);
        if (!subscription) throw new NotFoundError('Subscription not found');

        await billingRepository.updateTenantStatus(tenantId, 'suspended');
        await billingRepository.updateSubscriptionStatus(tenantId, subscription.subscription_id, 'past_due');

        await auditService.log({
            tenantId,
            userId: 'SYSTEM',
            action: 'TENANT_SUSPENDED',
            entityType: 'tenant',
            entityId: tenantId,
            metadata: { reason }
        });

        logger.info({ tenantId, reason }, 'Tenant suspended');
    }

    /**
     * Reactivate a suspended tenant.
     */
    async reactivateTenant(tenantId) {
        await billingRepository.updateTenantStatus(tenantId, 'active');

        await auditService.log({
            tenantId,
            userId: 'SYSTEM',
            action: 'TENANT_REACTIVATED',
            entityType: 'tenant',
            entityId: tenantId
        });
    }

    /**
     * Check if a tenant has exceeded their plan limits.
     */
    async checkLimits(tenantId, metric) {
        const subscription = await billingRepository.getSubscription(tenantId);
        if (!subscription) return true; // Default to pass if no sub

        const limits = subscription.plan_config?.limits || {};
        const limit = limits[metric];
        if (limit === undefined) return true; // No limit for this metric

        const period = new Date().toISOString().slice(0, 7);
        // Note: We'd need a query to get current usage for the period
        // For now, assume a check against a usage view or similar
        return true;
    }
}

module.exports = new BillingService();
