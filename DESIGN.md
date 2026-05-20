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

Initial scaffold complete. `npm run build` passes. Ready to deploy and
verify the roundtrip on the Vercel preview.

## Modules

### `pages/notes.vue`

The single page described in the Vision. Renders a `<v-form>` with a
`<v-textarea>` for the note body and a `<v-data-table>` showing every
saved note (newest first, `created_at` + `body` columns). On mount it
calls `/api/notes/ensure-schema` (idempotent) then `/api/notes/list`,
and refreshes the table after each successful save.

Includes a `bigqueryEnabled` runtime-config gate so the page shows a
clear "BigQuery is not configured" card in local dev where the env
vars are intentionally unset.

### `server/api/notes/ensure-schema.post.ts`

Calls `runMutation(CREATE TABLE IF NOT EXISTS notes …)` on every page
load (Option A from the brief). Partitions by `DATE(created_at)` so
future analytical queries stay cheap.

### `server/api/notes/create.post.ts`

Reads `{ body }` from the request, generates a UUID + ISO timestamp on
the server, and calls `runMutation('INSERT INTO notes …', { params })`
with parameterised `STRING` / `TIMESTAMP` values — no string
interpolation of user input.

### `server/api/notes/list.get.ts`

`runQuery('SELECT id, body, created_at FROM notes ORDER BY created_at
DESC LIMIT 500')` and uses `toRowObjects()` to flatten the BigQuery v2
row shape into a plain JSON array for the client.

### `nuxt.config.ts`

Added `bigqueryEnabled: ''` to `runtimeConfig.public` so
`NUXT_PUBLIC_BIGQUERY_ENABLED` flows through to
`useRuntimeConfig().public.bigqueryEnabled` for the page-level feature
gate.

## Feedback for the platform team

**BigQuery env vars + gateway routes:** Clear enough. The brief plus
`.agents/skills/aether/bigquery.md` together gave me everything I
needed — gateway URL pattern, body shape, allowed verbs, row/byte
caps. The brief's body-shape examples (`params`, `defaultDataset`)
matched the helpers in `server/utils/bigquery.ts` exactly.

**Aether skill coverage:** Yes — `bigquery.md` covered the gateway
pattern in detail (including "do NOT add `@google-cloud/bigquery`"
which is exactly the trap I would have fallen into). The example
server routes in that file were close enough to copy-paste-modify for
this app.

**Things that would have saved time / nice-to-haves:**

1. The `bigqueryEnabled` runtime-config key isn't pre-declared in
   `nuxt.config.ts`'s `runtimeConfig.public`. I had to add it so the
   `NUXT_PUBLIC_BIGQUERY_ENABLED` env var would surface to
   `<script setup>` via `useRuntimeConfig()`. Worth pre-seeding it in
   the starter `nuxt.config.ts` alongside `gatewayUrl` / `tenantOrgId`.
2. `toRowObjects()` is documented as returning `Record<string, unknown>`
   but the values are still BigQuery's wire format — `TIMESTAMP` comes
   back as a string of fractional Unix epoch seconds (e.g.
   `"1716240000.000000"`), not an ISO string. I handled it in the page
   with a `formatTimestamp()` helper, but a one-liner in `bigquery.md`
   ("scalar values are returned as raw BQ wire-format strings; parse
   them yourself, especially `TIMESTAMP`/`DATE`/`INT64`") would prevent
   surprises.
3. No MCP tool for "run a BQ query / mutation against the current
   tenant" — I had to write server routes and trust the Vercel preview
   to test the roundtrip. An MCP that proxies `runQuery` / `runMutation`
   against the dev tenant from the agent's environment would let
   future agents validate the full path before pushing.
