'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import { isUniversalRootAdmin } from '@/lib/auth/permissions';

export default function AdminSidebar() {
    const { user } = useAuth();

    return (
        <div className="w-64 border-r h-screen p-4 flex flex-col space-y-2 bg-gray-50">
            <div className="mb-6 px-2">
                <h2 className="text-xs font-black uppercase tracking-widest text-gray-500">Admin Panel</h2>
                <p className="text-[10px] font-bold text-blue-600 mt-1">{user?.primaryRole?.name}</p>
            </div>

            {!isUniversalRootAdmin(user) && (
                <Link href="/dashboard" className="p-2 hover:bg-gray-200 block text-sm font-bold text-gray-600">← Back to App</Link>
            )}

            <div className="pt-4 space-y-1">
                {!isUniversalRootAdmin(user) && (
                    <Link href="/admin/users" className="p-2 hover:bg-gray-200 rounded-lg block text-sm font-bold">User Management</Link>
                )}

                {isUniversalRootAdmin(user) && (
                    <Link href="/admin/tenants" className="p-2 hover:bg-gray-200 rounded-lg block text-sm font-bold">Tenant Management</Link>
                )}
            </div>
        </div>
    );
}
