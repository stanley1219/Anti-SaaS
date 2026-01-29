'use strict';

const logger = require('../../core/logger');

const config = require('../../config');

const errorHandler = (err, req, res, next) => {
    const statusCode = err.status || 500;
    const isProd = config.env === 'production';

    const errorResponse = {
        error: {
            message: statusCode === 500 && isProd ? 'An internal error occurred' : err.message,
            code: err.code || 'INTERNAL_ERROR',
            requestId: req.id,
            timestamp: new Date().toISOString()
        }
    };

    // Correlation metadata
    const logContext = {
        err,
        requestId: req.id,
        tenantId: req.user?.tenantId,
        userId: req.user?.id,
        method: req.method,
        url: req.url,
    };

    if (statusCode >= 500) {
        logger.error(logContext, 'Server error');
    } else {
        logger.warn(logContext, 'Client error');
    }

    // Attach stack trace only in development
    if (!isProd && statusCode === 500) {
        errorResponse.error.stack = err.stack;
    }

    res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;
