import React, { useEffect, useState } from "react";

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

export default function WeeklyChallengesPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [challenges, setChallenges] = useState([]);
  const [form, setForm] = useState({ name: "", date: "" });
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/profile`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.canManageShop || data?.role === "admin") setIsAdmin(true);
      } catch {}
    })();
  }, []);

  // Fetch challenges from backend
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/weekly-challenges`);
        if (!res.ok) return;
        const data = await res.json();
        setChallenges(data || []);
      } catch {}
    })();
  }, []);

  const handleAddChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (!form.name.trim() || !form.date.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/weekly-challenges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: form.name, date: form.date })
      });
      if (!res.ok) {
        const detail = await res.text();
        setStatus(`Failed to add challenge: ${detail}`);
        return;
      }
      const created = await res.json();
      setChallenges((prev) => [created, ...prev]);
      setForm({ name: "", date: "" });
      setShowForm(false);
      setStatus("Challenge added.");
    } catch (err) {
      setStatus(`Failed to add challenge: ${String(err)}`);
    }
  };

  return (
    <main>
      <section className="section" id="weekly-challenges">
        <div className="container">
          <h2>Weekly Challenges</h2>
          <div className="section-note">Participate in weekly design challenges to earn extra rewards and level up your skills!</div>
          {isAdmin && (
            <div style={{ margin: '18px 0' }}>
              <button className="btn" type="button" onClick={() => setShowForm(true)}>
                Add Challenge
              </button>
            </div>
          )}
          {showForm && (
            <div style={{ margin: '18px 0', background: '#fff7ed', padding: 18, borderRadius: 10, maxWidth: 420 }}>
              <form onSubmit={handleAddChallenge} style={{ display: 'grid', gap: 10 }}>
                <input
                  type="text"
                  placeholder="Challenge name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                />
                <input
                  type="text"
                  placeholder="Date (e.g. Mar 15–21)"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  required
                  style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
                  <button className="btn" type="submit">Add</button>
                </div>
                {status ? <div style={{ marginTop: 6, color: 'var(--muted)' }}>{status}</div> : null}
              </form>
            </div>
          )}
        <div style={{ marginTop: 24 }}>
            <ul style={{ listStyle: 'disc', paddingLeft: 24 }}>
              {challenges.length === 0 ? (
                <li style={{ color: 'var(--muted)' }}>No challenges yet. Admins can add new challenges.</li>
              ) : (
                challenges.map((c: any, i) => (
                  <li key={c.id || i}><b>Challenge {challenges.length - i}:</b> {c.name} <span style={{ color: 'var(--muted)' }}>({c.date})</span></li>
                ))
              )}
            </ul>
            <div style={{ marginTop: 32 }}>
              <p>Submit your entry through the <a href="https://forms.hackclub.com/enclosure" target="_blank" rel="noreferrer">submission form</a> and mention the challenge name in your notes.</p>
              <p>Winners will be featured and receive bonus cassos!</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
