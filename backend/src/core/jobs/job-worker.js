'use strict';

const os = require('os');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const logger = require('../logger');
const jobRepository = require('./job-repository');
const handlers = require('../../domain/jobs/handlers');

class JobWorker {
    constructor() {
        this.workerId = `${os.hostname()}-${uuidv4()}`;
        this.isActive = false;
        this.timer = null;
    }

    /**
     * Start the polling worker.
     */
    start() {
        if (this.isActive) return;
        this.isActive = true;
        logger.info({ workerId: this.workerId }, 'Job worker started');
        this.poll();
    }

    /**
     * Internal polling loop.
     */
    async poll() {
        if (!this.isActive) return;

        try {
            const jobs = await jobRepository.pickAndLockJobs(config.jobs.concurrency, this.workerId);

            if (jobs.length > 0) {
                logger.debug({ count: jobs.length }, 'Picked up jobs for processing');
                // Process jobs in parallel (up to concurrency limit)
                await Promise.all(jobs.map(job => this.processJob(job)));
            }
        } catch (err) {
            logger.error({ err }, 'Error in job worker polling loop');
        }

        this.timer = setTimeout(() => this.poll(), config.jobs.pollIntervalMs);
    }

    /**
     * Execute business logic for a single job.
     */
    async processJob(job) {
        const { job_id, type, tenant_id, payload } = job;
        const handler = handlers[type];

        if (!handler) {
            logger.error({ job_id, type }, 'No handler found for job type');
            await jobRepository.fail(tenant_id, job_id, 'No handler found');
            return;
        }

        try {
            logger.info({ job_id, type, tenant_id }, 'Processing job');

            await handler({
                jobId: job_id,
                tenantId: tenant_id,
                payload: payload
            });

            await jobRepository.complete(tenant_id, job_id);
            logger.info({ job_id, type, tenant_id }, 'Job completed successfully');
        } catch (err) {
            logger.error({ err, job_id, type, tenant_id }, 'Job execution failed');
            await jobRepository.fail(tenant_id, job_id, err.message);
        }
    }

    /**
     * Stop the worker gracefully.
     */
    stop() {
        this.isActive = false;
        if (this.timer) clearTimeout(this.timer);
        logger.info({ workerId: this.workerId }, 'Job worker stopped');
    }
}

module.exports = new JobWorker();
