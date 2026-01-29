# Expense & Reimbursement SaaS Backend Architecture

## Architecture Overview

The system is structured as a modular monolith with clear domain boundaries, designed to support horizontal scaling and eventual extraction into microservices if needed. The architecture prioritizes tenant isolation, auditability, and extensibility for future billing and feature gating requirements.

### Core Components

**Authentication & Authorization Domain**
Manages user identity verification, session lifecycle, role-based access control (RBAC), and permission enforcement. Operates independently of tenant-specific business logic and provides authentication context to all downstream domains. Responsible for issuing and validating authentication tokens with embedded tenant context.

**Tenant Management Domain**
Handles organization onboarding, configuration, and tenant-level metadata. Maintains tenant lifecycle states (trial, active, suspended, churned), settings, and feature flags. Acts as the authoritative source for tenant existence and status validation. Provides tenant context resolution for all inbound requests.

**Expense Management Domain**
Encapsulates expense creation, categorization, lifecycle management, and receipt handling. Enforces expense policies defined at the tenant level, such as spending limits, required fields, and category restrictions. Does not contain approval logic—exposes expense state transitions that are orchestrated by the workflow domain.

**Approval Workflow Domain**
Manages configurable approval chains, routing rules, and approval state machines. Operates on workflow-agnostic entities and can be reused across expense approvals, reimbursement approvals, or future approval types. Enforces tenant-specific workflow configurations such as sequential vs. parallel approvals, escalation rules, and delegation policies.

**Reimbursement Domain**
Handles reimbursement requests, payment scheduling, and reconciliation with approved expenses. Tracks payout status and integrates with external payment processors. Maintains separation from expense approval logic—only processes expenses that have completed the approval workflow.

**Reporting & Analytics Domain**
Provides read-optimized views for financial reporting, spending analysis, and audit trails. Uses materialized views or denormalized read models to avoid impacting transactional workloads. Enforces tenant-scoped queries and supports export functionality for accounting system integrations.

**Billing & Subscription Domain**
Manages subscription plans, usage metering, billing cycles, and payment collection. Integrates with the feature gating system to enforce plan-based access controls. Designed to operate independently of core expense workflows to allow billing changes without touching business logic.

**Notification & Communication Domain**
Handles asynchronous delivery of notifications (approval requests, updates, rejections) via email, webhooks, or push notifications. Provides a unified interface for all domains to trigger notifications without coupling to delivery mechanisms.

**Background Processing Infrastructure**
Executes asynchronous jobs such as receipt OCR processing, scheduled reports, billing cycle execution, and data exports. Uses a persistent job queue with retry logic, dead-letter handling, and tenant-aware job isolation.

---

## Multi-Tenancy Strategy

### Tenant Identification & Context Propagation

Tenants are identified by a globally unique `tenant_id` (UUID) assigned during organization onboarding. Every authenticated request carries tenant context extracted from the authentication token, which is validated and injected into the request context at the application middleware layer before any business logic executes.

All database queries, background jobs, and inter-domain calls explicitly include tenant context. There is no implicit tenant resolution—any operation without explicit tenant context fails fast. This ensures tenant safety is enforced at the application layer, not relying solely on database constraints.

### Data Isolation Model

The system employs a **shared database, shared schema** approach with row-level tenant isolation. Every tenant-scoped table includes a `tenant_id` column with a non-null constraint and a composite index on `(tenant_id, <primary key>)` to ensure query performance and isolation enforcement.

### Justification for Shared Database, Shared Schema

**Database-per-tenant** was rejected due to operational complexity at scale. Managing hundreds or thousands of databases introduces significant overhead in connection pooling, schema migrations, backups, and monitoring. It also complicates cross-tenant analytics for platform health and billing aggregation.

**Schema-per-tenant** was rejected because PostgreSQL does not optimize schema-level isolation well at scale, and connection management becomes complex when dynamically switching schemas per request. Schema migrations across hundreds of schemas also introduce deployment risk and extended downtime windows.

**Shared schema with row-level isolation** was chosen because:
- Single migration path for all tenants reduces deployment complexity
- Connection pooling is straightforward and efficient
- PostgreSQL Row-Level Security (RLS) can be used as a defense-in-depth mechanism alongside application-layer enforcement
- Backup and restore operations are simplified
- Cross-tenant platform analytics and aggregations are feasible
- Horizontal scaling via read replicas and sharding (by tenant_id ranges) is achievable without architectural changes

### Tenant Context Enforcement

Middleware extracts tenant context from the authenticated user's token and attaches it to the request context object. All service-layer methods require tenant context as an explicit parameter. Database access layers automatically inject tenant filters into all queries using query builders or ORM-level global scopes.

Tenant context is propagated to background jobs by embedding `tenant_id` in job payloads. Job workers validate tenant existence and status before processing.

### Tenant Isolation Guarantees

- All database queries are scoped by `tenant_id` enforced at both application and database (RLS) layers
- Background jobs explicitly carry tenant context and validate tenant status before execution
- File storage (receipts, exports) is partitioned by `tenant_id` in object storage paths
- API rate limiting and feature gating are enforced per tenant
- Cross-tenant data leakage is prevented by mandatory tenant scoping in all service methods and audited via automated tests

---

## Core Domain Boundaries

The system is decomposed into isolated domains, each responsible for a single area of business capability. Domains communicate through well-defined interfaces and avoid direct database access to other domains' tables.

### Authentication & Authorization
**Responsibility:** User identity, session management, RBAC, permissions  
**Owns:** User accounts, sessions, roles, permissions, authentication tokens  
**Exposes:** Authentication context (user_id, tenant_id, roles, permissions)  
**Dependencies:** None (foundational layer)

### Tenant Management
**Responsibility:** Organization lifecycle, settings, feature flags  
**Owns:** Tenant metadata, tenant status, feature entitlements  
**Exposes:** Tenant validation, feature flag resolution  
**Dependencies:** None (foundational layer)

### Expense Management
**Responsibility:** Expense creation, categorization, policy enforcement  
**Owns:** Expense records, categories, receipts, policy rules  
**Exposes:** Expense state transitions, policy validation  
**Dependencies:** Authentication (user context), Tenant Management (policy resolution)

### Approval Workflow
**Responsibility:** Approval routing, state machine execution, escalation  
**Owns:** Workflow definitions, approval chains, approval records  
**Exposes:** Workflow orchestration, approval state transitions  
**Dependencies:** Authentication (approver context), Tenant Management (workflow config)

### Reimbursement
**Responsibility:** Payment processing, reconciliation, payout tracking  
**Owns:** Reimbursement requests, payment records, payout schedules  
**Exposes:** Reimbursement initiation, payment status updates  
**Dependencies:** Expense Management (approved expenses), Approval Workflow (approval verification)

### Reporting & Analytics
**Responsibility:** Read models, aggregated views, audit trails  
**Owns:** Denormalized reporting tables, export jobs  
**Exposes:** Query interfaces, report generation  
**Dependencies:** All transactional domains (read-only access via events or read replicas)

### Billing & Subscription
**Responsibility:** Subscription management, usage tracking, payment collection  
**Owns:** Plans, subscriptions, invoices, payment methods  
**Exposes:** Plan entitlement checks, usage recording  
**Dependencies:** Tenant Management (tenant status), Authentication (billing admin access)

### Notification & Communication
**Responsibility:** Asynchronous message delivery  
**Owns:** Notification templates, delivery logs, webhook configurations  
**Exposes:** Notification dispatch interface  
**Dependencies:** Authentication (user contact info), Tenant Management (notification settings)

### Background Processing
**Responsibility:** Asynchronous job execution, scheduling  
**Owns:** Job queues, job execution logs, retry policies  
**Exposes:** Job enqueue interface, job status queries  
**Dependencies:** All domains (as job executors)

### Domain Communication Principles

- Domains never directly query other domains' database tables
- Inter-domain communication uses service interfaces or domain events
- Shared data (e.g., user contact info for notifications) is either replicated via events or fetched through service calls
- Each domain can evolve its internal data model without breaking other domains
- Domain boundaries align with future microservice extraction points

---

## Core Business Entities

These entities represent the fundamental concepts in the system's business domain. Definitions are intentionally abstract to avoid coupling to implementation details.

### Tenant (Organization)
Represents a customer organization using the platform. Encapsulates organizational identity, subscription status, and configuration. Acts as the primary isolation boundary for all tenant-scoped data.

### User
Represents an individual human or service account within a tenant. Users are always scoped to a single tenant and carry roles that define their permissions within that tenant's context.

### Session
Represents an authenticated session for a user. Tracks device/client context, issuance time, expiration, and revocation status. Sessions are tenant-scoped and enforce single-tenant access per session.

### Role
Represents a named collection of permissions within a tenant. Roles are tenant-specific configurations that define what actions users can perform within their organization. Examples: Admin, Manager, Employee, Accountant.

### Permission
Represents an atomic authorization capability, such as "create_expense", "approve_expense", or "view_reports". Permissions are system-defined but assigned to roles at the tenant level to allow customization.

### Expense
Represents a business expenditure submitted by a user for reimbursement or tracking. Encapsulates the amount, category, date, merchant, and associated receipts. Expenses transition through lifecycle states (draft, submitted, approved, rejected, reimbursed) orchestrated by workflow and reimbursement domains.

### Expense Category
Represents a classification for expenses, such as Travel, Meals, Office Supplies. Categories may have associated policy rules (e.g., receipt required for amounts above $25). Categories are tenant-configurable to allow organizational customization.

### Receipt
Represents digitized proof of an expense, such as an uploaded image or PDF. Receipts may undergo OCR processing to extract structured data (amount, merchant, date). Receipts are linked to expenses and stored securely with tenant isolation.

### Approval Workflow Definition
Represents a tenant-configured approval routing strategy. Defines the chain of approvers, conditions for approval routing (e.g., amount thresholds), escalation policies, and whether approvals are sequential or parallel.

### Approval Record
Represents an individual approval action within a workflow. Tracks the approver, timestamp, decision (approved/rejected), and optional comments. Approval records form an immutable audit trail of workflow execution.

### Reimbursement Request
Represents a request to pay back one or more approved expenses to a user. Tracks the total amount, payment method, payout schedule, and reconciliation status. Reimbursements are only created for expenses that have completed the approval workflow.

### Payment Record
Represents an executed payment transaction for a reimbursement. Tracks payment method, transaction ID, timestamp, and status (pending, completed, failed). Payment records enable reconciliation with external payment processors.

### Subscription Plan
Represents a billing tier offered by the platform, such as Free, Professional, Enterprise. Plans define feature entitlements, user limits, and pricing structures. Plans are system-defined but can have tenant-specific overrides for custom contracts.

### Subscription
Represents a tenant's active subscription to a plan. Tracks billing cycle, renewal date, payment status, and usage metrics. Subscriptions control access to plan-gated features.

### Feature Flag
Represents a boolean or tiered feature gate controlled at the tenant or plan level. Feature flags enable gradual rollouts, A/B testing, and plan-based access control without code changes.

### Notification Template
Represents a message template for user communications, such as "Expense Approved" or "Action Required: Pending Approval". Templates support variable interpolation and are tenant-customizable for branding.

### Audit Log Entry
Represents an immutable record of significant system events, such as expense creation, approval, rejection, or configuration changes. Audit logs are tenant-scoped and include actor, timestamp, action type, and affected entity for compliance and debugging.

### Background Job
Represents a unit of asynchronous work scheduled for execution. Jobs carry tenant context, retry policies, and priority levels. Jobs are idempotent and support cancellation or rescheduling.

---

## Design Principles for Future Extensibility

### Billing & Feature Gating Integration
The architecture ensures that adding billing plans and feature gates does not require refactoring core domains:
- Feature flag checks are abstracted into a centralized service queried by all domains
- Billing logic is isolated in the Billing & Subscription domain and does not leak into expense or approval logic
- Usage metering (e.g., expense count, user count) is recorded via domain events to avoid coupling billing to transactional flows

### Audit Trail & Compliance
- All state transitions in core workflows (expense, approval, reimbursement) emit immutable audit events
- Audit logs capture actor, tenant, timestamp, and action for regulatory compliance (SOC 2, GDPR)
- Soft deletes are used for critical entities to preserve audit history

### Horizontal Scalability
- Stateless application servers allow horizontal scaling behind a load balancer
- Database read replicas offload reporting and analytics queries
- Background job processing scales independently via worker pool expansion
- Tenant sharding can be implemented by partitioning the database on `tenant_id` without application changes

### Observability & Monitoring
- All requests are tagged with `tenant_id` for per-tenant monitoring and alerting
- Distributed tracing propagates tenant context across domain boundaries
- Rate limiting and anomaly detection operate per tenant to isolate noisy neighbors

---

This architecture establishes a foundation for a production-grade, multi-tenant SaaS backend with clear separation of concerns, tenant-first design, and extensibility for billing, feature gating, and operational scale.
