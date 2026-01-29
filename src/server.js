'use strict';

const app = require('./app');
const config = require('./config');
const logger = require('./core/logger');
const { pool } = require('./core/database/pool');
const jobWorker = require('./core/jobs/job-worker');

/**
 * Startup checks for critical configuration.
 */
function validateConfig() {
    const missing = [];
    if (!config.auth.accessSecret) missing.push('JWT_ACCESS_SECRET');
    if (!config.auth.refreshSecret) missing.push('JWT_REFRESH_SECRET');

    if (missing.length > 0) {
        logger.error({ missing }, 'Critical configuration missing');
        process.exit(1);
    }
}

const start = async () => {
    try {
        validateConfig();

        // Database connectivity check
        const client = await pool.connect();
        logger.info('Database connection established');
        client.release();

        // Start background worker
        jobWorker.start(); 

        const server = app.listen(config.port, () => {
            logger.info({
                port: config.port,
                env: config.env,
                apiVersion: config.api.currentVersion
            }, 'Server started successfully');
        });

        // Graceful shutdown handling
        const shutdown = (signal) => {
            logger.info(`${signal} received. Starting graceful shutdown.`);

            server.close(() => {
                logger.info('HTTP server closed.');
                jobWorker.stop();

                pool.end().then(() => {
                    logger.info('Database pool closed.');
                    process.exit(0);
                });
            });

            // Forced shutdown after timeout
            setTimeout(() => {
                logger.error('Could not close connections in time, forceful shutdown');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (err) {
        logger.fatal({ err }, 'Failed to start server');
        process.exit(1);
    }
};

// Handle unhandled rejections globally
process.on('unhandledRejection', (err) => {
    logger.error({ err }, 'Unhandled Rejection at top level');
});

start();
