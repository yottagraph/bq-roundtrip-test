# BQ Roundtrip Test

## Vision

## What we're building

A minimal Aether app that proves the BC 2.0 BigQuery roundtrip works end-to-end: the app should be able to **write rows into the per-tenant BigQuery analytical dataset and read them back**, all through the Broadchurch Portal gateway.

## Single page: `/notes`

One page with two things stacked vertically:

1. A `<v-form>` with a single `<v-textarea>` and a 'Save note' submit button.
2. A `<v-data-table>` listing every saved note, newest first, with columns `created_at` (formatted) and `body`.

When the form is submitted:

1. POST the note body to a server route `/api/notes/create`.
2. That server route uses `useElementalClient`'s pattern? No — use a plain `$fetch` to the portal gateway BigQuery mutation endpoint (details below).
3. Refresh the table.

When the page loads (or after a save), call `/api/notes/list` which runs a `SELECT` against the same table.

## BigQuery wiring (the important part)

The tenant has a per-tenant GCP project + a BigQuery dataset auto-created at provisioning time. The runtime env vars are already injected into Vercel by the platform — **do not duplicate them in `.env`**:

- `NUXT_PUBLIC_BIGQUERY_ENABLED=true`
- `NUXT_PUBLIC_BIGQUERY_PROJECT_ID=bc-bq-roundtrip-test`
- `NUXT_PUBLIC_BIGQUERY_DATASET_ID=bc_bq_roundtrip_test_analytics`
- `NUXT_PUBLIC_BIGQUERY_LOCATION=<region>` (varies)
- `NUXT_PUBLIC_GATEWAY_URL=https://broadchurch-portal-194773164895.us-central1.run.app`
- `NUXT_PUBLIC_TENANT_ORG_ID=<this tenant's org_id>`

All BigQuery work must go through the portal gateway — we never talk to BigQuery directly from the Vercel function. The gateway routes are:

- `POST {GATEWAY_URL}/api/bigquery/{TENANT_ORG_ID}/mutation` for DDL/DML
- `POST {GATEWAY_URL}/api/bigquery/{TENANT_ORG_ID}/query` for SELECTs

Body shape (mutation):
```
{
  "sql": "INSERT INTO notes (id, body, created_at) VALUES (@id, @body, @created_at)",
  "params": [
    { "name": "id", "type": "STRING", "value": "<uuid>" },
    { "name": "body", "type": "STRING", "value": "..." },
    { "name": "created_at", "type": "TIMESTAMP", "value": "2026-05-19T20:00:00Z" }
  ],
  "defaultDataset": "bc_bq_roundtrip_test_analytics"
}
```
Body shape (query): same `sql` + `defaultDataset`, no `params` if not needed. Response has `rows: [...]`.

## One-time bootstrap

Before the page can work, the `notes` table must exist. Two options — pick whichever is cleaner:

- **Option A** (preferred): a server route `/api/notes/ensure-schema` that does `CREATE TABLE IF NOT EXISTS notes (id STRING, body STRING, created_at TIMESTAMP)` via the mutation endpoint, called once at page load (idempotent so this is safe).
- **Option B**: a Nuxt server plugin that runs the CREATE TABLE IF NOT EXISTS at server startup.

## Success criteria for the build agent

When you (the agent) finish, you should be able to:

1. Run `npm run build` and have it pass.
2. Hit `/notes` in the deployed preview, submit a note, and see it show up in the table.
3. Refresh the page — the note is still there (durably stored in BigQuery).

## Feedback we want back from you

When you're done, please reply with notes on:

- Were the BC 2.0 BigQuery env vars and gateway routes documented clearly enough? What was missing?
- Did the Aether skill docs cover the gateway pattern, or did you have to infer it from the brief?
- Anything in the platform docs / skills / MCPs that would have saved you time?

## Status

Project just created. Run `/build_my_app` in Cursor to start building.

## Modules

*None yet — the agent will populate this as features are built.*
