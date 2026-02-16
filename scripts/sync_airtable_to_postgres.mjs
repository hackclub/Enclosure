#!/usr/bin/env node
import 'dotenv/config';
import pg from 'pg';
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
    // ignore if .env.local missing
  }
}

await loadDotEnv();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PAT || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';

async function fetchAllAirtable(tableName) {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    console.error('Airtable not configured (AIRTABLE_API_KEY/AIRTABLE_BASE_ID)');
    return [];
  }
  const out = [];
  let offset = undefined;
  try {
    do {
      const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`);
      if (offset) url.searchParams.set('offset', offset);
      url.searchParams.set('pageSize', '100');
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Airtable fetch failed: ${res.status} ${txt}`);
      }
      const j = await res.json();
      if (Array.isArray(j.records)) out.push(...j.records);
      offset = j.offset;
    } while (offset);
  } catch (err) {
    console.error('[sync] fetchAllAirtable error', String(err));
  }
  return out;
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function upsertUserToPostgres(rec) {
  const fields = rec.fields || {};
  const id = fields.identityId || fields.IdentityId || fields.id || null;
  if (!id) return;
  const name = fields.Name || fields.name || null;
  const email = fields.Email || fields.email || null;
  const image = fields.Image || fields.image || null;
  const slackId = fields.SlackId || fields.slackId || null;
  const role = fields.Role || fields.role || 'member';
  const banned = !!fields.Banned;

  const client = await pool.connect();
  try {
    await client.query(`INSERT INTO "user" (id, name, email, image, slackId, role, banned, updated_at, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,current_timestamp, current_timestamp)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, image = EXCLUDED.image, slackId = EXCLUDED.slackId, role = EXCLUDED.role, banned = EXCLUDED.banned, updated_at = current_timestamp`, [id, name, email, image, slackId, role, banned]);
  } finally {
    client.release();
  }
}

async function upsertOrdersToPostgres(rec) {
  const fields = rec.fields || {};
  const orderId = fields.OrderId || fields.orderId || null;
  const userId = fields.UserId || null;
  const shopItemId = fields.ShopItemId || null;
  const amount = fields.Amount || null;
  const status = fields.Status || null;
  if (!orderId) return;
  const client = await pool.connect();
  try {
    await client.query(`INSERT INTO orders (id, user_id, shop_item_id, amount, status, slack_id, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,current_timestamp)
      ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, shop_item_id = EXCLUDED.shop_item_id, amount = EXCLUDED.amount, status = EXCLUDED.status, slack_id = EXCLUDED.slack_id`, [orderId, userId, shopItemId, amount, status, fields.SlackId || null]);
  } finally { client.release(); }
}

async function main() {
  console.log('Fetching Airtable users...');
  const users = await fetchAllAirtable(process.env.AIRTABLE_USERS_TABLE || 'Users');
  for (const u of users) {
    await upsertUserToPostgres(u);
  }
  console.log('Fetching Airtable orders...');
  const orders = await fetchAllAirtable(process.env.AIRTABLE_ORDERS_TABLE || 'Orders');
  for (const o of orders) {
    await upsertOrdersToPostgres(o);
  }
  await pool.end();
  console.log('Sync complete');
}

main().catch((e) => { console.error(e); process.exit(1); });
