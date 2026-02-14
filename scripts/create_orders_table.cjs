#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const sql = `CREATE TABLE IF NOT EXISTS orders (
      id serial PRIMARY KEY,
      user_id text NOT NULL,
      shop_item_id text NOT NULL,
      amount text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamp without time zone DEFAULT now()
    );`;
    console.log('Running SQL to ensure orders table exists...');
    await client.query(sql);
    console.log('Orders table ensured.');
  } catch (err) {
    console.error('Failed to create orders table:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
