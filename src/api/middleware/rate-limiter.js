'use strict';

const config = require('../../config');
const logger = require('../../core/logger');

// Simple in-memory storage for rate limiting
const ipHits = new Map();
const tenantHits = new Map();

/**
 * Basic rate limiting middleware.
 */
const rateLimiter = (req, res, next) => {
    const now = Date.now();
    const windowMs = config.api.rateLimit.windowMs;

    // 1. IP-based limiting
    const ip = req.ip;
    const ipData = ipHits.get(ip) || { count: 0, resetAt: now + windowMs };

    if (now > ipData.resetAt) {
        ipData.count = 1;
        ipData.resetAt = now + windowMs;
    } else {
        ipData.count++;
    }
    ipHits.set(ip, ipData);

    if (ipData.count > config.api.rateLimit.maxRequestsPerIp) {
        logger.warn({ ip, count: ipData.count }, 'IP Rate limit exceeded');
        return res.status(429).json({ error: 'Too many requests from this IP' });
    }

    // 2. Tenant-based limiting (if authorized)
    if (req.user?.tenantId) {
        const tenantId = req.user.tenantId;
        const tenantData = tenantHits.get(tenantId) || { count: 0, resetAt: now + windowMs };

        if (now > tenantData.resetAt) {
            tenantData.count = 1;
            tenantData.resetAt = now + windowMs;
        } else {
            tenantData.count++;
        }
        tenantHits.set(tenantId, tenantData);

        if (tenantData.count > config.api.rateLimit.maxRequestsPerTenant) {
            logger.warn({ tenantId, count: tenantData.count }, 'Tenant Rate limit exceeded');
            return res.status(429).json({ error: 'Organization rate limit exceeded' });
        }
    }

    next();
};

// Cleanup interval to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of ipHits) {
        if (now > data.resetAt) ipHits.delete(ip);
    }
    for (const [tenant, data] of tenantHits) {
        if (now > data.resetAt) tenantHits.delete(tenant);
    }
}, 60000);

module.exports = rateLimiter;
