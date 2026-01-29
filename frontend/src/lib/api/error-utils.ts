/**
 * Utility to extract a safe, user-facing error message from various error sources.
 * Prevents "Objects are not valid as a React child" errors by ensuring a string is always returned.
 */
export function getErrorMessage(error: any): string | null {
    if (!error) return null;

    // 1. Handled normalized error from our Axios interceptor
    if (error.normalizedError?.message && typeof error.normalizedError.message === 'string') {
        return error.normalizedError.message;
    }

    // 2. Direct message from Axios response (Legacy or simple errors)
    if (error.response?.data?.error) {
        const err = error.response.data.error;
        if (typeof err === 'string') return err;
        if (typeof err === 'object' && typeof err.message === 'string') return err.message;
    }

    // 3. Standard Error object message
    if (error.message && typeof error.message === 'string') {
        return error.message;
    }

    // 4. Fallback for string errors
    if (typeof error === 'string') {
        return error;
    }

    // 5. Ultimate fallback
    return 'An unexpected error occurred. Please try again.';
}

/**
 * Hook-like pattern for mutations to expose a safe error message.
 * Use this in "use client" components.
 */
export const extractMutationError = (mutation: { error: any }): string | null => {
    return getErrorMessage(mutation.error);
};
