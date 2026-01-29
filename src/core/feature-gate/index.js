'use strict';

const { ForbiddenError } = require('../errors');
const logger = require('../logger');

/**
 * Lightweight feature-gating mechanism.
 * 
 * Rules:
 * - Fail fast: Call at service entry.
 * - Non-bypassable: Re-assert inside domain logic if needed.
 */
class FeatureGate {
    /**
     * Assert that a feature is enabled for a tenant.
     * 
     * @param {string} tenantId 
     * @param {string} featureKey 
     * @param {Object} context - Optional context (userId, etc.)
     */
    async assertEnabled(tenantId, featureKey, context = {}) {
        const isEnabled = await this.isEnabled(tenantId, featureKey, context);

        if (!isEnabled) {
            logger.warn({ tenantId, featureKey, ...context }, 'Feature gate access denied');
            throw new ForbiddenError(`Feature '${featureKey}' is not enabled for your plan`);
        }
    }

    /**
     * Check if a feature is enabled (returns boolean).
     */
    async isEnabled(tenantId, featureKey, context = {}) {
        // In a real system, this would query a dedicated features table or 
        // a cached plan configuration. 
        // For this hardening pass, we implement a safe default: everything but OCR is enabled.

        if (featureKey === 'ocr' || featureKey === 'ai_automation') {
            // Mock: Only certain tenants have OCR for now
            // (In reality, this would check the 'subscription_plans' Tier)
            return false;
        }

        return true;
    }
}

module.exports = new FeatureGate();
