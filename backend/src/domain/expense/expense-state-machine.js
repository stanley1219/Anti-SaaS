'use strict';

const { ConflictError } = require('../../core/errors');

/**
 * Expense State Machine
 * Defines valid status transitions for the Expense domain.
 */

const STATES = {
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    PAID: 'PAID'
};

const TRANSITIONS = {
    [STATES.DRAFT]: [STATES.SUBMITTED],
    [STATES.SUBMITTED]: [STATES.APPROVED, STATES.REJECTED],
    [STATES.REJECTED]: [STATES.SUBMITTED],
    [STATES.APPROVED]: [STATES.PAID],
    [STATES.PAID]: [] // Final state
};

/**
 * Check if a transition is allowed.
 */
const canTransition = (from, to) => {
    if (!from || !to) return false;
    const allowed = TRANSITIONS[from] || [];
    return allowed.includes(to);
};

/**
 * Assert that a transition is allowed, otherwise throw.
 */
const assertTransition = (from, to) => {
    if (!canTransition(from, to)) {
        throw new ConflictError(`Invalid expense status transition: ${from} -> ${to}`);
    }
};

module.exports = {
    STATES,
    canTransition,
    assertTransition
};
