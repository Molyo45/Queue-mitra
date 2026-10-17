/**
 * Static export for GitHub Pages.
 *
 * The app normally runs on a Node server (Route Handlers + SQLite + SSE). For a
 * GitHub Pages "website link" we instead build a fully client-side bundle that
 * uses the in-browser demo store (localStorage + BroadcastChannel).
 *
 * Next.js cannot statically export Route Handlers, so this script temporarily
 * moves `src/app/api` aside, runs `next build` with the export config, then
 * restores it.
 *
 * Usage:
 *   PAGES_BASE_PATH=/queue-mitra npm run build:static
 *
 * `PAGES_BASE_PATH` is the repo name for a GitHub *project* page
 * (https://<user>.github.io/<repo>/). Leave it empty for a user page
 * (https://<user>.github.io/) or a custom domain.
 */

import { execFileSync } from "node:child_process";
import { existsSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = join(root, "src", "app", "api");
const outDir = join(root, "out");
const stashDir = join(tmpdir(), `queue-mitra-api-stash-${process.pid}`);

const basePath = (process.env.PAGES_BASE_PATH || "").trim().replace(/\/+$/, "");

const env = {
  ...process.env,
  STATIC_EXPORT: "1",
  NEXT_PUBLIC_STATIC_EXPORT: "1",
  NEXT_PUBLIC_BASE_PATH: basePath,
};

console.log(`▶ static export to ./out  (basePath = ${basePath || "/"})`);

let stashed = false;
try {
  if (existsSync(apiDir)) {
    rmSync(stashDir, { recursive: true, force: true });
    renameSync(apiDir, stashDir);
    stashed = true;
  }
  rmSync(outDir, { recursive: true, force: true });
  execFileSync("npx", ["next", "build"], { cwd: root, env, stdio: "inherit" });
} finally {
  if (stashed && existsSync(stashDir)) {
    rmSync(apiDir, { recursive: true, force: true });
    renameSync(stashDir, apiDir);
  }
}

console.log("\n✓ Static site exported to ./out");
console.log("  Serve it locally to preview:");
console.log(`    npx serve out        # then open ${basePath || ""}/`);
