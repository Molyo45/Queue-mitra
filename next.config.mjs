/**
 * Two build modes:
 *
 *  • Default (`npm run dev` / `npm run build`) — the full app with the Node
 *    Route Handlers (SQLite + SSE). Used locally and on Node hosts.
 *
 *  • Static export (`STATIC_EXPORT=1`, see scripts/build-static.mjs) — a
 *    fully client-side bundle for GitHub Pages. The API routes are omitted and
 *    the app runs in local demo mode (localStorage + BroadcastChannel).
 *
 * `NEXT_PUBLIC_BASE_PATH` must be set to "/<repo-name>" for a GitHub *project*
 * page (e.g. https://user.github.io/queue-mitra/), and left empty for a user
 * page or a custom domain.
 */

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const isStaticExport = process.env.STATIC_EXPORT === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isStaticExport ? { output: "export", trailingSlash: true } : {}),
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  // Static hosting can't run the Next image optimizer.
  images: { unoptimized: true },
  // Let client code know it is a backend-less static build.
  env: {
    NEXT_PUBLIC_STATIC_EXPORT: isStaticExport ? "1" : "",
  },
};

export default nextConfig;
