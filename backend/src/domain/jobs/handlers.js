'use strict';

const logger = require('../../core/logger');

/**
 * Stub for OCR processing.
 */
async function handleOcr(job) {
    const { tenantId, payload } = job;
    logger.info({ tenantId, expenseId: payload.expenseId }, 'Stub: Processing receipt OCR');

    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 2000));

    logger.info({ tenantId, expenseId: payload.expenseId }, 'Stub: OCR processing complete');
}

/**
 * Stub for report generation.
 */
async function handleReport(job) {
    const { tenantId, payload } = job;
    logger.info({ tenantId, reportType: payload.type }, 'Stub: Generating scheduled report');

    await new Promise(resolve => setTimeout(resolve, 3000));

    logger.info({ tenantId, reportType: payload.type }, 'Stub: Report generation complete');
}

/**
 * Stub for billing cycle execution.
 */
async function handleBilling(job) {
    const { tenantId } = job;
    logger.info({ tenantId }, 'Stub: Executing billing cycle');

    await new Promise(resolve => setTimeout(resolve, 1500));

    logger.info({ tenantId }, 'Stub: Billing cycle complete');
}

module.exports = {
    ocr: handleOcr,
    report: handleReport,
    billing: handleBilling,
};
