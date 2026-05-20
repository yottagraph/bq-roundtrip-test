import { isBigQueryConfigured, runMutation } from '~/server/utils/bigquery';

/**
 * Idempotently create the `notes` table in the tenant's analytics dataset.
 * Safe to call on every page load; `CREATE TABLE IF NOT EXISTS` is a no-op
 * after the first successful call.
 */
export default defineEventHandler(async () => {
    if (!isBigQueryConfigured()) {
        throw createError({
            statusCode: 503,
            statusMessage: 'BigQuery is not configured for this tenant.',
        });
    }

    const result = await runMutation(`
        CREATE TABLE IF NOT EXISTS notes (
            id STRING NOT NULL,
            body STRING NOT NULL,
            created_at TIMESTAMP NOT NULL
        )
        PARTITION BY DATE(created_at)
    `);

    return {
        ok: true,
        jobId: result.jobId,
        pending: result.pending,
        statementType: result.statementType,
    };
});
