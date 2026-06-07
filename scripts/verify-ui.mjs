/**
 * UI verification via Playwright (terminal) — avoids Cursor Browser MCP crashes.
 * Usage: node scripts/verify-ui.mjs
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "scripts", "verify-output");

const HYDRATION_PATTERNS = [
  /hydration/i,
  /server rendered html didn't match/i,
  /text content did not match/i,
  /did not match\. server:/i,
];

async function waitForServer(url, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server not reachable at ${url}`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await waitForServer(BASE);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 400, height: 844 },
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const consoleLogs = [];
  page.on("console", (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (err) => {
    consoleLogs.push({ type: "pageerror", text: err.message });
  });

  // --- 1) Hydration check ---
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" }); // hard reload equivalent
  await page.waitForTimeout(1500);

  const hydrationHits = consoleLogs.filter((l) =>
    HYDRATION_PATTERNS.some((p) => p.test(l.text)),
  );
  const allWarningsErrors = consoleLogs.filter((l) =>
    ["warning", "error", "pageerror"].includes(l.type),
  );

  const hydrationResult = {
    hasHydrationError: hydrationHits.length > 0,
    hydrationMessages: hydrationHits,
    allWarningsErrors,
  };

  await writeFile(
    path.join(OUT, "hydration-console.json"),
    JSON.stringify(hydrationResult, null, 2),
  );

  // --- 2) Exercise detail modal ---
  await page.goto(`${BASE}/gym`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Exercises" }).click();
  await page.getByText("Back Squat", { exact: true }).waitFor({ timeout: 10000 });

  // Click the exercise card (not just text node)
  await page
    .locator("div.cursor-pointer")
    .filter({ hasText: "Back Squat" })
    .first()
    .click();

  await page.waitForTimeout(500);

  let hasTechniqueCues = await page.getByText("Technique cues").isVisible().catch(() => false);
  let hasAvoidInjury = await page.getByText("Avoid injury").isVisible().catch(() => false);
  let modalOpened = hasTechniqueCues;

  if (!modalOpened) {
    // Try Bulgarian Split Squat
    await page.getByText("Bulgarian Split Squat", { exact: true }).click();
    await page.waitForTimeout(500);
    hasTechniqueCues = await page.getByText("Technique cues").isVisible().catch(() => false);
    hasAvoidInjury = await page.getByText("Avoid injury").isVisible().catch(() => false);
    modalOpened = hasTechniqueCues;
  }

  // New Hevy-style elements
  const dialog = page.locator("[role=dialog]");
  const hasHeroImage = await dialog
    .locator("img")
    .first()
    .isVisible()
    .catch(() => false);
  const hasMuscleMap = (await dialog.locator("svg").count()) > 0;
  const hasStatsTab = await page
    .getByRole("button", { name: "Stats" })
    .isVisible()
    .catch(() => false);
  const hasMusclesLabel = await dialog
    .getByText(/Primary:/)
    .isVisible()
    .catch(() => false);

  await page.screenshot({ path: path.join(OUT, "exercise-modal.png"), fullPage: true });

  const modalResult = {
    modalOpened,
    hasTechniqueCues,
    hasAvoidInjury,
    hasHeroImage,
    hasMuscleMap,
    hasStatsTab,
    hasMusclesLabel,
  };

  await writeFile(
    path.join(OUT, "modal-result.json"),
    JSON.stringify(modalResult, null, 2),
  );

  // --- 3) Dashboard / Progress / Settings smoke ---
  await page.goto(BASE, { waitUntil: "networkidle" });
  const dashboardOk = await page
    .getByText("Ready to level up your surf?")
    .isVisible()
    .catch(() => false);

  await page.goto(`${BASE}/progress`, { waitUntil: "networkidle" });
  const progressOk = await page
    .getByRole("heading", { name: "Progress" })
    .isVisible()
    .catch(() => false);

  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  const settingsOk = await page.getByText("Units").isVisible().catch(() => false);
  const aiLocalOnly = await page
    .getByRole("button", { name: "Local" })
    .isVisible()
    .catch(() => false);

  const routesResult = { dashboardOk, progressOk, settingsOk, aiLocalOnly };
  await writeFile(
    path.join(OUT, "routes-result.json"),
    JSON.stringify(routesResult, null, 2),
  );

  await browser.close();

  // Print summary for agent
  console.log("=== HYDRATION ===");
  if (hydrationHits.length === 0) {
    console.log("no hydration errors");
  } else {
    for (const m of hydrationHits) {
      console.log(`[${m.type}] ${m.text}`);
    }
  }
  if (allWarningsErrors.length > 0) {
    console.log("--- other console warnings/errors ---");
    for (const m of allWarningsErrors) {
      console.log(`[${m.type}] ${m.text}`);
    }
  }

  console.log("\n=== EXERCISE MODAL ===");
  console.log(JSON.stringify(modalResult, null, 2));
  console.log(`\nScreenshot: ${path.join(OUT, "exercise-modal.png")}`);

  console.log("\n=== ROUTES ===");
  console.log(JSON.stringify(routesResult, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
