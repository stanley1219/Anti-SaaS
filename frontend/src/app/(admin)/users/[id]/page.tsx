'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '@/lib/api/admin';
import { useAuth } from '@/lib/auth/context';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { getErrorMessage } from '@/lib/api/error-utils';

export default function EditUserPage() {
    const { id } = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user: currentUser } = useAuth();
    const [actionError, setActionError] = useState<string | null>(null);

    const currentRoleLevel = currentUser?.primaryRole?.level;

    // Fetch users
    const { data: users } = useQuery({
        queryKey: ['admin', 'users'],
        queryFn: adminService.listUsers
    });

    // Fetch roles ONLY if Tenant Root Admin
    const canManageRoles = currentRoleLevel === 1;

    const { data: roles } = useQuery({
        queryKey: ['admin', 'roles'],
        queryFn: adminService.listRoles,
        enabled: canManageRoles
    });

    const targetUser = users?.find((u: any) => u.user_id === id);

    // Mutations
    const updateMutation = useMutation({
        mutationFn: (updates: any) => adminService.updateUser(id as string, updates),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    });

    const assignRoleMutation = useMutation({
        mutationFn: (roleId: string) => adminService.assignRole(id as string, roleId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
            setActionError(null);
        },
        onError: (err) => setActionError(getErrorMessage(err))
    });

    const deleteMutation = useMutation({
        mutationFn: () => adminService.deleteUser(id as string),
        onSuccess: () => router.push('/admin/users')
    });

    if (!targetUser) {
        return <div className="p-12 text-center text-gray-500 font-bold">User not found.</div>;
    }

    return (
        <div className="max-w-4xl space-y-12 pb-24">
            <header>
                <button
                    onClick={() => router.back()}
                    className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black mb-4"
                >
                    ← Back
                </button>

                <h1 className="text-3xl font-black">{targetUser.email}</h1>
                <p className="text-gray-500">Manage account status and access.</p>
            </header>

            {/* Status Management (Tenant Root Admin only) */}
            {currentRoleLevel === 1 && (
                <section className="bg-white border rounded-2xl p-6">
                    <h2 className="text-xs font-black uppercase mb-4">Account Status</h2>
                    <div className="flex gap-2">
                        {['active', 'inactive', 'suspended'].map((status) => (
                            <button
                                key={status}
                                onClick={() => updateMutation.mutate({ status })}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase border ${
                                    targetUser.status === status
                                        ? 'bg-black text-white'
                                        : 'bg-white text-gray-400'
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {/* Role Assignment — ONLY Tenant Root Admin */}
            {canManageRoles && (
                <section className="bg-white border rounded-2xl p-6">
                    <h2 className="text-xs font-black uppercase mb-4">Assign Roles</h2>

                    {actionError && (
                        <div className="text-red-600 text-xs mb-3">{actionError}</div>
                    )}

                    <div className="space-y-2">
                        {roles
                            ?.filter((r: any) =>
                                ['TENANT_ADMIN', 'TENANT_USER'].includes(r.name)
                            )
                            .map((role: any) => (
                                <button
                                    key={role.role_id}
                                    onClick={() => assignRoleMutation.mutate(role.role_id)}
                                    className="w-full p-3 border rounded-xl hover:bg-gray-50 flex justify-between"
                                >
                                    <span className="text-xs font-black">{role.name}</span>
                                    <span className="text-[10px] text-gray-400">Assign</span>
                                </button>
                            ))}
                    </div>
                </section>
            )}

            {/* Access Revocation — Tenant Root Admin only */}
            {currentRoleLevel === 1 && (
                <section>
                    <button
                        onClick={() => {
                            if (confirm('Revoke access for this user?')) {
                                deleteMutation.mutate();
                            }
                        }}
                        className="text-xs font-black uppercase text-red-600"
                    >
                        Revoke Access
                    </button>
                </section>
            )}
        </div>
    );
}