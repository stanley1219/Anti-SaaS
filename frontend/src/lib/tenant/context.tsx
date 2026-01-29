'use client';

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface TenantContextType {
    tenantId: string | null;
    isLoading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
    const params = useParams();
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // 1. Prefer URL param (source of truth for navigation)
        if (params?.tenantId) {
            setTenantId(params.tenantId as string);
        } else {
            // 2. Fallback to cookie for non-params routes
            const match = document.cookie.match(/tenantId=([^;]+)/);
            setTenantId(match ? match[1] : null);
        }
        setIsLoading(false);
    }, [params?.tenantId]);

    return (
        <TenantContext.Provider value={{ tenantId, isLoading }}>
            {children}
        </TenantContext.Provider>
    );
}

export function useTenant() {
    const context = useContext(TenantContext);
    if (context === undefined) {
        throw new Error('useTenant must be used within a TenantProvider');
    }
    return context;
}
