-- Migration: Add tenant isolation safety constraints
-- Purpose: Database-level enforcement of multi-tenancy rules
-- Author: System
-- Date: 2026-01-26

BEGIN;

-- ============================================================================
-- PART 1: COMPOSITE UNIQUE CONSTRAINTS (Prevent duplicates within tenant scope)
-- ============================================================================

-- Users: Prevent duplicate emails within same tenant
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_email_key CASCADE;

ALTER TABLE users
ADD CONSTRAINT users_tenant_email_unique UNIQUE (tenant_id, email);

-- Expenses: External reference uniqueness per tenant (if applicable)
-- Uncomment if you track external IDs
-- ALTER TABLE expenses
-- ADD CONSTRAINT expenses_tenant_external_ref_unique UNIQUE (tenant_id, external_reference);

-- Workflow chains: One active chain per expense
ALTER TABLE approval_chains
ADD CONSTRAINT approval_chains_tenant_expense_unique UNIQUE (tenant_id, expense_id);

-- Sessions: Prevent token ID reuse across tenants
ALTER TABLE sessions
ADD CONSTRAINT sessions_tenant_session_unique UNIQUE (tenant_id, session_id);

-- ============================================================================
-- PART 2: PARTIAL INDEXES (Performance + soft-delete safety)
-- ============================================================================

-- Users: Active users only (non-deleted)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_tenant_active 
ON users (tenant_id, email) 
WHERE deleted_at IS NULL;

-- Expenses: Active expenses by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_tenant_status_active
ON expenses (tenant_id, status, created_at DESC)
WHERE deleted_at IS NULL;

-- Expenses: User's expense lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_tenant_user_active
ON expenses (tenant_id, user_id, created_at DESC)
WHERE deleted_at IS NULL;

-- Approval steps: Pending approvals per approver
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_approval_steps_tenant_approver_pending
ON approval_steps (tenant_id, approver_user_id, created_at)
WHERE status = 'pending';

-- Approval chains: Pending chains
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_approval_chains_tenant_pending
ON approval_chains (tenant_id, expense_id)
WHERE status = 'pending';

-- Sessions: Active sessions (non-revoked, non-expired)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_tenant_active
ON sessions (tenant_id, user_id, expires_at)
WHERE revoked_at IS NULL AND expires_at > NOW();

-- ============================================================================
-- PART 3: CHECK CONSTRAINTS (Enum validation & business rules)
-- ============================================================================

-- Expense status must be valid
ALTER TABLE expenses
ADD CONSTRAINT expenses_status_valid CHECK (
    status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED')
);

-- Approval step status must be valid
ALTER TABLE approval_steps
ADD CONSTRAINT approval_steps_status_valid CHECK (
    status IN ('pending', 'approved', 'rejected')
);

-- Approval chain status must be valid
ALTER TABLE approval_chains
ADD CONSTRAINT approval_chains_status_valid CHECK (
    status IN ('pending', 'approved', 'rejected')
);

-- Approval decision must be valid
ALTER TABLE approval_actions
ADD CONSTRAINT approval_actions_decision_valid CHECK (
    decision IN ('approved', 'rejected')
);

-- User status must be valid
ALTER TABLE users
ADD CONSTRAINT users_status_valid CHECK (
    status IN ('active', 'inactive', 'suspended')
);

-- Tenant status must be valid
ALTER TABLE tenants
ADD CONSTRAINT tenants_status_valid CHECK (
    status IN ('active', 'suspended', 'churned', 'trial')
);

-- Subscription status must be valid
ALTER TABLE subscriptions
ADD CONSTRAINT subscriptions_status_valid CHECK (
    status IN ('trial', 'active', 'past_due', 'cancelled', 'expired')
);

-- Expense amount must be positive
ALTER TABLE expenses
ADD CONSTRAINT expenses_amount_positive CHECK (amount > 0);

-- Sequence must be positive
ALTER TABLE approval_steps
ADD CONSTRAINT approval_steps_sequence_positive CHECK (sequence > 0);

-- ============================================================================
-- PART 4: FOREIGN KEY DELETE PROTECTION
-- ============================================================================

-- Prevent deleting a tenant if it has active data
-- Note: This requires explicit cleanup workflows

-- Expenses reference users (RESTRICT prevents orphaning)
ALTER TABLE expenses
DROP CONSTRAINT IF EXISTS expenses_user_id_fkey;

ALTER TABLE expenses
ADD CONSTRAINT expenses_user_id_fkey 
FOREIGN KEY (tenant_id, user_id) 
REFERENCES users(tenant_id, user_id)
ON DELETE RESTRICT;

-- Approval chains reference expenses (CASCADE for workflow cleanup)
ALTER TABLE approval_chains
DROP CONSTRAINT IF EXISTS approval_chains_expense_id_fkey;

ALTER TABLE approval_chains
ADD CONSTRAINT approval_chains_expense_id_fkey
FOREIGN KEY (tenant_id, expense_id)
REFERENCES expenses(tenant_id, expense_id)
ON DELETE CASCADE;

-- Approval steps reference chains (CASCADE for cleanup)
ALTER TABLE approval_steps
DROP CONSTRAINT IF EXISTS approval_steps_chain_id_fkey;

ALTER TABLE approval_steps
ADD CONSTRAINT approval_steps_chain_id_fkey
FOREIGN KEY (tenant_id, chain_id)
REFERENCES approval_chains(tenant_id, chain_id)
ON DELETE CASCADE;

-- Approval steps reference approver user (RESTRICT)
ALTER TABLE approval_steps
DROP CONSTRAINT IF EXISTS approval_steps_approver_user_id_fkey;

ALTER TABLE approval_steps
ADD CONSTRAINT approval_steps_approver_user_id_fkey
FOREIGN KEY (tenant_id, approver_user_id)
REFERENCES users(tenant_id, user_id)
ON DELETE RESTRICT;

-- Sessions reference users (CASCADE for cleanup on user deletion)
ALTER TABLE sessions
DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;

ALTER TABLE sessions
ADD CONSTRAINT sessions_user_id_fkey
FOREIGN KEY (tenant_id, user_id)
REFERENCES users(tenant_id, user_id)
ON DELETE CASCADE;

-- Subscriptions reference tenants (RESTRICT)
ALTER TABLE subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_tenant_id_fkey;

ALTER TABLE subscriptions
ADD CONSTRAINT subscriptions_tenant_id_fkey
FOREIGN KEY (tenant_id)
REFERENCES tenants(tenant_id)
ON DELETE RESTRICT;

-- ============================================================================
-- PART 5: TENANT_ID NOT NULL ENFORCEMENT
-- ============================================================================

-- Ensure every tenant-scoped table has non-nullable tenant_id
ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE approval_workflows ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE approval_chains ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE approval_steps ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE approval_actions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE sessions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE user_roles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE role_permissions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE subscriptions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE usage_records ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audit_logs ALTER COLUMN tenant_id SET NOT NULL;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================

-- Check all constraints are in place
-- SELECT conname, contype FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY conname;

-- Check all indexes
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname;

-- Verify tenant_id NOT NULL
-- SELECT table_name, column_name, is_nullable FROM information_schema.columns 
-- WHERE column_name = 'tenant_id' AND table_schema = 'public';
