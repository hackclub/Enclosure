import React, { useEffect, useState } from "react";
import ProjectModal from "./ProjectModal";

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
  imageUrl?: string;
  modelUrl?: string | null;
  modelFileName?: string | null;
  [k: string]: any;
};

export default function ProjectsGallery({ apiPath = "/api/approved" }: { apiPath?: string }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Project | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        let res: Response | null = null;
        try {
          res = await fetch(`${API_BASE}${apiPath}`);
        } catch {
          res = null;
        }
        if (!res || res.status === 404) {
          try { res = await fetch(apiPath); } catch { /* leave null */ }
        }
        if (!res || !res.ok) return;
        const j = await res.json();
        const list = Array.isArray(j.projects) ? j.projects : (j || []);
        if (mounted) setProjects(list);
      } catch {
        // show placeholder on any error
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [apiPath]);

  if (loading) return <div className="projects-gallery-loading">Loading projects…</div>;

  if (!projects || projects.length === 0) {
    return (
      <div style={{ position: "relative" }}>
        <div className="projects-marquee" style={{ opacity: 0.4, pointerEvents: "none" }}>
          <div className="projects-marquee-track" style={{ animation: "none" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="marquee-card" key={i}>
                <div className="marquee-card-img marquee-card-img-placeholder" />
                <div className="marquee-card-info">
                  <div style={{ background: "var(--border)", borderRadius: 4, height: "1em", width: "70%" }} />
                  <div style={{ background: "var(--border)", borderRadius: 4, height: "0.75em", width: "45%", marginTop: 6 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 8, color: "var(--accent2)", fontWeight: 700, fontSize: "1.1rem",
        }}>
          🔒 Coming soon
        </div>
      </div>
    );
  }

  // Duplicate so the marquee loops seamlessly
  const items = projects.length < 6
    ? [...projects, ...projects, ...projects]
    : [...projects, ...projects];

  return (
    <>
      <div>
        <div className="projects-marquee">
          <div className="projects-marquee-track">
            {items.map((p, i) => (
              <div
                className="marquee-card marquee-card-clickable"
                key={`${p.id}-${i}`}
                onClick={() => setSelected(projects.find(x => x.id === p.id) || p)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === "Enter" && setSelected(projects.find(x => x.id === p.id) || p)}
              >
                <div className="marquee-card-img">
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt={p.title || "project"} />
                    : <div className="marquee-card-img-placeholder" />}
                </div>
                <div className="marquee-card-info">
                  <div className="marquee-card-title">{p.title || "Untitled"}</div>
                  {p.creatorName && (
                    <div className="marquee-card-creator">@{p.creatorName}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 28 }}>
          <a href="/gallery" className="btn-gallery-all">View Full Gallery →</a>
        </div>
      </div>

      {selected && <ProjectModal project={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
