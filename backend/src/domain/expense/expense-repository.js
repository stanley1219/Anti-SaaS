'use strict';

const { tenantQuery } = require('../../core/database/tenant-query');

/**
 * Repository for Expense data access.
 * Enforces tenant isolation and soft deletes.
 */
class ExpenseRepository {
    async create(tenantId, data) {
        const { userId, amount, currency, categoryId, merchant, date, description, status = 'DRAFT' } = data;

        const query = `
      INSERT INTO expenses (
        tenant_id, user_id, amount, currency, category_id, merchant, date, description, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

        const result = await tenantQuery(tenantId, query, [
            tenantId, userId, amount, currency, categoryId, merchant, date, description, status
        ]);

        return result.rows[0];
    }

    async findById(tenantId, expenseId) {
        const query = `
      SELECT * FROM expenses 
      WHERE tenant_id = $1 AND expense_id = $2 AND deleted_at IS NULL
    `;
        const result = await tenantQuery(tenantId, query, [tenantId, expenseId]);
        return result.rows[0];
    }

    /**
     * Find an expense and lock the row for the duration of the transaction.
     */
    async findByIdForUpdate(client, tenantId, expenseId) {
        const query = `
      SELECT * FROM expenses 
      WHERE tenant_id = $1 AND expense_id = $2 AND deleted_at IS NULL
      FOR UPDATE
    `;
        const result = await client.query(query, [tenantId, expenseId]);
        return result.rows[0];
    }

    async update(tenantId, expenseId, data) {
        const { amount, currency, categoryId, merchant, date, description } = data;

        // Status update protection: Reject any attempt to update status directly through this method
        if (data.status) {
            throw new Error('Direct status updates not permitted through repository.update()');
        }

        const query = `
      UPDATE expenses
      SET amount = COALESCE($3, amount),
          currency = COALESCE($4, currency),
          category_id = COALESCE($5, category_id),
          merchant = COALESCE($6, merchant),
          date = COALESCE($7, date),
          description = COALESCE($8, description),
          updated_at = NOW()
      WHERE tenant_id = $1 AND expense_id = $2 AND deleted_at IS NULL
      RETURNING *
    `;

        const result = await tenantQuery(tenantId, query, [
            tenantId, expenseId, amount, currency, categoryId, merchant, date, description
        ]);

        return result.rows[0];
    }

    /**
     * Internal method explicitly for status changes only.
     */
    async updateStatus(tenantId, expenseId, status, client = null) {
        const query = `
      UPDATE expenses
      SET status = $3, updated_at = NOW()
      WHERE tenant_id = $1 AND expense_id = $2 AND deleted_at IS NULL
      RETURNING *
    `;
        const res = client
            ? await client.query(query, [tenantId, expenseId, status])
            : await tenantQuery(tenantId, query, [tenantId, expenseId, status]);

        return res.rows[0];
    }

    async softDelete(tenantId, expenseId) {
        const query = `
      UPDATE expenses
      SET deleted_at = NOW()
      WHERE tenant_id = $1 AND expense_id = $2
    `;
        await tenantQuery(tenantId, query, [tenantId, expenseId]);
    }

    async list(tenantId, filters = {}) {
        const { userId, status, limit = 20, offset = 0 } = filters;
        const params = [tenantId];
        let query = `
      SELECT * FROM expenses
      WHERE tenant_id = $1 AND deleted_at IS NULL
    `;

        if (userId) {
            params.push(userId);
            query += ` AND user_id = $${params.length}`;
        }

        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        // Always append limit and offset after filters
        params.push(limit);
        const limitIndex = params.length;
        params.push(offset);
        const offsetIndex = params.length;

        query += ` ORDER BY created_at DESC LIMIT $${limitIndex} OFFSET $${offsetIndex}`;

        const result = await tenantQuery(tenantId, query, params);
        return {
            data: result.rows,
            limit,
            offset
        };
    }

    /**
     * Specifically for submission idempotency check
     */
    async getStatus(tenantId, expenseId) {
        const query = `SELECT status FROM expenses WHERE tenant_id = $1 AND expense_id = $2`;
        const result = await tenantQuery(tenantId, query, [tenantId, expenseId]);
        return result.rows[0]?.status;
    }
}

module.exports = new ExpenseRepository();
