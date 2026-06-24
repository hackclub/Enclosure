// Standalone Vercel function: proxies an Airtable attachment so Online3DViewer
// can fetch the model with a real file extension in the path (needed for format
// detection) and without CORS problems. Self-contained — no src/ imports — so it
// survives the monolith's cold-start crash, like api/approved.ts.
//
// Mirrors proxyAirtableFile + getSafeAirtableUrl in src/server.ts.
// Request shape: GET /api/model-proxy/<filename>?src=<airtable-url>

function getSafeAirtableUrl(srcUrl: unknown): string | null {
  if (typeof srcUrl !== "string") return null;
  try {
    const parsed = new URL(srcUrl);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:") return null;
    const allowedHosts = new Set(["airtableusercontent.com", "v5.airtableusercontent.com"]);
    if (!allowedHosts.has(host)) return null;
    const normalizedHost = host === "v5.airtableusercontent.com" ? "v5.airtableusercontent.com" : "airtableusercontent.com";
    return new URL(`${parsed.pathname}${parsed.search}`, `https://${normalizedHost}`).toString();
  } catch {
    return null;
  }
}

const first = (v: unknown): string | undefined =>
  Array.isArray(v) ? (v[0] as string) : (typeof v === "string" ? v : undefined);

export default async function handler(req: any, res: any) {
  // `src` carries the Airtable URL; `filename` comes from the [filename] path
  // segment (Vercel) and falls back to the query param for the legacy form.
  const src = first(req.query?.src) ?? first(req.query?.url);
  const filename = first(req.query?.filename);

  const safeUrl = getSafeAirtableUrl(src);
  if (!safeUrl) return res.status(400).json({ error: "Invalid URL" });

  try {
    const upstream = await fetch(safeUrl);
    if (!upstream.ok) return res.status(502).json({ error: "Upstream fetch failed" });
    const ct = upstream.headers.get("Content-Type") || "application/octet-stream";
    res.setHeader("Content-Type", ct);
    res.setHeader("Content-Disposition", filename ? `inline; filename="${filename}"` : "inline");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    const buf = await upstream.arrayBuffer();
    return res.send(Buffer.from(buf));
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
