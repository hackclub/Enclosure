require('dotenv').config();
try { require('dotenv').config({ path: '.env.local' }); } catch (e) {}
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  const rows = [];
  const header = parseLine(lines[0]);
  for (let i = 1; i < lines.length; i++) {
    const fields = parseLine(lines[i]);
    // pad if needed
    while (fields.length < header.length) fields.push('');
    const obj = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = fields[j] ?? '';
    rows.push(obj);
  }
  return rows;
}

function parseLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // lookahead for doubled quote
      if (inQuotes && line[i+1] === '"') {
        cur += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

async function main() {
  const csvPath = path.join(process.cwd(), 'assets', 'shop_items-Grid view.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found at', csvPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(raw);
  console.log(`Parsed ${rows.length} rows from CSV`);

  const cs = process.env.DATABASE_URL;
  if (!cs) {
    console.error('No DATABASE_URL found in environment');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: cs });
  const client = await pool.connect();
  try {
    let inserted = 0;
    for (const r of rows) {
      // map fields
      const id = r.id ? Number(r.id) : null;
      const title = r.title || null;
      const note = r.note || null;
      const img = r.img || null;
      const href = r.href || null;
      const price = r.price ? String(r.price) : null;
      // normalize created_at: remove surrounding quotes if any
      let created_at = r.created_at || r.createdAt || null;
      if (typeof created_at === 'string') {
        created_at = created_at.replace(/^\"+|\"+$/g, '');
      }
      // Upsert using id as conflict target
      const q = `
        INSERT INTO shop_items (id, title, note, img, href, created_at, price)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          note = EXCLUDED.note,
          img = EXCLUDED.img,
          href = EXCLUDED.href,
          created_at = EXCLUDED.created_at,
          price = EXCLUDED.price;
      `;
      const params = [id, title, note, img, href, created_at ? new Date(created_at) : null, price];
      try {
        await client.query(q, params);
        inserted++;
      } catch (e) {
        console.error('row insert failed', { id, title, err: e.message });
      }
    }
    console.log(`Upserted ${inserted} rows into shop_items`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
