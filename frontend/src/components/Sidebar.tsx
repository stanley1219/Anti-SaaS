'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import { useTenant } from '@/lib/tenant/context';
import { hasPermission } from '@/lib/auth/permissions';

export default function Sidebar() {
    const { user } = useAuth();
    const { tenantId } = useTenant();

    if (!tenantId) return null;

    // Universal Root Admin (Level 0) should NOT see this sidebar
    if (user?.primaryRole?.level === 0) return null;

    return (
        <div className="w-64 border-r h-screen p-4 flex flex-col space-y-2">
            <Link href="/dashboard" className="p-2 hover:bg-gray-100 block font-bold">Dashboard</Link>
            <Link href="/expenses" className="p-2 hover:bg-gray-100 block">My Expenses</Link>
            {hasPermission(user, 'expense:approve') && (
                <Link href="/approvals" className="p-2 hover:bg-gray-100 block">Approvals</Link>
            )}

            {user?.primaryRole && user.primaryRole.level <= 2 && (
                <Link href="/admin/users" className="p-2 hover:bg-gray-100 block text-blue-600 font-semibold mt-4">Settings & Admin</Link>
            )}
        </div>
    );
}
