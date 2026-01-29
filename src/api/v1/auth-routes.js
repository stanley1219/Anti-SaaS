'use strict';

const express = require('express');
const authService = require('../../domain/auth/auth-service');
const { authenticate } = require('../../api/middleware/auth');
const { validate } = require('../../api/middleware/validator');
const router = express.Router();

const loginSchema = {
    body: {
        tenantId: { required: true },
        email: { required: true, type: 'string' },
        password: { required: true, type: 'string' }
    }
};

const refreshSchema = {
    body: {
        tenantId: { required: true },
        refreshToken: { required: true, type: 'string' }
    }
};

const setAuthCookies = (res, { accessToken, refreshToken }) => {
    const isProd = process.env.NODE_ENV === 'production';

    const baseOptions = {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        path: '/',
    };

    res.cookie('accessToken', accessToken, {
        ...baseOptions,
        maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', refreshToken, {
        ...baseOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000,
    });
};

/**
 * Login endpoint
 */
router.post('/login', validate(loginSchema), async (req, res, next) => {
    try {
        const { tenantId, email, password } = req.body;
        const tokens = await authService.login(tenantId, email, password);

        setAuthCookies(res, tokens);

        res.success(tokens);
    } catch (err) {
        next(err);
    }
});

/**
 * Token refresh endpoint
 */
router.post('/refresh', validate(refreshSchema), async (req, res, next) => {
    try {
        const { tenantId, refreshToken } = req.body;
        const tokens = await authService.refresh(tenantId, refreshToken);

        setAuthCookies(res, tokens);

        res.success(tokens);
    } catch (err) {
        next(err);
    }
});

/**
 * Logout
 */
router.post('/logout', authenticate, async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (refreshToken) {
            await authService.logout(req.user.tenantId, refreshToken);
        }

        // Clear Cookies
        res.clearCookie('refreshToken', { path: '/' });
        res.clearCookie('accessToken', { path: '/' });

        res.success({ message: 'Logged out successfully' });
    } catch (err) {
        next(err);
    }
});

/**
 * Me endpoint (Verify session)
 */
// router.get('/me', authenticate, async (req, res, next) => {
//     try {
//         const user = await userRepository.findById(req.user.tenantId, req.user.id);
//         if (!user) {
//             return res.status(404).json({ error: 'User not found' });
//         }

//         res.success({
//             user: {
//                 id: user.user_id,
//                 tenantId: user.tenant_id,
//                 email: user.email,
//                 status: user.status,
//                 permissions: req.user.permissions
//                 // Note: user.name can be added later if column exists, for now we have email
//             }
//         });
//     } catch (err) {
//         next(err);
//     }
// // });

router.get('/me', authenticate, async (req, res, next) => {
    try {
        res.success({
            user: req.user
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
