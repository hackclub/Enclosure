#!/usr/bin/env node
import 'dotenv/config';
import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';

const OUT_DIR = path.join(process.cwd(), 'exports');

const TABLES = [
  { name: 'user', orderBy: 'created_at' },
  { name: 'submissions', orderBy: 'id' },
  { name: 'projects', orderBy: 'id' },
  { name: 'created_projects', orderBy: 'id' },
  { name: 'shipped_projects', orderBy: 'id' },
  { name: 'approved_projects', orderBy: 'id' },
  { name: 'rejected_projects', orderBy: 'id' },
  { name: 'shop_items', orderBy: 'id' },
  { name: 'shop_transactions', orderBy: 'id' }
];

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') val = JSON.stringify(val);
  const s = String(val);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

async function rowsToCSV(rows) {
  if (!rows || rows.length === 0) return '';
  const keys = Object.keys(rows[0]);
  const header = keys.join(',') + '\n';
  const lines = rows.map(r => keys.map(k => escapeCSV(r[k])).join(',')).join('\n');
  return header + lines + '\n';
}

async function ensureOutDir() {
  try {
    await fs.mkdir(OUT_DIR, { recursive: true });
  } catch (e) {
    // ignore
  }
}

async function exportTable(pool, table) {
  const safeName = '"' + table.name.replace(/"/g, '""') + '"';
  const orderBy = table.orderBy || 'id';
  const q = `SELECT * FROM ${safeName} ORDER BY ${orderBy} NULLS LAST`;
  const client = await pool.connect();
  try {
    const res = await client.query(q);
    const csv = await rowsToCSV(res.rows);
    const outPath = path.join(OUT_DIR, `${table.name}.csv`);
    await fs.writeFile(outPath, csv, 'utf8');
    console.log(`Wrote ${res.rows.length} rows -> ${outPath}`);
  } finally {
    client.release();
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in environment (see .env.local).');
    process.exit(1);
  }
  await ensureOutDir();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    for (const t of TABLES) {
      try {
        await exportTable(pool, t);
      } catch (err) {
        console.error(`Failed to export table ${t.name}:`, String(err));
      }
    }
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('export_pg_to_csv.mjs')) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
