'use strict';

const logger = require('../../core/logger');

/**
 * Stub for Policy Enforcement Engine.
 */
class PolicyStub {
    /**
     * Evaluates an expense against tenant policies.
     * @param {string} tenantId 
     * @param {Object} expense 
     * @returns {Promise<{ pass: boolean, warnings: string[], violations: string[] }>}
     */
    async evaluate(tenantId, expense) {
        logger.debug({ tenantId, expenseId: expense.expense_id }, 'Executing policy stub evaluation');

        // For now, everything passes.
        return {
            pass: true,
            warnings: [],
            violations: []
        };
    }
}

module.exports = new PolicyStub();
