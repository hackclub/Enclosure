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
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    note: "",
    img: "",
    href: ""
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/shop-items`);
        if (!res.ok) return;
        const data = (await res.json()) as ShopItem[];
        setItems(data);
      } catch (_err) {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/profile`);
        if (!res.ok) return;
        const data = (await res.json()) as ProfileResponse;
        const canManage = Boolean(data.canManageShop || data.role === "admin");
        setIsAdmin(canManage);
        if (canManage && data.identityToken) setToken(data.identityToken);
      } catch (_err) {
        // ignore
      }
    })();
  }, []);

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
          <h2>Shop</h2>
          <div className="section-note">Browse the full shop list.</div>
          <div className="grid">
            {items.map((item) => (
              <div key={item.id} className="card">
                <div className="shop-img" aria-hidden>
                  {item.img ? <img src={item.img} alt="" /> : null}
                </div>
                <h3>{item.title}</h3>
                {item.note ? <p className="muted">{item.note}</p> : null}
                {item.href ? (
                  <a href={item.href} target="_blank" rel="noreferrer">
                    View
                  </a>
                ) : null}
              </div>
            ))}
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
