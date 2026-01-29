'use strict';

const logger = require('../../core/logger');
const config = require('../../config');

/**
 * Standardized response and slow request logging middleware.
 */
const responseLogger = (req, res, next) => {
    const start = Date.now();

    // Standardize success response helper
    res.success = (data, statusCode = 200) => {
        res.status(statusCode).json({
            status: 'success',
            data,
            metadata: {
                requestId: req.id,
                timestamp: new Date().toISOString()
            }
        });
    };

    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            requestId: req.id,
            tenantId: req.user?.tenantId,
            userId: req.user?.id,
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            duration: `${duration}ms`
        };

        if (duration > config.api.slowRequestThresholdMs) {
            logger.warn(logData, 'Slow request detected');
        } else {
            logger.debug(logData, 'Request processed');
        }
    });

    next();
};

module.exports = responseLogger;
