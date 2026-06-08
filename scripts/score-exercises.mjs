/**
 * Pre-compute surfTransfer profiles for all seed exercises.
 * Delegates to the TypeScript scorer so logic stays in lib/surf-transfer.ts.
 *
 * Usage: npm run score-exercises
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const runner = path.join(__dirname, "score-exercises-runner.ts");

const result = spawnSync("npx", ["tsx", runner], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
