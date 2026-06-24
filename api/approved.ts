// Standalone Vercel serverless function for the public gallery.
//
// Deliberately self-contained: it queries Airtable directly with `fetch` and
// imports nothing from src/ (the full Express server). That isolates it from the
// monolith's cold-start initialization, so the gallery keeps working even if the
// main /api function fails to boot.
//
// Mirrors the logic of the Express `GET /api/approved` route in src/server.ts —
// same table, filter, and field mapping the frontend expects.

type Attachment = { url?: string; filename?: string };

export default async function handler(_req: any, res: any) {
  try {
    const pat = process.env.AIRTABLE_PAT || process.env.AIRTABLE_API_KEY || "";
    const baseId = process.env.AIRTABLE_BASE_ID || "";
    const tableName = process.env.AIRTABLE_PROJECT_TABLE || "Project Submission";

    if (!pat || !baseId) {
      return res.status(200).json({ ok: true, projects: [] });
    }

    const records: any[] = [];
    let offset: string | undefined;
    do {
      const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`);
      url.searchParams.set("filterByFormula", `{Review Status}="Approved"`);
      url.searchParams.set("pageSize", "100");
      if (offset) url.searchParams.set("offset", offset);
      const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${pat}` } });
      if (!r.ok) {
        const txt = await r.text();
        console.error("[api/approved] airtable error", r.status, txt);
        break;
      }
      const j: any = await r.json();
      if (Array.isArray(j.records)) records.push(...j.records);
      offset = j.offset;
    } while (offset);

    const toFiles = (arr: Attachment[] | undefined, type: string) =>
      Array.isArray(arr) ? arr.map((a) => ({ url: a.url, filename: a.filename, type })) : [];

    const projects = records.map((rec: any) => {
      const f = rec.fields || {};
      const modelFiles = [
        ...toFiles(f["Project File (STEP)"], "step"),
        ...toFiles(f["Project File (STL)"], "stl"),
        ...toFiles(f["Project File"], "other"),
      ];
      const first = modelFiles[0] || null;
      return {
        id: rec.id,
        title: f["Project Name"] || f.Title || f.Name || "Untitled",
        creatorName: f["GitHub Username"] || f["Name"] || f["Email"] || "",
        description: f["Additional Info (from participant)"] || f.Description || "",
        status: f["Review Status"] || "",
        imageUrl: (f.Screenshot && f.Screenshot[0]?.url) || (f.Image && f.Image[0]?.url) || "",
        modelUrl: first?.url || null,
        modelFileName: first?.filename || null,
        modelFiles,
        journalUrl: f["Journal URL"] || null,
      };
    });

    return res.status(200).json({ ok: true, projects });
  } catch (err: any) {
    console.error("[api/approved] error", err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
