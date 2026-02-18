import "dotenv/config";
import fs from "node:fs";
try {
	fs.writeFileSync('db_conn.log', String(process.env.DATABASE_URL ?? '<<no DATABASE_URL set>>'));
} catch (e) {}
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });
