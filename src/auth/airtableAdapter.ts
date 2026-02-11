import 'dotenv/config';

const API_BASE = 'https://api.airtable.com/v0';
// Airtable now encourages using Personal Access Tokens (PATs).
// Support `AIRTABLE_PAT` first, fall back to `AIRTABLE_API_KEY` for compatibility.
const API_KEY = process.env.AIRTABLE_PAT || process.env.AIRTABLE_API_KEY || '';
const BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const USER_TABLE = process.env.AIRTABLE_USER_TABLE || 'user';
// Use a single combined tokens table for sessions + verification tokens.
const TOKEN_TABLE = process.env.AIRTABLE_TOKEN_TABLE || process.env.AIRTABLE_SESSIONS_TABLE || 'tokens';
// Backwards-compatible aliases
const SESSIONS_TABLE = TOKEN_TABLE;
const VERIFICATION_TABLE = TOKEN_TABLE;

if (!API_KEY || !BASE_ID) {
  // Warn at require time; consumer may still use in environments where these are set.
  // Use `AIRTABLE_PAT` for Personal Access Tokens (recommended).
  // console.warn('Airtable adapter: AIRTABLE_PAT (preferred) or AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set');
}

function airtableFetch(path: string, opts: RequestInit = {}) {
  const url = `${API_BASE}/${BASE_ID}/${encodeURIComponent(path)}`;
  const headers: Record<string,string> = {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };
  opts.headers = Object.assign(headers, opts.headers || {});
  return fetch(url, opts).then(async res => {
    if (!res.ok) {
      const text = await res.text();
      const err = new Error(`Airtable ${res.status}: ${text}`);
      // @ts-ignore
      err.status = res.status;
      throw err;
    }
    return res.json();
  });
}

async function findRecordByField(table: string, fieldName: string, value: string) {
  const formula = `filterByFormula=${encodeURIComponent(`{${fieldName}}='${String(value).replace(/'/g,"\\'")}'`)}`;
  const res = await airtableFetch(`${table}?${formula}&pageSize=1`);
  return res.records && res.records[0] ? res.records[0] : null;
}

async function findTokenRecord(type: string, fieldName: string, value: string) {
  const raw = `AND({Type}='${String(type).replace(/'/g,"\\'")}', {${fieldName}}='${String(value).replace(/'/g,"\\'")}')`;
  const formula = `filterByFormula=${encodeURIComponent(raw)}`;
  const res = await airtableFetch(`${TOKEN_TABLE}?${formula}&pageSize=1`);
  return res.records && res.records[0] ? res.records[0] : null;
}

function mapAirtableRecordToUser(rec: any) {
  if (!rec) return null;
  const f = rec.fields || {};
  return {
    id: f.id ?? f.ID ?? rec.id,
    name: f.name ?? null,
    email: f.Email ?? null,
    emailVerified: !!f.emailVerified || !!f.EmailVerified || false,
    image: f.image ?? f.Image ?? null,
    slackId: f.slackId ?? f.SlackId ?? f.SlackID ?? null,
    credits: f.credits ?? f.Credits ?? null,
    role: f.role ?? null,
    verificationStatus: f.verificationStatus ?? f.VerificationStatus ?? null,
    identityToken: f.identityToken ?? f.IdentityToken ?? null,
    refreshToken: f.refreshToken ?? f.RefreshToken ?? null,
    createdAt: f.createdAt ?? null,
    updatedAt: f.updatedAt ?? null,
    // keep raw record id for updates
    _recordId: rec.id,
  };
}

export function airtableAdapter() {
  return {
    async getUserById(id: string) {
      if (!id) return null;
      // Try direct record id first
      try {
        if (id.startsWith('rec')) {
          const rec = await airtableFetch(`${USER_TABLE}/${id}`);
          return mapAirtableRecordToUser(rec);
        }
      } catch (e) {
        // ignore
      }
      // Fallback: search by id field
      const rec = await findRecordByField(USER_TABLE, 'id', id);
      return mapAirtableRecordToUser(rec);
    },

    async getUserByEmail(email: string) {
      if (!email) return null;
      const rec = await findRecordByField(USER_TABLE, 'Email', email);
      return mapAirtableRecordToUser(rec);
    },

    async createUser(data: any) {
      const fields = Object.assign({}, data);
      // Ensure we use the Email field naming
      if (fields.email) { fields.Email = fields.email; delete fields.email; }
      const body = { fields };
      const res = await airtableFetch(`${USER_TABLE}`, { method: 'POST', body: JSON.stringify(body) });
      return mapAirtableRecordToUser(res.records[0]);
    },

    async updateUser(id: string, updates: any) {
      if (!id) throw new Error('updateUser requires id');
      // find record
      const rec = await (id.startsWith('rec') ? airtableFetch(`${USER_TABLE}/${id}`) : findRecordByField(USER_TABLE, 'id', id));
      if (!rec) throw new Error('user not found');
      const recId = rec.id;
      const fields = Object.assign({}, updates);
      if (fields.email) { fields.Email = fields.email; delete fields.email; }
      await airtableFetch(`${USER_TABLE}/${recId}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
      const updated = await airtableFetch(`${USER_TABLE}/${recId}`);
      return mapAirtableRecordToUser(updated);
    },

    // Sessions table helpers
    async createSession(session: { sessionToken: string; userId: string; expires?: string }) {
      const fields: any = { sessionToken: session.sessionToken, userId: session.userId, Type: 'session' };
      if (session.expires) fields.expires = session.expires;
      const res = await airtableFetch(`${TOKEN_TABLE}`, { method: 'POST', body: JSON.stringify({ fields }) });
      return res.records[0];
    },

    async getSession(sessionToken: string) {
      const rec = await findTokenRecord('session', 'sessionToken', sessionToken);
      if (!rec) return null;
      const f = rec.fields || {};
      return { sessionToken: f.sessionToken, userId: f.userId, expires: f.expires, _recordId: rec.id };
    },

    async updateSession(sessionToken: string, updates: any) {
      const rec = await findTokenRecord('session', 'sessionToken', sessionToken);
      if (!rec) return null;
      const recId = rec.id;
      await airtableFetch(`${TOKEN_TABLE}/${recId}`, { method: 'PATCH', body: JSON.stringify({ fields: updates }) });
      const updated = await airtableFetch(`${TOKEN_TABLE}/${recId}`);
      const f = updated.fields || {};
      return { sessionToken: f.sessionToken, userId: f.userId, expires: f.expires };
    },

    async deleteSession(sessionToken: string) {
      const rec = await findTokenRecord('session', 'sessionToken', sessionToken);
      if (!rec) return;
      await airtableFetch(`${TOKEN_TABLE}/${rec.id}`, { method: 'DELETE' });
    },

    // Verification tokens
    async createVerificationToken(token) {
      const fields = Object.assign({}, token, { Type: 'verification' });
      const res = await airtableFetch(`${TOKEN_TABLE}`, { method: 'POST', body: JSON.stringify({ fields }) });
      return res.records[0].fields;
    },

    async useVerificationToken(identifier, token) {
      const rec = await findTokenRecord('verification', 'token', token);
      if (!rec) return null;
      // delete after use
      await airtableFetch(`${TOKEN_TABLE}/${rec.id}`, { method: 'DELETE' });
      return rec.fields;
    },

    // account linking: store provider info as fields on user (simple single-provider support)
    async linkAccount(userId: string, providerAccount: any) {
      // providerAccount contains providerId and providerAccountId and tokens
      const rec = await findRecordByField(USER_TABLE, 'id', userId);
      if (!rec) throw new Error('user not found');
      const recId = rec.id;
      const fields: any = {};
      if (providerAccount.providerId) fields.identity_provider = providerAccount.providerId;
      if (providerAccount.providerAccountId) fields.identity_user_id = providerAccount.providerAccountId;
      if (providerAccount.access_token) fields.identityToken = providerAccount.access_token;
      if (providerAccount.refresh_token) fields.refreshToken = providerAccount.refresh_token;
      await airtableFetch(`${USER_TABLE}/${recId}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
    },

    async unlinkAccount(userId: string, providerId: string) {
      const rec = await findRecordByField(USER_TABLE, 'id', userId);
      if (!rec) return;
      const recId = rec.id;
      const fields: any = { identity_provider: null, identity_user_id: null, identityToken: null, refreshToken: null };
      await airtableFetch(`${USER_TABLE}/${recId}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
    }
  };
}

export default airtableAdapter;
