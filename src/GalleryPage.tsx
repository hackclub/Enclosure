import React, { useEffect, useState } from "react";
import "../css/style.css";
import ProjectModal from "./components/ProjectModal";

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

type Project = {
  id: string;
  title?: string;
  creatorName?: string;
  description?: string;
  imageUrl?: string;
  modelUrl?: string | null;
  modelFileName?: string | null;
  [k: string]: any;
};

export default function GalleryPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Project | null>(null);

  useEffect(() => {
    async function load() {
      try {
        let res: Response | null = null;
        try { res = await fetch(`${API_BASE}/api/approved`); } catch { res = null; }
        if (!res || res.status === 404) {
          try { res = await fetch("/api/approved"); } catch { /* leave null */ }
        }
        if (!res || !res.ok) return;
        const j = await res.json();
        setProjects(Array.isArray(j.projects) ? j.projects : []);
      } catch {
        setProjects([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <>
      <div style={{ minHeight: "100vh", background: "var(--bg, #0c0806)", color: "var(--fg, #fff)", fontFamily: "inherit" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
          <a href="/" style={{ color: "var(--accent2)", fontSize: "0.9rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 32 }}>
            ← Back to home
          </a>
          <h1 style={{ fontSize: "2.2rem", marginBottom: 8 }}>Things Other People Made</h1>
          <p style={{ color: "var(--muted, #888)", marginBottom: 36 }}>All approved enclosure projects from the community. Click any card to view details and 3D model.</p>

          {loading && (
            <div style={{ color: "var(--muted)", textAlign: "center", padding: "60px 0" }}>Loading projects…</div>
          )}

          {!loading && projects && projects.length === 0 && (
            <div style={{ color: "var(--muted)", textAlign: "center", padding: "60px 0" }}>No approved projects yet.</div>
          )}

          {!loading && projects && projects.length > 0 && (
            <div className="gallery-page-grid">
              {projects.map((p) => (
                <div
                  className="gallery-page-card gallery-page-card-clickable"
                  key={p.id}
                  onClick={() => setSelected(p)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === "Enter" && setSelected(p)}
                >
                  <div className="gallery-page-img">
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.title || "project"} />
                      : <div className="gallery-page-img-placeholder" />}
                  </div>
                  <div className="gallery-page-info">
                    <div className="gallery-page-title">{p.title || "Untitled"}</div>
                    {p.creatorName && <div className="gallery-page-creator">@{p.creatorName}</div>}
                    {p.description && <p className="gallery-page-desc">{p.description}</p>}
                    {p.modelUrl && <div className="gallery-page-model-badge">🧊 3D model</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && <ProjectModal project={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
