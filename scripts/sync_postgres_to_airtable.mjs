// Fetch all records from an Airtable table (pagination-aware)
async function airtableFetchAll(table) {
  let offset = undefined;
  let all = [];
  do {
    let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}?pageSize=100`;
    if (offset) url += `&offset=${offset}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } });
    if (!res.ok) throw new Error(`Airtable fetch failed: ${res.status}`);
    const j = await res.json();
    all = all.concat(j.records);
    offset = j.offset;
  } while (offset);
  return all;
}

// Reconciliation: ensure all Postgres records exist in Airtable, and log extras
async function reconcileAirtableAndPostgres() {
  const client = await pool.connect();
  try {
    // USERS
    console.log('Reconciling users...');
    const pgUsers = await client.query('SELECT id, name, email, image, slack_id as "slackId", role, banned, credits, verification_status as "verificationStatus", identity_token as "identityToken", refresh_token as "refreshToken", created_at as "createdAt", updated_at as "updatedAt" FROM "user"');
    const atUsers = await airtableFetchAll(AIRTABLE_USERS_TABLE);
    const atUserMap = new Map(atUsers.map(r => [r.fields.identityId, r]));
    // Upsert missing users from Postgres to Airtable
    for (const u of pgUsers.rows) {
      if (!atUserMap.has(u.id)) {
        console.log('[reconcile] Upserting missing user to Airtable:', u.id);
        await upsertUser(u);
      }
    }
    // Airtable to Postgres: insert missing users
    for (const r of atUsers) {
      if (r.fields.identityId && !pgUsers.rows.find(u => u.id === r.fields.identityId)) {
        console.log('[reconcile] Inserting user from Airtable to Postgres:', r.fields.identityId);
        try {
          await client.query(
            'INSERT INTO "user" (id, name, email, image, slack_id, role, banned, credits, verification_status, identity_token, refresh_token, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING',
            [
              r.fields.identityId,
              r.fields.Name ?? null,
              r.fields.Email ?? null,
              r.fields.Image ?? null,
              r.fields.SlackId ?? null,
              r.fields.role ?? null,
              r.fields.Banned ?? false,
              r.fields.credits ?? null,
              r.fields.verificationStatus ?? null,
              r.fields.identityToken ?? null,
              r.fields.refreshToken ?? null,
              r.fields.createdAt ? new Date(r.fields.createdAt) : new Date(),
              r.fields.updatedAt ? new Date(r.fields.updatedAt) : new Date()
            ]
          );
        } catch (e) {
          console.error('[reconcile] Failed to insert user from Airtable:', r.fields.identityId, e);
        }
      }
    }

    // ORDERS
    console.log('Reconciling orders...');
    const pgOrders = await client.query('SELECT id, user_id, shop_item_id, amount, status, slack_id FROM orders');
    const atOrders = await airtableFetchAll(AIRTABLE_ORDERS_TABLE);
    const atOrderMap = new Map(atOrders.map(r => [String(r.fields.OrderId), r]));
    for (const o of pgOrders.rows) {
      if (!atOrderMap.has(String(o.id))) {
        console.log('[reconcile] Upserting missing order to Airtable:', o.id);
        await upsertOrder(o);
      }
    }
    // Airtable to Postgres: insert missing orders
    for (const r of atOrders) {
      if (r.fields.OrderId && !pgOrders.rows.find(o => String(o.id) === String(r.fields.OrderId))) {
        console.log('[reconcile] Inserting order from Airtable to Postgres:', r.fields.OrderId);
        try {
          await client.query(
            'INSERT INTO orders (id, user_id, shop_item_id, amount, status, slack_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING',
            [
              Number(r.fields.OrderId),
              r.fields.UserId ?? null,
              r.fields.ShopItemId ?? null,
              r.fields.Amount ?? null,
              r.fields.Status ?? null,
              r.fields.SlackId ?? null,
              r.fields.createdAt ? new Date(r.fields.createdAt) : new Date()
            ]
          );
        } catch (e) {
          console.error('[reconcile] Failed to insert order from Airtable:', r.fields.OrderId, e);
        }
      }
    }
    console.log('Reconciliation complete.');
  } finally {
    client.release();
  }
}
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
    // Normalize credits: Airtable expects a Number for the `credits` field.
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
    const payload = fields;
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
    console.log('[sync] user payload tokens present?', { id: u.id, identityToken: !!u.identityToken, refreshToken: !!u.refreshToken });
    const found = await airtableFindRecord(AIRTABLE_USERS_TABLE, formula).catch(() => null);
    if (found) {
      try {
        return await airtablePatch(AIRTABLE_USERS_TABLE, found.id, payload);
      } catch (err) {
        const msg = String(err);
        if (msg.includes('UNKNOWN_FIELD_NAME')) {
          console.log('[sync] Airtable unknown field; retrying without tokens for', u.id);
          const payload2 = dropTokenFields(payload);
          const res = await airtablePatch(AIRTABLE_USERS_TABLE, found.id, payload2);
          console.log('[sync] retried patch result id=', found.id);
          return res;
        }
        throw err;
      }
    }
    try {
      return await airtableCreate(AIRTABLE_USERS_TABLE, payload);
    } catch (err) {
      const msg = String(err);
      if (msg.includes('UNKNOWN_FIELD_NAME')) {
        console.log('[sync] Airtable unknown field on create; retrying without tokens for', u.id);
        const payload2 = dropTokenFields(payload);
        const res = await airtableCreate(AIRTABLE_USERS_TABLE, payload2);
        console.log('[sync] retried create result id=', res && res.records && res.records[0] && res.records[0].id);
        return res;
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
    // omit SlackId for orders unless your Airtable Orders table has that exact field name
  };
  const formula = `{OrderId}='${String(o.id).replace(/'/g, "\\'")}'`;
  const found = await airtableFindRecord(AIRTABLE_ORDERS_TABLE, formula).catch(() => null);
  // coerce Amount from DB value to number if possible
  const maybeNum = Number(o.amount);
  if (Number.isFinite(maybeNum)) fields.Amount = maybeNum;
  // sanitize: remove undefined/null fields so Airtable doesn't try to create empty values
  const sanitize = (obj) => {
    const out = {};
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v !== undefined && v !== null && String(v) !== '') out[k] = v;
    }
    return out;
  };
  // Try patch/create and if Airtable rejects due to single-select option creation,
  // retry without the Amount field so other fields can be updated.
  if (found) {
    try {
      const payload = sanitize(fields);
      console.log('[sync] patching order', o.id, payload);
      return await airtablePatch(AIRTABLE_ORDERS_TABLE, found.id, payload);
    } catch (err) {
      const msg = String(err);
      if (msg.includes('INVALID_MULTIPLE_CHOICE_OPTIONS') || msg.includes('Insufficient permissions to create new select option')) {
        console.log('[sync] Airtable rejects new select option for Amount; retrying without Amount for order', o.id);
        const copy = sanitize(Object.assign({}, fields));
        delete copy.Amount;
        console.log('[sync] retry patch without Amount', o.id, copy);
        return await airtablePatch(AIRTABLE_ORDERS_TABLE, found.id, copy);
      }
      throw err;
    }
  }
  try {
    const payload = sanitize(fields);
    console.log('[sync] creating order', o.id, payload);
    return await airtableCreate(AIRTABLE_ORDERS_TABLE, payload);
  } catch (err) {
    const msg = String(err);
    if (msg.includes('INVALID_MULTIPLE_CHOICE_OPTIONS') || msg.includes('Insufficient permissions to create new select option')) {
      console.log('[sync] Airtable rejects new select option for Amount on create; retrying without Amount for order', o.id);
      const copy = sanitize(Object.assign({}, fields));
      delete copy.Amount;
      console.log('[sync] retry create without Amount', o.id, copy);
      return await airtableCreate(AIRTABLE_ORDERS_TABLE, copy);
    }
    throw err;
  }
}

async function main() {
  console.log('Reading Postgres users...');
  const client = await pool.connect();
  try {
    // proceed to upsert using explicit field mappings
    const res = await client.query('SELECT id, name, email, image, slack_id as "slackId", role, banned, credits, verification_status as "verificationStatus", identity_token as "identityToken", refresh_token as "refreshToken", created_at as "createdAt", updated_at as "updatedAt" FROM "user"');
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
  // Do not close pool here, keep for polling
  console.log('Push to Airtable complete');
}


// Event-driven sync: listen for NOTIFY events from Postgres
async function listenForNotifications() {
  const client = await pool.connect();
  await client.query('LISTEN airtable_sync');
  console.log('Listening for Postgres NOTIFY events on channel "airtable_sync"...');
  client.on('notification', async (msg) => {
    try {
      if (msg.channel === 'airtable_sync') {
        console.log('[sync] Received NOTIFY:', msg.payload);
        // If payload is JSON with table and id, only sync that row
        let payload;
        try {
          payload = msg.payload ? JSON.parse(msg.payload) : null;
        } catch {}
        // Support both flat and nested (record) payloads
        let table = payload && payload.table;
        let id = payload && payload.id;
        if (!id && payload && payload.record && payload.record.id) {
          id = payload.record.id;
        }
        if (table && id) {
          console.log(`[sync] Targeted sync for table=${table}, id=${id}`);
          if (table === 'user') {
            const res = await pool.query('SELECT id, name, email, image, slack_id as "slackId", role, banned, credits, verification_status as "verificationStatus", identity_token as "identityToken", refresh_token as "refreshToken", created_at as "createdAt", updated_at as "updatedAt" FROM "user" WHERE id = $1', [id]);
            if (res.rows.length) await upsertUser(res.rows[0]);
          } else if (table === 'orders' || table === 'order') {
            const or = await pool.query('SELECT id, user_id, shop_item_id, amount, status, slack_id FROM orders WHERE id = $1', [id]);
            if (or.rows.length) await upsertOrder(or.rows[0]);
          } else {
            console.log('[sync] Unknown table in payload, skipping sync');
          }
        } else {
          console.log('[sync] No/invalid payload, skipping sync');
        }
      }
    } catch (e) {
      console.error('[sync notify] error:', e);
    }
  });
}



// Periodic reconciliation every 2 hours (7200000 ms)
async function startPeriodicReconciliation() {
  while (true) {
    try {
      console.log('[reconcile] Starting periodic reconciliation...');
      await reconcileAirtableAndPostgres();
      console.log('[reconcile] Next reconciliation in 2 hours.');
    } catch (e) {
      console.error('[reconcile] Error during reconciliation:', e);
    }
    await new Promise(res => setTimeout(res, 2 * 60 * 60 * 1000));
  }
}

if (process.argv[2] === 'reconcile') {
  reconcileAirtableAndPostgres().catch((e) => { console.error(e); process.exit(1); });
} else {
  // Run NOTIFY listener and periodic reconciliation in parallel
  listenForNotifications().catch((e) => { console.error(e); process.exit(1); });
  startPeriodicReconciliation();
}
