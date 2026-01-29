import api from './client';
import { Expense } from '@/types/expense';

export const approvalService = {
    listPending: async (): Promise<Expense[]> => {
        const response = await api.get('/approvals/pending');
        return response.data.expenses;
    },

    approve: async (id: string): Promise<Expense> => {
        const response = await api.post(`/expenses/${id}/approve`);
        return response.data;
    },

    reject: async (id: string): Promise<Expense> => {
        const response = await api.post(`/expenses/${id}/reject`);
        return response.data;
    }
};
