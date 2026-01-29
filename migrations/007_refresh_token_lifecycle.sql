-- Migration: Refresh Token Lifecycle
-- Purpose: Implement secure refresh token rotation and revocation

BEGIN;

-- Drop old sessions table if it exists (assuming we are migrating toward the new structure)
DROP TABLE IF EXISTS sessions;

CREATE TABLE refresh_tokens (
    token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    replaced_by UUID REFERENCES refresh_tokens(token_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, user_id) ON DELETE CASCADE
);

-- Indexes for performance and lookup
CREATE INDEX idx_refresh_tokens_lookup ON refresh_tokens (tenant_id, token_id);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (tenant_id, user_id);
-- Fast check for active tokens in a chain
CREATE INDEX idx_refresh_tokens_rotation ON refresh_tokens (replaced_by) WHERE replaced_by IS NOT NULL;

COMMIT;
