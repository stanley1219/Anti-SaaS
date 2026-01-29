'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const requestId = require('./api/middleware/request-id');
const responseLogger = require('./api/middleware/response-logger');
const rateLimiter = require('./api/middleware/rate-limiter');
const errorHandler = require('./api/middleware/error-handler');
const { authenticate } = require('./api/middleware/auth');
const { enforceTenantStatus } = require('./api/middleware/tenant-status');

const config = require('./config');

const app = express();

// 1. Request ID (First for tracking)
app.use(requestId);

// 2. CORS (Early to handle preflight correctly)
app.use(cors(config.cors));

// 3. Security Headers
app.use(helmet({
    contentSecurityPolicy: true,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// 3. Parsers & Utils
app.use(express.json({ limit: '10kb' }));
app.use(responseLogger);

// 4. Rate Limiting (Global)
app.use(rateLimiter);

// 5. Tenant Status Enforcement (Global baseline)
app.use(enforceTenantStatus);

// 6. API v1 Router
app.use('/api/v1', require('./api/v1'));

// 7. Operational Endpoints
app.get('/health', (req, res) => {
    res.json({
        status: 'up',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({ name: 'Expense SaaS API', version: '1.0.0', apiRoot: '/api/v1' });
});

// 8. Global Error Handler
app.use(errorHandler);

module.exports = app;
