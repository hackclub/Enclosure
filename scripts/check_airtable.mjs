#!/usr/bin/env node
import fs from 'fs/promises';

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

const API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PAT || '';
const BASE = process.env.AIRTABLE_BASE_ID || '';
const tableCandidates = [process.env.AIRTABLE_USERS_TABLE || 'Users', (process.env.AIRTABLE_USERS_TABLE || 'Users').toLowerCase(), 'users'];

if (!API_KEY || !BASE) {
  console.error('Missing AIRTABLE_API_KEY/AIRTABLE_BASE_ID');
  process.exit(1);
}

async function fetchTable(name) {
  const url = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(name)}?pageSize=5`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } });
  const txt = await res.text();
  let j = null;
  try { j = JSON.parse(txt); } catch (e) { /* ignore */ }
  return { ok: res.ok, status: res.status, bodyText: txt, json: j };
}

console.log('Checking Airtable base:', BASE);
for (const t of Array.from(new Set(tableCandidates))) {
  try {
    const r = await fetchTable(t);
    console.log('Table:', t, 'status:', r.status, 'ok:', r.ok);
    if (r.json && Array.isArray(r.json.records)) {
      console.log('  records:', r.json.records.length);
      for (const rec of r.json.records) console.log('  -', rec.id, Object.keys(rec.fields || {}).slice(0,5));
    } else {
      console.log('  body:', r.bodyText.slice(0,400));
    }
  } catch (err) {
    console.error('  error checking', t, String(err));
  }
}
