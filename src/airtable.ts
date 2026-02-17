import { URLSearchParams } from "url";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || "Users";
const AIRTABLE_ORDERS_TABLE = process.env.AIRTABLE_ORDERS_TABLE || "Orders";
const AIRTABLE_USERS_ID_FIELD = process.env.AIRTABLE_USERS_ID_FIELD || "identityId";

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  // allow module to load in environments without config; functions will exit early
}

async function airtableFetch(path: string, opts: RequestInit = {}) {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) throw new Error("Airtable not configured");
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(path)}`;
  const headers = Object.assign({}, opts.headers || {}, {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
  });
  const res = await fetch(url + (opts.method === 'GET' && opts.body ? `?${String(opts.body)}` : ''), { ...opts, headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Airtable ${res.status} ${res.statusText}: ${txt}`);
  }
  return res.json();
}

export async function upsertAirtableUser(u: {
  id: string; name?: string | null; email?: string | null; image?: string | null; slackId?: string | null; role?: string | null; banned?: boolean; updatedAt?: Date | string | null; createdAt?: Date | string | null; credits?: string | number | null; verificationStatus?: string | null; identityToken?: string | null; refreshToken?: string | null;
}) {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) return null;
  try {
    const formula = encodeURIComponent(`{${AIRTABLE_USERS_ID_FIELD}}='${String(u.id).replace("'","\\'")}'`);
    const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_USERS_TABLE)}?filterByFormula=${formula}`, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
    });
    const j = await res.json();
    const fields: Record<string, unknown> = {
      identityId: u.id,
      Name: u.name ?? null,
      Email: u.email ?? null,
      Image: u.image ?? null,
      SlackId: u.slackId ?? null,
      Role: u.role ?? null,
      Banned: !!u.banned,
      credits: u.credits ?? null,
      verificationStatus: u.verificationStatus ?? null,
      identityToken: u.identityToken ?? null,
      refreshToken: u.refreshToken ?? null,
      createdAt: u.createdAt ? (typeof u.createdAt === 'string' ? u.createdAt : (u.createdAt as Date).toISOString()) : null,
      updatedAt: u.updatedAt ? (typeof u.updatedAt === 'string' ? u.updatedAt : (u.updatedAt as Date).toISOString()) : null,
    };

    if (Array.isArray(j.records) && j.records.length) {
      const recId = j.records[0].id;
      const patch = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_USERS_TABLE)}/${recId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });
      return patch.ok ? await patch.json() : null;
    } else {
      const created = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_USERS_TABLE)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });
      return created.ok ? await created.json() : null;
    }
  } catch (err) {
    console.error('[airtable] upsert user failed', String(err));
    return null;
  }
}

export async function upsertAirtableOrder(o: {
  id?: number | string; userId?: string; shopItemId?: string | null; amount?: number | string; status?: string; slackId?: string | null; createdAt?: Date | string;
}) {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) return null;
  try {
    const fields: Record<string, unknown> = {
      OrderId: String(o.id ?? ''),
      UserId: o.userId ?? null,
      ShopItemId: o.shopItemId ?? null,
      Amount: o.amount ?? null,
      Status: o.status ?? null,
      SlackId: o.slackId ?? null,
    };

    // Try to find existing order by OrderId
    const formula = encodeURIComponent(`{OrderId}='${String(o.id ?? '').replace("'","\\'")}'`);
    const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_ORDERS_TABLE)}?filterByFormula=${formula}`, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
    });
    const j = await res.json();
    if (Array.isArray(j.records) && j.records.length) {
      const recId = j.records[0].id;
      const patch = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_ORDERS_TABLE)}/${recId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });
      return patch.ok ? await patch.json() : null;
    } else {
      const created = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_ORDERS_TABLE)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });
      return created.ok ? await created.json() : null;
    }
  } catch (err) {
    console.error('[airtable] upsert order failed', String(err));
    return null;
  }
}

export async function fetchAllAirtable(tableName: string) {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) return [];
  const out: any[] = [];
  let offset: string | undefined = undefined;
  try {
    do {
      const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`);
      if (offset) url.searchParams.set('offset', offset);
      url.searchParams.set('pageSize', '100');
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } });
      if (!res.ok) throw new Error(`Airtable fetch failed: ${res.status}`);
      const j = await res.json();
      if (Array.isArray(j.records)) out.push(...j.records);
      offset = j.offset;
    } while (offset);
  } catch (err) {
    console.error('[airtable] fetchAll failed', String(err));
  }
  return out;
}

export default { upsertAirtableUser, upsertAirtableOrder, fetchAllAirtable };
