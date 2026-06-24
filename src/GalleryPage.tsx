import React, { useEffect, useState } from "react";
import "../css/style.css";
import ProjectModal from "./components/ProjectModal";
import { getCachedApproved, setCachedApproved } from "./approvedCache";

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
  tier?: string;
  [k: string]: any;
};

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_KEY = "enclosure:gallery-page-size";

// Compact list of page numbers with ellipses, e.g. [1, '…', 4, 5, 6, '…', 20].
function pageWindow(current: number, total: number): (number | "…")[] {
  const pages = new Set<number>([1, total]);
  for (let p = current - 1; p <= current + 1; p++) if (p >= 1 && p <= total) pages.add(p);
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

export default function GalleryPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Project | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem(PAGE_SIZE_KEY));
      return PAGE_SIZE_OPTIONS.includes(v) ? v : DEFAULT_PAGE_SIZE;
    } catch {
      return DEFAULT_PAGE_SIZE;
    }
  });

  useEffect(() => {
    // Show the cached list instantly, then revalidate in the background.
    const cached = getCachedApproved<Project>();
    if (cached) {
      setProjects(cached);
      setLoading(false);
    }

    async function load() {
      try {
        let res: Response | null = null;
        try { res = await fetch(`${API_BASE}/api/approved`); } catch { res = null; }
        if (!res || res.status === 404) {
          try { res = await fetch("/api/approved"); } catch { /* leave null */ }
        }
        if (!res || !res.ok) return;
        const j = await res.json();
        const list = Array.isArray(j.projects) ? j.projects : [];
        setProjects(list);
        setCachedApproved(list);
      } catch {
        if (!cached) setProjects([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const all = projects ?? [];
  const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageItems = all.slice(start, start + pageSize);

  function goToPage(p: number) {
    setPage(Math.min(Math.max(1, p), totalPages));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function changePageSize(n: number) {
    setPageSize(n);
    setPage(1);
    try { localStorage.setItem(PAGE_SIZE_KEY, String(n)); } catch { /* ignore */ }
  }

  return (
    <>
      <div style={{ minHeight: "100vh", background: "var(--bg, #0c0806)", color: "var(--fg, #fff)", fontFamily: "inherit" }}>
        <div style={{ maxWidth: 1480, margin: "0 auto", padding: "48px 24px" }}>
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
            <>
              <div className="gallery-toolbar">
                <span style={{ color: "var(--muted, #888)", fontSize: "0.9rem" }}>
                  Showing {start + 1}–{Math.min(start + pageSize, all.length)} of {all.length} projects
                </span>
                <label className="gallery-page-size">
                  Per page:
                  <select
                    value={pageSize}
                    onChange={(e) => changePageSize(Number(e.target.value))}
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="gallery-page-grid">
                {pageItems.map((p) => (
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
                      {p.tier && <span className="gallery-page-tier">{p.tier}</span>}
                    </div>
                    <div className="gallery-page-info">
                      <div className="gallery-page-title">{p.title || "Untitled"}</div>
                      {p.creatorName && <div className="gallery-page-creator">@{p.creatorName}</div>}
                      {p.description && <p className="gallery-page-desc">{p.description}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <nav className="gallery-pager" aria-label="Gallery pages">
                  <button
                    className="gallery-pager-btn"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    ← Prev
                  </button>
                  {pageWindow(currentPage, totalPages).map((p, i) =>
                    p === "…" ? (
                      <span key={`gap-${i}`} className="gallery-pager-gap">…</span>
                    ) : (
                      <button
                        key={p}
                        className={`gallery-pager-btn${p === currentPage ? " is-active" : ""}`}
                        onClick={() => goToPage(p)}
                        aria-current={p === currentPage ? "page" : undefined}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    className="gallery-pager-btn"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next →
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>

      {selected && <ProjectModal project={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
