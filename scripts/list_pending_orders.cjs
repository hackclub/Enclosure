'use strict';
require('dotenv').config();
const { Client } = require('pg');
(async ()=>{
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try{
    await client.connect();
    const res = await client.query("SELECT id, user_id, shop_item_id, amount, status, created_at FROM orders ORDER BY id DESC LIMIT 20");
    console.log('orders:');
    console.table(res.rows);
  }catch(e){
    console.error('failed', e && e.message || e);
  }finally{
    await client.end();
  }
})();
