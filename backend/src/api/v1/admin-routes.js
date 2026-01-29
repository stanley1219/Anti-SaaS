'use strict';

const express = require('express');
const roleService = require('../../domain/auth/role-service');
const tenantService = require('../../domain/tenant/tenant-service');
const userRepository = require('../../domain/user/user-repository');
const { requireRoleLevel } = require('../../api/middleware/auth');
const { validate } = require('../../api/middleware/validator');
const { ValidationError } = require('../../core/errors');

const router = express.Router();

/**
 * 1. SYSTEM-LEVEL ROUTES (Universal Root Admin only: level 0)
 */

// List all tenants
router.get('/tenants', requireRoleLevel(0), async (req, res, next) => {
    try {
        const tenants = await tenantService.listTenants();
        res.success(tenants);
    } catch (err) {
        next(err);
    }
});

// Create tenant + first admin
router.post('/tenants', requireRoleLevel(0), async (req, res, next) => {
    try {
        const { tenant, admin } = req.body;
        if (!tenant || !admin) {
            throw new ValidationError('Tenant and Admin data are required');
        }
        const result = await tenantService.createTenantWithAdmin(tenant, admin);
        res.success(result);
    } catch (err) {
        next(err);
    }
});

// Update tenant status (Disable/Enable)
router.patch('/tenants/:id/status', requireRoleLevel(0), async (req, res, next) => {
    try {
        const { status } = req.body;
        const tenant = await tenantService.updateTenantStatus(req.params.id, status);
        res.success(tenant);
    } catch (err) {
        next(err);
    }
});

// Revoke Tenant Root Admin
router.delete('/tenants/:id/admin', requireRoleLevel(0), async (req, res, next) => {
    try {
        const { adminId } = req.body; // Pass adminId to match correct user
        await tenantService.revokeTenantRootAdmin(req.params.id, adminId, req.user);
        res.success({ message: 'Tenant Root Admin revoked' });
    } catch (err) {
        next(err);
    }
});

/**
 * 2. TENANT-LEVEL ADMIN ROUTES
 * Restricted by Privacy Guarantee: URA (level 0) CANNOT access these.
 */

// Middleware to block Level 0 from tenant routes
const blockSystemAdmin = (req, res, next) => {
    if (req.user.primaryRole?.level === 0) {
        return res.status(403).json({ error: 'System administrators cannot access tenant data directly' });
    }
    next();
};

// GET /users: Accessible by level 1 and 2
router.get('/users', blockSystemAdmin, requireRoleLevel(2), async (req, res, next) => {
    try {
        const users = await userRepository.listUsersByTenant(req.user.tenantId);
        res.success(users);
    } catch (err) {
        next(err);
    }
});

// Write operations: Accessible by level 1 only
router.post('/users', blockSystemAdmin, requireRoleLevel(1), async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const authService = require('../../domain/auth/auth-service');
        const passwordHash = await authService.hashPassword(password);

        const user = await userRepository.createUser(req.user.tenantId, {
            email,
            passwordHash
        });
        res.success(user);
    } catch (err) {
        next(err);
    }
});

router.patch('/users/:id', blockSystemAdmin, requireRoleLevel(1), async (req, res, next) => {
    try {
        const user = await userRepository.updateUser(req.user.tenantId, req.params.id, req.body);
        res.success(user);
    } catch (err) {
        next(err);
    }
});

router.delete('/users/:id', blockSystemAdmin, requireRoleLevel(1), async (req, res, next) => {
    try {
        await userRepository.deleteUser(req.user.tenantId, req.params.id);
        res.success({ message: 'User deleted successfully' });
    } catch (err) {
        next(err);
    }
});

/**
 * 3. ROLE ASSIGNMENT ROUTES (Tenant Root Admin only: level 1)
 */

router.get('/roles', blockSystemAdmin, requireRoleLevel(2), async (req, res, next) => {
    try {
        const roles = await userRepository.listRolesByTenant(req.user.tenantId);
        res.success(roles);
    } catch (err) {
        next(err);
    }
});

router.post('/users/:id/roles', blockSystemAdmin, requireRoleLevel(1), async (req, res, next) => {
    try {
        const { roleId } = req.body;
        await roleService.assignRole(req.user.tenantId, req.user, req.params.id, roleId);
        res.success({ message: 'Role assigned successfully' });
    } catch (err) {
        next(err);
    }
});

router.delete('/users/:id/roles/:roleId', blockSystemAdmin, requireRoleLevel(1), async (req, res, next) => {
    try {
        await roleService.revokeRole(req.user.tenantId, req.user, req.params.id, req.params.roleId);
        res.success({ message: 'Role revoked successfully' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
