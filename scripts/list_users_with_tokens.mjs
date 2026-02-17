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
    const res = await client.query(`SELECT id, identity_token, refresh_token FROM "user" WHERE identity_token IS NOT NULL OR refresh_token IS NOT NULL LIMIT 100`);
    console.log('count:', res.rowCount);
    for (const r of res.rows) {
      console.log(r);
    }
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(e=>{console.error(e);process.exit(1)});
