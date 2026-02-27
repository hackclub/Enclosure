import 'dotenv/config';
const BASE = process.env.AIRTABLE_BASE_ID;
const PAT = process.env.AIRTABLE_PAT || process.env.AIRTABLE_API_KEY;
const ORDERS_TABLE = process.env.AIRTABLE_SHOP_TXN_TABLE || process.env.AIRTABLE_TABLE_NAME || 'orders';
if (!BASE || !PAT) {
  console.error('Missing AIRTABLE_BASE_ID or AIRTABLE_PAT in environment');
  process.exit(1);
}
async function fetchAll(table) {
  const out = [];
  let offset;
  do {
    const params = new URLSearchParams();
    params.set('pageSize','100');
    if (offset) params.set('offset', offset);
    const url = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(table)}?${params.toString()}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${PAT}` } });
    if (!res.ok) {
      console.error('Airtable fetch failed', res.status, await res.text());
      process.exit(2);
    }
    const j = await res.json();
    (j.records||[]).forEach(r=>out.push(r));
    offset = j.offset;
  } while (offset);
  return out;
}
(async ()=>{
  console.log('Fetching Airtable orders from table:', ORDERS_TABLE);
  const recs = await fetchAll(ORDERS_TABLE);
  console.log('Total records:', recs.length);
  let i=0;
  for (const r of recs) {
    const f = r.fields || {};
    const orderId = f.OrderId ?? f.orderId ?? null;
    const userId = f.UserId ?? f.userId ?? null;
    const shopItemId = f.ShopItemId ?? f.shopItemId ?? null;
    const amount = f.Amount ?? f.amount ?? null;
    const status = f.Status ?? f.status ?? null;
    const slack = f.SlackId ?? f.slack_id ?? null;
    console.log(`#${++i} airtable_id=${r.id}`);
    console.log('  OrderId:', orderId);
    console.log('  UserId:', userId);
    console.log('  ShopItemId:', shopItemId);
    console.log('  Amount:', amount);
    console.log('  Status:', status);
    console.log('  SlackId:', slack);
    console.log('  Raw fields:', JSON.stringify(f));
  }
})();
