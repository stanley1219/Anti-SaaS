'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '@/lib/api/admin';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import { isUniversalRootAdmin } from '@/lib/auth/permissions';
import { getErrorMessage } from '@/lib/api/error-utils';
import { useState } from 'react';

export default function TenantManagementPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [actionError, setActionError] = useState<string | null>(null);

    const { data: tenants, isLoading, error } = useQuery({
        queryKey: ['admin', 'tenants'],
        queryFn: adminService.listTenants,
        enabled: !!user && isUniversalRootAdmin(user)
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string, status: string }) =>
            adminService.updateTenantStatus(id, status),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] }),
        onError: (err) => setActionError(getErrorMessage(err))
    });

    const revokeAdminMutation = useMutation({
        mutationFn: ({ tenantId, adminId }: { tenantId: string, adminId: string }) =>
            adminService.revokeTenantRootAdmin(tenantId, adminId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] }),
        onError: (err) => setActionError(getErrorMessage(err))
    });

    if (!isUniversalRootAdmin(user)) {
        return <div className="p-12 text-center text-red-600 font-bold">Access Denied: Universal Root Admin only.</div>;
    }

    if (isLoading) return <div className="text-gray-500 font-medium font-bold">Loading global tenant list...</div>;
    if (error) return <div className="text-red-600 bg-red-50 p-4 rounded-lg">{getErrorMessage(error)}</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-gray-900">System Tenants</h1>
                    <p className="text-gray-500 text-sm font-medium">Global overview of all organizations in the system.</p>
                </div>
                <Link
                    href="/admin/tenants/new"
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-sm"
                >
                    + Provision Tenant
                </Link>
            </div>

            {actionError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg font-bold border border-red-100">
                    {actionError}
                    <button onClick={() => setActionError(null)} className="ml-4 text-xs underline">Dismiss</button>
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Organization</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Tenant Root Admin</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {tenants?.map((t: any) => (
                            <tr key={t.tenant_id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                    <p className="font-bold text-gray-900">{t.name}</p>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{t.tenant_id}</p>
                                    <p className="text-xs text-gray-500 mt-1">/{t.slug}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter border ${t.status === 'active' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
                                        }`}>
                                        {t.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {t.admin_email ? (
                                        <>
                                            <p className="text-sm font-bold text-gray-900">{t.admin_email}</p>
                                            <p className="text-[10px] text-gray-400 tracking-tighter">{t.admin_id}</p>
                                        </>
                                    ) : (
                                        <span className="text-xs text-gray-400 italic">No Root Admin assigned</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex space-x-3 items-center">
                                        {/* Disable/Enable Tenant */}
                                        {t.status === 'active' ? (
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Disable tenant "${t.name}"? Users will lose access.`)) {
                                                        statusMutation.mutate({ id: t.tenant_id, status: 'suspended' });
                                                    }
                                                }}
                                                className="text-[10px] font-black uppercase tracking-widest text-red-600 hover:text-red-800"
                                            >
                                                Disable
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => statusMutation.mutate({ id: t.tenant_id, status: 'active' })}
                                                className="text-[10px] font-black uppercase tracking-widest text-green-600 hover:text-green-800"
                                            >
                                                Enable
                                            </button>
                                        )}

                                        <span className="text-gray-300">|</span>

                                        {/* Revoke Admin */}
                                        {t.admin_id && (
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Revoke Root Admin role from ${t.admin_email}?`)) {
                                                        revokeAdminMutation.mutate({ tenantId: t.tenant_id, adminId: t.admin_id });
                                                    }
                                                }}
                                                className="text-[10px] font-black uppercase tracking-widest text-yellow-600 hover:text-yellow-800"
                                            >
                                                Revoke Admin
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {(!tenants || tenants.length === 0) && (
                    <div className="p-12 text-center text-gray-400 font-bold">No tenants found in the system.</div>
                )}
            </div>
        </div>
    );
}
