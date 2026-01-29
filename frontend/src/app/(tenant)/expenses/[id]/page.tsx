'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { expenseService } from '@/lib/api/expenses';
import { approvalService } from '@/lib/api/approvals';
import { useAuth } from '@/lib/auth/context';
import { useTenant } from '@/lib/tenant/context';
import { hasPermission } from '@/lib/auth/permissions';
import { getErrorMessage } from '@/lib/api/error-utils';

export default function ExpenseDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { tenantId } = useTenant();

    const { data: expense, isLoading, error } = useQuery({
        queryKey: ['expenses', id],
        queryFn: () => expenseService.getById(id as string),
        retry: (failureCount, err: any) => {
            // Don't retry on forbidden or not found
            if (err.response?.status === 403 || err.response?.status === 404) return false;
            return failureCount < 2;
        }
    });

    const submitMutation = useMutation({
        mutationFn: () => expenseService.submit(id as string),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses', id] });
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
        },
    });

    const approveMutation = useMutation({
        mutationFn: () => approvalService.approve(id as string),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses', id] });
            queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] });
        },
    });

    const rejectMutation = useMutation({
        mutationFn: () => approvalService.reject(id as string),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses', id] });
            queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] });
        },
    });

    if (isLoading) return <div className="p-12 text-center text-gray-500 font-medium" aria-live="polite">Loading expense details...</div>;

    const apiError = error as any;
    if (apiError) {
        const isForbidden = apiError.response?.status === 403;
        return (
            <div className="p-12 max-w-xl mx-auto text-center" role="alert">
                <div className="bg-red-50 border border-red-100 p-8 rounded-2xl shadow-sm">
                    <p className="text-red-700 font-extrabold text-xl">
                        {isForbidden ? 'Access Denied' : 'Unable to load expense'}
                    </p>
                    <p className="text-red-600 mt-2 text-sm font-medium">
                        {isForbidden
                            ? "You don't have permission to view this expense or it belongs to another tenant."
                            : getErrorMessage(error)}
                    </p>
                    <button
                        onClick={() => router.push('/expenses')}
                        className="mt-6 text-sm font-bold text-red-700 underline underline-offset-4 hover:text-red-800"
                    >
                        Go back to My Expenses
                    </button>
                </div>
            </div>
        );
    }

    if (!expense) return null;

    const isOwner = expense.user_id === user?.id;
    const canSubmit = isOwner && expense.status === 'DRAFT';
    const canApprove = hasPermission(user, 'expense:approve') && !isOwner && expense.status === 'SUBMITTED';
    const isPendingSync = submitMutation.isPending || approveMutation.isPending || rejectMutation.isPending;

    // Stale state notice (e.g. if someone approved while you were looking)
    const isStale = (submitMutation.error as any)?.response?.status === 409 ||
        (approveMutation.error as any)?.response?.status === 409;

    return (
        <div className="max-w-xl mx-auto space-y-8">
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{expense.title}</h1>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                        ID: {expense.expense_id.split('-')[0]}...
                    </p>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border shadow-sm ${expense.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-100' :
                    expense.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-100' :
                        expense.status === 'SUBMITTED' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                            'bg-gray-100 text-gray-600 border-gray-200'
                    }`}>
                    {expense.status}
                </span>
            </div>

            {isStale && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex items-center gap-3" role="status">
                    <span className="text-xl">⚠️</span>
                    <p className="text-sm font-bold text-yellow-800">
                        State has changed. Please refresh to see the latest status.
                    </p>
                    <button
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['expenses', id] })}
                        className="ml-auto text-xs font-black uppercase tracking-tighter bg-yellow-800 text-white px-3 py-1.5 rounded-lg"
                    >
                        Refresh
                    </button>
                </div>
            )}

            <div className="bg-white border border-gray-200 p-8 rounded-2xl shadow-sm space-y-8">
                <div className="grid grid-cols-2 gap-8 divide-x divide-gray-100">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Total Amount</p>
                        <p className="font-extrabold text-3xl text-gray-900 tabular-nums">
                            {expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            <span className="text-lg ml-1.5 text-gray-400">{expense.currency}</span>
                        </p>
                    </div>
                    <div className="pl-8 space-y-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Transaction Date</p>
                        <p className="font-bold text-lg text-gray-900">
                            {new Date(expense.date).toLocaleDateString(undefined, { dateStyle: 'full' })}
                        </p>
                    </div>
                </div>

                <div className="space-y-6 pt-4 border-t border-gray-50">
                    {expense.merchant && (
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Merchant</p>
                            <p className="font-bold text-gray-900">{expense.merchant}</p>
                        </div>
                    )}
                    {expense.description && (
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Description</p>
                            <p className="text-gray-600 font-medium leading-relaxed">{expense.description}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                    {canSubmit && (
                        <button
                            onClick={() => submitMutation.mutate()}
                            disabled={isPendingSync}
                            className="flex-1 bg-black text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs disabled:opacity-50 hover:bg-gray-800 transition-all shadow-lg focus:ring-2 focus:ring-offset-2 focus:ring-black outline-none"
                        >
                            {submitMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
                        </button>
                    )}

                    {canApprove && (
                        <div className="flex-1 flex gap-4">
                            <button
                                onClick={() => approveMutation.mutate()}
                                disabled={isPendingSync}
                                className="flex-1 bg-green-600 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs disabled:opacity-50 hover:bg-green-700 transition-all shadow-lg focus:ring-2 focus:ring-offset-2 focus:ring-green-600 outline-none"
                            >
                                Approve
                            </button>
                            <button
                                onClick={() => rejectMutation.mutate()}
                                disabled={isPendingSync}
                                className="flex-1 bg-red-600 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs disabled:opacity-50 hover:bg-red-700 transition-all shadow-lg focus:ring-2 focus:ring-offset-2 focus:ring-red-600 outline-none"
                            >
                                Reject
                            </button>
                        </div>
                    )}
                </div>

                <button
                    onClick={() => router.back()}
                    className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors self-center py-2"
                >
                    ← Go Back
                </button>
            </div>
        </div>
    );
}
