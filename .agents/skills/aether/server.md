# Nitro Server Routes

The `server/` directory contains Nuxt's Nitro server layer. These routes deploy
with the app to Vercel -- they are NOT a separate service. They handle
server-side concerns like KV storage, database access, and image proxying
that can't run in the browser.

## Directory Layout

```
server/
├── api/
│   ├── kv/                  # KV (Upstash Redis) CRUD — read, write, delete, documents, status
│   └── avatar/[url].ts      # Avatar image proxy
└── utils/
    ├── redis.ts              # Upstash Redis client (lazy-init from KV_REST_API_URL)
    ├── neon.ts               # Neon Postgres client (lazy-init from DATABASE_URL) — create if missing when Neon is provisioned
    └── cookies.ts            # Cookie handling (@hapi/iron)
```

For KV and Neon Postgres access (client usage, provisioning checks, creating
tables, handling missing credentials gracefully), see
[storage.md](storage.md) in this skill. For calling the platform Query
Server from Nitro routes, see [server-data.md](server-data.md) in this
skill.

## Adding Routes

Follow Nitro file-based routing. The filename determines the HTTP method and
path:

```
server/api/my-resource.get.ts      → GET  /api/my-resource
server/api/my-resource.post.ts     → POST /api/my-resource
server/api/my-resource/[id].get.ts → GET  /api/my-resource/:id
```

Route handler pattern:

```typescript
export default defineEventHandler(async (event) => {
    const params = getQuery(event); // query string
    const body = await readBody(event); // POST body
    const id = getRouterParam(event, 'id'); // path params

    // ... implementation ...
    return { result: 'data' };
});
```

## Key Differences from Client-Side Code

- Server routes run on the server (Node.js), not in the browser
- They have access to Redis, Neon Postgres, secrets, and server-only APIs
- They do NOT have access to Vue composables, Vuetify, or any client-side code
- Use `defineEventHandler`, not Vue component patterns

See [architecture.md](architecture.md) in this skill for the full data
architecture overview, [storage.md](storage.md) for KV/Postgres patterns,
and [pref.md](pref.md) for client-side KV preferences.
