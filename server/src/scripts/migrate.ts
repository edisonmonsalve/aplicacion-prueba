import "dotenv/config";
import { runMigrations } from "../db/migrator.js";

const arg = process.argv.find((a) => a.startsWith("--baseline="));
const baseline = arg ? Number(arg.split("=")[1]) : undefined;

try {
  await runMigrations({ baseline });
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}