'use strict';

const tenantRepository = require('./tenant-repository');
const userRepository = require('../user/user-repository');
const authService = require('../auth/auth-service');
const roleService = require('../auth/role-service');
const db = require('../../core/database/pool');
const { ConflictError } = require('../../core/errors');

/**
 * Service for orchestrating Tenant operations.
 */
class TenantService {
    /**
     * Create a new tenant and initialize its first administrator.
     */
    async createTenantWithAdmin(tenantData, adminData) {
        // 1. Check if slug is unique
        const existing = await tenantRepository.findBySlug(tenantData.slug);
        if (existing) {
            throw new ConflictError('Tenant with this slug already exists');
        }

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            // 2. Create Tenant
            const tenant = await tenantRepository.create({
                name: tenantData.name,
                slug: tenantData.slug
            });

            // 3. Create Admin User
            const passwordHash = await authService.hashPassword(adminData.password);
            const user = await userRepository.createUser(tenant.tenant_id, {
                email: adminData.email,
                passwordHash
            });

            // 4. Assign Tenant Root Admin Role
            // The role_id for TENANT_ROOT_ADMIN is fixed in migration 008
            const TRA_ROLE_ID = '00000000-0000-0000-0000-000000000002';
            await userRepository.assignUserRole(tenant.tenant_id, user.user_id, TRA_ROLE_ID);

            await client.query('COMMIT');
            return { tenant, admin: user };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Update tenant status.
     */
    async updateTenantStatus(tenantId, status) {
        return tenantRepository.updateStatus(tenantId, status);
    }

    /**
     * Revoke Tenant Root Admin role.
     */
    async revokeTenantRootAdmin(tenantId, adminId, assignerUser) {
        // Hardcoded TRA Role ID
        const TRA_ROLE_ID = '00000000-0000-0000-0000-000000000002';
        return roleService.revokeRole(tenantId, assignerUser, adminId, TRA_ROLE_ID);
    }

    /**
     * List all tenants.
     */
    async listTenants() {
        return tenantRepository.listAll();
    }
}

module.exports = new TenantService();
