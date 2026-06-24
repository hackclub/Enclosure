
import { getApprovedProjects } from "./airtablClient";

export default async function handler(req: any, res: any) {
	try {
		const projects = await getApprovedProjects();
		return res.status(200).json({ ok: true, projects });
	} catch (err: any) {
		console.error("[api/approved] error", err);
		return res.status(500).json({ ok: false, error: err?.message || String(err) });
	}
}

