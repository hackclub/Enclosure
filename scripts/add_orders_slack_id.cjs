#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const sql = `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS slack_id text;`;
    console.log('Running SQL to add slack_id to orders (if missing)...');
    await client.query(sql);
    console.log('ALTER TABLE completed.');
  } catch (err) {
    console.error('Failed to alter orders table:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
