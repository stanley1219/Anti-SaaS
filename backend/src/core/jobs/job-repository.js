'use strict';

const { tenantQuery, systemQuery } = require('../database/tenant-query');

class JobRepository {
  /**
   * Enqueue a new background job.
   */
  async enqueue(tenantId, type, payload, options = {}) {
    const { scheduledAt = new Date(), priority = 0 } = options;
    const query = `
      INSERT INTO background_jobs (
        tenant_id, type, payload, scheduled_at, priority, status
      )
      VALUES ($1, $2, $3, $4, $5, 'queued')
      RETURNING *
    `;
    const result = await tenantQuery(tenantId, query, [
      tenantId, type, JSON.stringify(payload), scheduledAt, priority
    ]);
    return result.rows[0];
  }

  /**
   * Pick up queued jobs and lock them for processing.
   * Atomic lock using SKIP LOCKED.
   * SYSTEM OPERATION: Crosses tenant boundaries to find work.
   */
  async pickAndLockJobs(limit = 1, lockId) {
    const query = `
      UPDATE background_jobs
      SET status = 'processing',
          locked_at = NOW(),
          locked_by = $1,
          attempts = attempts + 1
      WHERE job_id IN (
        SELECT job_id
        FROM background_jobs
        WHERE status IN ('queued', 'failed')
          AND attempts < $2
          AND (scheduled_at <= NOW() OR scheduled_at IS NULL)
          AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '5 minutes')
        ORDER BY priority DESC, scheduled_at ASC
        LIMIT $3
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `;
    const config = require('../../config');
    const result = await systemQuery(query, [lockId, config.jobs.maxRetries, limit]);
    return result.rows;
  }

  /**
   * Mark a job as completed.
   */
  async complete(tenantId, jobId) {
    const query = `
      UPDATE background_jobs
      SET status = 'completed',
          locked_at = NULL,
          locked_by = NULL,
          completed_at = NOW()
      WHERE tenant_id = $1 AND job_id = $2
    `;
    await tenantQuery(tenantId, query, [tenantId, jobId]);
  }

  /**
   * Mark a job as failed and schedule retry with exponential backoff.
   * Logic:
   * - If attempts >= maxRetries, move to 'permanently_failed' (Dead Letter)
   * - Otherwise, schedule retry: 2^attempts minutes from now
   */
  async fail(tenantId, jobId, error, retryAt = null) {
    const config = require('../../config');
    const query = `
      UPDATE background_jobs
      SET status = CASE 
            WHEN attempts >= $3 THEN 'permanently_failed'
            ELSE 'failed'
          END,
          locked_at = NULL,
          locked_by = NULL,
          last_error = $4,
          scheduled_at = CASE
            WHEN attempts >= $3 THEN NULL
            ELSE COALESCE($5, NOW() + (INTERVAL '1 minute' * POWER(2, attempts)))
          END,
          updated_at = NOW()
      WHERE tenant_id = $1 AND job_id = $2
    `;
    await tenantQuery(tenantId, query, [
      tenantId,
      jobId,
      config.jobs.maxRetries,
      error.toString(),
      retryAt
    ]);
  }
}

module.exports = new JobRepository();
