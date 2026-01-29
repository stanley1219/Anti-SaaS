# Production-Grade Database Schema Design

This document defines the PostgreSQL schema structure for the Expense & Reimbursement SaaS backend. It adheres strictly to the Shared Database, Shared Schema multi-tenancy model with Row-Level Security (RLS) as the primary isolation enforcement mechanism.

## Schema Design Principles

1.  **Strict Tenant Isolation**: All tenant-specific tables MUST include `tenant_id` as part of their primary key or unique constraints to enable database-level partitioning and efficient RLS.
2.  **Composite Foreign Keys**: All foreign keys referencing tenant-scoped tables MUST include `tenant_id` to prevent cross-tenant object references at the database level.
3.  **Financial Integrity**: Tables storing financial data (expenses, reimbursements) are structurally designed to be append-only or versioned; no physical deletion of financial history is permitted.
4.  **Soft Deletes**: Used for user-facing recoverability (e.g., `deleted_at` timestamp). Hard deletes are reserved for GDPR compliance requests only.

---

## 1. Tenant Management Domain

| Table Name | Purpose | Key Constraints | Important Indexes |
| :--- | :--- | :--- | :--- |
| `tenants` | Roots of the multi-tenancy graph. Stores organization profile, status, and subscription tier. | • PK: `tenant_id`<br>• `status` IN (trial, active, suspended, churned)<br>• **Never** hard deleted (legal retention) | • `(id)` (Primary)<br>• `(status)` for filtering |
| `tenant_settings` | Configuration key-value pairs or JSONB usage specific to a tenant (e.g., currency, timezone, locale). | • PK: `(tenant_id, key)`<br>• FK `tenant_id` -> `tenants(id)` | • `(tenant_id)` |
| `feature_flags` | Tenant-specific overrides for system feature gates. | • PK: `(tenant_id, feature_key)`<br>• FK `tenant_id` -> `tenants(id)` | • `(tenant_id)` |

## 2. Authentication & Authorization Domain

| Table Name | Purpose | Key Constraints | Important Indexes |
| :--- | :--- | :--- | :--- |
| `users` | Identity and profile information. Scoped to a tenant (standard SaaS model). | • PK: `(tenant_id, user_id)`<br>• Email unique per tenant (or globally if unified login)<br>• Soft delete enabled | • `(tenant_id, email)` (Login lookup)<br>• `(tenant_id, status)` |
| `roles` | Definitions of functional roles within a tenant (e.g., "Finance Admin"). | • PK: `(tenant_id, role_id)`<br>• FK `tenant_id` -> `tenants(id)` | • `(tenant_id)` |
| `permissions` | System-defined capabilities. Often global reference table, mapping to Roles via join table. | • PK: `permission_key`<br>• Immutable system data | • `(permission_key)` |
| `role_permissions` | Mapping of permissions to roles. | • PK: `(tenant_id, role_id, permission_key)`<br>• FK includes `tenant_id` checks | • `(tenant_id, role_id)` |
| `user_roles` | Assigns roles to users. | • PK: `(tenant_id, user_id, role_id)`<br>• Composite FK prevents cross-tenant role assignment | • `(tenant_id, user_id)` (Session building) |
| `sessions` | Active authentication sessions with expiration. | • PK: `(tenant_id, session_id)`<br>• TTL expiration required | • `(token_hash)` (Auth lookup)<br>• `(expires_at)` (Cleanup) |

## 3. Expense Management Domain

| Table Name | Purpose | Key Constraints | Important Indexes |
| :--- | :--- | :--- | :--- |
| `expense_categories` | Tenant-defined classifications (e.g., "Travel", "Meals"). | • PK: `(tenant_id, category_id)`<br>• Soft delete enabled | • `(tenant_id, status)` |
| `expenses` | The core financial record. Tracks amount, merchant, date, and current lifecycle state. | • PK: `(tenant_id, expense_id)`<br>• State machine constraint (draft -> submitted -> approved -> reimbursed)<br>• FK `user_id` MUST include `tenant_id` | • `(tenant_id, user_id, created_at)` (My Expenses)<br>• `(tenant_id, status, date)` (Reporting)<br>• `(tenant_id, category_id)` |
| `expense_line_items` | Granular breakdown of an expense if splitting is supported. | • PK: `(tenant_id, item_id)`<br>• FK `expense_id` parent check<br>• Sum of items MUST equal expense total (application or trigger constraint) | • `(tenant_id, expense_id)` |
| `receipts` | Metadata for file attachments (images/PDFs) stored in object storage. | • PK: `(tenant_id, receipt_id)`<br>• FK `expense_id` (1:N or M:N depending on design)<br>• Storage path MUST contain tenant_id | • `(tenant_id, expense_id)` |
| `expense_policies` | Rules engine configuration (e.g., "Max $50 for Meals"). | • PK: `(tenant_id, policy_id)`<br>• JSONB for flexible rule definitions | • `(tenant_id)` |

## 4. Approval Workflow Domain

| Table Name | Purpose | Key Constraints | Important Indexes |
| :--- | :--- | :--- | :--- |
| `approval_workflows` | Definitions of approval logic (e.g., "Over $100 needs Manager"). | • PK: `(tenant_id, workflow_id)`<br>• Priority ordering for conflict resolution | • `(tenant_id, active)` |
| `approval_chains` | Captures the specific sequence of required approvals for a *specific* expense (Materialized workflow). | • PK: `(tenant_id, chain_id)`<br>• FK `expense_id` (Unique per expense)<br>• Immutable once created to preserve audit trail | • `(tenant_id, expense_id)` |
| `approval_steps` | Individual nodes in the approval chain (e.g., "Step 1: Manager"). | • PK: `(tenant_id, step_id)`<br>• Status: pending, approved, rejected, skipped | • `(tenant_id, chain_id, status)` (Workflow engine lookup) |
| `approval_actions` | The actual decision event made by a human/system. | • PK: `(tenant_id, action_id)`<br>• **Immutable** (Audit critical)<br>• FK `approver_user_id` | • `(tenant_id, step_id)` |

## 5. Reimbursement Domain

| Table Name | Purpose | Key Constraints | Important Indexes |
| :--- | :--- | :--- | :--- |
| `reimbursement_batches` | Grouping of approved expenses for payment processing (e.g., "Oct 2023 Payouts"). | • PK: `(tenant_id, batch_id)`<br>• Status: open, processing, settled, failed | • `(tenant_id, status, created_at)` |
| `reimbursement_items` | Link table connecting `expenses` to `reimbursement_batches`. | • PK: `(tenant_id, batch_id, expense_id)`<br>• FK to `expenses` enforces strict `approved` state requirement | • `(tenant_id, expense_id)` (Prevent double pay) |
| `payments` | Records of the actual money movement transaction. | • PK: `(tenant_id, payment_id)`<br>• FK to `reimbursement_batch`<br>• External processor Reference ID (Unique) | • `(tenant_id, external_ref_id)` (Reconciliation) |

## 6. Billing & Subscription Domain

| Table Name | Purpose | Key Constraints | Important Indexes |
| :--- | :--- | :--- | :--- |
| `subscription_plans` | **Global Table**. Defines tiers (Free, Pro, Enterprise) and limits. | • PK: `plan_id`<br>• No `tenant_id` (Shared referential data) | • `(id)` |
| `subscriptions` | Active conceptual contract for a tenant. | • PK: `(tenant_id, subscription_id)`<br>• Only one active subscription per tenant | • `(tenant_id, status)` |
| `invoices` | Platform billing records (SaaS fees charged to the tenant). | • PK: `(tenant_id, invoice_id)`<br>• Immutable after finalization | • `(tenant_id, billing_period)` |
| `usage_records` | Aggregated metering data (e.g., "Active Users", "Processed Expenses"). | • PK: `(tenant_id, metric, period)`<br>• Idempotent upsert capability | • `(tenant_id, period)` |

## 7. Notifications Domain

| Table Name | Purpose | Key Constraints | Important Indexes |
| :--- | :--- | :--- | :--- |
| `notification_templates` | System or tenant-defined message formats. | • PK: `(tenant_id, template_id)`<br>• Fallback to system defaults if tenant specific missing | • `(tenant_id, event_type)` |
| `notification_logs` | History of sent messages. Critical for "I didn't get the email" debugging. | • PK: `(tenant_id, log_id)`<br>• Status: sent, failed, delivered | • `(tenant_id, user_id, created_at)` |

## 8. Audit Logging Domain

| Table Name | Purpose | Key Constraints | Important Indexes |
| :--- | :--- | :--- | :--- |
| `audit_logs` | Centralized timeline of all critical business actions. | • PK: `(tenant_id, log_id)`<br>• **Partitioned by tenant_id or time**<br>• **Append-Only** (DB permissions should deny UPDATE/DELETE)<br>• JSONB `metadata` for flexible context capturing | • `(tenant_id, entity_type, entity_id)` (History view)<br>• `(tenant_id, actor_user_id)` (User activity)<br>• `(created_at)` (Time-range queries) |

## 9. Background Jobs (Infrastructure)

| Table Name | Purpose | Key Constraints | Important Indexes |
| :--- | :--- | :--- | :--- |
| `background_jobs` | Persistent queue for async tasks (OCR, Report Gen, Email). | • PK: `(tenant_id, job_id)`<br>• Status: pinned, queued, processing, completed, failed, dead<br>• `locked_at` / `locked_by` for concurrency control | • `(queue_name, status, scheduled_at, priority)` (Worker polling)<br>• `(tenant_id)` (Isolation) |

---

## Audit & Compliance Strategy

### Immutability & Retention
*   **Append-Only Tables**: `audit_logs`, `approval_actions`, `payment_records`. These tables should ideally be backed by trigger-based protection or DB-level read-only user permissions for the application user.
*   **Soft Deletes**: `users`, `expenses`, `expense_categories`. Implemented via `deleted_at` column. Standard queries must implicitly filter `deleted_at IS NULL`.
*   **Hard Deletes**: Only permissible for `sessions` (after expiry) and `background_jobs` (after archival/success). GDPR "Right to be Forgotten" requests are processed via a specialized compliance workflow, not standard app logic.

### Cross-Cutting Concerns
*   **Currency Handling**: All monetary values in `expenses` and `payments` MUST use integer-based storage (cents/micros) plus a 3-char ISO currency code column. Floating point types are strictly forbidden.
*   **Timezones**: All timestamps (`created_at`, `audit_time`) must be stored in UTC (`TIMESTAMPTZ`). Display logic handles conversion to tenant/user local time.
