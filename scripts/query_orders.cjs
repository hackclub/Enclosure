#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const res = await client.query(`SELECT id, user_id, shop_item_id, amount, status, slack_id, created_at FROM orders ORDER BY created_at DESC LIMIT 20`);
    console.log('Recent orders:');
    console.table(res.rows);
  } catch (err) {
    console.error('Failed to query orders:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
