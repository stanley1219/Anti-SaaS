'use strict';

const { tenantQuery } = require('../database/tenant-query');
const logger = require('../logger');

/**
 * Service for recording immutable audit logs.
 */
class AuditService {
    /**
     * Log a business event.
     * @param {Object} params
     * @param {string} params.tenantId
     * @param {string} params.userId
     * @param {string} params.action - e.g., 'EXPENSE_CREATE', 'EXPENSE_SUBMIT'
     * @param {string} params.entityType - e.g., 'expense'
     * @param {string} params.entityId
     * @param {Object} [params.metadata] - Extra context info
     */
    async log(params) {
        const { tenantId, userId, action, entityType, entityId, metadata = {} } = params;

        try {
            const query = `
        INSERT INTO audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;

            await tenantQuery(tenantId, query, [
                tenantId,
                userId,
                action,
                entityType,
                entityId,
                JSON.stringify(metadata)
            ]);

            logger.info({
                tenantId,
                userId,
                action,
                entityType,
                entityId
            }, 'Audit log recorded');
        } catch (err) {
            // We log the failure but usually don't want to crash the business transaction
            // if the audit log fails unless it's a strict requirement.
            logger.error({ err, params }, 'Failed to record audit log');
        }
    }
}

module.exports = new AuditService();
