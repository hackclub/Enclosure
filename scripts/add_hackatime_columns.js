require("dotenv/config");
const { Client } = require("pg");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Missing DATABASE_URL in environment.");
  process.exit(1);
}

const statements = [
  "ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS hackatime_access_token text",
  "ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS hackatime_refresh_token text",
  "ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS hackatime_expires_at timestamptz",
  "ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS hackatime_user_id text"
];

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    for (const statement of statements) {
      await client.query(statement);
    }
    console.log("Hackatime columns added (if missing)." );
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
