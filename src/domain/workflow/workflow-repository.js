'use strict';

const { tenantQuery } = require('../../core/database/tenant-query');

class WorkflowRepository {
    /**
     * Find the applicable workflow definition for a tenant or specific criteria.
     * Simple implementation: find the first active workflow for the tenant.
     */
    async findActiveWorkflow(tenantId) {
        const query = `
      SELECT * FROM approval_workflows 
      WHERE tenant_id = $1 AND active = true 
      ORDER BY priority DESC LIMIT 1
    `;
        const result = await tenantQuery(tenantId, query, [tenantId]);
        return result.rows[0];
    }

    /**
     * Create an approval chain (materialized workflow) for an expense.
     */
    async createApprovalChain(tenantId, expenseId, workflowId, client = null) {
        const query = `
      INSERT INTO approval_chains (tenant_id, expense_id, workflow_id, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING chain_id
    `;
        const db = client || { query: (...args) => tenantQuery(tenantId, ...args) };
        const result = await db.query(query, [tenantId, expenseId, workflowId]);
        return result.rows[0].chain_id;
    }

    /**
     * Add a step to an approval chain.
     */
    async createApprovalStep(tenantId, chainId, approverUserId, sequence, client = null) {
        const query = `
      INSERT INTO approval_steps (tenant_id, chain_id, approver_user_id, sequence, status)
      VALUES ($1, $2, $3, $4, 'pending')
    `;
        const db = client || { query: (...args) => tenantQuery(tenantId, ...args) };
        await db.query(query, [tenantId, chainId, approverUserId, sequence]);
    }

    /**
     * Get the current pending step for an approval chain.
     */
    async getNextPendingStep(tenantId, chainId) {
        const query = `
      SELECT * FROM approval_steps
      WHERE tenant_id = $1 AND chain_id = $2 AND status = 'pending'
      ORDER BY sequence ASC
      LIMIT 1
    `;
        const result = await tenantQuery(tenantId, query, [tenantId, chainId]);
        return result.rows[0];
    }

    /**
     * Find an approval chain by expense ID.
     */
    async findChainByExpenseId(tenantId, expenseId) {
        const query = `
      SELECT * FROM approval_chains
      WHERE tenant_id = $1 AND expense_id = $2
    `;
        const result = await tenantQuery(tenantId, query, [tenantId, expenseId]);
        return result.rows[0];
    }

    /**
     * Get steps for a chain.
     */
    async getChainSteps(tenantId, chainId) {
        const query = `
      SELECT * FROM approval_steps
      WHERE tenant_id = $1 AND chain_id = $2
      ORDER BY sequence ASC
    `;
        const result = await tenantQuery(tenantId, query, [tenantId, chainId]);
        return result.rows;
    }

    /**
     * Update step status.
     */
    async updateStepStatus(tenantId, stepId, status, client = null) {
        const query = `
      UPDATE approval_steps
      SET status = $3, updated_at = NOW()
      WHERE tenant_id = $1 AND step_id = $2
    `;
        const db = client || { query: (...args) => tenantQuery(tenantId, ...args) };
        await db.query(query, [tenantId, stepId, status]);
    }

    /**
     * Update chain status.
     */
    async updateChainStatus(tenantId, chainId, status, client = null) {
        const query = `
      UPDATE approval_chains
      SET status = $3, updated_at = NOW()
      WHERE tenant_id = $1 AND chain_id = $2
    `;
        const db = client || { query: (...args) => tenantQuery(tenantId, ...args) };
        await db.query(query, [tenantId, chainId, status]);
    }

    /**
     * Create an approval action record.
     */
    async createAction(tenantId, stepId, userId, decision, comment, client = null) {
        const query = `
      INSERT INTO approval_actions (tenant_id, step_id, approver_user_id, decision, comment)
      VALUES ($1, $2, $3, $4, $5)
    `;
        const db = client || { query: (...args) => tenantQuery(tenantId, ...args) };
        await db.query(query, [tenantId, stepId, userId, decision, comment]);
    }

    /**
     * List pending steps for a user.
     */
    async findPendingStepsForUser(tenantId, userId) {
        const query = `
      SELECT s.*, e.amount, e.currency, e.merchant, e.user_id as requester_id
      FROM approval_steps s
      JOIN approval_chains c ON s.chain_id = c.chain_id AND s.tenant_id = c.tenant_id
      JOIN expenses e ON c.expense_id = e.expense_id AND c.tenant_id = e.tenant_id
      WHERE s.tenant_id = $1 AND s.approver_user_id = $2 AND s.status = 'pending'
      AND c.status = 'pending'
      ORDER BY s.created_at ASC
    `;
        const result = await tenantQuery(tenantId, query, [tenantId, userId]);
        return result.rows;
    }
}

module.exports = new WorkflowRepository();
