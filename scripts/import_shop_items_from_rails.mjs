#!/usr/bin/env node
/*
  Usage:
    SOURCE_URL="https://rails.example.com/api/shop_items" \
    SOURCE_TOKEN="railsBearerToken" \
    BACKEND_URL="http://localhost:4000" \
    BACKEND_TOKEN="adminIdentityToken" \
    node scripts/import_shop_items_from_rails.mjs

  The script expects the Rails endpoint to return a JSON array of items.
  It maps fields to this app's `shop_items` shape: `{ title, note, img, href }`.
*/

import process from 'node:process';

const SOURCE_URL = process.env.SOURCE_URL || process.env.SOURCE || '';
const SOURCE_TOKEN = process.env.SOURCE_TOKEN || '';
const BACKEND_URL = process.env.BACKEND_URL || process.env.BACKEND || 'http://localhost:4000';
const BACKEND_TOKEN = process.env.BACKEND_TOKEN || '';

if (!SOURCE_URL) {
  console.error('Missing SOURCE_URL. Set SOURCE_URL env var to your Rails API endpoint.');
  process.exit(2);
}
if (!BACKEND_TOKEN) {
  console.error('Missing BACKEND_TOKEN. Set BACKEND_TOKEN env var to an admin identity token for POST /api/shop-items.');
  process.exit(2);
}

async function fetchJson(url, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  return res.json();
}

function mapItem(src) {
  // Guess common Rails field names; fallback to generic properties
  const title = src.title || src.name || src.label || src.description || 'Untitled';
  const note = src.note || src.description || src.body || src.summary || '';
  const img = src.img || src.image_url || src.image || src.photo || src.picture || null;
  const href = src.href || src.url || src.link || null;
  return { title, note, img, href };
}

async function postToBackend(item) {
  const url = new URL('/api/shop-items', BACKEND_URL).toString();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BACKEND_TOKEN}`
    },
    body: JSON.stringify(item)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${res.statusText} - ${text}`);
  return JSON.parse(text || '{}');
}

async function run() {
  console.log('Fetching source items from', SOURCE_URL);
  const items = await fetchJson(SOURCE_URL, SOURCE_TOKEN);
  if (!Array.isArray(items)) {
    console.error('Expected array from source. Got:', typeof items);
    console.error(JSON.stringify(items).slice(0, 1000));
    process.exit(3);
  }

  console.log(`Fetched ${items.length} items. Preparing to import...`);
  let success = 0;
  for (const src of items) {
    try {
      const mapped = mapItem(src);
      // Optional: include price in note if present on source
      if (!mapped.note && (src.price || src.cost)) mapped.note = `Price: ${src.price ?? src.cost}`;
      const created = await postToBackend(mapped);
      console.log('Imported:', mapped.title, '-> id', created?.id ?? '(no id)');
      success++;
    } catch (err) {
      console.error('Import failed for item:', src?.id ?? src?.title ?? JSON.stringify(src).slice(0,40), String(err));
    }
  }

  console.log(`Done. Imported ${success}/${items.length} items.`);
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
