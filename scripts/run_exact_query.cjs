const fs = require('fs');
const { Client } = require('pg');
const path = require('path');

function loadEnv(p) {
  const text = fs.readFileSync(p, 'utf8');
  for (const l of text.split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let [, k, v] = m;
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1,-1);
    if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1,-1);
    process.env[k] = v;
  }
}

try { loadEnv(path.join(__dirname, '..', '.env.local')); } catch (e) {}
try { loadEnv(path.join(__dirname, '..', '.env')); } catch (e) {}

const client = new Client({ connectionString: process.env.DATABASE_URL });

(async()=>{
  await client.connect();
  const sql = 'select "id", "name", "email", "email_verified", "image", "slack_id", "banned", "credits", "role", "verification_status", "identity_token", "refresh_token", "created_at", "updated_at" from "user" where "user"."identity_token" = $1 limit $2';
  const params = ['idntk.snWBCiBODgWb8kDIU83_l9u9crWC9ivQo56ydIPUQZA', 1];
  try {
    const res = await client.query(sql, params);
    console.log('rows', res.rows);
  } catch (err) {
    console.error('exact query error:', err);
  } finally {
    await client.end();
  }
})();
