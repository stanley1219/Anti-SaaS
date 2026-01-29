'use strict';

const { ValidationError } = require('../../core/errors');

/**
 * Lightweight schema validation middleware.
 * Uses a simple check function.
 */
const validate = (schema) => {
    return (req, res, next) => {
        const errors = [];

        if (schema.body) {
            for (const [key, rules] of Object.entries(schema.body)) {
                const value = req.body[key];

                if (rules.required && (value === undefined || value === null || value === '')) {
                    errors.push(`${key} is required`);
                } else if (value !== undefined) {
                    if (rules.type === 'number' && typeof value !== 'number') {
                        errors.push(`${key} must be a number`);
                    }
                    if (rules.type === 'string' && typeof value !== 'string') {
                        errors.push(`${key} must be a string`);
                    }
                }
            }
        }

        if (errors.length > 0) {
            return next(new ValidationError(`Validation failed: ${errors.join(', ')}`));
        }

        next();
    };
};

module.exports = { validate };
