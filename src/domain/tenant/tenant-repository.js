'use strict';

const db = require('../../core/database/pool');
const { systemQuery } = require('../../core/database/tenant-query');

/**
 * Repository for Tenant-related database operations.
 */
class TenantRepository {
    /**
     * List all tenants in the system with their primary root admin.
     */
    async listAll() {
        const query = `
            SELECT 
                t.tenant_id, 
                t.name, 
                u.email as admin_email, 
                u.user_id as admin_id
            FROM tenants t
            LEFT JOIN users u ON t.tenant_id = u.tenant_id
            LEFT JOIN user_roles ur ON u.user_id = ur.user_id AND u.tenant_id = ur.tenant_id
            LEFT JOIN roles r ON ur.role_id = r.role_id
            WHERE r.role_level = 1 OR r.role_level IS NULL
            ORDER BY t.created_at DESC
        `;
        const result = await systemQuery(query);
        return result.rows;
    }

    /**
     * Create a new tenant.
     */
    async create({ name, slug, status = 'active' }) {
        const query = `
            INSERT INTO tenants (name, slug, status)
            VALUES ($1, $2, $3)
            RETURNING *
        `;
        const result = await systemQuery(query, [name, slug, status]);
        return result.rows[0];
    }

    /**
     * Update tenant status.
     */
    async updateStatus(tenantId, status) {
        const query = `
            UPDATE tenants 
            SET status = $1, updated_at = NOW()
            WHERE tenant_id = $2
            RETURNING *
        `;
        const result = await systemQuery(query, [status, tenantId]);
        return result.rows[0];
    }

    /**
     * Find a tenant by ID.
     */
    async findById(tenantId) {
        const query = 'SELECT * FROM tenants WHERE tenant_id = $1';
        const result = await systemQuery(query, [tenantId]);
        return result.rows[0];
    }

    /**
     * Find a tenant by slug.
     */
    async findBySlug(slug) {
        const query = 'SELECT * FROM tenants WHERE slug = $1';
        const result = await systemQuery(query, [slug]);
        return result.rows[0];
    }
}

module.exports = new TenantRepository();
