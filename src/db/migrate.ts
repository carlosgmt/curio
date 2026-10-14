import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function runMigrations() {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgres://curio:curio_secret@localhost:5432/curio";

  console.log("Running migrations on:", connectionString);
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  try {
    // Enable pgvector extension if not already enabled
    await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations applied successfully!");
  } finally {
    await sql.end();
  }
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
