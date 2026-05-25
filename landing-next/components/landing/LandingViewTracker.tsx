"use client";

import { useEffect } from "react";

const STORAGE_PREFIX = "cf_view_";

interface LandingViewTrackerProps {
  landingId: string;
}

/**
 * Records one view per browser session (sessionStorage) via POST /api/landings/[id]/view.
 */
export function LandingViewTracker({ landingId }: LandingViewTrackerProps) {
  useEffect(() => {
    const key = `${STORAGE_PREFIX}${landingId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage blocked — still attempt one request
    }

    fetch(`/api/landings/${landingId}/view`, { method: "POST" }).catch(() => {
      // best-effort
    });
  }, [landingId]);

  return null;
}
