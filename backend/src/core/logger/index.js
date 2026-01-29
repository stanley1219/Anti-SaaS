'use strict';

const pino = require('pino');
const config = require('../../config');


const logger = pino({
    level: config.logLevel,
    transport: config.env === 'development' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'HH:MM:ss Z',
        },
    } : undefined,
});

module.exports = logger;
