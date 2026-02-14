require('dotenv').config();
try { require('dotenv').config({ path: '.env.local' }); } catch (e) {}
const { Client } = require('pg');
(async () => {
  const cs = process.env.DATABASE_URL;
  console.log('Using DATABASE_URL:', cs ? cs.replace(/:.+@/, ':<REDACTED>@') : '(none)');
  if (!cs) return console.error('No DATABASE_URL set');
  const c = new Client({ connectionString: cs });
  await c.connect();
  try {
    const info = (await c.query('SELECT current_database() as db, current_user as usr')).rows[0];
    console.log('DB INFO:', info);

    const tables = (await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")).rows.map(r=>r.table_name);
    console.log('Public tables:', tables);

    const userCols = (await c.query("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='user' ORDER BY ordinal_position")).rows;
    console.log('"user" table columns:', userCols.length ? userCols : '(no such table)');

    try {
      const r = await c.query('SELECT * FROM "user" WHERE id=$1 LIMIT 1', ['ident!exvf8y']);
      console.log('SELECT result rows:', r.rows);
    } catch (selErr) {
      console.error('SELECT error:', selErr.message);
    }
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await c.end();
  }
})();
