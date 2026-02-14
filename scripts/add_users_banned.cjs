#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const sql = `ALTER TABLE IF EXISTS "user" ADD COLUMN IF NOT EXISTS banned boolean DEFAULT false NOT NULL;`;
    console.log('Running SQL to ensure users.banned column exists...');
    await client.query(sql);
    console.log('users.banned column ensured.');
  } catch (err) {
    console.error('Failed to alter user table:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
