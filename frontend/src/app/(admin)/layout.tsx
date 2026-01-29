'use client';

import { useAuth } from '@/lib/auth/context';
import AdminSidebar from '@/components/AdminSidebar';
import Header from '@/components/Header';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) return <div className="p-12 text-center text-gray-500 font-medium">Verifying access...</div>;

    if (!isAuthenticated) {
        return <div className="p-12 text-center text-red-600 font-bold">UNAUTHENTICATED ADMIN ACCESS</div>;
    }

    return (
        <div className="flex min-h-screen">
            <AdminSidebar />
            <div className="flex-1 flex flex-col">
                <Header />
                <main className="p-8 max-w-6xl w-full mx-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
