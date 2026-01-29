import api from './client';

export const adminService = {
    // System Level (Universal Admin)
    listTenants: async () => {
        const response = await api.get('/admin/tenants');
        return response.data;
    },
    createTenant: async (tenantData: any, adminData: any) => {
        const response = await api.post('/admin/tenants', { tenant: tenantData, admin: adminData });
        return response.data;
    },
    updateTenantStatus: async (tenantId: string, status: string) => {
        const response = await api.patch(`/admin/tenants/${tenantId}/status`, { status });
        return response.data;
    },
    revokeTenantRootAdmin: async (tenantId: string, adminId: string) => {
        const response = await api.delete(`/admin/tenants/${tenantId}/admin`, { data: { adminId } });
        return response.data;
    },

    // User Management
    listUsers: async () => {
        const response = await api.get('/admin/users');
        return response.data;
    },
    createUser: async (userData: any) => {
        const response = await api.post('/admin/users', userData);
        return response.data;
    },
    updateUser: async (userId: string, updates: any) => {
        const response = await api.patch(`/admin/users/${userId}`, updates);
        return response.data;
    },
    deleteUser: async (userId: string) => {
        const response = await api.delete(`/admin/users/${userId}`);
        return response.data;
    },

    // Role Management
    listRoles: async () => {
        const response = await api.get('/admin/roles');
        return response.data;
    },
    assignRole: async (userId: string, roleId: string) => {
        const response = await api.post(`/admin/users/${userId}/roles`, { roleId });
        return response.data;
    },
    revokeRole: async (userId: string, roleId: string) => {
        const response = await api.delete(`/admin/users/${userId}/roles/${roleId}`);
        return response.data;
    }
};
