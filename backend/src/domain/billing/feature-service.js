'use strict';

const billingRepository = require('./billing-repository');
const logger = require('../../core/logger');

class FeatureService {
    /**
     * Check if a specific feature is enabled for a tenant based on their plan.
     */
    async isFeatureEnabled(tenantId, featureKey) {
        const subscription = await billingRepository.getSubscription(tenantId);
        if (!subscription) {
            // Default features for tenants without subscriptions (e.g. basic free)
            return this.getLegacyDefaults(featureKey);
        }

        const enabledFeatures = subscription.plan_config?.features || [];
        const isEnabled = enabledFeatures.includes(featureKey);

        logger.debug({ tenantId, featureKey, isEnabled }, 'Feature gate check');
        return isEnabled;
    }

    /**
     * Get all enabled features for a tenant.
     */
    async getEnabledFeatures(tenantId) {
        const subscription = await billingRepository.getSubscription(tenantId);
        if (!subscription) return [];
        return subscription.plan_config?.features || [];
    }

    getLegacyDefaults(featureKey) {
        // Define baseline features for the platform
        const defaults = ['core_expenses', 'basic_approvals'];
        return defaults.includes(featureKey);
    }
}

module.exports = new FeatureService();
