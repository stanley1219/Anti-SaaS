'use strict';

const db = require('./pool');
const logger = require('../logger');

/**
 * Strict tenant-aware query executor.
 * 
 * Enforces that a tenantId is present for all operations.
 * Relies on the repository layer to provide correctly filtered SQL 
 * (including tenant_id and deleted_at conditions).
 * 
 * @param {string} tenantId - The UUID of the tenant
 * @param {string} text - The SQL query
 * @param {Array} params - The query parameters
 * @param {Object} options - Optional configuration (maintained for signature compatibility)
 * @returns {Promise<import('pg').QueryResult>}
 */
const tenantQuery = async (tenantId, text, params = [], options = {}) => {
    if (!tenantId) {
        throw new Error('TENANT_ISOLATION_VIOLATION: tenant_id is required for all data operations');
    }

    try {
        return await db.query(text, params);
    } catch (err) {
        logger.error({
            err,
            tenantId,
            query: text,
            params
        }, 'Tenant query failed');
        throw err;
    }
};

/**
 * System-level query executor (bypasses tenant isolation checks).
 * Use only for cross-tenant operations or system maintenance.
 * 
 * @param {string} text - The SQL query
 * @param {Array} params - The query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
const systemQuery = async (text, params = []) => {
    return db.query(text, params);
};

module.exports = {
    tenantQuery,
    systemQuery,
};
