'use client';

import { useAuth } from '@/lib/auth/context';

export default function TenantLayout({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();

    // Lightweight check - just to have it in context, but never redirecting
    return <>{children}</>;
}