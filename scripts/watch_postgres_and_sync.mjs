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

const { Client } = pg;
const client = new Client({ connectionString: DATABASE_URL });

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
  let creditsValue = null;
  if (u.credits !== undefined && u.credits !== null) {
    const s = String(u.credits).trim();
    if (s !== '' && !Number.isNaN(Number(s))) creditsValue = Number(s);
  }
  const fields = {
    identityId: u.id,
    Name: u.name ?? null,
    Email: u.email ?? null,
    Image: u.image ?? null,
    SlackId: u.slackId ?? null,
    role: u.role ?? null,
    Banned: !!u.banned,
    credits: creditsValue,
    verificationStatus: u.verificationStatus ?? null,
    identityToken: u.identityToken ?? null,
    refreshToken: u.refreshToken ?? null,
    createdAt: u.createdAt ? (u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt)) : null,
    updatedAt: u.updatedAt ? (u.updatedAt instanceof Date ? u.updatedAt.toISOString() : String(u.updatedAt)) : null,
  };
  const formula = `{identityId}='${String(u.id).replace(/'/g, "\\'")}'`;
  const dropTokenFields = (p) => {
    const copy = Object.assign({}, p);
    delete copy.verificationStatus;
    delete copy.identityToken;
    delete copy.refreshToken;
    delete copy.credits;
    delete copy.createdAt;
    delete copy.updatedAt;
    return copy;
  };
  const found = await airtableFindRecord(AIRTABLE_USERS_TABLE, formula).catch(() => null);
  if (found) {
    try { return await airtablePatch(AIRTABLE_USERS_TABLE, found.id, fields); } catch (err) {
      const msg = String(err);
      if (msg.includes('UNKNOWN_FIELD_NAME')) {
        const payload2 = dropTokenFields(fields);
        return await airtablePatch(AIRTABLE_USERS_TABLE, found.id, payload2);
      }
      throw err;
    }
  }
  try { return await airtableCreate(AIRTABLE_USERS_TABLE, fields); } catch (err) {
    const msg = String(err);
    if (msg.includes('UNKNOWN_FIELD_NAME')) {
      const payload2 = dropTokenFields(fields);
      return await airtableCreate(AIRTABLE_USERS_TABLE, payload2);
    }
    throw err;
  }
}

async function upsertOrder(o) {
  const fields = {
    OrderId: String(o.id),
    UserId: o.user_id ?? null,
    ShopItemId: o.shop_item_id ?? null,
    Status: o.status ?? null,
  };
  // coerce Amount
  const maybeNum = Number(o.amount);
  if (!Number.isNaN(maybeNum)) fields.Amount = maybeNum;
  const formula = `{OrderId}='${String(o.id).replace(/'/g, "\\'")}'`;
  const found = await airtableFindRecord(AIRTABLE_ORDERS_TABLE, formula).catch(() => null);
  if (found) return airtablePatch(AIRTABLE_ORDERS_TABLE, found.id, fields);
  return airtableCreate(AIRTABLE_ORDERS_TABLE, fields);
}

async function ensureTriggers() {
  const func = `
CREATE OR REPLACE FUNCTION notify_airtable() RETURNS trigger AS $$
DECLARE
  payload json;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    payload = json_build_object('table', TG_TABLE_NAME, 'op', TG_OP, 'record', row_to_json(OLD));
  ELSE
    payload = json_build_object('table', TG_TABLE_NAME, 'op', TG_OP, 'record', row_to_json(NEW));
  END IF;
  PERFORM pg_notify('airtable_sync', payload::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;`;

  await client.query(func);
  // drop/create triggers for `user` and `orders`
  await client.query('DROP TRIGGER IF EXISTS user_airtable_notify ON "user"');
  await client.query('CREATE TRIGGER user_airtable_notify AFTER INSERT OR UPDATE ON "user" FOR EACH ROW EXECUTE FUNCTION notify_airtable()');
  await client.query('DROP TRIGGER IF EXISTS orders_airtable_notify ON orders');
  await client.query('CREATE TRIGGER orders_airtable_notify AFTER INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION notify_airtable()');
  console.log('Triggers installed (user, orders)');
}

async function run() {
  await client.connect();
  await ensureTriggers();
  await client.query('LISTEN airtable_sync');
  console.log('Listening for Postgres notifications on channel airtable_sync...');
  client.on('notification', async (msg) => {
    try {
      const payload = JSON.parse(msg.payload || '{}');
      const table = payload.table || payload.t || '';
      const record = payload.record || {};
      if (String(table).toLowerCase().includes('user')) {
        const mapped = {
          id: record.id,
          name: record.name,
          email: record.email,
          image: record.image,
          slackId: record.slack_id ?? record.slackId,
          role: record.role,
          banned: record.banned,
          credits: record.credits,
          verificationStatus: record.verification_status ?? record.verificationStatus,
          identityToken: record.identity_token ?? record.identityToken,
          refreshToken: record.refresh_token ?? record.refreshToken,
          createdAt: record.created_at ?? record.createdAt,
          updatedAt: record.updated_at ?? record.updatedAt,
        };
        console.log('[listener] user change, upserting to Airtable', mapped.id);
        try { await upsertUser(mapped); } catch (e) { console.error('[listener] upsert user failed', String(e)); }
      } else if (String(table).toLowerCase().includes('order')) {
        const mapped = {
          id: record.id,
          user_id: record.user_id,
          shop_item_id: record.shop_item_id,
          amount: record.amount,
          status: record.status,
          slack_id: record.slack_id,
          created_at: record.created_at,
        };
        console.log('[listener] order change, upserting to Airtable', mapped.id);
        try { await upsertOrder(mapped); } catch (e) { console.error('[listener] upsert order failed', String(e)); }
      } else {
        // ignore
      }
    } catch (err) { console.error('[listener] notification handling error', String(err)); }
  });
}

run().catch((e) => { console.error(e); process.exit(1); });
