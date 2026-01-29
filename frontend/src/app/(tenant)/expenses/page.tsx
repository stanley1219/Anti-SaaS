'use client';

import { useQuery } from '@tanstack/react-query';
import { expenseService } from '@/lib/api/expenses';
import Link from 'next/link';
import { useTenant } from '@/lib/tenant/context';
import { getErrorMessage } from '@/lib/api/error-utils';

export default function ExpensesPage() {
    const { tenantId } = useTenant();
    const { data: expenses, isLoading, error } = useQuery({
        queryKey: ['expenses'],
        queryFn: () => expenseService.list(),
    });

    if (isLoading) return <div className="p-12 text-center text-gray-500 font-medium" aria-live="polite">Loading expenses...</div>;
    if (error) return (
        <div className="p-12 text-center text-red-600 bg-red-50 border border-red-100 rounded-lg" role="alert">
            {getErrorMessage(error)}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">My Expenses</h1>
                <Link
                    href="/expenses/new"
                    className="bg-black text-white px-5 py-2.5 rounded-md text-sm font-semibold hover:bg-gray-800 transition-all focus:ring-2 focus:ring-offset-2 focus:ring-black outline-none shadow-sm"
                >
                    New Expense
                </Link>
            </div>

            <div className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">
                {!expenses || expenses.length === 0 ? (
                    <div className="py-20 px-6 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-50 mb-4">
                            <span className="text-2xl" role="img" aria-hidden="true">📋</span>
                        </div>
                        <p className="text-gray-900 font-bold text-lg">No expenses yet</p>
                        <p className="text-gray-500 max-w-xs mx-auto mt-2 text-sm">Submit your business expenditures to start tracking and reimbursements.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100" role="list">
                        {expenses.map((expense) => (
                            <Link
                                key={expense.expense_id}
                                href={`/expenses/${expense.expense_id}`}
                                className="p-5 flex justify-between items-center hover:bg-gray-50 transition-colors group focus:bg-gray-50 outline-none"
                                aria-label={`Expense: ${expense.title}, ${expense.amount} ${expense.currency}`}
                            >
                                <div className="min-w-0 pr-4">
                                    <p className="font-bold text-gray-900 truncate group-hover:text-black">{expense.title}</p>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-1">
                                        {new Date(expense.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                    </p>
                                </div>
                                <div className="shrink-0 text-right flex flex-col items-end gap-2">
                                    <p className="font-extrabold text-gray-900 tabular-nums">
                                        {expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs font-bold text-gray-400">{expense.currency}</span>
                                    </p>
                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tighter border ${expense.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-100' :
                                        expense.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-100' :
                                            expense.status === 'SUBMITTED' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                'bg-gray-100 text-gray-600 border-gray-200'
                                        }`} aria-label={`Status: ${expense.status}`}>
                                        {expense.status}
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
