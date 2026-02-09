const { Client } = require("pg");

const connectionString = "postgresql://neondb_owner:***REMOVED***@ep-silent-butterfly-ai2ol0w7-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const statements = [
  "BEGIN",
  "DROP TABLE IF EXISTS shop_items",
  "DROP TABLE IF EXISTS \"user\"",
  "CREATE TABLE \"user\" (id text PRIMARY KEY, name text, email text NOT NULL, email_verified boolean DEFAULT false, image text, slack_id text, verification_status text, role text DEFAULT 'member', identity_token text, refresh_token text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())",
  "CREATE TABLE shop_items (id serial PRIMARY KEY, title text NOT NULL, note text, img text, href text, created_at timestamptz DEFAULT now())",
  "COMMIT"
];

async function reset() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    for (const statement of statements) {
      await client.query(statement);
    }
    console.log("Production schema reset complete.");
  } finally {
    await client.end();
  }
}

reset().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
