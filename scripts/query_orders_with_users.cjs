#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT o.id AS order_id, o.shop_item_id, o.amount, o.status, o.slack_id AS order_slack, o.created_at,
             u.id AS user_id, u.email, u.slack_id AS user_slack, u.identity_token
      FROM orders o
      LEFT JOIN "user" u ON u.id = o.user_id
      ORDER BY o.created_at DESC
      LIMIT 50
    `);
    console.log('Recent orders with user info:');
    console.table(res.rows);
  } catch (err) {
    console.error('Failed to query orders+users:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
