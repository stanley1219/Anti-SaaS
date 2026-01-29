'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const config = require('../../config');
const userRepository = require('../user/user-repository');
const logger = require('../../core/logger');

const { ValidationError, ForbiddenError, ConflictError } = require('../../core/errors');

/**
 * Service for Authentication and Token Management.
 */
class AuthService {
    /**
     * Authenticate a user by email and password.
     */
    async login(tenantId, email, password) {
        const user = await userRepository.findByEmail(tenantId, email);

        if (!user) {
            logger.warn({ tenantId, email }, 'Login failed: user not found');
            throw new ForbiddenError('Invalid credentials');
        }

        if (user.status !== 'active') {
            logger.warn({ tenantId, userId: user.user_id, status: user.status }, 'Login failed: inactive user');
            throw new ForbiddenError('User account is not active');
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            logger.warn({ tenantId, email }, 'Login failed: password mismatch');
            throw new ForbiddenError('Invalid credentials');
        }

        // Resolve roles and permissions to embed in JWT
        const [roles, permissions] = await Promise.all([
            userRepository.getUserRoles(tenantId, user.user_id),
            userRepository.getUserPermissions(tenantId, user.user_id)
        ]);

        return this.generateTokens(tenantId, user.user_id, permissions, roles);
    }

    /**
     * Refresh access tokens using a valid refresh token.
     * Implements rotation and reuse detection.
     */
    async refresh(tenantId, refreshToken) {
        try {
            const decoded = jwt.verify(refreshToken, config.auth.refreshSecret);
            const tokenId = decoded.jti;

            const storedToken = await userRepository.findRefreshToken(tenantId, tokenId);

            // 1. Token exists?
            if (!storedToken) {
                throw new ValidationError('Refresh token not found');
            }

            // 2. Token reuse detection (Breach handling)
            // If token is revoked but was already replaced, something is wrong.
            if (storedToken.revoked_at) {
                if (storedToken.replaced_by) {
                    logger.error({ tenantId, userId: storedToken.user_id, tokenId }, 'REFRESH_TOKEN_REUSE: Revoking entire token chain');
                    await userRepository.revokeAllUserTokens(tenantId, storedToken.user_id);
                }
                throw new ConflictError('Refresh token revoked');
            }

            // 3. Expiry check
            if (new Date(storedToken.expires_at) < new Date()) {
                throw new ValidationError('Refresh token expired');
            }

            // 4. Verify hash integrity
            const refreshTokenHash = this.hashToken(refreshToken);
            if (storedToken.token_hash !== refreshTokenHash) {
                throw new ValidationError('Refresh token hash mismatch');
            }

            // 5. User/Tenant status check
            const user = await userRepository.findById(tenantId, storedToken.user_id);
            if (!user || user.status !== 'active') {
                throw new ForbiddenError('User inactive or not found');
            }

            // 6. Rotate Tokens
            const [roles, permissions] = await Promise.all([
                userRepository.getUserRoles(tenantId, user.user_id),
                userRepository.getUserPermissions(tenantId, user.user_id)
            ]);

            const tokens = await this.generateTokens(tenantId, user.user_id, permissions, roles, tokenId);

            return tokens;
        } catch (err) {
            logger.error({ err, tenantId }, 'Token refresh failed');
            throw new ForbiddenError('Invalid refresh token');
        }
    }

    /**
     * Generate Access and Refresh tokens with rotation.
     */
    async generateTokens(tenantId, userId, permissions, roles, lastTokenId = null) {
        const tokenId = uuidv4();

        // Map roles to a compact format for JWT
        const rolePayload = roles.map(r => ({
            name: r.name,
            level: r.role_level
        }));

        // Identify primary role (lowest level)
        const primaryRole = rolePayload.reduce((prev, curr) =>
            (prev.level < curr.level) ? prev : curr,
            rolePayload[0] || { name: 'TENANT_USER', level: 3 }
        );

        const accessToken = jwt.sign(
            {
                sub: userId,
                tid: tenantId,
                roles: rolePayload,
                primaryRole,
                permissions
            },
            config.auth.accessSecret,
            { expiresIn: config.auth.accessExpiry }
        );

        const refreshToken = jwt.sign(
            {
                sub: userId,
                tid: tenantId,
                jti: tokenId
            },
            config.auth.refreshSecret,
            { expiresIn: config.auth.refreshExpiry }
        );

        // Calculate expiry based on config
        const expiresAt = new Date(Date.now() + (config.auth.refreshExpirySeconds * 1000));

        const tokenHash = this.hashToken(refreshToken);

        // 1. Save NEW refresh token first
        await userRepository.saveRefreshToken(
            tenantId,
            userId,
            tokenId,
            tokenHash,
            expiresAt
        );

        // 2. Then mark OLD token as replaced
        if (lastTokenId) {
            await userRepository.replaceRefreshToken(
                tenantId,
                lastTokenId,
                tokenId
            );
        }

        return { accessToken, refreshToken };
    }

    /**
     * Revoke a specific token on logout.
     */
    async logout(tenantId, refreshToken) {
        try {
            const decoded = jwt.verify(refreshToken, config.auth.refreshSecret);
            await userRepository.revokeRefreshToken(tenantId, decoded.jti);
        } catch (err) {
            logger.debug({ err }, 'Logout error/already expired');
        }
    }

    /**
     * Deterministic hash for tokens.
     */
    hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    /**
     * Hash a password for storage.
     */
    async hashPassword(password) {
        return bcrypt.hash(password, config.auth.passwordSaltRounds);
    }
}

module.exports = new AuthService();
