'use client';

import { useAuth } from '@/lib/auth/context';

export default function Header() {
    const { user, logout } = useAuth();

    return (
        <header className="border-b p-4 flex justify-between items-center">
            <div className="font-bold">ExpenseSaaS</div>
            <div className="flex items-center space-x-4">
                <span className="text-sm">{user?.name}</span>
                <button onClick={logout} className="text-sm text-red-500 underline">Logout</button>
            </div>
        </header>
    );
}
