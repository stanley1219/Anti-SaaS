'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminService } from '@/lib/api/admin';
import { getErrorMessage } from '@/lib/api/error-utils';

export default function InviteUserPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            await adminService.createUser({ email, password });
            // router.push('/admin/users'); popcorn
            router.push('/users')
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-md">
            <h1 className="text-2xl font-black tracking-tight text-gray-900 mb-2">Invite New Member</h1>
            <p className="text-gray-500 text-sm font-medium mb-8">Send an invitation to join your organization.</p>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm font-bold border border-red-100 mb-6">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Email Address</label>
                    <input
                        type="email"
                        required
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none font-bold placeholder:font-medium transition-all"
                        placeholder="team@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Temporary Password</label>
                    <input
                        type="password"
                        required
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none font-bold placeholder:font-medium transition-all"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                <div className="flex space-x-3 pt-2">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 bg-black text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-gray-800 disabled:bg-gray-400 transition-all shadow-md"
                    >
                        {isSubmitting ? 'Sending...' : 'Create Account'}
                    </button>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-3 rounded-xl text-sm font-bold border border-gray-200 hover:bg-gray-50 transition-all"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}
