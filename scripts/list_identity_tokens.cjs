const fs = require('fs');
const { Client } = require('pg');

function loadEnv(path) {
  const text = fs.readFileSync(path, 'utf8');
  const lines = text.split(/\r?\n/);
  for (const l of lines) {
    const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let [, k, v] = m;
    // strip optional surrounding quotes
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
    process.env[k] = v;
  }
}

async function main() {
  const envPath = require('path').join(__dirname, '..', '.env.local');
  try {
    loadEnv(envPath);
  } catch (e) {
    // fallback: try .env
    try { loadEnv(require('path').join(__dirname, '..', '.env')); } catch (e) {}
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not found in .env.local or .env');
    process.exit(2);
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    const res = await client.query('SELECT id, email, identity_token FROM "user" ORDER BY created_at DESC LIMIT 50');
    if (!res.rows.length) {
      console.log('No users found.');
    } else {
      console.table(res.rows.map(r => ({ id: r.id, email: r.email, identity_token: r.identity_token })));
    }
    await client.end();
  } catch (err) {
    console.error('Query failed:', String(err));
    try { await client.end(); } catch (e) {}
    process.exit(1);
  }
}

main();
