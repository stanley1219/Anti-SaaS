import { z } from 'zod';

export const ExpenseStatusEnum = z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID']);
export type ExpenseStatus = z.infer<typeof ExpenseStatusEnum>;

export const ExpenseSchema = z.object({
    expense_id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    user_id: z.string().uuid(),
    title: z.string(),
    amount: z.number(),
    currency: z.string(),
    status: ExpenseStatusEnum,
    date: z.string().datetime(),
    category_id: z.string().uuid().optional(),
    merchant: z.string().optional(),
    description: z.string().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime()
});

export type Expense = z.infer<typeof ExpenseSchema>;

export const ExpenseCreateSchema = z.object({
    title: z.string().min(1, 'Title is required').max(100),
    amount: z.coerce.number().positive('Amount must be positive'),
    currency: z.string().length(3, 'Currency code must be 3 characters'),
    date: z.string(), // ISO string from input type="date"
    category_id: z.string().uuid().optional().or(z.literal('')),
    merchant: z.string().optional(),
    description: z.string().max(500).optional()
});

export type ExpenseCreateInput = z.infer<typeof ExpenseCreateSchema>;
