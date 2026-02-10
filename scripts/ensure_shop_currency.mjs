#!/usr/bin/env node
import process from 'node:process';
import pkg from 'pg';
const { Client } = pkg;

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('Missing DATABASE_URL');
    process.exit(2);
  }
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    // Add credits column if missing
    await client.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='"user"' AND column_name='credits') THEN
        ALTER TABLE "user" ADD COLUMN credits integer DEFAULT 0;
      END IF;
    END $$;`);

    // Create shop_transactions table if missing
    await client.query(`CREATE TABLE IF NOT EXISTS shop_transactions (
      id serial PRIMARY KEY,
      user_id text NOT NULL,
      amount integer NOT NULL,
      reason text,
      created_at timestamptz DEFAULT now()
    );`);

    console.log('ensure_shop_currency: OK');
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
