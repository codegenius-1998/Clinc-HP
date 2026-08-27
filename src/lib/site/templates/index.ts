import onePageClassic from "./one-page-classic.json";
import onePageEditorial from "./one-page-editorial.json";
import multiPageClinic from "./multi-page-clinic.json";
import landingLite from "./landing-lite.json";
import suzukakeDental from "./suzukake-dental.json";

/** The template library's registry.
 *
 * ⚠️ Static imports rather than reading the directory at runtime, for three measured reasons:
 *
 * 1. `next.config.ts` sets `output: "standalone"`. A file outside `public/` that nothing imports is
 *    NOT traced into the standalone build — a runtime `readdir` would work in dev and find an empty
 *    directory in production. That is the worst kind of failure: invisible until deployed.
 * 2. `ArchetypeSelect.tsx` is a client component and reads these names. A bundled import reaches the
 *    browser; a filesystem read cannot.
 * 3. `archetypeBlocks()` stays synchronous. Making it async would ripple through five call sites for
 *    no benefit.
 *
 * ⚠️ The cost is one line per template, and forgetting it is a silent no-op. That is exactly what
 * `scripts/verify-templates.mts` checks: it compares this list against the files on disk and fails
 * when either side has something the other does not. */
export const TEMPLATE_SOURCES: Record<string, unknown> = {
  "one-page-classic": onePageClassic,
  "one-page-editorial": onePageEditorial,
  "multi-page-clinic": multiPageClinic,
  "landing-lite": landingLite,
  "suzukake-dental": suzukakeDental,
};
