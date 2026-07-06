"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Periodically re-runs the server component's data fetch, keeping data-fetching (and PDA derivation) server-side. */
export function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
