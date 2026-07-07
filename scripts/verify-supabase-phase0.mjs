#!/usr/bin/env node
/**
 * Verify Supabase Phase 0 tables are reachable with the anon key.
 *
 * Usage:
 *   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run verify:supabase
 *   node scripts/verify-supabase-phase0.mjs --env-file .env.local
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const TABLES = [
  'tms_profiles',
  'journal_snapshots',
  'kpi_operational_snapshots',
  'kpi_monthly_approvals',
  'kpi2_row_approvals',
  'announcements',
  'csr_requests',
  'sync_events',
];

function loadEnvFile(path) {
  const env = {};
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
  return env;
}

function parseArgs(argv) {
  const args = { envFile: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--env-file' && argv[i + 1]) {
      args.envFile = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv);
const fileEnv = args.envFile ? loadEnvFile(args.envFile) : {};
const url = process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
  console.error('Set env vars or pass --env-file .env.local');
  process.exit(1);
}

const client = createClient(url, anonKey);

let failed = 0;

for (const table of TABLES) {
  const { error } = await client.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    failed += 1;
    console.log(`FAIL  ${table}: ${error.message}`);
  } else {
    console.log(`OK    ${table}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} table(s) failed. Run supabase/phase0-apply.sql in SQL Editor.`);
  process.exit(1);
}

console.log('\nPhase 0 schema check passed.');
