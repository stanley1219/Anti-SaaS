'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminService } from '@/lib/api/admin';
import { getErrorMessage } from '@/lib/api/error-utils';

export default function ProvisionTenantPage() {
    const [tenantName, setTenantName] = useState('');
    const [tenantSlug, setTenantSlug] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            await adminService.createTenant(
                { name: tenantName, slug: tenantSlug },
                { email: adminEmail, password: adminPassword }
            );
            router.push('/admin/tenants');
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-black tracking-tight text-gray-900 mb-2">Provision Global Tenant</h1>
            <p className="text-gray-500 text-sm font-medium mb-12">Create a new organization and initialize its primary administrator.</p>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm font-bold border border-red-100 mb-8">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
                <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-blue-600 border-b border-blue-50 pb-2">Organization Details</h3>

                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Display Name</label>
                        <input
                            type="text"
                            required
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                            placeholder="Acme Corp"
                            value={tenantName}
                            onChange={(e) => setTenantName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">URL Slug</label>
                        <div className="flex">
                            <span className="bg-gray-50 border border-r-0 border-gray-200 px-3 py-3 rounded-l-xl text-sm font-bold text-gray-400 flex items-center">/</span>
                            <input
                                type="text"
                                required
                                className="w-full px-4 py-3 rounded-r-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                                placeholder="acme"
                                value={tenantSlug}
                                onChange={(e) => setTenantSlug(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-purple-600 border-b border-purple-50 pb-2">Primary Admin User</h3>

                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Admin Email</label>
                        <input
                            type="email"
                            required
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none font-bold"
                            placeholder="admin@acme.com"
                            value={adminEmail}
                            onChange={(e) => setAdminEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Initial Password</label>
                        <input
                            type="password"
                            required
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none font-bold"
                            placeholder="••••••••"
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                        />
                    </div>
                </div>

                <div className="md:col-span-2 flex space-x-3 pt-6 border-t border-gray-50 mt-4">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 bg-blue-600 text-white px-8 py-4 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:bg-gray-400 transition-all shadow-lg"
                    >
                        {isSubmitting ? 'Provisioning Resources...' : 'Create Tenant & Administrator'}
                    </button>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-8 py-4 rounded-xl text-sm font-bold border border-gray-200 hover:bg-gray-50 transition-all"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}
