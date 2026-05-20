import { randomUUID } from 'node:crypto';

import { isBigQueryConfigured, runMutation } from '~/server/utils/bigquery';

interface CreateNoteBody {
    body?: string;
}

/**
 * Insert a single row into the `notes` table.
 */
export default defineEventHandler(async (event) => {
    if (!isBigQueryConfigured()) {
        throw createError({
            statusCode: 503,
            statusMessage: 'BigQuery is not configured for this tenant.',
        });
    }

    const payload = await readBody<CreateNoteBody>(event);
    const body = (payload?.body ?? '').trim();
    if (!body) {
        throw createError({ statusCode: 400, statusMessage: 'body is required' });
    }

    const id = randomUUID();
    const createdAt = new Date().toISOString();

    const result = await runMutation(
        `INSERT INTO notes (id, body, created_at) VALUES (@id, @body, @created_at)`,
        {
            params: [
                { name: 'id', type: 'STRING', value: id },
                { name: 'body', type: 'STRING', value: body },
                { name: 'created_at', type: 'TIMESTAMP', value: createdAt },
            ],
        }
    );

    return {
        ok: true,
        note: { id, body, created_at: createdAt },
        jobId: result.jobId,
        pending: result.pending,
        inserted: result.numDmlAffectedRows,
    };
});
