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

type ShopItem = {
  id: number;
  title: string;
  note: string | null;
  price?: string | number | null;
  img: string | null;
  href: string | null;
};

type ProfileResponse = {
  role?: string | null;
  name?: string | null;
  canManageShop?: boolean;
  identityToken?: string | null;
};

export default function ShopPage() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    note: "",
    img: "",
    href: ""
  });


  const loadItems = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/shop-items`, { credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        setStatus(`Failed to load items: ${res.status} ${res.statusText} ${text}`);
        setItems([]);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as ShopItem[];
      setItems(data || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to load items: ${msg}`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/profile`, { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as ProfileResponse;
        const canManage = Boolean(data.canManageShop || data.role === "admin");
        setIsAdmin(canManage);
        if (canManage && data.identityToken) setToken(data.identityToken);
        if (typeof (data as any).credits === 'number') setCredits((data as any).credits as number);
      } catch (_err) {
        // ignore
      }
    })();
  }, []);

      const buyItem = async (itemId: number) => {
        setStatus(null);
        try {
          const res = await fetch(`${API_BASE}/api/shop/buy`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: itemId })
          });
          const j = await res.json();
          if (!res.ok) {
            setStatus((j && j.error) ? j.error : `Purchase failed: ${res.status}`);
            return;
          }
          // update local credits
          if (typeof j.credits === 'number') setCredits(j.credits);
          setStatus("Purchase successful!");
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setStatus(`Purchase failed: ${msg}`);
        }
      };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    if (!isAdmin) {
      setStatus("Admin access required.");
      return;
    }
    if (!token) {
      setStatus("Missing admin token. Please log in again.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/shop-items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: form.title,
          note: form.note || null,
          img: form.img || null,
          href: form.href || null
        })
      });

      if (!res.ok) {
        const detail = await res.text();
        setStatus(`Failed to add item: ${detail}`);
        return;
      }

      const created = (await res.json()) as ShopItem;
      setItems((prev) => [created, ...prev]);
      setForm({ title: "", note: "", img: "", href: "" });
      setStatus("Item added.");
      setShowForm(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to add item: ${message}`);
    }
  };

  return (
    <main>
      <section className="section" id="shop">
        <div className="container">
          <div style={{ marginBottom: 12, position: 'relative' }}>
            <a className="btn secondary" href="/" style={{ position: 'absolute', left: 0, top: 0 }}>
              ← Back to main page
            </a>
          </div>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <h2 style={{ margin: 0, textAlign: 'center' }}>Shop</h2>
            <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 12, alignItems: 'center', zIndex: 2000 }}>
              {typeof credits === 'number' ? (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 12,
                  border: '2px solid #b45309',
                  background: '#fff7ed',
                  color: '#b45309',
                  fontWeight: 800,
                  fontSize: 18,
                }}>
                  <div style={{ lineHeight: 1 }}>{credits}</div>
                  <img src="/assets/Cassos.png" alt="cassos" style={{ width: 34, height: 40, display: 'block' }} />
                </div>
              ) : null}
              <button
                className="btn secondary"
                onClick={() => { window.location.href = '/orders'; }}
                type="button"
                style={{ whiteSpace: 'nowrap' }}
              >
                View your orders
              </button>
            </div>
          </div>
          <div className="section-note">Browse the full shop list.</div>
          <div className="grid shop-grid">
            {
              (() => {
                if (loading) {
                  return <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 20 }}>Loading shop items…</div>;
                }
                if (status) {
                  return (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 20 }}>
                      <div style={{ marginBottom: 8, color: 'var(--muted)' }}>{status}</div>
                      <button className="btn" onClick={() => loadItems()}>Retry</button>
                    </div>
                  );
                }
                if (!items || items.length === 0) {
                  return (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 20 }}>
                      No shop items available.
                      <div style={{ marginTop: 10 }}>
                        <button className="btn" onClick={() => loadItems()}>Reload</button>
                      </div>
                    </div>
                  );
                }

                return items.map((item) => (
                  <div key={item.id} className="card shop-card">
                    <div className="shop-image">
                      {item.img ? (
                        <img src={item.img} alt={item.title} />
                      ) : (
                        <div className="shop-placeholder">No image</div>
                      )}

                      {/* bought count removed per request */}
                      <button className="shop-fav" aria-label="favorite">☆</button>
                    </div>

                    <h3>{item.title}</h3>
                    {item.note ? <p className="muted">{item.note}</p> : null}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontWeight: 700 }}>{item.price ? Number(item.price) : 0}</div>
                        <img src="/assets/Cassos.png" alt={item.price ? `${item.price} cassos` : 'cassos'} style={{ width: 30, height: 36, display: 'block' }} />
                      </div>
                      <div>
                        <button className="btn" onClick={() => buyItem(item.id)}>Buy</button>
                      </div>
                    </div>
                  </div>
                ));
              })()
            }
          </div>
        </div>
      </section>

      {isAdmin ? (
        <>
          <button
            aria-label="Add shop item"
            onClick={() => setShowForm(true)}
            style={{
              position: "fixed",
              top: 16,
              right: 16,
              zIndex: 3000,
              padding: "8px 12px",
              borderRadius: 8,
              background: "var(--accent, #0ea5a4)",
              color: "white",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(0,0,0,0.12)"
            }}
            className="btn"
            type="button"
          >
            Add Shop Item
          </button>

          {showForm ? (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", zIndex: 2000 }}>
              <div style={{ background: "var(--card)", padding: 20, borderRadius: 10, width: "min(92%, 560px)" }}>
                <h2>Add Shop Item</h2>
                <div className="section-note">Admins only.</div>
                <form onSubmit={handleSubmit} style={{ maxWidth: 520 }}>
                  <div className="form-row">
                    <label>
                      Title
                      <input
                        type="text"
                        value={form.title}
                        onChange={(event) => setForm({ ...form, title: event.target.value })}
                        required
                      />
                    </label>
                  </div>
                  <div className="form-row">
                    <label>
                      Note
                      <input
                        type="text"
                        value={form.note}
                        onChange={(event) => setForm({ ...form, note: event.target.value })}
                      />
                    </label>
                  </div>
                  <div className="form-row">
                    <label>
                      Image URL
                      <input
                        type="url"
                        value={form.img}
                        onChange={(event) => setForm({ ...form, img: event.target.value })}
                      />
                    </label>
                  </div>
                  <div className="form-row">
                    <label>
                      Link URL
                      <input
                        type="url"
                        value={form.href}
                        onChange={(event) => setForm({ ...form, href: event.target.value })}
                      />
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button className="btn" type="submit">Add Item</button>
                    <button className="btn secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
                  </div>
                  {status ? <div style={{ marginTop: 12 }}>{status}</div> : null}
                </form>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
