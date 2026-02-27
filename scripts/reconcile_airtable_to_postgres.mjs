import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const BASE = process.env.AIRTABLE_BASE_ID;
const PAT = process.env.AIRTABLE_PAT || process.env.AIRTABLE_API_KEY;
const USERS_TABLE = process.env.AIRTABLE_USER_TABLE || 'users';
const ORDERS_TABLE = process.env.AIRTABLE_SHOP_TXN_TABLE || process.env.AIRTABLE_TABLE_NAME || 'orders';
const DRY = process.env.DRY_RUN !== 'false' && !process.argv.includes('--apply');

if (!BASE || !PAT) {
  console.error('Missing AIRTABLE_BASE_ID or AIRTABLE_PAT in environment');
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function fetchAllAirtable(table) {
  const out = [];
  let offset = undefined;
  do {
    const params = new URLSearchParams();
    params.set('pageSize', '100');
    if (offset) params.set('offset', offset);
    const url = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(table)}?${params.toString()}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${PAT}` } });
    if (!res.ok) throw new Error(`Airtable fetch failed ${res.status} ${await res.text()}`);
    const j = await res.json();
    (j.records || []).forEach(r => out.push(r));
    offset = j.offset;
  } while (offset);
  return out;
}

function isEmpty(val) {
  return val === null || val === undefined || (typeof val === 'string' && val.trim() === '');
}

async function reconcileUsers() {
  console.log('Fetching Airtable users...');
  const records = await fetchAllAirtable(USERS_TABLE);
  console.log('Got', records.length, 'user records');
  let inserts = 0, updates = 0, skipped = 0;
  for (const rec of records) {
    const f = rec.fields || {};
    const identityId = f.identityId || f.IdentityId || null;
    const email = f.Email || f.email || f.email_address || null;
    if (!identityId && !email) {
      skipped++;
      console.log('Skipping Airtable user (no identityId/email) id=', rec.id);
      continue;
    }
    const dbRes = await client.query('SELECT * FROM "user" WHERE id = $1 OR email = $2 LIMIT 1', [identityId || null, email || null]);
    const existing = dbRes.rows[0] || null;
    if (existing) {
      // Build updates only for empty DB fields (don't overwrite existing non-empty values)
      const toSet = {};
      if (!existing.name && f.Name) toSet.name = String(f.Name);
      if (!existing.image && f.Image) toSet.image = String(f.Image);
      if (!existing.slack_id && (f.SlackId || f.slack_id)) toSet.slack_id = String(f.SlackId || f.slack_id);
      if ((!existing.credits || existing.credits === '0' || isEmpty(existing.credits)) && (f.credits !== undefined || f.Credits !== undefined)) toSet.credits = String(f.credits ?? f.Credits);
      if (f.Banned !== undefined && (existing.banned === false || existing.banned === null)) toSet.banned = Boolean(f.Banned);
      if (Object.keys(toSet).length) {
        updates++;
        console.log(`[users] update ${existing.id}: set`, toSet);
        if (!DRY) {
          const sets = Object.keys(toSet).map((k,i)=>`${k}=$${i+1}`).join(', ');
          const vals = Object.values(toSet);
          await client.query(`UPDATE "user" SET ${sets} WHERE id=$${vals.length+1}`, [...vals, existing.id]);
        }
      }
    } else {
      // Insert new user when identityId present (we need a stable id). If only email, we still insert and generate id
      const newId = identityId || email;
      const payload = {
        id: String(newId),
        name: f.Name ?? null,
        email: email ?? null,
        image: f.Image ?? null,
        slack_id: f.SlackId ?? f.slack_id ?? null,
        banned: !!(f.Banned ?? false),
        credits: f.credits !== undefined ? String(f.credits) : null,
        verification_status: f.verificationStatus ?? null,
        created_at: new Date(),
      };
      inserts++;
      console.log('[users] insert', payload);
      if (!DRY) {
        await client.query(`INSERT INTO "user" (id,name,email,image,slack_id,banned,credits,verification_status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [payload.id,payload.name,payload.email,payload.image,payload.slack_id,payload.banned,payload.credits,payload.verification_status,payload.created_at]);
      }
    }
  }
  console.log(`Users reconciliation finished: inserts=${inserts}, updates=${updates}, skipped=${skipped}`);
}

async function reconcileOrders() {
  console.log('Fetching Airtable orders...');
  const records = await fetchAllAirtable(ORDERS_TABLE);
  console.log('Got', records.length, 'order records');
  let inserts = 0, updates = 0, skipped = 0;
  for (const rec of records) {
    const f = rec.fields || {};
    const orderIdRaw = f.OrderId || f.orderId || null;
    const userId = f.UserId || f.userId || null;
    const shopItemId = f.ShopItemId || f.shopItemId || null;
    const amount = f.Amount ?? f.amount ?? null;
    const status = f.Status ?? f.status ?? null;
    const slackId = f.SlackId ?? f.slack_id ?? null;

    let existing = null;
    if (orderIdRaw !== undefined && orderIdRaw !== null && /^-?\d+$/.test(String(orderIdRaw).trim())) {
      const idNum = Number(String(orderIdRaw).trim());
      const r = await client.query('SELECT * FROM orders WHERE id=$1 LIMIT 1', [idNum]);
      existing = r.rows[0] || null;
    }
    // fallback matching by (userId, shopItemId, amount)
    if (!existing && userId && shopItemId) {
      const r = await client.query('SELECT * FROM orders WHERE user_id=$1 AND shop_item_id=$2 AND amount=$3 LIMIT 1', [String(userId), String(shopItemId), amount !== null ? String(amount) : null]);
      existing = r.rows[0] || null;
    }

    if (existing) {
      // Only update if DB fields are empty/missing
      const toSet = {};
      if (isEmpty(existing.user_id) && userId) toSet.user_id = String(userId);
      if (isEmpty(existing.shop_item_id) && shopItemId) toSet.shop_item_id = String(shopItemId);
      if (isEmpty(existing.amount) && amount !== null) toSet.amount = String(amount);
      if (isEmpty(existing.status) && status !== null) toSet.status = String(status);
      if (isEmpty(existing.slack_id) && slackId) toSet.slack_id = String(slackId);
      if (Object.keys(toSet).length) {
        updates++;
        console.log(`[orders] update ${existing.id}: set`, toSet);
        if (!DRY) {
          const sets = Object.keys(toSet).map((k,i)=>`${k}=$${i+1}`).join(', ');
          const vals = Object.values(toSet);
          await client.query(`UPDATE orders SET ${sets} WHERE id=$${vals.length+1}`, [...vals, existing.id]);
        }
      }
    } else {
      // Insert new order if userId and shopItemId present
      if (!userId || !shopItemId) {
        skipped++;
        console.log('[orders] skipping insert - missing userId/shopItemId for airtable id=', rec.id);
        continue;
      }
      const payload = {
        user_id: String(userId),
        shop_item_id: String(shopItemId),
        amount: amount !== null ? String(amount) : '0',
        status: status ?? 'pending',
        slack_id: slackId ?? null,
        created_at: new Date(),
      };
      inserts++;
      console.log('[orders] insert', payload);
      if (!DRY) {
        await client.query('INSERT INTO orders (user_id,shop_item_id,amount,status,slack_id,created_at) VALUES($1,$2,$3,$4,$5,$6)', [payload.user_id,payload.shop_item_id,payload.amount,payload.status,payload.slack_id,payload.created_at]);
      }
    }
  }
  console.log(`Orders reconciliation finished: inserts=${inserts}, updates=${updates}, skipped=${skipped}`);
}

(async ()=>{
  try {
    await client.connect();
    console.log('Connected to Postgres, DRY_RUN=', DRY);
    await reconcileUsers();
    await reconcileOrders();
    console.log('Done');
  } catch (e) {
    console.error('Reconciliation failed', e && e.message || e);
  } finally {
    await client.end();
  }
})();
