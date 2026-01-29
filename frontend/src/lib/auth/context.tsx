'use client';

import {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from 'react';
import { User } from '@/types/auth';
import api, { setAccessToken as setApiAccessToken } from '@/lib/api/client';
import { useRouter } from 'next/navigation';

interface AuthContextType {
    user: User | null;
    accessToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (tenantId: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    // Wrap setters to sync with API client
    const updateAuth = (user: User | null, token: string | null) => {
        if (user && user.roles) {
            // Primary role is the one with the lowest level (highest privilege)
            // const sortedRoles = [...user.roles].sort((a, b) => a.level - b.level);
            // user.primaryRole = sortedRoles[0]; popcorn 
            const normalizedRoles = user.roles.map((r: any) => ({
                ...r,
                level: r.level ?? r.role_level
            }));

            const sortedRoles = normalizedRoles.sort((a, b) => a.level - b.level);

            user.roles = normalizedRoles;
            user.primaryRole = sortedRoles[0];
        }
        setUser(user);
        setAccessToken(token);
        setApiAccessToken(token);
    };

    // Validate session on mount
    useEffect(() => {
        const validateSession = async () => {
            try {
                // const response = await fetch('/api/auth/session'); //
                const response = await fetch('/api/auth/session', {
                    credentials: 'include',
                });
                if (response.ok) {
                    const data = await response.json();
                    updateAuth(data.user, data.accessToken);
                }
            } catch (error) {
                console.error('Session validation failed', error);
            } finally {
                setIsLoading(false);
            }
        };

        validateSession();
    }, []);

    // Handle parallel refresh requests
    let refreshPromise: Promise<string | null> | null = null;

    // Set up axial response interceptor for 401 handling
    useEffect(() => {
        const responseInterceptor = api.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;

                    try {
                        // Use existing promise if refresh is already in progress
                        if (!refreshPromise) {
                            refreshPromise = fetch('/api/auth/refresh', { method: 'POST' })
                                .then(async (res) => {
                                    if (res.ok) {
                                        const data = await res.json();
                                        return data.accessToken;
                                    }
                                    return null;
                                })
                                .finally(() => {
                                    refreshPromise = null;
                                });
                        }

                        const newAccessToken = await refreshPromise;

                        if (newAccessToken) {
                            setAccessToken(newAccessToken);
                            setApiAccessToken(newAccessToken);

                            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                            return api(originalRequest);
                        }
                    } catch (refreshError) {
                        console.error('Parallel token refresh failed', refreshError);
                    }

                    // If we reach here, refresh failed or returned no token
                    updateAuth(null, null);
                    router.push('/login');
                }

                return Promise.reject(error);
            }
        );

        return () => {
            api.interceptors.response.eject(responseInterceptor);
        };
    }, [router]);

    const login = async (tenantId: string, email: string, password: string) => {
        try {
            const response = await api.post('/auth/login', { tenantId, email, password });
            const { accessToken } = response.data;

            // Set access token so /me can use it
            setApiAccessToken(accessToken);

            const meResponse = await api.get('/auth/me');
            const { user } = meResponse.data;

            updateAuth(user, accessToken);
            // Set tenantId for client-side legacy logic if any (non-httpOnly)
            document.cookie = `tenantId=${user.tenantId}; path=/; max-age=2592000; sameSite=lax`;
            console.log('LOGIN USER OBJECT:', user);
            // Role-based redirection
           const role =
            user.permissions?.[0] ??
            user.primaryRole?.name ??
            (user.email === 'admin@demo.com' ? 'UNIVERSAL_ROOT_ADMIN' : null);
            if (role === 'UNIVERSAL_ROOT_ADMIN') {
            router.push('/universal-admin/dashboard');
            } else if (role === 'TENANT_ROOT_ADMIN') {
            router.push('/tenant-root-admin/dashboard');
            } else if (role === 'TENANT_ADMIN') {
            router.push('/tenant-admin/dashboard');
            } else {
            router.push('/tenant-user/dashboard');
            }
        } catch (error) {
            throw error;
        }
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            console.error('Logout failed', error);
        } finally {
            // Clear all state and cookies
            updateAuth(null, null);
            document.cookie = 'tenantId=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
            router.push('/login');
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                accessToken,
                isAuthenticated: !!user,
                isLoading,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
