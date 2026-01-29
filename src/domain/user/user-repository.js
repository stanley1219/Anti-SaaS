'use strict';

const db = require('../../core/database/pool');
const { tenantQuery } = require('../../core/database/tenant-query');

/**
 * Repository for User-related database operations.
 * Strictly enforces tenant isolation.
 */
class UserRepository {
  /**
   * Find a user by email within a specific tenant.
   * @param {string} tenantId 
   * @param {string} email 
   */
  async findByEmail(tenantId, email) {
    const query = `
      SELECT user_id, tenant_id, email, password_hash, status
      FROM users
      WHERE tenant_id = $1 AND email = $2 AND deleted_at IS NULL
    `;
    const result = await tenantQuery(tenantId, query, [tenantId, email]);
    return result.rows[0];
  }

  /**
   * Find a user by ID within a specific tenant.
   * @param {string} tenantId 
   * @param {string} userId 
   */
  async findById(tenantId, userId) {
    const query = `
      SELECT user_id, tenant_id, email, status
      FROM users
      WHERE tenant_id = $1 AND user_id = $2 AND deleted_at IS NULL
    `;
    const result = await tenantQuery(tenantId, query, [tenantId, userId]);
    return result.rows[0];
  }

  /**
   * Get all permissions for a user across their assigned roles within a tenant.
   * Supports both tenant-specific and system-level roles.
   * @param {string} tenantId 
   * @param {string} userId 
   */
  async getUserPermissions(tenantId, userId) {
    const query = `
      SELECT DISTINCT rp.permission_key
      FROM user_roles ur
      JOIN role_permissions rp ON ur.role_id = rp.role_id
      WHERE ur.tenant_id = $1 AND ur.user_id = $2
      AND (rp.tenant_id = ur.tenant_id OR rp.tenant_id = '00000000-0000-0000-0000-000000000000')
    `;
    const result = await tenantQuery(tenantId, query, [tenantId, userId]);
    return result.rows.map(row => row.permission_key);
  }

  /**
   * Get all roles assigned to a user with their hierarchy metadata.
   * @param {string} tenantId 
   * @param {string} userId 
   */
  async getUserRoles(tenantId, userId) {
    const query = `
      SELECT r.role_id, r.name, r.role_level, r.is_system_role
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.role_id
      WHERE ur.tenant_id = $1 AND ur.user_id = $2
    `;
    const result = await tenantQuery(tenantId, query, [tenantId, userId]);
    return result.rows;
  }

  /**
   * Find a role by its ID.
   * @param {string} roleId 
   */
  async getRoleById(roleId) {
    const query = `
      SELECT role_id, tenant_id, name, role_level, is_system_role, can_assign_roles
      FROM roles
      WHERE role_id = $1
    `;
    // Using systemQuery if we don't know the tenant, or we can use tenantQuery with a null/0000 tenant
    const result = await db.query(query, [roleId]);
    return result.rows[0];
  }

  /**
   * Store a refresh token for a user.
   */
  async saveRefreshToken(tenantId, userId, tokenId, tokenHash, expiresAt, replacedBy = null) {
    const query = `
      INSERT INTO refresh_tokens (tenant_id, token_id, user_id, token_hash, expires_at, replaced_by)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await tenantQuery(tenantId, query, [tenantId, tokenId, userId, tokenHash, expiresAt, replacedBy]);
  }

  /**
   * Find a refresh token by its ID.
   */
  async findRefreshToken(tenantId, tokenId) {
    const query = `
      SELECT token_id, tenant_id, user_id, token_hash, expires_at, revoked_at, replaced_by
      FROM refresh_tokens
      WHERE tenant_id = $1 AND token_id = $2
    `;
    const result = await tenantQuery(tenantId, query, [tenantId, tokenId]);
    return result.rows[0];
  }

  /**
   * Mark a token as replaced by another.
   */
  async replaceRefreshToken(tenantId, tokenId, replacementId) {
    const query = `
      UPDATE refresh_tokens
      SET replaced_by = $3, revoked_at = NOW()
      WHERE tenant_id = $1 AND token_id = $2
    `;
    await tenantQuery(tenantId, query, [tenantId, tokenId, replacementId]);
  }

  /**
   * Revoke an entire token chain for a user (Security Breach Handling).
   */
  async revokeAllUserTokens(tenantId, userId) {
    const query = `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL
    `;
    await tenantQuery(tenantId, query, [tenantId, userId]);
  }

  /**
   * Revoke a specific refresh token.
   */
  async revokeRefreshToken(tenantId, tokenId) {
    const query = `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE tenant_id = $1 AND token_id = $2
    `;
    await tenantQuery(tenantId, query, [tenantId, tokenId]);
  }
  /**
   * Assign a role to a user.
   */
  async assignUserRole(tenantId, userId, roleId) {
    const query = `
      INSERT INTO user_roles (tenant_id, user_id, role_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (tenant_id, user_id, role_id) DO NOTHING
    `;
    await tenantQuery(tenantId, query, [tenantId, userId, roleId]);
  }

  /**
   * Remove a role from a user.
   */
  async removeUserRole(tenantId, userId, roleId) {
    const query = `
      DELETE FROM user_roles
      WHERE tenant_id = $1 AND user_id = $2 AND role_id = $3
    `;
    await tenantQuery(tenantId, query, [tenantId, userId, roleId]);
  }

  /**
   * List all users within a tenant.
   * @param {string} tenantId 
   */
  async listUsersByTenant(tenantId) {
    const query = `
      SELECT user_id, email, status, created_at
      FROM users
      WHERE tenant_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    const result = await tenantQuery(tenantId, query, [tenantId]);
    return result.rows;
  }

  /**
   * Create a new user.
   */
  async createUser(tenantId, { email, passwordHash, status = 'active' }) {
    const query = `
      INSERT INTO users (tenant_id, email, password_hash, status)
      VALUES ($1, $2, $3, $4)
      RETURNING user_id, tenant_id, email, status
    `;
    const result = await tenantQuery(tenantId, query, [tenantId, email, passwordHash, status]);
    return result.rows[0];
  }

  /**
   * Update an existing user.
   */
  async updateUser(tenantId, userId, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);

    if (fields.length === 0) return null;

    const setClause = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
    const query = `
      UPDATE users 
      SET ${setClause}, updated_at = NOW()
      WHERE tenant_id = $1 AND user_id = $2 AND deleted_at IS NULL
      RETURNING user_id, email, status
    `;

    const result = await tenantQuery(tenantId, query, [tenantId, userId, ...values]);
    return result.rows[0];
  }

  /**
   * Soft delete a user.
   */
  async deleteUser(tenantId, userId) {
    const query = `
      UPDATE users 
      SET deleted_at = NOW(), status = 'inactive'
      WHERE tenant_id = $1 AND user_id = $2
    `;
    await tenantQuery(tenantId, query, [tenantId, userId]);
  }

  /**
   * List available roles for a tenant (including system roles).
   */
  async listRolesByTenant(tenantId) {
    const query = `
      SELECT role_id, name, description, role_level, is_system_role
      FROM roles
      WHERE tenant_id = $1 OR tenant_id = '00000000-0000-0000-0000-000000000000'
      ORDER BY role_level ASC
    `;
    const result = await tenantQuery(tenantId, query, [tenantId]);
    return result.rows;
  }
}

module.exports = new UserRepository();
