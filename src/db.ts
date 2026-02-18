import "dotenv/config";
import fs from "node:fs";
try {
	fs.writeFileSync('db_conn.log', String(process.env.DATABASE_URL ?? '<<no DATABASE_URL set>>'));
} catch (e) {}
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Quick connection check at module load to log whether DB is reachable.
(async () => {
	try {
		const client = await pool.connect();
		client.release();
		try {
			const u = new URL(String(process.env.DATABASE_URL));
			console.log('DB connected to', u.host, u.pathname.replace(/^\//, ''));
		} catch (_) {
			console.log('DB connected');
		}
	} catch (err) {
		console.error('DB connection failed:', String(err));
	}
})();

export const db = drizzle(pool, { schema });
