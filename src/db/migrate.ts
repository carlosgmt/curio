import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db, sqlite } from "./index";

async function runMigrations() {
  console.log("Running migrations on SQLite database...");
  try {
    migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations applied successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    sqlite.close();
  }
}

runMigrations();
