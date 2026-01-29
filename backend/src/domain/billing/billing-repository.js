'use strict';

const { tenantQuery, systemQuery } = require('../../core/database/tenant-query');

class BillingRepository {
    /**
     * Get global subscription plans (system-level, not tenant-scoped).
     */
    async getPlans() {
        const query = 'SELECT * FROM subscription_plans ORDER BY tier ASC';
        const result = await systemQuery(query);
        return result.rows;
    }

    /**
     * Get current subscription for a tenant.
     */
    async getSubscription(tenantId) {
        const query = `
      SELECT s.*, p.name as plan_name, p.config as plan_config
      FROM subscriptions s
      JOIN subscription_plans p ON s.plan_id = p.plan_id
      WHERE s.tenant_id = $1
      LIMIT 1
    `;
        const result = await tenantQuery(tenantId, query, [tenantId]);
        return result.rows[0];
    }

    /**
     * Update or Create usage record (idempotent upsert).
     */
    async upsertUsage(tenantId, metric, period, value) {
        const query = `
      INSERT INTO usage_records (tenant_id, metric, period, value)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (tenant_id, metric, period)
      DO UPDATE SET value = usage_records.value + EXCLUDED.value, updated_at = NOW()
    `;
        await tenantQuery(tenantId, query, [tenantId, metric, period, value]);
    }

    /**
     * Increment usage record.
     */
    async incrementUsage(tenantId, metric, period, amount = 1) {
        return this.upsertUsage(tenantId, metric, period, amount);
    }

    /**
     * Update subscription status.
     */
    async updateSubscriptionStatus(tenantId, subscriptionId, status, client = null) {
        const query = `
      UPDATE subscriptions SET status = $3, updated_at = NOW()
      WHERE tenant_id = $1 AND subscription_id = $2
      RETURNING *
    `;
        const executor = client || { query: (...args) => tenantQuery(tenantId, ...args) };
        const result = await executor.query(query, [tenantId, subscriptionId, status]);
        return result.rows[0];
    }

    /**
     * Update tenant status in the main tenants table (system-level operation).
     */
    async updateTenantStatus(tenantId, status, client = null) {
        const query = `UPDATE tenants SET status = $2, updated_at = NOW() WHERE tenant_id = $1`;
        const executor = client || { query: (...args) => systemQuery(...args) };
        await executor.query(query, [tenantId, status]);
    }

    /**
     * Get tenant metadata including status (system-level read).
     */
    async getTenant(tenantId) {
        const query = 'SELECT * FROM tenants WHERE tenant_id = $1';
        const result = await systemQuery(query, [tenantId]);
        return result.rows[0];
    }
}

module.exports = new BillingRepository();
