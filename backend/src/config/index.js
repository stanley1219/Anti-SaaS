'use strict';

require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    name: process.env.DB_NAME || 'expense_saas',
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
  },
  auth: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'supersearchsecretaccess',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'supersearchsecretrefresh',
    accessExpiry: '15m',
    refreshExpiry: '30d',
    refreshExpirySeconds: 30 * 24 * 60 * 60, // 30 days in seconds
    passwordSaltRounds: 12,
  },
  jobs: {
    pollIntervalMs: parseInt(process.env.JOB_POLL_INTERVAL || '5000', 10),
    maxRetries: 5,
    concurrency: parseInt(process.env.JOB_CONCURRENCY || '5', 10),
    lockDurationMs: 60000, // 1 minute
  },
  api: {
    currentVersion: 'v1',
    slowRequestThresholdMs: 1000,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequestsPerIp: 100,
      maxRequestsPerTenant: 1000,
    }
  },
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? (process.env.CORS_ORIGIN || 'https://app.antisaas.com')
      : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id', 'X-Tenant-ID'],
    exposedHeaders: ['X-Request-Id'],
    credentials: true,
    maxAge: 86400,
  }
};

module.exports = config;
