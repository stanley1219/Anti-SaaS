'use strict';

const userRepository = require('../user/user-repository');
const { ForbiddenError, ValidationError } = require('../../core/errors');
const logger = require('../../core/logger');

class RoleService {

    async assignRole(tenantId, assignerUser, targetUserId, roleId) {
        const roleToAssign = await userRepository.getRoleById(roleId);
        if (!roleToAssign) {
            throw new ValidationError('Role not found');
        }

        const assignerRoles = await userRepository.getUserRoles(
            assignerUser.tenantId,
            assignerUser.id
        );

        const highestAssignerLevel = Math.min(...assignerRoles.map(r => r.role_level));

        /* ─────────────────────────────────────────────
           FIX-4: UNIVERSAL ROOT ADMIN HARD RESTRICTION
        ───────────────────────────────────────────── */

        if (highestAssignerLevel === 0) {
            // Universal Root Admin can ONLY assign TENANT_ROOT_ADMIN
            if (roleToAssign.name !== 'TENANT_ROOT_ADMIN') {
                logger.warn({
                    assignerId: assignerUser.id,
                    role: roleToAssign.name
                }, 'Universal Root Admin tried forbidden role assignment');

                throw new ForbiddenError(
                    'Universal Root Admin can only assign or revoke Tenant Root Admin'
                );
            }

            await userRepository.assignUserRole(tenantId, targetUserId, roleId);
            return;
        }

        /* ─────────────────────────────────────────────
           TENANT ROOT ADMIN RULES
        ───────────────────────────────────────────── */

        if (highestAssignerLevel === 1) {
            if (roleToAssign.role_level <= 1) {
                throw new ForbiddenError(
                    'Tenant Root Admin cannot assign root-level roles'
                );
            }

            await userRepository.assignUserRole(tenantId, targetUserId, roleId);
            return;
        }

        /* ─────────────────────────────────────────────
           EVERYONE ELSE — HARD DENY
        ───────────────────────────────────────────── */

        throw new ForbiddenError('You are not allowed to assign roles');
    }

    async revokeRole(tenantId, assignerUser, targetUserId, roleId) {
        const assignerRoles = await userRepository.getUserRoles(
            assignerUser.tenantId,
            assignerUser.id
        );

        const highestAssignerLevel = Math.min(...assignerRoles.map(r => r.role_level));
        const role = await userRepository.getRoleById(roleId);

        if (!role) {
            throw new ValidationError('Role not found');
        }

        // Universal Root Admin: ONLY revoke Tenant Root Admin
        if (highestAssignerLevel === 0) {
            if (role.name !== 'TENANT_ROOT_ADMIN') {
                throw new ForbiddenError(
                    'Universal Root Admin can only revoke Tenant Root Admin'
                );
            }

            await userRepository.removeUserRole(tenantId, targetUserId, roleId);
            return;
        }

        // Tenant Root Admin: revoke lower roles only
        if (highestAssignerLevel === 1) {
            if (role.role_level <= 1) {
                throw new ForbiddenError('Cannot revoke root roles');
            }

            await userRepository.removeUserRole(tenantId, targetUserId, roleId);
            return;
        }

        throw new ForbiddenError('You are not allowed to revoke roles');
    }

    async hasRequiredRoleLevel(tenantId, userId, maxAllowedLevel) {
        const roles = await userRepository.getUserRoles(tenantId, userId);
        return roles.some(r => r.role_level <= maxAllowedLevel);
    }
}

module.exports = new RoleService();