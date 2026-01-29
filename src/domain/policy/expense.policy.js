'use strict';

const { ForbiddenError, ConflictError } = require('../../core/errors');

/**
 * Pure authorization and invariant checks for Expenses.
 * This is the single source of truth for "who can do what".
 */

/**
 * Check if user is allowed to create an expense.
 */
const canCreateExpense = (user) => {
    if (user.permissions && !user.permissions.includes('expense:create')) {
        throw new ForbiddenError('Insufficient permissions to create expense');
    }
};

/**
 * Check if user is allowed to view a specific expense.
 */
const canViewExpense = (user, expense) => {
    const isOwner = expense.user_id === user.id;
    const canViewAll = user.permissions && (user.permissions.includes('expense:view_all') || user.permissions.includes('expense:audit_view'));

    if (!isOwner && !canViewAll) {
        throw new ForbiddenError('Access denied: You do not have permission to view this expense');
    }
};

/**
 * Determine the user ID to filter by when listing expenses.
 * Returns null if the user has broad view permissions.
 */
const getAuthorizedListUserId = (user) => {
    const canViewAll = user.permissions && (user.permissions.includes('expense:view_all') || user.permissions.includes('expense:audit_view'));
    return canViewAll ? null : user.id;
};

/**
 * Check if user can update an expense.
 */
const canUpdateExpense = (user, expense) => {
    const isOwner = expense.user_id === user.id;
    const isAdmin = user.permissions && user.permissions.includes('expense:view_all');

    if (!isOwner && !isAdmin) {
        throw new ForbiddenError('You do not own this expense');
    }

    if (expense.status !== 'DRAFT' && expense.status !== 'REJECTED') {
        throw new ConflictError('Cannot edit an expense that is already submitted or approved');
    }
};

/**
 * Check if user can submit an expense.
 */
const canSubmitExpense = (user, expense) => {
    if (expense.user_id !== user.id) {
        throw new ForbiddenError('You do not own this expense');
    }

    if (expense.status === 'APPROVED' || expense.status === 'PAID') {
        throw new ConflictError('Cannot submit an expense that is already approved or paid');
    }
};

/**
 * Check if user can approve an expense.
 */
const canApproveExpense = (user, expense) => {
    if (expense.user_id === user.id) {
        throw new ForbiddenError('You cannot approve your own expense');
    }

    if (user.permissions && !user.permissions.includes('expense:approve')) {
        throw new ForbiddenError('Insufficient permissions to approve expense');
    }

    if (expense.status !== 'SUBMITTED') {
        throw new ConflictError('Only submitted expenses can be approved');
    }
};

/**
 * Check if user can reject an expense.
 */
const canRejectExpense = (user, expense) => {
    if (expense.user_id === user.id) {
        throw new ForbiddenError('You cannot reject your own expense');
    }

    if (user.permissions && !user.permissions.includes('expense:approve')) {
        throw new ForbiddenError('Insufficient permissions to reject expense');
    }

    if (expense.status !== 'SUBMITTED') {
        throw new ConflictError('Only submitted expenses can be rejected');
    }
};

module.exports = {
    canCreateExpense,
    canViewExpense,
    getAuthorizedListUserId,
    canUpdateExpense,
    canSubmitExpense,
    canApproveExpense,
    canRejectExpense
};
