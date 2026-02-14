require('dotenv').config();
try { require('dotenv').config({ path: '.env.local' }); } catch (e) {}
const { Pool } = require('pg');
(async () => {
  const cs = process.env.DATABASE_URL;
  console.log('Using DATABASE_URL:', cs ? cs.replace(/:.+@/, ':<REDACTED>@') : '(none)');
  if (!cs) return console.error('No DATABASE_URL set');
  const pool = new Pool({ connectionString: cs });
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT current_database() as db, current_user as usr');
    console.log('DB INFO:', r.rows[0]);
    const res = await client.query('SELECT id, email, name, created_at FROM "user" ORDER BY created_at DESC LIMIT 10');
    console.log('USERS:', res.rows);
  } catch (e) {
    console.error('QUERY ERR', e.message);
  } finally {
    client.release();
    await pool.end();
  }
})();
