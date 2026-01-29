import { z } from 'zod';

export const RoleSchema = z.object({
    name: z.string(),
    level: z.number(),
    id: z.string().uuid().optional(),
    isSystem: z.boolean().optional(),
});

export type Role = z.infer<typeof RoleSchema>;

export const UserSchema = z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    email: z.string().email(),
    name: z.string().optional(),
    status: z.enum(['active', 'inactive', 'suspended']),
    permissions: z.array(z.string()),
    roles: z.array(RoleSchema),
    primaryRole: RoleSchema.optional(),
});

export type User = z.infer<typeof UserSchema>;

export interface AuthState {
    user: User | null;
    accessToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}
