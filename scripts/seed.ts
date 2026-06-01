import { db } from "@/lib/db";

async function main() {
  console.log("🌱 Seeding database...");

  // Create a demo user (password hashed by bcrypt at runtime)
  console.log("  Skipping user seed (requires runtime bcrypt)...");

  // Verify database connectivity
  try {
    const result = await db.execute("SELECT 1 AS ok");
    console.log("  Database connection: OK");
  } catch (e) {
    console.error("  Database connection: FAILED", e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  console.log("✅ Seed complete.");
  process.exit(0);
}

main();
