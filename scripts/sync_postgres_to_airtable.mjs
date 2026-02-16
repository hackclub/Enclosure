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

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PAT || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_ORDERS_TABLE = process.env.AIRTABLE_ORDERS_TABLE || 'Orders';

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Missing Airtable config (AIRTABLE_API_KEY/AIRTABLE_BASE_ID)');
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function airtableFindRecord(table, formula) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}?filterByFormula=${encodeURIComponent(formula)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Airtable find failed ${res.status}: ${txt}`);
  }
  const j = await res.json();
  return Array.isArray(j.records) && j.records.length ? j.records[0] : null;
}

// we will send explicit fields mappings to Airtable

async function airtableCreate(table, fields) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`;
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type':'application/json' }, body: JSON.stringify({ fields }) });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Airtable create failed ${res.status}: ${txt}`);
  }
  return res.json();
}

async function airtablePatch(table, recId, fields) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}/${recId}`;
  const res = await fetch(url, { method: 'PATCH', headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type':'application/json' }, body: JSON.stringify({ fields }) });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Airtable patch failed ${res.status}: ${txt}`);
  }
  return res.json();
}

async function upsertUser(u) {
  const fields = {
    identityId: u.id,
    Name: u.name ?? null,
    Email: u.email ?? null,
    Image: u.image ?? null,
    SlackId: u.slackId ?? null,
    role: u.role ?? null,
    Banned: !!u.banned,
  };
  const formula = `{identityId}='${String(u.id).replace(/'/g, "\\'")}'`;
  const payload = fields;
  const found = await airtableFindRecord(AIRTABLE_USERS_TABLE, formula).catch(() => null);
  if (found) return airtablePatch(AIRTABLE_USERS_TABLE, found.id, payload);
  return airtableCreate(AIRTABLE_USERS_TABLE, payload);
}

async function upsertOrder(o) {
  const fields = {
    OrderId: String(o.id),
    UserId: o.user_id ?? null,
    ShopItemId: o.shop_item_id ?? null,
    Status: o.status ?? null,
    // omit SlackId for orders unless your Airtable Orders table has that exact field name
  };
  const formula = `{OrderId}='${String(o.id).replace(/'/g, "\\'")}'`;
  const found = await airtableFindRecord(AIRTABLE_ORDERS_TABLE, formula).catch(() => null);
  // coerce Amount to number if possible
  const maybeNum = Number(fields.Amount);
  if (Number.isFinite(maybeNum)) fields.Amount = maybeNum;
  if (found) return airtablePatch(AIRTABLE_ORDERS_TABLE, found.id, fields);
  return airtableCreate(AIRTABLE_ORDERS_TABLE, fields);
}

async function main() {
  console.log('Reading Postgres users...');
  const client = await pool.connect();
  try {
    // proceed to upsert using explicit field mappings
    const res = await client.query('SELECT id, name, email, image, slack_id as "slackId", role, banned FROM "user"');
    for (const r of res.rows) {
      try {
        await upsertUser(r);
        console.log('Upserted user', r.id);
      } catch (err) { console.error('user upsert failed', r.id, String(err)); }
    }

    console.log('Reading Postgres orders...');
    const or = await client.query('SELECT id, user_id, shop_item_id, amount, status, slack_id FROM orders');
    for (const o of or.rows) {
      try {
        await upsertOrder(o);
        console.log('Upserted order', o.id);
      } catch (err) { console.error('order upsert failed', o.id, String(err)); }
    }
  } finally { client.release(); }
  await pool.end();
  console.log('Push to Airtable complete');
}

main().catch((e) => { console.error(e); process.exit(1); });
