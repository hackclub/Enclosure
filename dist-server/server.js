import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { desc, eq } from "drizzle-orm";
import { db } from "./db.js";
import { projects, createdProjects, shopItems, user as users, shopTransactions } from "./schema.js";
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
const SERVER_BASE_URL = process.env.SERVER_BASE_URL || (() => {
    try {
        return new URL(IDENTITY_REDIRECT_URI).origin;
    }
    catch {
        return "http://localhost:4000";
    }
})();
const DEV_FORCE_ELIGIBLE = process.env.DEV_FORCE_ELIGIBLE?.toLowerCase();
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const CACHET_BASE = process.env.CACHET_BASE || "https://cachet.dunkirk.sh";
const HACKATIME_HOST = process.env.HACKATIME_HOST || "https://hackatime.hackclub.com";
const HACKATIME_CLIENT_ID = process.env.HACKATIME_CLIENT_ID || "";
const HACKATIME_CLIENT_SECRET = process.env.HACKATIME_CLIENT_SECRET || "";
const HACKATIME_REDIRECT_URI = process.env.HACKATIME_REDIRECT_URI || "http://localhost:4000/api/auth/hackatime/callback";
const HACKATIME_SCOPE = process.env.HACKATIME_SCOPE || "profile read";
const HACKATIME_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
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
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME || !email)
        return null;
    try {
        const q = `filterByFormula=${encodeURIComponent(`{${AIRTABLE_EMAIL_FIELD}}='${email.replace("'", "\\'")}'`)}`;
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}?${q}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } });
        if (!res.ok)
            return null;
        const j = await res.json();
        if (!j.records || !j.records.length)
            return null;
        const rec = j.records[0];
        const fields = rec.fields || {};
        // Prefer the approved-hours field (if provided) because approved hours
        // may differ from total hours in Airtable.
        const rawHours = fields[AIRTABLE_APPROVED_HOURS_FIELD] ?? fields[AIRTABLE_HOURS_FIELD];
        const hours = Number(rawHours);
        const approvedRaw = fields[AIRTABLE_APPROVAL_FIELD];
        const approved = approvedRaw !== undefined && approvedRaw !== null && String(approvedRaw).toLowerCase() === AIRTABLE_APPROVAL_VALUE;
        return { hours: Number.isFinite(hours) ? hours : null, approved };
    }
    catch (err) {
        console.error('airtable lookup failed', String(err));
        return null;
    }
}
async function fetchSlackAvatar(opts) {
    // Try cachet first (no token needed) when we have a Slack user id
    if (opts.slackId) {
        try {
            const res = await fetch(`${CACHET_BASE}/users/${opts.slackId}`);
            if (res.ok) {
                const data = (await res.json());
                if (data.imageUrl)
                    return data.imageUrl;
            }
        }
        catch {
            // best-effort
        }
    }
    if (!SLACK_BOT_TOKEN)
        return undefined;
    const headers = { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/x-www-form-urlencoded" };
    // Prefer lookup by ID when available
    if (opts.slackId) {
        const res = await fetch("https://slack.com/api/users.info", {
            method: "POST",
            headers,
            body: new URLSearchParams({ user: opts.slackId })
        });
        const data = (await res.json());
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
        const data = (await res.json());
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
app.use(express.json());
// Helper: extract bearer token from Authorization header or `hc_identity` cookie
function extractToken(req) {
    const auth = req.headers.authorization;
    if (typeof auth === "string" && auth.startsWith("Bearer "))
        return auth.slice(7);
    const raw = req.headers.cookie || "";
    const pairs = String(raw).split(/;\s*/).filter(Boolean);
    for (const p of pairs) {
        const idx = p.indexOf("=");
        if (idx === -1)
            continue;
        const k = p.slice(0, idx);
        const v = p.slice(idx + 1);
        if (k === "hc_identity")
            return decodeURIComponent(v);
    }
    return undefined;
}
app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
});
// Debug: show cookies and auth extraction for troubleshooting
app.get("/__debug_cookies", (req, res) => {
    try {
        const raw = req.headers.cookie || "";
        const token = extractToken(req);
        res.json({ cookieHeader: raw, extractedToken: token ?? null, headers: req.headers });
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
// Debug endpoint: list files under the built `dist` directory (temporary)
app.get("/__debug_dist", async (_req, res) => {
    try {
        const fs = await import("node:fs/promises");
        const distDir = path.join(process.cwd(), "dist");
        const list = await fs.readdir(distDir);
        res.json({ distDir, list });
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
app.get("/__debug_assets", async (_req, res) => {
    try {
        const fs = await import("node:fs/promises");
        const assetsDir = path.join(process.cwd(), "dist", "assets");
        const files = await fs.readdir(assetsDir);
        res.json({ assetsDir, files });
    }
    catch (err) {
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
    if (!name || typeof name !== "string")
        return res.status(400).json({ error: "name is required" });
    if (!email || typeof email !== "string")
        return res.status(400).json({ error: "email is required" });
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
    }
    catch (err) {
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
                    }
                    else if (rec.hours === null) {
                        console.log('Airtable record missing hours for', email);
                    }
                    else {
                        const credits = Math.max(0, Math.floor(rec.hours * HOURS_TO_CREDITS));
                        if (credits > 0) {
                            const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
                            if (u) {
                                const prev = Number(u.credits ?? 0) || 0;
                                const next = prev + credits;
                                await db.update(users).set({ credits: String(next) }).where(eq(users.id, u.id));
                                await db.insert(shopTransactions).values({ userId: u.id, amount: String(credits), reason: `Payout for project ${updated.id}`, createdAt: new Date() });
                                console.log('Credited user', email, credits, 'hours=', rec.hours);
                            }
                            else {
                                console.log('No user found for email, skipping credit:', email);
                            }
                        }
                    }
                }
                else {
                    console.log('No airtable record found for', email);
                }
            }
            else {
                console.log('No submission record found matching project name, skipping payout for project', updated.id);
            }
        }
    }
    catch (err) {
        console.error('payout processing failed', String(err));
    }
    res.json(updated);
});
app.get("/api/auth/login", (req, res) => {
    if (!IDENTITY_CLIENT_ID)
        return res.status(500).send("Missing HC_IDENTITY_CLIENT_ID");
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
        }
        catch (e) {
            // ignore invalid continue
        }
    }
    if (force === "1")
        url.searchParams.set("prompt", "login");
    res.redirect(url.toString());
});
// Stateless logout: clear known cookies (best-effort) and bounce to the frontend root
app.get("/api/auth/logout", (_req, res) => {
    res.clearCookie("session");
    res.clearCookie("hc_identity");
    res.clearCookie("hackatime_token");
    const redirectUrl = new URL("/", FRONTEND_BASE_URL);
    res.redirect(302, redirectUrl.toString());
});
app.get("/api/auth/callback", async (req, res) => {
    const code = req.query.code;
    const rawState = req.query.state;
    if (!code)
        return res.status(400).send("Missing code");
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
        const meJson = (await meRes.json());
        console.log('[auth callback] meJson identity keys:', Object.keys(meJson.identity || {}));
        const identity = meJson.identity || {};
        const identityId = typeof identity.id === "string" ? identity.id : undefined;
        const identityEmail = typeof identity.email === "string"
            ? identity.email
            : typeof identity.primary_email === "string"
                ? identity.primary_email
                : typeof identity.primaryEmail === "string"
                    ? identity.primaryEmail
                    : undefined;
        const identityName = typeof identity.name === "string"
            ? identity.name
            : (() => {
                const first = typeof identity.first_name === "string"
                    ? identity.first_name
                    : typeof identity.firstName === "string"
                        ? identity.firstName
                        : "";
                const last = typeof identity.last_name === "string"
                    ? identity.last_name
                    : typeof identity.lastName === "string"
                        ? identity.lastName
                        : "";
                const full = `${first} ${last}`.trim();
                return full || undefined;
            })();
        const slackId = typeof identity.slack_id === "string" ? identity.slack_id : undefined;
        const verificationStatus = typeof identity.verification_status === "string"
            ? identity.verification_status
            : undefined;
        const emailVerified = Boolean(identity.email_verified || identity.emailVerified);
        let profilePicture = typeof identity.image === "string"
            ? identity.image
            : typeof identity.picture === "string"
                ? identity.picture
                : typeof identity.profile?.image_512 === "string"
                    ? identity.profile?.image_512
                    : typeof identity.profile?.image === "string"
                        ? identity.profile?.image
                        : undefined;
        const rawEligible = identity.ysws_eligible ??
            identity.yswsEligible ??
            identity.eligible;
        const isEligible = typeof rawEligible === "string" ? rawEligible.toLowerCase() === "yes" : Boolean(rawEligible);
        let effectiveEligible = isEligible;
        if (DEV_FORCE_ELIGIBLE === "yes" || DEV_FORCE_ELIGIBLE === "true")
            effectiveEligible = true;
        if (DEV_FORCE_ELIGIBLE === "no" || DEV_FORCE_ELIGIBLE === "false")
            effectiveEligible = false;
        console.log("[auth] identity", {
            id: identityId,
            email: identityEmail,
            slackId,
            verificationStatus,
            hasAccessToken: Boolean(tokenJson.access_token)
        });
        let existing = [];
        if (identityId && identityEmail) {
            const idValue = identityId;
            const emailValue = identityEmail;
            existing = await db.select().from(users).where(eq(users.id, idValue)).limit(1);
            const pickString = (val) => (typeof val === "string" ? val : null);
            if (!profilePicture) {
                const fetched = await fetchSlackAvatar({
                    slackId: typeof slackId === "string" ? slackId : null,
                    email: emailValue
                });
                profilePicture = fetched ?? profilePicture;
            }
            const pickRole = (val) => {
                return val === "admin" || val === "reviewer" || val === "member" ? val : null;
            };
            const basePayload = {
                name: pickString(identityName ?? existing[0]?.name),
                email: emailValue,
                emailVerified,
                image: pickString(profilePicture ?? existing[0]?.image),
                slackId: pickString(slackId ?? existing[0]?.slackId),
                role: pickRole(existing[0]?.role ?? "member"),
                verificationStatus: pickString(verificationStatus ?? existing[0]?.verificationStatus),
                identityToken: typeof tokenJson.access_token === "string" ? tokenJson.access_token : existing[0]?.identityToken || null,
                refreshToken: typeof tokenJson.refresh_token === "string" ? tokenJson.refresh_token : existing[0]?.refreshToken || null,
                hackatimeAccessToken: existing[0]?.hackatimeAccessToken || null,
                hackatimeRefreshToken: existing[0]?.hackatimeRefreshToken || null,
                hackatimeExpiresAt: existing[0]?.hackatimeExpiresAt || null,
                hackatimeUserId: existing[0]?.hackatimeUserId || null,
                updatedAt: new Date()
            };
            if (existing.length) {
                await db.update(users).set(basePayload).where(eq(users.id, idValue));
                console.log("[auth] user updated", { id: idValue });
            }
            else {
                await db.insert(users).values({ ...basePayload, id: idValue, createdAt: new Date() });
                console.log("[auth] user inserted", { id: idValue });
            }
        }
        const hasValidHackatime = existing.length &&
            existing[0]?.hackatimeAccessToken &&
            existing[0]?.hackatimeExpiresAt &&
            new Date(existing[0].hackatimeExpiresAt).getTime() > Date.now();
        const needsHackatime = identityId && !hasValidHackatime;
        if (needsHackatime && HACKATIME_CLIENT_ID && HACKATIME_CLIENT_SECRET) {
            const loginUrl = new URL("/api/auth/hackatime/login", SERVER_BASE_URL);
            loginUrl.searchParams.set("user_id", identityId);
            loginUrl.searchParams.set("continue", new URL("/", FRONTEND_BASE_URL).toString());
            return res.redirect(302, loginUrl.toString());
        }
        // Prefer a continue URL from OAuth `state` when provided (dev flow).
        let finalContinue = FRONTEND_BASE_URL;
        if (rawState) {
            try {
                const parsed = JSON.parse(Buffer.from(rawState, "base64url").toString("utf8"));
                if (parsed && typeof parsed.cont === "string" && parsed.cont.length) {
                    finalContinue = parsed.cont;
                }
            }
            catch (e) {
                // ignore parse errors and fall back to FRONTEND_BASE_URL
            }
        }
        const redirectUrl = new URL("/", finalContinue);
        redirectUrl.searchParams.set("eligible", effectiveEligible ? "yes" : "no");
        if (!effectiveEligible)
            redirectUrl.searchParams.set("msg", "banned");
        // Set auth cookies so the browser can authenticate next requests.
        try {
            const secure = process.env.NODE_ENV === "production";
            const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
            const sameSiteVal = secure ? "none" : "lax";
            const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
            const cookieOpts = {
                httpOnly: true,
                sameSite: sameSiteVal,
                secure: secure,
                path: "/",
                maxAge,
            };
            if (cookieDomain)
                cookieOpts.domain = cookieDomain;
            res.cookie("hc_identity", String(tokenJson.access_token), cookieOpts);
            console.log('[auth callback] set hc_identity cookie');
            // session cookie: session-only (no persistent maxAge)
            const sessionOpts = { ...cookieOpts };
            delete sessionOpts.maxAge;
            res.cookie("session", "1", sessionOpts);
            console.log('[auth callback] set session cookie');
        }
        catch (e) {
            console.error("failed to set auth cookies", String(e));
        }
        return res.redirect(302, redirectUrl.toString());
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: "auth callback failed", detail: message });
    }
});
// Hackatime OAuth
app.get("/api/auth/hackatime/login", (req, res) => {
    if (!HACKATIME_CLIENT_ID)
        return res.status(500).send("Missing HACKATIME_CLIENT_ID");
    const userId = req.query.user_id || "";
    const cont = req.query.continue || FRONTEND_BASE_URL;
    const statePayload = Buffer.from(JSON.stringify({ userId, cont }), "utf8").toString("base64url");
    const url = new URL("/oauth/authorize", HACKATIME_HOST);
    url.searchParams.set("client_id", HACKATIME_CLIENT_ID);
    url.searchParams.set("redirect_uri", HACKATIME_REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", HACKATIME_SCOPE);
    url.searchParams.set("state", statePayload);
    res.redirect(url.toString());
});
app.get("/api/auth/hackatime/callback", async (req, res) => {
    const code = req.query.code;
    const rawState = req.query.state;
    if (!code)
        return res.status(400).send("Missing code");
    if (!HACKATIME_CLIENT_ID || !HACKATIME_CLIENT_SECRET) {
        return res.status(500).send("Missing Hackatime client id/secret");
    }
    let state = {};
    try {
        state = rawState ? JSON.parse(Buffer.from(rawState, "base64url").toString("utf8")) : {};
    }
    catch {
        // ignore bad state
    }
    const userId = state.userId;
    const continueUrl = state.cont || FRONTEND_BASE_URL;
    if (!userId) {
        return res.status(400).send("Missing user_id in state");
    }
    try {
        const tokenUrl = new URL("/oauth/token", HACKATIME_HOST);
        const body = new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: HACKATIME_REDIRECT_URI,
            client_id: HACKATIME_CLIENT_ID,
            client_secret: HACKATIME_CLIENT_SECRET
        });
        const tokenRes = await fetch(tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body
        });
        const tokenJson = await tokenRes.json();
        if (!tokenRes.ok || !tokenJson.access_token) {
            console.error("[hackatime] token exchange failed", tokenRes.status, tokenJson);
            return res.status(502).json({ error: "hackatime token exchange failed", status: tokenRes.status, detail: tokenJson });
        }
        const meUrl = new URL("/api/v1/authenticated/me", HACKATIME_HOST);
        const meRes = await fetch(meUrl, {
            headers: {
                Authorization: `Bearer ${tokenJson.access_token}`,
                Accept: "application/json"
            }
        });
        if (!meRes.ok) {
            const detail = await meRes.text();
            console.error("[hackatime] profile fetch failed", meRes.status, detail);
            return res.status(502).json({ error: "hackatime profile fetch failed", status: meRes.status, detail });
        }
        const meJson = (await meRes.json());
        const hackatimeUserId = meJson?.id ? String(meJson.id) : null;
        const expiresAt = new Date(Date.now() + HACKATIME_TOKEN_TTL_MS);
        await db
            .update(users)
            .set({
            hackatimeAccessToken: typeof tokenJson.access_token === "string" ? tokenJson.access_token : null,
            hackatimeRefreshToken: typeof tokenJson.refresh_token === "string" ? tokenJson.refresh_token : null,
            hackatimeExpiresAt: expiresAt,
            hackatimeUserId,
            updatedAt: new Date()
        })
            .where(eq(users.id, userId));
        console.log("Oauth Successful 1", { userId, hackatimeUserId });
        const redirectUrl = new URL(continueUrl);
        res.redirect(302, redirectUrl.toString());
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: "hackatime callback failed", detail: message });
    }
});
app.get("/api/auth/me", async (req, res) => {
    const token = extractToken(req);
    if (!token)
        return res.status(401).json({ error: "missing bearer token" });
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: "profile lookup failed", detail: message });
    }
});
// Convenience: return the most recently seen user (for UI avatar without exposing tokens)
app.get("/api/auth/profile", async (req, res) => {
    try {
        const token = extractToken(req);
        let userRow;
        if (token) {
            const found = await db.select().from(users).where(eq(users.identityToken, token)).limit(1);
            if (found.length)
                userRow = found[0];
        }
        // Do not auto-fallback to the most-recent user. Treat as unauthenticated when no token.
        if (!userRow) {
            return res.status(401).json({ error: "not authenticated" });
        }
        const canManageShop = userRow.role === "admin";
        res.json({
            id: userRow.id,
            name: userRow.name,
            email: userRow.email,
            emailVerified: userRow.emailVerified,
            image: userRow.image,
            slackId: userRow.slackId,
            role: userRow.role,
            canManageShop,
            identityToken: canManageShop ? userRow.identityToken : null,
            identityLinked: Boolean(userRow.id),
            hackatimeLinked: Boolean(userRow.hackatimeAccessToken),
            // Expose the user's current credits (number). Stored as text in DB,
            // so coerce to Number and default to 0 if missing.
            credits: Number(userRow.credits ?? 0),
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: "profile lookup failed", detail: message });
    }
});
// Use process.cwd() to reliably reference the built `dist` directory
// regardless of how the server is executed (works on Heroku).
const clientPath = path.join(process.cwd(), "dist");
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
    }
    catch (err) {
        console.error("asset lookup error", String(err));
    }
    return next();
});
app.use("/assets", express.static(assetsPath));
// Fallback: also serve files from the dist root under /assets
app.use("/assets", express.static(clientPath));
app.use(express.static(clientPath));
// SPA fallback for client-side routing (exclude api and auth)
// Dev-only API endpoint to set test cookies (inspect Set-Cookie headers)
if (process.env.NODE_ENV !== "production") {
    app.get("/api/__dev_set_cookies", (_req, res) => {
        try {
            const secure = process.env.NODE_ENV === "production";
            const sameSiteVal = secure ? "none" : "lax";
            const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
            const cookieOpts = {
                httpOnly: true,
                sameSite: sameSiteVal,
                secure,
                path: "/",
            };
            if (cookieDomain)
                cookieOpts.domain = cookieDomain;
            res.cookie("hc_identity", "dev-token-123", cookieOpts);
            const sessionOpts = { ...cookieOpts };
            delete sessionOpts.maxAge;
            res.cookie("session", "1", sessionOpts);
            res.json({ ok: true });
        }
        catch (err) {
            res.status(500).json({ error: String(err) });
        }
    });
}
app.get(/^(?!\/api\/).*/, (req, res) => {
    // Prevent aggressive caching of the SPA shell so clients always load
    // the latest `index.html` after a deploy.
    res.setHeader("Cache-Control", "no-store, must-revalidate");
    res.sendFile(path.join(clientPath, "index.html"));
});
// Development-only: quickly set test cookies so we can inspect Set-Cookie flags
if (process.env.NODE_ENV !== "production") {
    app.get("/__dev_set_cookies", (_req, res) => {
        try {
            const secure = process.env.NODE_ENV === "production";
            const sameSiteVal = secure ? "none" : "lax";
            const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
            const cookieOpts = {
                httpOnly: true,
                sameSite: sameSiteVal,
                secure,
                path: "/",
            };
            if (cookieDomain)
                cookieOpts.domain = cookieDomain;
            res.cookie("hc_identity", "dev-token-123", cookieOpts);
            res.cookie("session", "1", cookieOpts);
            res.json({ ok: true });
        }
        catch (err) {
            res.status(500).json({ error: String(err) });
        }
    });
}
const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
    console.log(`API running at http://localhost:${PORT}`);
});
// Add this after all app.use and before any catch-all or app.listen
app.get("/api/shop-items", async (req, res) => {
    try {
        const items = await db.select().from(shopItems).orderBy(desc(shopItems.id));
        res.json(items);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).send(`Failed to load shop items: ${message}`);
    }
});
// Admin-only: create a shop item. Authorize with Bearer identity token.
app.post("/api/shop-items", async (req, res) => {
    try {
        const auth = req.headers.authorization || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token)
            return res.status(401).send("Missing Authorization Bearer token");
        const [u] = await db.select().from(users).where(eq(users.identityToken, token)).limit(1);
        if (!u)
            return res.status(401).send("Invalid token");
        if (u.role !== "admin")
            return res.status(403).send("Admin access required");
        const { title, note, img, href } = req.body || {};
        if (!title || typeof title !== "string")
            return res.status(400).send("title is required");
        const [created] = await db.insert(shopItems).values({
            title: title.trim(),
            note: typeof note === "string" ? note.trim() : null,
            img: typeof img === "string" ? img.trim() : null,
            href: typeof href === "string" ? href.trim() : null,
            createdAt: new Date()
        }).returning();
        res.status(201).json(created);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).send(`Failed to create shop item: ${message}`);
    }
});
