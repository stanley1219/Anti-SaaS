'use client';

import { useEffect } from 'react';
import { getErrorMessage } from '@/lib/api/error-utils';

/**
 * Global Error Boundary for Next.js App Router.
 * This catch-all component prevents "Objects are not valid as a React child" 
 * crashes and provides a graceful recovery path.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // In a production app, we would send this to Sentry/LogScale
        console.error('Unhandled runtime error:', error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
            <div className="max-w-md w-full bg-white border border-red-100 p-10 rounded-2xl shadow-xl text-center space-y-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-2">
                    <span className="text-3xl" role="img" aria-hidden="true">⚠️</span>
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-black tracking-tight text-gray-900">Something went wrong</h2>
                    <p className="text-gray-600 text-sm font-medium leading-relaxed">
                        {getErrorMessage(error)}
                    </p>
                </div>
                <div className="flex flex-col gap-3 pt-4">
                    <button
                        onClick={() => reset()}
                        className="w-full bg-black text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-800 transition-all shadow-md focus:ring-2 focus:ring-offset-2 focus:ring-black outline-none"
                    >
                        Try again
                    </button>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="w-full bg-white text-gray-400 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:text-gray-900 transition-colors"
                    >
                        Back to safety
                    </button>
                </div>
                {error.digest && (
                    <p className="text-[10px] font-mono text-gray-300 uppercase tracking-widest pt-4">
                        Digest: {error.digest}
                    </p>
                )}
            </div>
        </div>
    );
}
