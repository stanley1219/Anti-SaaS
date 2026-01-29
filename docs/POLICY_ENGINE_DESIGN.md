# Policy Enforcement Engine Design

This document defines the Policy Enforcement Engine, responsible for validating expenses against tenant-configured rules. It operates as a stateless validation service invoked by the Expense Domain.

## 1. Policy Types

Policies are defined as JSON rules stored in `expense_policies` (per schema design).

### Spend Limits
*   **Per-Expense Limit**: Maximum amount allowed for a single transaction.
    *   *Example*: "Max $50 for Office Supplies".
*   **Per-Period Aggregations** (Advanced): Cumulative limits over a sliding window or calendar period.
    *   *Example*: "Max $500 per month for Team Events".
    *   *Implementation*: Requires a real-time aggregation query on `expenses` table for the user/category within the period window during validation.
*   **Currency Check**: Automatic validation against tenant usage—spend limits are defined in tenant base currency; foreign expenses are converted using the spot rate for validation.

### Receipt Compliance
*   **Threshold-Based**: Receipts required only if amount > $X.
*   **Category-Based**: Receipts always required for specific categories (e.g., "Air Travel").
*   **Random Audit**: Probabilistic flag (e.g., "Require receipt for 5% of all expenses") for audit coverage.

### Data & Metadata Requirements
*   **Merchant Whitelist/Blacklist**: Block submission if merchant matches regex (e.g., "No gambling sites").
*   **Mandatory Fields**: Require specific metadata keys for categories (e.g., "Attendees" list required for "Client Meal").
*   **Age Limits**: Block expenses incurred > X days ago (Standard: 90 days).

### Role-Based Exceptions
*   Policies can define `exception_roles` (list of Role IDs).
*   *Example*: "Max Hotel Rate $200 (Exception: Executives allowed $500)".
*   If a user has an exception role, the standard policy is skipped or replaced by the tiered limit.

---

## 2. Evaluation Flow

Policy evaluation is synchronous and occurs during the strict transition from **DRAFT** to **SUBMITTED**.

### Step 1: Trigger
User attempts `submitExpense(expense_id)`. The Expense Domain locks the record and invokes `PolicyService.evaluate(expense, user_context)`.

### Step 2: Policy Resolution
1.  Fetch all active policies for `tenant_id`.
2.  Filter policies applicable to the expense's `category_id`, `user_id` (via roles), and `amount`.

### Step 3: Rule Execution
Evaluate each applicable policy. Collect results into two buckets:
*   **Violations (HARD)**: Fundamental breaches that strictly prevent submission.
*   **Warnings (SOFT)**: Breaches allowed but flagged for approvers.

### Step 4: Outcome Determination
*   **IF any HARD Violations**:
    *   **Action**: Abort submission transaction.
    *   **Return**: Error 422 Unprocessable Entity with list of violation messages.
*   **IF only SOFT Warnings (or PASS)**:
    *   **Action**: Proceed with submission.
    *   **Persist**: Store warnings in `expense.policy_flags` (JSONCA) for the Approval Workflow to read.
    *   **Return**: Success 200 (with warning notices).

---

## 3. Enforcement Rules

### Server-Side Authority
*   Client-side validation is purely for UX.
*   The Policy Engine is the sole source of truth.
*   Bypassing the UI (direct API calls) triggers the exact same checks.

### Idempotency
*   Policy evaluation is functional: `F(Expense, User, TenantConfig) -> Result`.
*   Retrying submission on an unchanged expense yields the same result (assuming configuration hasn't changed).
*   Policy snapshotting: The *result* of the policy check (warnings) is frozen on the Expense record at submission time. Future policy changes do not retroactively flag already-submitted expenses.

### Tenant Isolation
*   Policy fetching uses strict `WHERE tenant_id = ?` clauses.
*   Cached policy definitions (if using Redis) are namespaced by `tenant_id`.
*   Users cannot trigger evaluation of another tenant's policies.

---

## 4. Domain Integrations

### Integration: Expense Domain
*   **Caller**: The Expense Service calls `PolicyService.validate()`.
*   **State**: The Expense Service updates the status to `SUBMITTED` only if the Policy Service returns a PASS/WARN result.
*   **Persistence**: The Expense Service saves the returned `policy_flags` (e.g., `["WARN_NO_RECEIPT_UNDER_THRESHOLD", "WARN_HIGH_AMOUNT"]`) into the expense record.

### Integration: Approval Workflow Domain
*   **Consumer**: The Workflow Engine reads `expense.policy_flags` to determine routing.
*   **Logic**:
    *   *Standard Route*: No flags. -> "Manager Approval".
    *   *Escalation Route*: Has `WARN_HIGH_AMOUNT`. -> "Manager + Director Approval".
*   **Visibility**: Approvers see a UI banner: "This expense exceeded the lunch limit ($50) by $12."

### Integration: Audit Logging
*   **Event**: `POLICY_EVALUATION_COMPLETE`
*   **Payload**:
    *   `result`: "BLOCKED" | "PASSED_WITH_WARNINGS"
    *   `hard_violations`: `["Max limit $50"]` (only if blocked)
    *   `soft_warnings`: `["Missing Receipt"]`
*   **Purpose**: Compliance auditing. Proof that constraints were enforced at the time of submission.
