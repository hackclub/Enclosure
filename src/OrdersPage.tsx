import { useEffect, useState } from "react";

const API_BASE = (() => {
  const env = import.meta.env.VITE_API_BASE;
  if (env) return env;
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    if (url.port === "5713") url.port = "4000";
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.origin;
  }
  return "";
})();

type Order = {
  id: number;
  user_id: string;
  shop_item_id: string;
  amount: string;
  status: string;
  slack_id?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  itemTitle?: string | null;
  itemImg?: string | null;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [itemsMap, setItemsMap] = useState<Record<string, { title?: string; img?: string }>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [ordersRes, itemsRes] = await Promise.all([
          fetch(`${API_BASE}/api/orders`, { credentials: "include" }),
          fetch(`${API_BASE}/api/shop-items`, { credentials: "include" })
        ]);

        if (!ordersRes.ok) {
          const j = await ordersRes.json().catch(() => null);
          setError((j && j.error) ? j.error : `Failed to load orders: ${ordersRes.status}`);
          setOrders([]);
          setLoading(false);
          return;
        }

        const ordersData = (await ordersRes.json()) as Order[];
        setOrders(ordersData || []);

        if (itemsRes.ok) {
          const itemsData = (await itemsRes.json()) as Array<{ id: number; title?: string; img?: string }>;
          const map: Record<string, { title?: string; img?: string }> = {};
          for (const it of itemsData) map[String(it.id)] = { title: it.title, img: it.img };
          setItemsMap(map);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main>
      <section className="section" id="orders">
        <div className="container">
          <div style={{ marginBottom: 12 }}>
            <button
              className="btn secondary"
              type="button"
              style={{ marginRight: 8, zIndex: 9999, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', transform: 'translateY(-8px)' }}
              onClick={() => { window.location.href = '/'; }}
            >
              ← Back
            </button>
            <h2 style={{ display: 'inline-block', margin: 0 }}>Your Orders</h2>
          </div>

          <div className="section-note">Track the status of items you've purchased from the shop.</div>

          {loading ? (
            <div style={{ padding: 20 }}>Loading orders…</div>
          ) : error ? (
            <div style={{ padding: 20, color: 'var(--muted)' }}>
              {error}
            </div>
          ) : (!orders || orders.length === 0) ? (
            <div style={{ padding: 20 }}>You have no orders yet.</div>
          ) : (
            <div style={{ marginTop: 12, display: 'grid', gap: 16 }}>
              {orders.map((o) => {
                const item = itemsMap[String(o.shop_item_id)] || { title: o.itemTitle, img: o.itemImg };
                const createdRaw = o.createdAt ?? o.created_at ?? null;
                const created = createdRaw ? new Date(createdRaw) : null;
                return (
                  <div key={o.id} style={{ display: 'flex', gap: 14, background: 'var(--card)', borderRadius: 12, padding: 16, alignItems: 'center', boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
                    <div style={{ width: 140, height: 100, borderRadius: 8, overflow: 'hidden', background: '#f7fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.img ? (
                        <img src={item.img} alt={item.title || 'item'} style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} />
                      ) : (
                        <div style={{ color: '#9ca3af' }}>{item.title ? item.title[0] : '—'}</div>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 800 }}>{item.title ?? `Item #${o.shop_item_id}`}</div>
                          <div style={{ color: 'var(--muted)', marginTop: 6 }}>Placed: {created ? created.toLocaleString() : '—'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Order #{o.id}</div>
                          <div style={{ marginTop: 8 }}><span style={{ padding: '6px 10px', borderRadius: 20, background: o.status === 'fulfilled' || o.status === 'complete' ? '#d1fae5' : o.status === 'pending' ? '#fff7ed' : '#eef2ff', color: o.status === 'fulfilled' || o.status === 'complete' ? '#065f46' : '#92400e' }}>{o.status}</span></div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                        <div style={{ color: 'var(--muted)' }}>Ship to: <strong>{o.slack_id ?? '—'}</strong></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ fontWeight: 800 }}>{o.amount}</div>
                          <img src="/assets/Cassos.png" alt="cassos" style={{ width: 26, height: 30 }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
