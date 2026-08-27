"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches the current Server Component page on an interval while a build is running.
 *
 * Needed because the build no longer happens inside the request that started it (see
 * approveRequestAction): the action returns in milliseconds and the actual work finishes minutes
 * later, with nothing to push the result to a browser that is already sitting on a rendered page.
 * `router.refresh()` re-runs the server render in place, so the 作成中 badge turns into the finished
 * site without the operator reloading by hand and without losing their scroll position.
 *
 * Rendered only when something is actually running, so an idle screen does no polling at all. */
export function AutoRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
