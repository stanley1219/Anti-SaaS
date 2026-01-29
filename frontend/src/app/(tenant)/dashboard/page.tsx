'use client';

import { useAuth } from '@/lib/auth/context';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div>LOADING...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p className="mb-8">
        {user ? 'DASHBOARD STABLE' : 'NOT AUTHENTICATED'}
      </p>

      <div className="flex flex-col space-y-4 max-w-xs">
        <Link href="/profile" className="p-4 bg-gray-100 rounded hover:bg-gray-200 text-center font-bold">Profile</Link>
        <Link href="/settings" className="p-4 bg-gray-100 rounded hover:bg-gray-200 text-center font-bold">Settings</Link>

        {user?.primaryRole?.level === 0 && (
          <Link href="/universal-root/dashboard" className="p-4 bg-purple-100 rounded hover:bg-purple-200 text-center font-bold">Universal Root Dashboard</Link>
        )}

        {user?.primaryRole?.level === 1 && (
          <Link href="/admin-root/dashboard" className="p-4 bg-green-100 rounded hover:bg-green-200 text-center font-bold">Tenant Root Admin Dashboard</Link>
        )}

        {user?.primaryRole?.level === 2 && (
          <Link href="/admin/dashboard" className="p-4 bg-blue-100 rounded hover:bg-blue-200 text-center font-bold">Tenant Admin Dashboard</Link>
        )}

        {user && (
          <Link href="/admin-panel" className="p-4 bg-gray-100 rounded hover:bg-gray-200 text-center font-bold">Admin Panel</Link>
        )}
      </div>
    </div>
  );
}