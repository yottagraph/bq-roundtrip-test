import { isBigQueryConfigured, runQuery, toRowObjects } from '~/server/utils/bigquery';

interface NoteRow {
    id: string;
    body: string;
    created_at: string;
}

/**
 * Return every saved note, newest first.
 */
export default defineEventHandler(async () => {
    if (!isBigQueryConfigured()) {
        throw createError({
            statusCode: 503,
            statusMessage: 'BigQuery is not configured for this tenant.',
        });
    }

    const result = await runQuery(
        `SELECT id, body, created_at FROM notes ORDER BY created_at DESC LIMIT 500`
    );

    const rows = toRowObjects(result) as unknown as NoteRow[];

    return {
        rows,
        truncated: result.truncated,
        totalRows: result.totalRows,
    };
});
