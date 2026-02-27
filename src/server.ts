import "dotenv/config";
// Run sync_postgres_to_airtable.mjs script on server start

import { spawn } from "child_process";
import path from "node:path";
function startSyncScript() {
  const syncScript = path.join(process.cwd(), "scripts", "sync_postgres_to_airtable.mjs");
  const proc = spawn(process.platform === "win32" ? "node" : "node", [syncScript], { stdio: "inherit" });
  proc.on("exit", code => {
    console.log("sync_postgres_to_airtable.mjs exited with code", code);
    // Restart automatically if it exits unexpectedly
    setTimeout(() => {
      console.log("Restarting sync_postgres_to_airtable.mjs...");
      startSyncScript();
    }, 5000); // 5 second delay before restart
  });
}
startSyncScript();
// Reconciliation script: run alongside the server and restart if it exits.
function startReconcileScript() {
  const enabled = process.env.RECONCILE_ON_START !== 'false';
  if (!enabled) {
    console.log('Reconcile script disabled via RECONCILE_ON_START=false');
    return;
  }
  const reconcileScript = path.join(process.cwd(), "scripts", "reconcile_airtable_to_postgres.mjs");
  try {
    const proc = spawn(process.platform === "win32" ? "node" : "node", [reconcileScript], { stdio: "inherit" });
    proc.on("exit", code => {
      console.log("reconcile_airtable_to_postgres.mjs exited with code", code);
      // Restart automatically after a short delay
      setTimeout(() => {
        console.log("Restarting reconcile_airtable_to_postgres.mjs...");
        startReconcileScript();
      }, 30000); // 30 second delay before restart
    });
  } catch (e) {
    console.error('failed to start reconcile script', String(e));
    // try again later
    setTimeout(startReconcileScript, 30000);
  }
}
startReconcileScript();
import express from "express";
console.log('server.ts loaded at', new Date().toISOString());
import cors from "cors";
import fs from "node:fs";
import { desc, eq } from "drizzle-orm";
import { db } from "./db.js";
import { projects, createdProjects, shopItems, user as users, shopTransactions, orders, weeklyChallenges } from "./schema.js";
import { upsertAirtableUser, upsertAirtableOrder } from "./airtable.js";
import { Pool } from "pg";

// Move all env variable assignments here
const IDENTITY_HOST = process.env.HC_IDENTITY_HOST || "https://auth.hackclub.com";
const IDENTITY_CLIENT_ID = process.env.HC_IDENTITY_CLIENT_ID || "";
const IDENTITY_CLIENT_SECRET = process.env.HC_IDENTITY_CLIENT_SECRET || "";
let IDENTITY_REDIRECT_URI = process.env.HC_IDENTITY_REDIRECT_URI || "http://localhost:4000/api/auth/callback";
// For local development force the localhost callback unless explicitly running in production
if (process.env.NODE_ENV !== 'production') {
  IDENTITY_REDIRECT_URI = "http://localhost:4000/api/auth/callback";
}
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || "http://localhost:5713";
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:4000";
const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
const SERVER_BASE_URL = process.env.SERVER_BASE_URL || (() => {
  try {
    return new URL(IDENTITY_REDIRECT_URI).origin;
  } catch {
    return "http://localhost:4000";
  }
})();
const DEV_FORCE_ELIGIBLE = process.env.DEV_FORCE_ELIGIBLE?.toLowerCase();
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const CACHET_BASE = process.env.CACHET_BASE || "https://cachet.dunkirk.sh";
// Hackatime integration removed per request.
// Airtable config for hours lookup (optional)
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || "";
const AIRTABLE_EMAIL_FIELD = process.env.AIRTABLE_EMAIL_FIELD || "Email";
const AIRTABLE_HOURS_FIELD = process.env.AIRTABLE_HOURS_FIELD || "Hours";
// If your Airtable stores a separate "approved hours" field that differs
// from total hours, set `AIRTABLE_APPROVED_HOURS_FIELD`. Otherwise we
// fall back to `AIRTABLE_HOURS_FIELD`.
const AIRTABLE_APPROVED_HOURS_FIELD = process.env.AIRTABLE_APPROVED_HOURS_FIELD || AIRTABLE_HOURS_FIELD;
const AIRTABLE_APPROVAL_FIELD = process.env.AIRTABLE_APPROVAL_FIELD || "Approved";
const AIRTABLE_APPROVAL_VALUE = (process.env.AIRTABLE_APPROVAL_VALUE || "yes").toLowerCase();
const HOURS_TO_CREDITS = Number(process.env.HOURS_TO_CREDITS || "1");

// Fetch the first matching Airtable record for the given email and return
// both the hours field (number) and whether the record is approved.
async function fetchAirtableRecordByEmail(email) {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME || !email) return null;
  try {
    const q = `filterByFormula=${encodeURIComponent(`{${AIRTABLE_EMAIL_FIELD}}='${email.replace("'","\\'")}'`)}`;
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}?${q}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j.records || !j.records.length) return null;
    const rec = j.records[0];
    const fields = rec.fields || {};
    // Prefer the approved-hours field (if provided) because approved hours
    // may differ from total hours in Airtable.
    const rawHours = fields[AIRTABLE_APPROVED_HOURS_FIELD] ?? fields[AIRTABLE_HOURS_FIELD];
    const hours = Number(rawHours);
    const approvedRaw = fields[AIRTABLE_APPROVAL_FIELD];
    const approved = approvedRaw !== undefined && approvedRaw !== null && String(approvedRaw).toLowerCase() === AIRTABLE_APPROVAL_VALUE;
    return { hours: Number.isFinite(hours) ? hours : null, approved };
  } catch (err) {
    console.error('airtable lookup failed', String(err));
    return null;
  }
}
async function getUserfromReq(req:any){
  try {
    // Use the shared extractToken helper so we handle Authorization header
    // and cookies consistently (no cookie-parser dependency needed).
    const token = extractToken(req);
    if (!token) return null;

    const found = await db.select().from(users).where(eq(users.identityToken, token)).limit(1);
    return found[0] || null;
  } catch (e) {
    console.error('[getUserfromReq] error', String(e));
    return null;
  }
}
async function fetchSlackAvatar(opts: { slackId?: string | null; email?: string | null }): Promise<string | undefined> {
  // Try cachet first (no token needed) when we have a Slack user id
  if (opts.slackId) {
    try {
      const res = await fetch(`${CACHET_BASE}/users/${opts.slackId}`);
      if (res.ok) {
        const data = (await res.json()) as { imageUrl?: string };
        if (data.imageUrl) return data.imageUrl;
      }
    } catch {
      // best-effort
    }
  }

  if (!SLACK_BOT_TOKEN) return undefined;
  const headers = { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/x-www-form-urlencoded" } as const;

  // Prefer lookup by ID when available
  if (opts.slackId) {
    const res = await fetch("https://slack.com/api/users.info", {
      method: "POST",
      headers,
      body: new URLSearchParams({ user: opts.slackId })
    });
    const data = (await res.json()) as { ok?: boolean; user?: { profile?: { image_512?: string; image_192?: string; image_72?: string } } };
    if (data.ok && data.user?.profile) {
      return data.user.profile.image_512 || data.user.profile.image_192 || data.user.profile.image_72;
    }
  }

  if (opts.email) {
    const res = await fetch("https://slack.com/api/users.lookupByEmail", {
      method: "POST",
      headers,
      body: new URLSearchParams({ email: opts.email })
    });
    const data = (await res.json()) as { ok?: boolean; user?: { profile?: { image_512?: string; image_192?: string; image_72?: string } } };
    if (data.ok && data.user?.profile) {
      return data.user.profile.image_512 || data.user.profile.image_192 || data.user.profile.image_72;
    }
  }

  return undefined;
}

const app = express();
const corsOptions = process.env.NODE_ENV === 'production'
  ? { origin: FRONTEND_BASE_URL, credentials: true }
  : { origin: true, credentials: true };

app.use(cors(corsOptions));

// Robust body parsing: try JSON first, but if body-parser throws a SyntaxError
// (Airtable sometimes sends a bare string or malformed JSON), fall back to
// reading the raw text and attempt to parse or keep as string.
app.use((req, res, next) => {
  const jsonParser = express.json();
  jsonParser(req, res, (err) => {
    if (!err) return next();
    // If body-parser returned a SyntaxError, try to read raw text instead
    if (err && err.type === 'entity.parse.failed') {
      const textParser = express.text({ type: '*/*' });
      textParser(req, res, (err2) => {
        if (err2) return next(err2);
        // try to coerce to JSON if it looks like JSON, otherwise leave as string
        try {
          const maybe = (req.body || '').toString();
          // strip accidental surrounding template braces
          const cleaned = maybe.trim().replace(/^\s*"+|"+\s*$/g, '');
          if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
            req.body = JSON.parse(cleaned);
          } else if (cleaned.length) {
            // accept raw id strings as { id: 'rec...' }
            req.body = { id: cleaned };
          } else {
            req.body = {};
          }
        } catch (e) {
          req.body = { id: (req.body || '').toString() };
        }
        return next();
      });
    } else {
      return next(err);
    }
  });
});

// Simple request logger to help debug incoming webhooks
app.use((req, _res, next) => {
  try {
    const now = new Date().toISOString();
    // Avoid logging potentially large bodies here; log headers and route
    console.log(`[req] ${now} ${req.method} ${req.originalUrl} headers=${JSON.stringify(req.headers)}`);
  } catch (e) {
    // ignore logging errors
  }
  next();
});

// Airtable webhook endpoints
// Optional security: set WEBHOOK_SECRET env var and Airtable script should send header 'x-webhook-secret'
app.post('/webhook/airtable/users', async (req, res) => {
  try {
    const secret = process.env.WEBHOOK_SECRET;
    if (secret) {
      const incoming = String(req.headers['x-webhook-secret'] || '');
      if (!incoming || incoming !== secret) return res.status(403).json({ error: 'invalid webhook secret' });
    }

    console.log('[webhook/users] payload received at', new Date().toISOString());
    const record = req.body;
    // Log the raw body to help debug different payload shapes
    try { console.log('[webhook/users] raw body:', JSON.stringify(record)); } catch {}

    // Airtable record from automation script should be the record object (with .id and .fields)
    let fields = (record && (record.fields || record)) || {};

    // If the automation only sends a partial payload (for example only the record id
    // or only the changed fields), try fetching the full record from Airtable so we
    // have identifying fields like Email or identityId.
    const hasIdentity = !!(fields.identityId || fields.IdentityId || fields.identity_id);
    const hasEmail = !!(fields.Email || fields.email || fields.email_address);
    if (!hasIdentity && !hasEmail && record && record.id && AIRTABLE_BASE_ID) {
      try {
        const userTable = process.env.AIRTABLE_USER_TABLE || process.env.AIRTABLE_TABLE_NAME || 'users';
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(userTable)}/${encodeURIComponent(record.id)}`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.AIRTABLE_PAT || process.env.AIRTABLE_API_KEY || ''}` } });
        if (r.ok) {
          const jr = await r.json();
          fields = jr.fields || fields;
          console.log('[webhook/users] fetched full record from airtable, fields keys:', Object.keys(fields));
        } else {
          console.log('[webhook/users] airtable fetch failed', r.status, await r.text());
        }
      } catch (e) {
        console.error('[webhook/users] airtable fetch error', String(e));
      }
    }

    const identityId = fields.identityId || fields.IdentityId || fields.identity_id || undefined;
    const email = fields.Email || fields.email || fields.email_address || null;

    const updates: Record<string, any> = {};
    if (fields.Name) updates.name = String(fields.Name);
    if (fields.Email) updates.email = String(fields.Email);
    if (fields.Image) updates.image = String(fields.Image);
    if (fields.SlackId) updates.slackId = String(fields.SlackId);
    if (fields.Banned !== undefined) updates.banned = Boolean(fields.Banned);
    const rawCredits = fields.credits ?? fields.Credits ?? fields.CREDITs ?? fields.Credits ?? fields['Shop Credits'];
    if (rawCredits !== undefined) updates.credits = String(rawCredits ?? '0');
    if (fields.verificationStatus !== undefined) updates.verificationStatus = String(fields.verificationStatus);
    updates.updatedAt = new Date();

    // Try identityId first, else email
    let updated: any = null;
    if (identityId) {
      const [u] = await db.update(users).set(updates).where(eq(users.id, String(identityId))).returning();
      updated = u || null;
    } else if (email) {
      const [u] = await db.update(users).set(updates).where(eq(users.email, String(email))).returning();
      updated = u || null;
    }

    // If no existing user updated, optionally insert a new user when identityId present
    if (!updated && identityId) {
      try {
        const [created] = await db.insert(users).values(({ id: String(identityId), ...updates, createdAt: new Date() } as any)).returning();
        updated = created;
      } catch (e) {
        console.error('[webhook/users] insert failed', String(e));
      }
    }

    console.log('[webhook/users] finished', { identityId, email, updated: !!updated });
    return res.json({ ok: true, updated: !!updated, recordId: record?.id ?? null });
  } catch (err) {
    console.error('[webhook/users] error', String(err));
    return res.status(500).json({ error: String(err) });
  }
});

app.post('/webhook/airtable/orders', async (req, res) => {
  try {
    const secret = process.env.WEBHOOK_SECRET;
    if (secret) {
      const incoming = String(req.headers['x-webhook-secret'] || '');
      if (!incoming || incoming !== secret) return res.status(403).json({ error: 'invalid webhook secret' });
    }

    console.log('[webhook/orders] payload received at', new Date().toISOString());
    const record = req.body;
    try { console.log('[webhook/orders] raw body:', JSON.stringify(record)); } catch {}

    // Extract fields (automation may send either the record object or just fields)
    let fields = (record && (record.fields || record)) || {};

    // If payload lacks identifying order fields, but includes an Airtable record id,
    // fetch the full record so we can access OrderId / other fields.
    // Only consider explicit OrderId fields as indicating we already have
    // the identifying OrderId. Do NOT treat an Airtable record `id` as an
    // OrderId here — if the payload contains only a record id, we want to
    // fetch the full record below.
    const hasOrderId = !!(fields.OrderId || fields.orderId || fields['Order Id'] || fields['order id']);
    if (!hasOrderId && record && record.id && AIRTABLE_BASE_ID) {
      try {
        const orderTable = process.env.AIRTABLE_SHOP_TXN_TABLE || process.env.AIRTABLE_TABLE_NAME || 'shop_txns';
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(orderTable)}/${encodeURIComponent(record.id)}`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.AIRTABLE_PAT || process.env.AIRTABLE_API_KEY || ''}` } });
        if (r.ok) {
          const jr = await r.json();
          fields = jr.fields || fields;
          console.log('[webhook/orders] fetched full record from airtable, fields keys:', Object.keys(fields));
        } else {
          console.log('[webhook/orders] airtable fetch failed', r.status, await r.text());
        }
      } catch (e) {
        console.error('[webhook/orders] airtable fetch error', String(e));
      }
    }

    // Prefer explicit OrderId fields. Do NOT treat Airtable record ids
    // (e.g. "rec...") as an OrderId — they can contain digits and lead to
    // accidental numeric matches like `4` which cause incorrect updates.
    const orderIdRaw = fields.OrderId || fields.orderId || fields['Order Id'] || fields['order id'] || null;
    // Normalize OrderId: it may be a string containing digits; extract first integer
    let orderId: number | null = null;
    if (orderIdRaw !== undefined && orderIdRaw !== null) {
      const asStr = String(orderIdRaw).trim();
      // Try direct numeric parse first
      if (/^-?\d+$/.test(asStr)) {
        orderId = Number(asStr);
      } else {
        // Extract first continuous digits sequence
        const m = asStr.match(/(\d+)/);
        if (m) orderId = Number(m[1]);
      }
    }
    const updates: Record<string, any> = {};
    if (fields.UserId) updates.userId = String(fields.UserId);
    if (fields.ShopItemId) updates.shopItemId = String(fields.ShopItemId);
    const rawAmount = fields.Amount ?? fields.amount ?? fields.AmountPaid ?? fields['Amount'];
    if (rawAmount !== undefined) updates.amount = String(rawAmount);
    if (fields.Status !== undefined) updates.status = String(fields.Status || fields.status);
    if (fields.SlackId !== undefined) updates.slackId = String(fields.SlackId);
    // Don't add `updatedAt` for orders because the `orders` table does not
    // include an `updated_at` column. Drizzle will strip unknown fields which
    // could result in an empty `SET` clause and a broken UPDATE SQL statement.

    // Sanitize updates to remove undefined values so Drizzle doesn't drop
    // them and produce an empty update set.
    const sanitized = Object.fromEntries(Object.entries(updates).filter(([k, v]) => v !== undefined));

    let updated: any = null;
    if (orderId) {
      const found = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (found && found.length) {
        if (Object.keys(sanitized).length) {
          const [u] = await db.update(orders).set(sanitized).where(eq(orders.id, orderId)).returning();
          updated = u || null;
        } else {
          // Nothing to update; return the existing record as-is.
          updated = found[0];
        }
      } else {
        // create new order if not found
        try {
          const insertVals: Record<string, any> = Object.assign({}, updates);
          if (!insertVals.userId) insertVals.userId = updates.userId ?? null;
          if (!insertVals.amount) insertVals.amount = updates.amount ?? '0';
          const [created] = await db.insert(orders).values((insertVals as any)).returning();
          updated = created;
        } catch (e) {
          console.error('[webhook/orders] insert failed', String(e));
        }
      }
    }

    console.log('[webhook/orders] finished', { orderId, updated: !!updated });
    return res.json({ ok: true, updated: !!updated, recordId: record?.id ?? null });
  } catch (err) {
    console.error('[webhook/orders] error', String(err));
    return res.status(500).json({ error: String(err) });
  }
});

// Helper to rewrite image paths to a CDN when configured.
const CDN_BASE = process.env.CDN_BASE_URL || "";
function toCdnUrl(img: string | null | undefined) {
  if (!img) return null;
  const s = String(img).trim();
  if (!s) return null;
  // leave absolute URLs alone
  if (/^https?:\/\//i.test(s)) return s;
  if (!CDN_BASE) return s;
  return `${CDN_BASE.replace(/\/$/, "")}/${s.replace(/^\//, "")}`;
}

// Middleware: if a request includes an identity token for a user who is banned,
// block access to the site (returns 403). Allow unauthenticated requests.
app.use(async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return next();

    // Allow auth callback and login endpoints to proceed so login flow can still
    // run (we'll still prevent access once authenticated if banned).
    if (req.path.startsWith('/api/auth')) return next();

    const found = await db.select().from(users).where(eq(users.identityToken, token)).limit(1);
    const u = found[0];
    if (u && (u as any).banned) {
      return res.status(403).send('Access denied');
    }
    return next();
  } catch (err) {
    console.error('[banned middleware] error', String(err));
    return next();
  }
});

// Helper: extract bearer token from Authorization header or `hc_identity` cookie
function extractToken(req: express.Request): string | undefined {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) return auth.slice(7);
  const raw = req.headers.cookie || "";
  const pairs = String(raw).split(/;\s*/).filter(Boolean);
  for (const p of pairs) {
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = p.slice(0, idx);
    const v = p.slice(idx + 1);
    if (k === "hc_identity") return decodeURIComponent(v);
  }
  return undefined;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Debug: show cookies and auth extraction for troubleshooting
app.get("/api/__debug_cookies", (req, res) => {
  try {
    const raw = req.headers.cookie || "";
    const token = extractToken(req);
    res.json({ cookieHeader: raw, extractedToken: token ?? null, headers: req.headers });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Debug endpoint: list files under the built `dist` directory (temporary)
app.get("/api/__debug_dist", async (_req, res) => {
  try {
    const fs = await import("node:fs/promises");
    const distDir = path.join(process.cwd(), "dist");
    const list = await fs.readdir(distDir);
    res.json({ distDir, list });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/__debug_assets", async (_req, res) => {
  try {
    const fs = await import("node:fs/promises");
    const assetsDir = path.join(process.cwd(), "dist", "assets");
    const files = await fs.readdir(assetsDir);
    res.json({ assetsDir, files });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/projects", async (_req, res) => {
  const rows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  res.json(rows);
});

app.post("/api/projects", async (req, res) => {
  const { name, description, status } = req.body || {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "name is required" });
  }

  const [created] = await db
    .insert(projects)
    .values({
      name: name.trim(),
      description: typeof description === "string" ? description.trim() : "",
      status: typeof status === "string" ? status.trim() : "draft"
    })
    .returning();

  res.status(201).json(created);
});

// Capture submitted projects into created_projects
app.post("/api/projects/submit", async (req, res) => {
  const { name, email } = req.body || {};
  if (!name || typeof name !== "string") return res.status(400).json({ error: "name is required" });
  if (!email || typeof email !== "string") return res.status(400).json({ error: "email is required" });

  try {
    const [created] = await db
      .insert(createdProjects)
      .values({
        name: name.trim(),
        email: email.trim(),
        createdAt: new Date()
      })
      .returning();

    return res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "project submit failed", detail: message });
  }
});

app.patch("/api/projects/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "invalid id" });
  }
  if (!status || typeof status !== "string") {
    return res.status(400).json({ error: "status is required" });
  }

  const [updated] = await db
    .update(projects)
    .set({ status: status.trim(), updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();

  if (!updated) {
    return res.status(404).json({ error: "project not found" });
  }

  // If project was approved, attempt to credit the submitting user based on Airtable hours
  try {
    if (String(status).toLowerCase() === "approved") {
      // Try to find a submitted project record that matches name
      const found = await db.select().from(createdProjects).where(eq(createdProjects.name, updated.name)).limit(1);
      const email = found[0]?.email ?? null;
      if (email) {
        const rec = await fetchAirtableRecordByEmail(email);
        if (rec) {
          if (!rec.approved) {
            console.log('Airtable record not approved, skipping credit for', email);
          } else if (rec.hours === null) {
            console.log('Airtable record missing hours for', email);
          } else {
            const credits = Math.max(0, Math.floor(rec.hours * HOURS_TO_CREDITS));
            if (credits > 0) {
              const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
              if (u) {
                const prev = Number(u.credits ?? 0) || 0;
                const next = prev + credits;
                await db.update(users).set({ credits: String(next) }).where(eq(users.id, u.id));
                try {
                  await upsertAirtableUser({ id: u.id, credits: String(next), updatedAt: new Date() });
                } catch (e) { console.error('[payout] airtable upsert failed', String(e)); }
                await db.insert(shopTransactions).values({ userId: u.id, amount: String(credits), reason: `Payout for project ${updated.id}`, createdAt: new Date() });
                console.log('Credited user', email, credits, 'hours=', rec.hours);
              } else {
                console.log('No user found for email, skipping credit:', email);
              }
            }
          }
        } else {
          console.log('No airtable record found for', email);
        }
      } else {
        console.log('No submission record found matching project name, skipping payout for project', updated.id);
      }
    }
  } catch (err) {
    console.error('payout processing failed', String(err));
  }

  res.json(updated);
});

app.get("/api/auth/login", (req, res) => {
  try {
    if (!IDENTITY_CLIENT_ID) {
      console.error('[auth/login] HC_IDENTITY_CLIENT_ID is not set');
      return res.status(500).json({ error: "Missing HC_IDENTITY_CLIENT_ID" });
    }
    // Accept `continue` or `cont` to return the user after login, and `force=1` to add prompt=login
    const continueUrl = String((req.query && (req.query.continue || req.query.cont)) || "");
    const force = String((req.query && req.query.force) || "");

    const url = new URL("/oauth/authorize", IDENTITY_HOST);
      url.searchParams.set("client_id", IDENTITY_CLIENT_ID);
      url.searchParams.set("redirect_uri", IDENTITY_REDIRECT_URI);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "profile email name slack_id verification_status");

    if (continueUrl) {
      try {
        const payload = Buffer.from(JSON.stringify({ cont: continueUrl }), "utf8").toString("base64url");
        url.searchParams.set("state", payload);
      } catch (e) {
        console.error('[auth/login] failed to encode continue URL', String(e));
      }
    }

    if (force === "1") url.searchParams.set("prompt", "login");

    console.log('[auth/login] redirecting to', url.toString());
    res.redirect(url.toString());
  } catch (err) {
    console.error('[auth/login] unexpected error', err instanceof Error ? err.stack : String(err));
    res.status(500).json({ error: "login failed", detail: String(err) });
  }
});

// Stateless logout: clear known cookies (best-effort) and bounce to the frontend root
app.get("/api/auth/logout", (_req, res) => {
  res.clearCookie("session");
  res.clearCookie("hc_identity");
  const redirectUrl = new URL("/", FRONTEND_BASE_URL);
  res.redirect(302, redirectUrl.toString());
});

app.get("/api/auth/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  const rawState = req.query.state as string | undefined;
  if (!code) return res.status(400).send("Missing code");
  if (!IDENTITY_CLIENT_ID || !IDENTITY_CLIENT_SECRET) {
    return res.status(500).send("Missing client id/secret");
  }
  try {
    const tokenUrl = new URL("/oauth/token", IDENTITY_HOST);
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: IDENTITY_REDIRECT_URI,
      client_id: IDENTITY_CLIENT_ID,
      client_secret: IDENTITY_CLIENT_SECRET
    });
    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const tokenJson = await tokenRes.json();
    console.log('[auth callback] tokenJson:', tokenJson);
    if (!tokenRes.ok || !tokenJson.access_token) {
      return res.status(502).json({ error: "token exchange failed", detail: tokenJson });
    }

    console.log("hca auth: true");

    const meUrl = new URL("/api/v1/me", IDENTITY_HOST);
    const meRes = await fetch(meUrl, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` }
    });

    if (!meRes.ok) {
      const detail = await meRes.text();
      return res.status(502).json({ error: "profile fetch failed", detail });
    }

    const meJson = (await meRes.json()) as { identity?: Record<string, unknown> };
    console.log('[auth callback] meJson identity keys:', Object.keys(meJson.identity || {}));
    const identity = meJson.identity || {};
    const identityId = typeof (identity as { id?: unknown }).id === "string" ? (identity as { id?: unknown }).id : undefined;
    const identityEmail = typeof (identity as { email?: unknown }).email === "string"
      ? (identity as { email?: unknown }).email
      : typeof (identity as { primary_email?: unknown }).primary_email === "string"
        ? (identity as { primary_email?: unknown }).primary_email
        : typeof (identity as { primaryEmail?: unknown }).primaryEmail === "string"
          ? (identity as { primaryEmail?: unknown }).primaryEmail
          : undefined;

    const identityName = typeof (identity as { name?: unknown }).name === "string"
      ? (identity as { name?: unknown }).name
      : (() => {
          const first = typeof (identity as { first_name?: unknown }).first_name === "string"
            ? (identity as { first_name?: unknown }).first_name
            : typeof (identity as { firstName?: unknown }).firstName === "string"
              ? (identity as { firstName?: unknown }).firstName
              : "";
          const last = typeof (identity as { last_name?: unknown }).last_name === "string"
            ? (identity as { last_name?: unknown }).last_name
            : typeof (identity as { lastName?: unknown }).lastName === "string"
              ? (identity as { lastName?: unknown }).lastName
              : "";
          const full = `${first} ${last}`.trim();
          return full || undefined;
        })();
    const slackId = typeof (identity as { slack_id?: unknown }).slack_id === "string" ? (identity as { slack_id?: unknown }).slack_id : undefined;
    const address = typeof (identity as { address?: unknown }).address === "string" ? (identity as { address?: unknown }).address : undefined;
    const verificationStatus = typeof (identity as { verification_status?: unknown }).verification_status === "string"
      ? (identity as { verification_status?: unknown }).verification_status
      : undefined;
    const emailVerified = Boolean((identity as { email_verified?: unknown }).email_verified || (identity as { emailVerified?: unknown }).emailVerified);
    let profilePicture = typeof (identity as { image?: unknown }).image === "string"
      ? (identity as { image?: unknown }).image
      : typeof (identity as { picture?: unknown }).picture === "string"
        ? (identity as { picture?: unknown }).picture
        : typeof (identity as { profile?: { image_512?: unknown; image?: unknown } }).profile?.image_512 === "string"
          ? (identity as { profile?: { image_512?: unknown; image?: unknown } }).profile?.image_512
          : typeof (identity as { profile?: { image?: unknown } }).profile?.image === "string"
            ? (identity as { profile?: { image?: unknown } }).profile?.image
            : undefined;

    const rawEligible =
      (identity as { ysws_eligible?: unknown }).ysws_eligible ??
      (identity as { yswsEligible?: unknown }).yswsEligible ??
      (identity as { eligible?: unknown }).eligible;

    const isEligible =
      typeof rawEligible === "string" ? rawEligible.toLowerCase() === "yes" : Boolean(rawEligible);

    let effectiveEligible = isEligible;
    if (DEV_FORCE_ELIGIBLE === "yes" || DEV_FORCE_ELIGIBLE === "true") effectiveEligible = true;
    if (DEV_FORCE_ELIGIBLE === "no" || DEV_FORCE_ELIGIBLE === "false") effectiveEligible = false;

    console.log("[auth] identity", {
      id: identityId,
      email: identityEmail,
      slackId,
      verificationStatus,
      hasAccessToken: Boolean(tokenJson.access_token)
    });

    let existing: typeof users.$inferSelect[] = [];
    if (identityId && identityEmail) {
      const idValue = identityId as string;
      const emailValue = identityEmail as string;
      existing = await db.select().from(users).where(eq(users.id, idValue)).limit(1);
      const pickString = (val: unknown) => (typeof val === "string" ? val : null);
      if (!profilePicture) {
        const fetched: string | undefined = await fetchSlackAvatar({
          slackId: typeof slackId === "string" ? slackId : null,
          email: emailValue
        });
        profilePicture = fetched ?? profilePicture;
      }
      const pickRole = (val: unknown): "admin" | "reviewer" | "member" | null => {
        return val === "admin" || val === "reviewer" || val === "member" ? val : null;
      };

      const basePayload: {
        name: string | null;
        email: string;
        emailVerified: boolean;
        image: string | null;
        slackId: string | null;
        role: "admin" | "reviewer" | "member" | null;
        verificationStatus: string | null;
        identityToken: string | null;
        refreshToken: string | null;
        banned: boolean;
        updatedAt: Date;
        address: string | null;
        } = {
        name: pickString(identityName ?? existing[0]?.name),
        email: emailValue,
        emailVerified,
        image: pickString(profilePicture ?? existing[0]?.image),
        slackId: pickString(slackId ?? existing[0]?.slackId),
        role: pickRole(existing[0]?.role ?? "member"),
        verificationStatus: pickString(verificationStatus ?? existing[0]?.verificationStatus),
        identityToken: typeof tokenJson.access_token === "string" ? tokenJson.access_token : existing[0]?.identityToken || null,
        refreshToken: typeof tokenJson.refresh_token === "string" ? tokenJson.refresh_token : existing[0]?.refreshToken || null,
        banned: !effectiveEligible,
        address: address ?? ((existing[0] && typeof (existing[0] as any).address === 'string') ? (existing[0] as any).address : null) ?? null,
          updatedAt: new Date()
      };

      if (existing.length) {
        await db.update(users).set(basePayload).where(eq(users.id, idValue));
        console.log("[auth] user updated", { id: idValue });
        // Persist to Airtable (best-effort)
        try { await upsertAirtableUser({ id: idValue, name: basePayload.name as string | null, email: basePayload.email, image: basePayload.image as string | null, slackId: basePayload.slackId as string | null, role: basePayload.role as string | null, banned: basePayload.banned }); } catch (e) { console.error('[auth] airtable upsert failed', String(e)); }
      } else {
        await db.insert(users).values(({ ...basePayload, id: idValue, createdAt: new Date() } as any));
        console.log("[auth] user inserted", { id: idValue });
        try { await upsertAirtableUser({ id: idValue, name: basePayload.name as string | null, email: basePayload.email, image: basePayload.image as string | null, slackId: basePayload.slackId as string | null, role: basePayload.role as string | null, banned: basePayload.banned }); } catch (e) { console.error('[auth] airtable upsert failed', String(e)); }
      }
    }

    // Hackatime integration removed: skip linking Hackatime accounts.

    // Prefer a continue URL from OAuth `state` when provided (dev flow).
    let finalContinue = FRONTEND_BASE_URL;
    if (rawState) {
      try {
        const parsed = JSON.parse(Buffer.from(rawState, "base64url").toString("utf8"));
        if (parsed && typeof parsed.cont === "string" && parsed.cont.length) {
          finalContinue = parsed.cont;
        }
      } catch (e) {
        // ignore parse errors and fall back to FRONTEND_BASE_URL
      }
    }

    const redirectUrl = new URL("/", finalContinue);
    redirectUrl.searchParams.set("eligible", effectiveEligible ? "yes" : "no");
    if (!effectiveEligible) redirectUrl.searchParams.set("msg", "banned");

    // Set auth cookies so the browser can authenticate next requests.
    try {
      const secure = process.env.NODE_ENV === "production";
      const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
      const sameSiteVal: "lax" | "none" = secure ? "none" : "lax";
      const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
      const cookieOpts: Record<string, unknown> = {
        httpOnly: true,
        sameSite: sameSiteVal,
        secure: secure,
        path: "/",
        maxAge,
      };
      if (cookieDomain) (cookieOpts as any).domain = cookieDomain;

      res.cookie("hc_identity", String(tokenJson.access_token), cookieOpts);
      console.log('[auth callback] set hc_identity cookie');

      // session cookie: session-only (no persistent maxAge)
      const sessionOpts = { ...cookieOpts } as Record<string, unknown>;
      delete (sessionOpts as any).maxAge;
      res.cookie("session", "1", sessionOpts);
      console.log('[auth callback] set session cookie');
    } catch (e) {
      console.error("failed to set auth cookies", String(e));
    }

    return res.redirect(302, redirectUrl.toString());
  } catch (err) {
    console.error('[auth/callback] unexpected error', err instanceof Error ? err.stack : String(err));
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "auth callback failed", detail: message });
  }
});

// Hackatime integration removed: endpoints deleted.

app.get("/api/auth/me", async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "missing bearer token" });
  try {
    const meUrl = new URL("/api/v1/me", IDENTITY_HOST);
    const meRes = await fetch(meUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!meRes.ok) {
      const detail = await meRes.text();
      return res.status(401).json({ error: "invalid token", detail });
    }
    const meJson = await meRes.json();
    res.json(meJson);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/auth/profile] error', err);
    try {
      const fs = await import('node:fs');
      const out = typeof err === 'string' ? err : (err instanceof Error ? (err.stack || err.message) : String(err));
      fs.appendFileSync('profile_error.log', `\n---- ${new Date().toISOString()} ----\n${out}\n`);
    } catch (e) {}
    res.status(500).json({ error: "profile lookup failed", detail: message });
  }
});

// Convenience: return the most recently seen user (for UI avatar without exposing tokens)
app.get("/api/auth/profile", async (req, res) => {
  try {
    console.log('[profile] handler start');
    const token = extractToken(req);
    console.log('[profile] extracted token:', token?.slice ? token.slice(0,12) + '...' : token);

    let userRow;
    if (token) {
      console.log('[profile] about to run raw query');
      try {
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        const sql = 'select "id", "name", "email", "email_verified", "image", "slack_id", "banned", "credits", "role", "verification_status", "identity_token", "refresh_token", "created_at", "updated_at" from "user" where "user"."identity_token" = $1 limit $2';
        const q = await pool.query(sql, [token, 1]);
        console.log('[profile] raw query returned rows:', q.rows.length);
        if (q.rows && q.rows.length) userRow = q.rows[0];
        // If slack_id is missing, try to fetch it from Slack API
        if (userRow && !userRow.slack_id && userRow.email && process.env.SLACK_BOT_TOKEN) {
          const slackRes = await fetch("https://slack.com/api/users.lookupByEmail", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({ email: userRow.email })
          });
          const slackData = await slackRes.json();
          if (slackData.ok && slackData.user && slackData.user.id) {
            userRow.slack_id = slackData.user.id;
            // Update DB
            await pool.query('update "user" set "slack_id" = $1 where "id" = $2', [slackData.user.id, userRow.id]);
          }
        }
        await pool.end();
      } catch (e) {
        console.error('[api/auth/profile] raw query error', e);
        throw e;
      }
    }

    // Do not auto-fallback to the most-recent user. Treat as unauthenticated when no token.
    if (!userRow) {
      return res.status(401).json({ error: "not authenticated" });
    }

    // Fetch the latest identity info from the identity provider to ensure
    // any changes to eligibility/banned status are reflected immediately.
    try {
      const meUrl = new URL('/api/v1/me', IDENTITY_HOST);
      const meRes = await fetch(meUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (meRes.ok) {
        const meJson = await meRes.json();
        const identity = meJson.identity || {};
        const rawEligible = (identity as any).ysws_eligible ?? (identity as any).yswsEligible ?? (identity as any).eligible;
        const isEligible = typeof rawEligible === 'string' ? rawEligible.toLowerCase() === 'yes' : Boolean(rawEligible);
        let effectiveEligible = isEligible;
        if (DEV_FORCE_ELIGIBLE === 'yes' || DEV_FORCE_ELIGIBLE === 'true') effectiveEligible = true;
        if (DEV_FORCE_ELIGIBLE === 'no' || DEV_FORCE_ELIGIBLE === 'false') effectiveEligible = false;
        const shouldBeBanned = !effectiveEligible;
        // If DB differs, update it so middleware and other endpoints see the change.
        if ((userRow.banned ? true : false) !== shouldBeBanned) {
          try {
            const pool2 = new Pool({ connectionString: process.env.DATABASE_URL });
            await pool2.query('update "user" set "banned" = $1, "updated_at" = now() where "id" = $2', [shouldBeBanned, userRow.id]);
            await pool2.end();
            userRow.banned = shouldBeBanned;
            console.log('[profile] synced banned status from identity provider for', userRow.id, 'banned=', shouldBeBanned);
          } catch (e) {
            console.error('[profile] failed to update banned status', String(e));
          }
        }
        // If the user is now banned, deny access immediately.
        if (shouldBeBanned) {
          return res.status(403).json({ error: 'banned' });
        }
      } else {
        console.log('[profile] identity provider /me returned', meRes.status);
      }
    } catch (e) {
      console.error('[profile] identity fetch error', String(e));
      // on error, continue with existing userRow (do not block access)
    }

    const canManageShop = userRow.role === "admin";
    res.json({
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      emailVerified: userRow.emailVerified,
      image: userRow.image,
      slackId: userRow.slack_id, // derive from DB field
      role: userRow.role,
      canManageShop,
      shopOpen: canManageShop,
      identityToken: canManageShop ? userRow.identityToken : null,
      identityLinked: Boolean(userRow.id),
      credits: Number(userRow.credits ?? 0),
    });
  } catch (err) {
    console.error('[auth/profile] unexpected error', err instanceof Error ? err.stack : String(err));
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "profile lookup failed", detail: message });
  }
});

// Use process.cwd() to reliably reference the built `dist` directory
// regardless of how the server is executed (works on Heroku).
// On Vercel, static files are served by the CDN — skip filesystem serving.
const clientPath = path.join(process.cwd(), "dist");
if (!process.env.VERCEL) {
const assetsPath = path.join(process.cwd(), "dist", "assets");
console.log("Serving client from:", clientPath, "assets from:", assetsPath);
// Custom assets middleware: try explicit disk locations before falling
// through to the SPA fallback. Some builds place images in `dist/` (e.g.
// `dist/logo.png` or `dist/covers/...`) while Vite output lives in
// `dist/assets`. This middleware checks both locations and returns the
// first matching file to avoid the SPA fallback returning `index.html`.
app.use("/assets", (req, res, next) => {
  try {
    const rel = req.path.replace(/^\/assets/, "");
    const candidates = [path.join(assetsPath, rel), path.join(clientPath, rel)];
    for (const c of candidates) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        console.log("serving asset file:", c);
        return res.sendFile(c);
      }
    }
  } catch (err) {
    console.error("asset lookup error", String(err));
  }
  return next();
});
app.use("/assets", express.static(assetsPath));
// Fallback: also serve files from the dist root under /assets
app.use("/assets", express.static(clientPath));
app.use(express.static(clientPath));
}
// Webhook endpoint for Airtable -> Postgres sync
app.post('/api/webhook/airtable', async (req, res) => {
  try {
    const secret = process.env.AIRTABLE_WEBHOOK_SECRET;
    if (secret) {
      const header = String(req.headers['x-airtable-secret'] || '');
      if (!header || header !== secret) return res.status(401).json({ error: 'invalid webhook secret' });
    }

    const body = req.body || {};
    const table = body.table || body.tableName || (body.record && body.record.table) || null;
    const record = body.record || body.fields || null;
    if (!table || !record) return res.status(400).json({ error: 'missing table or record' });

    if (String(table).toLowerCase().includes('user')) {
      const f = record.fields || record;
      const identityId = f.identityId || f.IdentityId || f.id || f.ID || null;
      if (!identityId) return res.status(400).json({ error: 'missing identityId in user record' });
      const existing = await db.select().from(users).where(eq(users.id, String(identityId))).limit(1);
      const payload = {
        id: String(identityId),
        name: f.Name ?? f.name ?? null,
        email: f.Email ?? f.email ?? null,
        image: f.Image ?? f.image ?? null,
        slackId: f.SlackId ?? f.slackId ?? null,
        role: (f.role ?? f.Role) || null,
        banned: !!(f.Banned ?? f.banned),
        credits: f.credits ?? null,
        verificationStatus: f.verificationStatus ?? f.VerificationStatus ?? null,
      };
      if (existing.length) {
        await db.update(users).set({ name: payload.name, email: payload.email, image: payload.image, slackId: payload.slackId, role: payload.role, banned: payload.banned, credits: payload.credits, verificationStatus: payload.verificationStatus, updatedAt: new Date() }).where(eq(users.id, payload.id));
      } else {
        await db.insert(users).values(({ ...payload, createdAt: new Date(), updatedAt: new Date() } as any));
      }
      return res.json({ ok: true });
    }

    // For orders: best-effort insert/update using OrderId or record id
    if (String(table).toLowerCase().includes('order')) {
      const f = record.fields || record;
      const orderId = f.OrderId || f.orderId || null;
      const userId = f.UserId || f.userId || null;
      const shopItemId = f.ShopItemId || f.shopItemId || null;
      const amount = f.Amount ?? null;
      const status = f.Status ?? null;
      const slackId = f.SlackId ?? f.slack_id ?? null;
      if (orderId && Number.isInteger(Number(orderId))) {
        const idNum = Number(orderId);
        const exists = await db.select().from(orders).where(eq(orders.id, idNum)).limit(1);
        const upd: Record<string, any> = {
          userId: userId ? String(userId) : undefined,
          shopItemId: shopItemId ? String(shopItemId) : undefined,
          amount: amount !== undefined && amount !== null ? String(amount) : undefined,
          status: status !== undefined && status !== null ? String(status) : undefined,
          slackId: slackId !== undefined && slackId !== null ? String(slackId) : undefined,
        };
        const sanitized = Object.fromEntries(Object.entries(upd).filter(([_, v]) => v !== undefined));
        if (exists.length) {
          if (Object.keys(sanitized).length) {
            await db.update(orders).set(sanitized).where(eq(orders.id, idNum));
          }
        } else {
          await db.insert(orders).values(({ id: idNum, userId: userId ? String(userId) : null, shopItemId: shopItemId ? String(shopItemId) : null, amount: amount ? String(amount) : null, status: status ?? null, slackId: slackId ?? null, createdAt: new Date() } as any));
        }
        return res.json({ ok: true });
      }
      // fallback: insert new order row without forcing id
      await db.insert(orders).values(({ userId: userId ? String(userId) : null, shopItemId: shopItemId ? String(shopItemId) : null, amount: amount ? String(amount) : null, status: status ?? null, slackId: slackId ?? null, createdAt: new Date() } as any));
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'unsupported table' });
  } catch (err) {
    console.error('[webhook] airtable sync failed', String(err));
    res.status(500).json({ error: 'sync failed', detail: String(err) });
  }
});

// (Webhook handlers for users/orders are defined above and handle full processing.)

app.get("/api/shop-items", async (req, res) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'shop is closed' });
    const found = await db.select().from(users).where(eq(users.identityToken, token)).limit(1);
    const u = found[0];
    if (!u || u.role !== 'admin') return res.status(403).json({ error: 'shop is closed' });

    const items = await db.select().from(shopItems).orderBy(desc(shopItems.id));
    const out = items.map((it: any) => ({ ...it, img: toCdnUrl(it.img) }));
    res.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).send(`Failed to load shop items: ${message}`);
  }
});

app.post("/api/shop/buy", async (req, res) => {
  try {
    const user = await getUserfromReq(req);
    if (!user) return res.status(401).json({ error: "not authenticated" });

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'shop is closed' });
    }

    const { id } = req.body || {};
    const itemId = Number(id);
    if (!Number.isInteger(itemId)) return res.status(400).json({ error: "invalid item id" });

    const found = await db.select().from(shopItems).where(eq(shopItems.id, itemId)).limit(1);
    const item = found[0];
    if (!item) return res.status(404).json({ error: "item not found" });

    const price = Number(item.price ?? 0) || 0;
    const current = Number(user.credits ?? 0) || 0;
    if (current < price) return res.status(400).json({ error: "insufficient credits", credits: current, price });

    const next = current - price;

    try {
      const [createdOrder] = await db.insert(orders).values({ userId: user.id, shopItemId: String(item.id), slackId: user.slackId ?? null, amount: String(price), status: 'pending', createdAt: new Date() }).returning();
      try {
        await upsertAirtableOrder({ id: createdOrder.id ?? item.id, userId: user.id, shopItemId: String(item.id), amount: price, status: 'pending', slackId: user.slackId ?? null, createdAt: createdOrder.createdAt ?? new Date() });
      } catch (e) { console.error('[orders] airtable upsert failed', String(e)); }
    } catch (e) {
      console.error('failed to insert order', String(e));
    }

    await db.insert(shopTransactions).values({ userId: user.id, amount: String(-price), reason: `Purchase: ${item.title}`, createdAt: new Date() });
    await db.update(users).set({ credits: String(next) }).where(eq(users.id, user.id));
    try { await upsertAirtableUser({ id: user.id, credits: String(next), updatedAt: new Date() }); } catch (e) { console.error('[purchase] airtable upsert failed', String(e)); }

    res.json({ ok: true, credits: next, itemId: itemId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "purchase failed", detail: message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const user = await getUserfromReq(req);
    if (!user) return res.status(401).json({ error: 'not authenticated' });

    const sql = `
      SELECT o.id, o.user_id, o.shop_item_id, o.amount, o.status, o.slack_id, o.created_at,
             s.title AS "itemTitle", s.img AS "itemImg"
      FROM orders o
      LEFT JOIN shop_items s ON s.id::text = o.shop_item_id
      WHERE o.user_id = $1
      ORDER BY o.id DESC
    `;
    const result = await pgPool.query(sql, [user.id]);
    const rows = (result.rows || []).map((r: any) => ({ ...r, itemImg: toCdnUrl(r.itemimg ?? r.itemImg) }));
    res.json(rows);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: 'orders lookup failed', detail: message });
  }
});

app.post("/api/shop-items", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    let adminUser = null;
    if (token) {
      const rows = await db.select().from(users).where(eq(users.identityToken, token)).limit(1);
      adminUser = rows[0] ?? null;
      if (!adminUser) return res.status(401).send("Invalid token");
      if (adminUser.role !== "admin") return res.status(403).send("Admin access required");
    } else {
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).send("Missing Authorization Bearer token");
      }
      adminUser = null;
    }

    const { title, note, img, href } = req.body || {};
    if (!title || typeof title !== "string") return res.status(400).send("title is required");

    const [created] = await db.insert(shopItems).values({
      title: title.trim(),
      note: typeof note === "string" ? note.trim() : null,
      img: typeof img === "string" ? img.trim() : null,
      href: typeof href === "string" ? href.trim() : null,
      createdAt: new Date()
    }).returning();

    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).send(`Failed to create shop item: ${message}`);
  }
});

app.delete("/api/shop-items/:id", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    let adminUser = null;
    if (token) {
      const rows = await db.select().from(users).where(eq(users.identityToken, token)).limit(1);
      adminUser = rows[0] ?? null;
      if (!adminUser) return res.status(401).send("Invalid token");
      if (adminUser.role !== "admin") return res.status(403).send("Admin access required");
    } else {
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).send("Missing Authorization Bearer token");
      }
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).send("Invalid id");

    await db.delete(shopItems).where(eq(shopItems.id, id));
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).send(`Failed to delete shop item: ${message}`);
  }
});

// dev cookie
if (process.env.NODE_ENV !== "production") {
  app.get("/api/__dev_set_cookies", (_req, res) => {
    try {
      const secure = process.env.NODE_ENV === "production";
      const sameSiteVal: "lax" | "none" = secure ? "none" : "lax";
      const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
      const cookieOpts: Record<string, unknown> = {
        httpOnly: true,
        sameSite: sameSiteVal,
        secure,
        path: "/",
      };
      if (cookieDomain) (cookieOpts as any).domain = cookieDomain;
      res.cookie("hc_identity", "dev-token-123", cookieOpts);
      const sessionOpts = { ...cookieOpts } as Record<string, unknown>;
      delete (sessionOpts as any).maxAge;
      res.cookie("session", "1", sessionOpts);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}

// SPA fallback
if (!process.env.VERCEL) {
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.setHeader("Cache-Control", "no-store, must-revalidate");
  res.sendFile(path.join(clientPath, "index.html"));
});
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err instanceof Error ? err.stack : String(err));
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error', detail: String(err) });
  }
});

// this is for vercel
export default app;

// Only start the server when not running on Vercel
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 4000;
  const HOST = "0.0.0.0";
  app.listen(PORT, HOST, () => {
    console.log(`API running on ${HOST}:${PORT}`);
  });
}
