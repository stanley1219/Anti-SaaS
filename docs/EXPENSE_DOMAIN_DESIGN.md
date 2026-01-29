# Expense Management Domain Design

This document defines the core logic and rules for the Expense Management domain. It is strictly scoped to expense creation, state management, and policy enforcement triggers, delegating approval logic to the Approval Domain.

## 1. Expense Lifecycle

The expense lifecycle is modeled as a finite state machine. Transitions are strictly guarded by RBAC permissions and data consistency checks.

### Valid States
*   **DRAFT**: Initial state. User is editing data. Incomplete data allowed (mostly). Not visible to approvers.
*   **SUBMITTED**: Locked for editing. Policy validation passed. Visible to approvers. Awaiting approval workflow start.
*   **APPROVED**: Workflow completed successfully. Ready for reimbursement. Immutable logic applies.
*   **REJECTED**: Workflow completed with rejection. Sent back to user. Editable (can transition back to DRAFT or resubmit).
*   **REIMBURSED**: Payment processing complete. Strict immutability.

### Allowed Transitions & Guards

| From | To | Guard / Trigger | Role Required |
| :--- | :--- | :--- | :--- |
| `(New)` | `DRAFT` | `createExpense()` | User (Owner) |
| `DRAFT` | `SUBMITTED` | `submitExpense()`<br>• Policy checks pass<br>• Required fields present<br>• Receipts attached (if required) | User (Owner) |
| `SUBMITTED` | `DRAFT` | `recallExpense()`<br>• Only if approval workflow hasn't started (or config allows recall) | User (Owner) |
| `SUBMITTED` | `APPROVED` | `workflowComplete(outcome=APPROVED)`<br>• Triggered solely by Approval Domain event | System (via Domain Event) |
| `SUBMITTED` | `REJECTED` | `workflowComplete(outcome=REJECTED)`<br>• Triggered solely by Approval Domain event | System (via Domain Event) |
| `REJECTED` | `DRAFT` | `reopenExpense()` | User (Owner) |
| `APPROVED` | `REIMBURSED` | `paymentSettled()`<br>• Triggered solely by Reimbursement Domain event | System (via Domain Event) |

*Note: There is no direct transition from DRAFT to APPROVED. All expenses must pass through submission.*

---

## 2. Validation Rules

Validation occurs at two levels: Structural (Data Integrity) and Logical (Business Policy).

### Server-Side Data Integrity (Hard Rules)
These rules are enforced by the Expense Domain service layer before hitting the database.

*   **Amounts**: Must be positive integers. Zero-amount expenses are blocked unless explicitly allowed by tenant config (e.g., zero-dollar tracking).
*   **Currency**: Must match the tenant's base currency OR a valid enabled multi-currency code. If multi-currency, an exchange rate must be snapshotted at submission time.
*   **Dates**: Future dating is restricted (e.g., cannot be > 30 days in future). Past dating allowed but may trigger policy warnings (e.g., > 90 days old).
*   **Categories**: `category_id` must valid, active, and belong to the `tenant_id`.
*   **Merchant**: String text required. Sanitized for inputs.
*   **Receipts**: If `receipt_required` flag is true for the category/amount threshold, at least one `receipt_id` must be linked.

### Policy Integration (Soft Rules / Hard Gates)
The Expense Domain calls the `Tenant Management` (Policy) service during the `submitExpense()` transaction.

*   **Trigger**: On `submitExpense()`.
*   **Action**: Validate expense metadata against Tenant Policy Rules (e.g., "Max $50 for Lunch").
*   **Outcome**:
    *   *Pass*: Transition to SUBMITTED.
    *   *Warn*: Transition to SUBMITTED, but attach `policy_violation_warnings` metadata (visible to approvers).
    *   *Block*: Reject transition, return error to user.

### Idempotency
*   **Submission**: `submitExpense` allows idempotent retries. If already SUBMITTED, return success (no-op).
*   **Creation**: Use client-generated UUIDs (optional) or deduplication keys to prevent double-creation on network retries.

---

## 3. Access & Ownership Rules

RBAC enforcement happens at the Service Layer, using the User and Tenant context.

### Viewer/Editor Rules

| Actor | Visibility Scope | Edit Permission | logic |
| :--- | :--- | :--- | :--- |
| **Expense Owner** | Own expenses only. | **Yes** (if DRAFT/REJECTED).<br>**No** (if SUBMITTED/APPROVED/REIMBURSED). | `user_id == current_user.id` |
| **Direct Manager** | Expenses where `user_id` is a direct report. | **No** (Read Only). | `user_id IN (direct_reports)` |
| **Finance Admin** | All expenses in `tenant_id`. | **No** (Cannot edit user data).<br>**Yes** (Can admin-reject or force-edit *if* strictly audited & config allows). | `hasPermission('expense:admin_view')` |
| **Auditor** | All expenses in `tenant_id`. | **No** (Strict Read Only). | `hasPermission('expense:audit_view')` |

### RBAC Enforcement Strategy
*   **Service Layer Gates**: Every method signature includes `(Actor actor, ...)`
*   **Access Check**:
    ```text
    IF not actor.hasPermission('expense:view') THEN Throw Forbidden
    IF expense.user_id != actor.user_id AND not actor.hasPermission('expense:view_all') THEN Throw Forbidden
    ```
*   **Tenant Boundary**: implicit `AND tenant_id = actor.tenant_id` in all DB queries.

---

## 4. Receipt Handling

Receipts are treated as immutable evidence attachments.

### Attachment Logic
*   **Upload**: Performed via signed URLs to object storage (S3/GCS).
*   **Linking**: The `receipts` table entry is created with status `UNLINKED` initially.
*   **Assignment**: When saving an expense, a list of `receipt_ids` is provided. The service validates these receipts belong to the `tenant_id` and are not linked to another active expense.
*   **Metadata**:
    *   `content_type`: (image/jpeg, application/pdf).
    *   `file_size`: Max limit enforced (e.g., 10MB).
    *   `storage_path`: `tenants/{tenant_id}/expenses/{year}/{month}/{uuid}`.

### Storage & Security
*   **Tenant Isolation**: Object storage paths are strictly prefixed with `tenant_id`.
*   **Access Control**: Generating a download URL requires `expense:view` permission on the associated expense.
*   **Immutability**: Once an expense is SUBMITTED, linked receipts cannot be deleted or replaced throughout the audit lifecycle.

---

## 5. Domain Events & Audit Hooks

The domain emits events for cross-domain usage and strictly logs audit entries for compliance.

### Emitted Domain Events (Async)
Used by Approval, Notification, and Reporting domains.

1.  `ExpenseCreated { expense_id, user_id, amount, currency }`
2.  `ExpenseSubmitted { expense_id, submitted_at, total_amount, policy_flags[] }`
3.  `ExpenseStatusChanged { expense_id, old_status, new_status, reason }`
4.  `ExpenseDeleted { expense_id }` (Only for DRAFTs)

### Audit Logs (Sync/Transactional)
Written to the immutable `audit_logs` table within the same transaction as the state change.

| Action | Context Captured | Trigger Condition |
| :--- | :--- | :--- |
| `EXPENSE_CREATE` | Amount, Merchant, Category | Creation of new record. |
| `EXPENSE_SUBMIT` | Snapshot of Policy Checks, assigned Approval Chain ID | User clicks submit. |
| `EXPENSE_EDIT` | Diff of changed fields (Before/After) | Owner updates DRAFT or corrects REJECTED expense. |
| `RECEIPT_ATTACH` | Receipt ID, Filename | File linked to expense. |
| `POLICY_OVERRIDE` | Justification text provided by user | If soft-policy violation allows submission with reason. |

*Crucial: Audit logs must capture the `user_id` acting, the `tenant_id`, and a timestamp.*
