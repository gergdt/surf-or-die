import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import type { Exercise } from "../lib/types";
import { CURATED_PROFILES, scoreExercise } from "../lib/surf-transfer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(__dirname, "../lib/seed/exercises.json");

async function main() {
  const raw = await readFile(SEED, "utf8");
  const exercises = JSON.parse(raw) as Exercise[];

  let high = 0;
  let medium = 0;
  let low = 0;

  const scored = exercises.map((exercise) => {
    const withoutStored = { ...exercise, surfTransfer: undefined };
    const profile =
      CURATED_PROFILES[exercise.id] ?? scoreExercise(withoutStored);
    if (profile.tier === "high") high++;
    else if (profile.tier === "medium") medium++;
    else low++;

    return { ...exercise, surfTransfer: profile };
  });

  await writeFile(SEED, `${JSON.stringify(scored, null, 2)}\n`, "utf8");

  console.log(`Scored ${scored.length} exercises → ${SEED}`);
  console.log(`  high: ${high}, medium: ${medium}, low: ${low}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
