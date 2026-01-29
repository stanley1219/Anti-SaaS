'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { getErrorMessage } from '@/lib/api/error-utils';

export default function LoginPage() {
    const [tenantId, setTenantId] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const { login, isLoading } = useAuth();
    const [loading, setLoading] = useState(false);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            await login(tenantId, email, password);
        } catch (err: any) {
            setError(getErrorMessage(err));
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
            <div className="w-full max-w-md bg-white border border-gray-200 p-10 rounded-2xl shadow-xl space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-black tracking-tighter text-gray-900">Sign In</h1>
                    <p className="text-gray-500 font-medium text-sm">Enter your workspace details to continue.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-5">
                        <div>
                            <label htmlFor="tenantId" className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Tenant ID</label>
                            <input
                                id="tenantId"
                                type="text"
                                placeholder="your-workspace-slug"
                                value={tenantId}
                                onChange={(e) => setTenantId(e.target.value)}
                                className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 text-sm font-medium outline-none transition-all focus:bg-white focus:ring-2 focus:ring-gray-100 focus:border-gray-300"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Email Address</label>
                            <input
                                id="email"
                                type="email"
                                placeholder="name@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 text-sm font-medium outline-none transition-all focus:bg-white focus:ring-2 focus:ring-gray-100 focus:border-gray-300"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Password</label>
                            <input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 text-sm font-medium outline-none transition-all focus:bg-white focus:ring-2 focus:ring-gray-100 focus:border-gray-300"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-600 animate-in fade-in slide-in-from-top-1" role="alert">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-black text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-50 hover:bg-gray-800 transition-all shadow-lg focus:ring-2 focus:ring-offset-2 focus:ring-black outline-none"
                    >
                        {isLoading ? 'Signing you in...' : 'Enter Workspace'}
                    </button>
                </form>
            </div>
        </div>
    );
}
