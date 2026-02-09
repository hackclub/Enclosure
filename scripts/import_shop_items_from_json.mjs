#!/usr/bin/env node
import fs from 'node:fs/promises';
import process from 'node:process';
import pkg from 'pg';
const { Client } = pkg;

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('Missing DATABASE_URL. Set env var or run with DATABASE_URL=... node scripts/import_shop_items_from_json.mjs');
    process.exit(2);
  }

  const dataRaw = await fs.readFile(new URL('../shop_items.json', import.meta.url));
  const items = JSON.parse(dataRaw.toString());
  if (!Array.isArray(items) || items.length === 0) {
    console.error('No items found in shop_items.json');
    process.exit(0);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    let inserted = 0;
    for (const it of items) {
      const title = it.title || it.name || 'Untitled';
      const note = it.note ?? null;
      const img = it.img ?? null;
      const href = it.href ?? null;

      // skip if same title already exists
      const exists = await client.query('SELECT id FROM shop_items WHERE title = $1 LIMIT 1', [title]);
      if (exists.rows.length) {
        console.log('Skipping existing:', title);
        continue;
      }

      await client.query(
        'INSERT INTO shop_items (title, note, img, href, created_at) VALUES ($1,$2,$3,$4,COALESCE($5, NOW()))',
        [title, note, img, href, it.createdAt ?? null]
      );
      console.log('Inserted:', title);
      inserted++;
    }
    console.log(`Done. Inserted ${inserted}/${items.length}.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
