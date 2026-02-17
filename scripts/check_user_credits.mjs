#!/usr/bin/env node
import fs from 'fs/promises';
import pg from 'pg';

async function loadDotEnv() {
  try {
    const envPath = new URL('../.env.local', import.meta.url);
    const content = await fs.readFile(envPath, 'utf8');
    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (k && v && process.env[k] === undefined) process.env[k] = v;
    }
  } catch (err) {
    // ignore
  }
}

if (process.argv.length < 3) {
  console.error('Usage: node check_user_credits.mjs <userId>');
  process.exit(2);
}
const userId = process.argv[2];
await loadDotEnv();
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT id, credits, identity_token, refresh_token FROM "user" WHERE id = $1 LIMIT 1', [userId]);
    if (!res.rows.length) {
      console.log('no user found for', userId);
      return;
    }
    const u = res.rows[0];
    console.log('user:', u.id);
    console.log('  credits raw:', u.credits, 'type:', typeof u.credits);
    console.log('  identity_token present?', !!u.identity_token);
    console.log('  refresh_token present?', !!u.refresh_token);
    const parsed = (u.credits == null || String(u.credits).trim() === '') ? null : (Number.isFinite(Number(u.credits)) ? Number(u.credits) : null);
    console.log('  credits parsed for Airtable:', parsed, 'typeof parsed:', typeof parsed);
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(e=>{console.error(e);process.exit(1)});
