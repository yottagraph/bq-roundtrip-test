#!/usr/bin/env node
/**
 * prebuild guard: refuse to build if a forbidden direct-GCP-SDK
 * dependency snuck into the tenant app's package.json.
 *
 * Tenant Aether apps never hold GCP credentials. Anything that needs
 * BigQuery / Cloud Storage / Firestore / etc. must go through the
 * Broadchurch Portal gateway. See `.agents/skills/aether/bigquery.md`.
 *
 * If a coding agent reflexively reaches for `@google-cloud/bigquery`
 * or asks the user to paste a `GOOGLE_SERVICE_ACCOUNT_KEY`, this guard
 * fails the build with a pointer at the right helper instead of
 * letting the broken pattern deploy.
 *
 * This script runs at the tenant project (the Vercel build target).
 * It is intentionally cheap and side-effect-free — it just reads
 * package.json and exits non-zero on a hit.
 */
const fs = require('fs');
const path = require('path');

const PKG = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(PKG)) {
    process.exit(0); // nothing to check
}

const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'));
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

// Forbidden direct GCP SDK packages. The tenant app must always go through
// the portal gateway (`server/utils/bigquery.ts` etc.) and never hold
// credentials of its own.
const FORBIDDEN = [
    '@google-cloud/bigquery',
    '@google-cloud/bigquery-storage',
    '@google-cloud/storage',
    '@google-cloud/firestore',
    '@google-cloud/secret-manager',
    '@google-cloud/pubsub',
    'google-auth-library',
    'gcp-metadata',
];

const hits = FORBIDDEN.filter((name) => Object.hasOwn(deps, name));
if (hits.length === 0) {
    process.exit(0);
}

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

console.error('');
console.error(red(bold('✖ Forbidden GCP SDK dependency in package.json')));
console.error('');
for (const h of hits) console.error(`  - ${h}@${deps[h]}`);
console.error('');
console.error('The tenant Aether app must NEVER hold GCP credentials directly.');
console.error('Instead, go through the Broadchurch Portal gateway, which runs');
console.error("BigQuery / Storage / etc. in the tenant's GCP project on the");
console.error("app's behalf. The relevant helpers are already scaffolded:");
console.error('');
console.error(yellow('  server/utils/bigquery.ts'));
console.error('');
console.error('Required steps to fix:');
console.error(
    `  1. Remove the forbidden package(s) from package.json: ` +
        hits.map((h) => `\`${h}\``).join(', ')
);
console.error('  2. Replace any custom BigQuery client with the existing helper:');
console.error('       import { runQuery } from "~/server/utils/bigquery";');
console.error('  3. Read the skill for usage patterns: .agents/skills/aether/bigquery.md');
console.error('');
console.error('If you genuinely need a GCP capability the gateway does not yet');
console.error('cover, open an issue in broadchurch rather than installing the SDK');
console.error('here.');
console.error('');

process.exit(1);
