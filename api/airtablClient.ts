// Lightweight wrapper that reuses the project's REST-based Airtable helper
import airtable from "../src/airtable";

export type ProjectRecord = {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  imageUrl?: string;
  [k: string]: any;
};

export async function getApprovedProjects(): Promise<ProjectRecord[]> {
  const table = process.env.AIRTABLE_TABLE_NAME || "Projects";
  const all = await airtable.fetchAllAirtable(table);
  const approved = (all || []).filter((r: any) => {
    const s = (r?.fields?.Status ?? r?.fields?.status ?? "") as string;
    return String(s).toLowerCase() === "approved";
  });
  return approved.map((r: any) => {
    const f = r.fields || {};
    return {
      id: r.id,
      title: f.Title || f.name || f.Name || "",
      description: f.Description || f.description || "",
      status: f.Status || f.status || "",
      imageUrl: (f.Image && f.Image[0] && f.Image[0].url) || f.ImageUrl || f.image || "",
      ...f,
    } as ProjectRecord;
  });
}