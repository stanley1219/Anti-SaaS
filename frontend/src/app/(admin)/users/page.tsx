'use client';

import { useQuery } from '@tanstack/react-query';
import { adminService } from '@/lib/api/admin';
import Link from 'next/link';
import { getErrorMessage } from '@/lib/api/error-utils';

export default function UserManagementPage() {
    const { data: users, isLoading, error } = useQuery({
        queryKey: ['admin', 'users'],
        queryFn: adminService.listUsers
    });

    if (isLoading) return <div className="text-gray-500 font-medium">Loading user list...</div>;
    if (error) return <div className="text-red-600 bg-red-50 p-4 rounded-lg">{getErrorMessage(error)}</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-gray-900">User Management</h1>
                    <p className="text-gray-500 text-sm font-medium">Manage members of your organization and their roles.</p>
                </div>
                <Link
                    // href="/admin/users/new" //popcorn
                    href="/users/new"
                    className="bg-black text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-gray-800 transition-all shadow-sm"
                >
                    + Invite User
                </Link>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">User</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Joined</th>
                            <th className="px-6 py-4 text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {users?.map((u: any) => (
                            <tr key={u.user_id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                    <p className="font-bold text-gray-900">{u.email}</p>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{u.user_id}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter border ${u.status === 'active' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
                                        }`}>
                                        {u.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm font-bold text-gray-500">
                                    {new Date(u.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <Link
                                        // href={`/admin/users/${u.user_id}`} popcorn
                                        href={`/users/${u.user_id}`}
                                        className="text-xs font-black uppercase tracking-widest text-blue-600 hover:text-blue-800"
                                    >
                                        Edit Details →
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {(!users || users.length === 0) && (
                    <div className="p-12 text-center text-gray-400 font-bold">No users found.</div>
                )}
            </div>
        </div>
    );
}
