'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { expenseService } from '@/lib/api/expenses';
import { ExpenseCreateSchema } from '@/types/expense';
import { useTenant } from '@/lib/tenant/context';
import { getErrorMessage } from '@/lib/api/error-utils';

export default function NewExpensePage() {
    const router = useRouter();
    const { tenantId } = useTenant();
    const queryClient = useQueryClient();
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [globalError, setGlobalError] = useState<string | null>(null);

    const mutation = useMutation({
        mutationFn: expenseService.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            router.push('/expenses');
        },
        onError: (err: any) => {
            setGlobalError(getErrorMessage(err));
        }
    });

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setGlobalError(null);
        setFieldErrors({});

        const formData = new FormData(e.currentTarget);
        const rawData = {
            title: formData.get('title') as string,
            amount: formData.get('amount'),
            currency: formData.get('currency') as string,
            date: formData.get('date') ? new Date(formData.get('date') as string).toISOString() : '',
            merchant: formData.get('merchant') as string,
            description: formData.get('description') as string,
        };

        const result = ExpenseCreateSchema.safeParse(rawData);
        if (!result.success) {
            const errors: Record<string, string> = {};
            result.error.issues.forEach((issue) => {
                if (issue.path[0]) errors[issue.path[0] as string] = issue.message;
            });
            setFieldErrors(errors);
            return;
        }

        mutation.mutate(result.data);
    };

    const ErrorMessage = ({ message }: { message?: string }) =>
        message ? <p className="text-xs font-bold text-red-600 mt-1" role="alert">{message}</p> : null;

    return (
        <div className="max-w-xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">New Expense</h1>
                <p className="text-gray-500 text-sm mt-1">Fill in the details for your new expenditure draft.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-gray-200 p-8 rounded-xl shadow-sm">
                <div className="space-y-4">
                    <div>
                        <label htmlFor="title" className="block text-sm font-bold text-gray-700 mb-1.5">Title</label>
                        <input
                            id="title"
                            name="title"
                            placeholder="e.g., Client Dinner at Nobu"
                            className={`w-full border rounded-lg p-2.5 text-sm outline-none transition-all focus:ring-2 ${fieldErrors.title ? 'border-red-300 focus:ring-red-100' : 'border-gray-300 focus:ring-gray-100'
                                }`}
                            aria-invalid={!!fieldErrors.title}
                        />
                        <ErrorMessage message={fieldErrors.title} />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="amount" className="block text-sm font-bold text-gray-700 mb-1.5">Amount</label>
                            <input
                                id="amount"
                                name="amount"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                className={`w-full border rounded-lg p-2.5 text-sm outline-none transition-all focus:ring-2 ${fieldErrors.amount ? 'border-red-300 focus:ring-red-100' : 'border-gray-300 focus:ring-gray-100'
                                    }`}
                                aria-invalid={!!fieldErrors.amount}
                            />
                            <ErrorMessage message={fieldErrors.amount} />
                        </div>
                        <div>
                            <label htmlFor="currency" className="block text-sm font-bold text-gray-700 mb-1.5">Currency</label>
                            <select
                                id="currency"
                                name="currency"
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-gray-100 bg-white"
                                defaultValue="USD"
                            >
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="INR">INR (₹)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="date" className="block text-sm font-bold text-gray-700 mb-1.5">Date</label>
                        <input
                            id="date"
                            name="date"
                            type="date"
                            className={`w-full border rounded-lg p-2.5 text-sm outline-none transition-all focus:ring-2 ${fieldErrors.date ? 'border-red-300 focus:ring-red-100' : 'border-gray-300 focus:ring-gray-100'
                                }`}
                            defaultValue={new Date().toISOString().split('T')[0]}
                            aria-invalid={!!fieldErrors.date}
                        />
                        <ErrorMessage message={fieldErrors.date} />
                    </div>

                    <div>
                        <label htmlFor="merchant" className="block text-sm font-bold text-gray-700 mb-1.5">Merchant (Optional)</label>
                        <input
                            id="merchant"
                            name="merchant"
                            placeholder="e.g., Apple Inc."
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-gray-100"
                        />
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-bold text-gray-700 mb-1.5">Description (Optional)</label>
                        <textarea
                            id="description"
                            name="description"
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-gray-100"
                            rows={3}
                            placeholder="Add some details about this expense..."
                        />
                    </div>
                </div>

                {globalError && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs font-bold text-red-600" role="alert">
                        {globalError}
                    </div>
                )}

                <div className="flex justify-end items-center gap-4 pt-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="bg-black text-white px-8 py-3 rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-gray-800 transition-all shadow-md focus:ring-2 focus:ring-offset-2 focus:ring-black outline-none"
                    >
                        {mutation.isPending ? 'Saving...' : 'Create Draft'}
                    </button>
                </div>
            </form>
        </div>
    );
}
