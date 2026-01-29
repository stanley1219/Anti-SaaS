'use client';

import { useQuery } from '@tanstack/react-query';
import { approvalService } from '@/lib/api/approvals';
import Link from 'next/link';
import { useTenant } from '@/lib/tenant/context';
import { getErrorMessage } from '@/lib/api/error-utils';

export default function ApprovalsPage() {
    const { tenantId } = useTenant();
    const { data: pending, isLoading, error } = useQuery({
        queryKey: ['approvals', 'pending'],
        queryFn: () => approvalService.listPending(),
    });

    if (isLoading) return <div className="p-12 text-center text-gray-500 font-medium" aria-live="polite">Loading approvals dashboard...</div>;
    if (error) return (
        <div className="p-12 text-center text-red-600 bg-red-50 border border-red-100 rounded-lg" role="alert">
            {getErrorMessage(error)}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Pending Approvals</h1>
                <p className="text-sm text-gray-500 font-medium">Review and take action on expenses submitted by your team.</p>
            </div>

            <div className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">
                {!pending || pending.length === 0 ? (
                    <div className="py-20 px-6 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 mb-4 text-blue-500">
                            <span className="text-2xl" role="img" aria-hidden="true">🎯</span>
                        </div>
                        <p className="text-gray-900 font-bold text-lg">Queue Clear!</p>
                        <p className="text-gray-500 max-w-xs mx-auto mt-2 text-sm font-medium">There are no expenses waiting for your approval at this moment.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100" role="list">
                        {pending.map((expense) => (
                            <Link
                                key={expense.expense_id}
                                href={`/expenses/${expense.expense_id}`}
                                className="p-5 flex justify-between items-center hover:bg-gray-50 transition-colors group focus:bg-gray-50 outline-none"
                                aria-label={`Approval required: ${expense.title} from user ${expense.user_id}, ${expense.amount} ${expense.currency}`}
                            >
                                <div className="min-w-0 pr-4">
                                    <p className="font-bold text-gray-900 truncate group-hover:text-black">{expense.title}</p>
                                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">
                                        PENDING REVIEW • {new Date(expense.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                    </p>
                                </div>
                                <div className="shrink-0 text-right flex flex-col items-end gap-2">
                                    <p className="font-extrabold text-gray-900 tabular-nums text-lg">
                                        {expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs font-bold text-gray-400">{expense.currency}</span>
                                    </p>
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter bg-blue-100 text-blue-800 border border-blue-200">
                                        Review Actions →
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
