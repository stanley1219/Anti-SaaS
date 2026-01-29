'use strict';

const { Pool } = require('pg');
const config = require('../../config');
const logger = require('../logger');

const pool = new Pool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name,
    max: config.db.max,
    min: config.db.min,
    idleTimeoutMillis: config.db.idleTimeoutMillis,
    connectionTimeoutMillis: config.db.connectionTimeoutMillis,
});

pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

pool.on('connect', () => {
    logger.debug('New client connected to PostgreSQL');
});

module.exports = {
    /**
     * Execute a single query using the pool
     */
    query: (text, params) => pool.query(text, params),

    /**
     * Get a client from the pool for transaction management
     */
    getClient: () => pool.connect(),

    pool,
};
