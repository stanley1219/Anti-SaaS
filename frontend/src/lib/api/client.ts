import axios from 'axios';

const api = axios.create({
    baseURL: '/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

// Helper to get cookies in client side
const getCookie = (name: string) => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
};

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
    accessToken = token;
};

// Request interceptor
api.interceptors.request.use((config) => {
    // 1. Inject Tenant ID from cookie if present (fallback for backend tracing)
    const tenantId = getCookie('tenantId');
    if (tenantId) {
        config.headers['X-Tenant-ID'] = tenantId;
    }

    // 2. Authorization header from setter source
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
});

// Response interceptor
api.interceptors.response.use(
    (response) => {
        // Unwrap standard success wrapper: { status: 'success', data: { ... } }
        if (response.data?.status === 'success') {
            return { ...response, data: response.data.data };
        }
        return response;
    },
    (error) => {
        // 1. Extract error details from backend response
        // Backend returns: { error: { message: string, code: string, requestId: string, ... } }
        // or sometimes just { error: string } for simpler implementations
        const errorData = error.response?.data?.error;

        let message = error.message; // Default to Axios error message
        let code = error.response?.data?.code || 'ERROR';

        if (errorData) {
            if (typeof errorData === 'object') {
                message = errorData.message || message;
                code = errorData.code || code;
            } else if (typeof errorData === 'string') {
                message = errorData;
            }
        }

        // 2. Attach normalized error info for components to use
        error.normalizedError = { message, code };

        return Promise.reject(error);
    }
);

export default api;
