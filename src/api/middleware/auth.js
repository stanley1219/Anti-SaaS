'use strict';

const jwt = require('jsonwebtoken');
const config = require('../../config');
const logger = require('../../core/logger');

/**
 * Middleware to authenticate requests via JWT.
 * Injects tenant context and user info into req.user.
 */
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, config.auth.accessSecret);

        // Inject context
        req.user = {
            id: decoded.sub,
            tenantId: decoded.tid,
            permissions: decoded.permissions || [],
            roles: (decoded.roles || []).map(r => ({
                name: r.name,
                level: r.level
            })),
            primaryRole: decoded.primaryRole
        };

        // Ensure tenant_id is available for downstream usage (e.g. audit logging)
        req.tenantId = decoded.tid;

        next();
    } catch (err) {
        logger.debug({ err }, 'JWT verification failed');
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

/**
 * Higher-order middleware to require specific permissions.
 * Must be used after authenticate middleware.
 * @param {string|string[]} requiredPermissions 
 */
const requirePermission = (requiredPermissions) => {
    const permissions = Array.isArray(requiredPermissions)
        ? requiredPermissions
        : [requiredPermissions];

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const hasAllPermissions = permissions.every(p =>
            req.user.permissions.includes(p)
        );

        if (!hasAllPermissions) {
            logger.warn({
                userId: req.user.id,
                tenantId: req.user.tenantId,
                requiredPermissions
            }, 'Access denied: insufficient permissions');

            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        }

        next();
    };
};

/**
 * Middleware to require a minimum role level (lowest number = highest privilege).
 * @param {number} maxLevel 
 */
const requireRoleLevel = (maxLevel) => {
    return (req, res, next) => {
        if (!req.user || !req.user.roles) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const isAuthorized = req.user.roles.some(r => r.level <= maxLevel);

        if (!isAuthorized) {
            logger.warn({
                userId: req.user.id,
                tenantId: req.user.tenantId,
                maxLevel
            }, 'Access denied: insufficient role level');

            return res.status(403).json({ error: 'Forbidden: Insufficient role level' });
        }

        next();
    };
};

module.exports = {
    authenticate,
    requirePermission,
    requireRoleLevel
};
