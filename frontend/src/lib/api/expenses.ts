import api from './client';
import { Expense, ExpenseCreateInput } from '@/types/expense';

export const expenseService = {
    list: async (status?: string): Promise<Expense[]> => {
        const response = await api.get('/expenses', { params: { status } });
        return response.data.expenses;
    },

    getById: async (id: string): Promise<Expense> => {
        const response = await api.get(`/expenses/${id}`);
        return response.data;
    },

    create: async (data: ExpenseCreateInput): Promise<Expense> => {
        const response = await api.post('/expenses', data);
        return response.data;
    },

    submit: async (id: string): Promise<Expense> => {
        const response = await api.post(`/expenses/${id}/submit`);
        return response.data;
    }
};
