import { User } from '@/types/auth';

export function hasPermission(user: User | null, permission: string): boolean {
    return user?.permissions.includes(permission) ?? false;
}

export function hasAnyPermission(user: User | null, permissions: string[]): boolean {
    return permissions.some((p) => hasPermission(user, p));
}

export function hasRole(user: User | null, roleName: string): boolean {
    return user?.roles.some((r) => r.name === roleName) ?? false;
}

export function isTenantRootAdmin(user: User | null): boolean {
    // Tenant Root Admin has level 1
    return user?.roles.some((r) => r.level === 1) ?? false;
}

export function isUniversalRootAdmin(user: User | null): boolean {
    // Universal Root Admin has level 0
    return user?.roles.some((r) => r.level === 0) ?? false;
}
