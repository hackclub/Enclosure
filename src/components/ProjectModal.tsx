import React, { useEffect, useRef, useState } from "react";

type ModelFile = { url: string; filename: string; type: string };

type Project = {
  id: string;
  title?: string;
  creatorName?: string;
  description?: string;
  imageUrl?: string;
  modelUrl?: string | null;
  modelFileName?: string | null;
  modelFiles?: ModelFile[];
  journalUrl?: string | null;
  [k: string]: any;
};

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

// Path-based proxy: extension in URL path so Online3DViewer detects format
function pathProxyUrl(url: string, filename: string) {
  return `${API_BASE}/api/model-proxy/${encodeURIComponent(filename)}?src=${encodeURIComponent(url)}`;
}

// Legacy query-param proxy for download links
function downloadProxyUrl(url: string, filename?: string) {
  return `${API_BASE}/api/model-proxy?url=${encodeURIComponent(url)}${filename ? `&filename=${encodeURIComponent(filename)}` : ""}`;
}

// No version pin — lets jsDelivr resolve latest; build/ is included in the npm package
const O3DV_JS = "https://cdn.jsdelivr.net/npm/online-3d-viewer/build/o3dv.min.js";
const O3DV_CSS = "https://cdn.jsdelivr.net/npm/online-3d-viewer/build/o3dv.min.css";

function Model3DViewer({ proxyUrl }: { proxyUrl: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    function initViewer() {
      if (cancelled) return;
      const OV = (window as any).OV;
      if (!OV) { setState("error"); return; }
      if (!wrapperRef.current) return;

      // OV spawns a Web Worker for STEP/IGES parsing (occt-import-js). Browsers block
      // cross-origin workers, so the loaders must be served from our own origin. These
      // files live in assets/o3dv-libs/loaders/ (served at /o3dv-libs/loaders/ in dev,
      // copied into dist/ for prod). OV appends "loaders/..." to this base itself.
      if (typeof OV.SetExternalLibLocation === "function") {
        OV.SetExternalLibLocation("/o3dv-libs");
      }

      wrapperRef.current.innerHTML = "";
      const el = document.createElement("div");
      el.className = "online_3d_viewer";
      el.style.cssText = "width:100%;height:100%;min-height:460px;";
      el.setAttribute("model", proxyUrl);
      wrapperRef.current.appendChild(el);

      // Init3DViewerElements scans document for .online_3d_viewer and initialises them
      OV.Init3DViewerElements();
      setState("ready");
    }

    if (!document.getElementById("o3dv-css")) {
      const link = document.createElement("link");
      link.id = "o3dv-css";
      link.rel = "stylesheet";
      link.href = O3DV_CSS;
      document.head.appendChild(link);
    }

    if ((window as any).OV) {
      initViewer();
    } else {
      let script = document.getElementById("o3dv-js") as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = "o3dv-js";
        script.src = O3DV_JS;
        document.head.appendChild(script);
      }
      script.addEventListener("load", initViewer);
      script.addEventListener("error", () => { if (!cancelled) setState("error"); });
    }

    return () => {
      cancelled = true;
      if (wrapperRef.current) wrapperRef.current.innerHTML = "";
    };
  }, [proxyUrl]);

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 460, position: "relative" }}>
      {state === "loading" && (
        <div className="modal-viewer-loading">
          <div className="modal-viewer-spinner">⟳</div>
          <div>Loading 3D viewer…</div>
        </div>
      )}
      {state === "error" && (
        <div className="modal-no-model" style={{ flexDirection: "column", gap: 6, textAlign: "center", padding: "0 24px" }}>
          <div>Failed to load 3D viewer</div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Use the download button to view locally</div>
        </div>
      )}
      <div ref={wrapperRef} style={{ width: "100%", height: "100%", minHeight: 460 }} />
    </div>
  );
}

export default function ProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const files: ModelFile[] = project.modelFiles?.length
    ? project.modelFiles
    : project.modelUrl
      ? [{ url: project.modelUrl, filename: project.modelFileName || "model", type: "other" }]
      : [];

  const [activeIdx, setActiveIdx] = useState(0);
  const activeFile = files[activeIdx] || null;

  useEffect(() => { setActiveIdx(0); }, [project.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const viewerUrl = activeFile ? pathProxyUrl(activeFile.url, activeFile.filename) : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="modal-body">
          {/* Left: info + screenshot */}
          <div className="modal-left">
            {project.imageUrl && (
              <img className="modal-screenshot" src={project.imageUrl} alt={project.title || "project"} />
            )}
            <div className="modal-info">
              <h2 className="modal-title">{project.title || "Untitled"}</h2>
              {project.creatorName && (
                <div className="modal-creator">@{project.creatorName}</div>
              )}
              {project.description && (
                <p className="modal-desc">{project.description}</p>
              )}

              {files.length > 1 && (
                <div className="modal-file-list">
                  <div className="modal-file-label">Model files ({files.length})</div>
                  {files.map((f, i) => (
                    <button
                      key={i}
                      className={`modal-file-btn${i === activeIdx ? " modal-file-btn-active" : ""}`}
                      onClick={() => setActiveIdx(i)}
                    >
                      {f.type === "step" ? "⬡" : f.type === "stl" ? "▲" : "📄"} {f.filename}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
                {project.journalUrl && (
                  <a className="modal-download" href={project.journalUrl} target="_blank" rel="noopener noreferrer">
                    📓 View Journal
                  </a>
                )}
                {activeFile && (
                  <a className="modal-download" href={downloadProxyUrl(activeFile.url, activeFile.filename)} download={activeFile.filename || "model"}>
                    ↓ Download {activeFile.filename || "Model"}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Right: 3D viewer */}
          <div className="modal-right">
            {viewerUrl ? (
              <>
                <Model3DViewer key={viewerUrl} proxyUrl={viewerUrl} />
                <div className="modal-viewer-hint">
                  Powered by Online3DViewer · STEP files may take a moment to load
                </div>
              </>
            ) : (
              <div className="modal-no-model">No 3D model available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
