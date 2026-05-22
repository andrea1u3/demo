"use client";

import { useEffect, useState } from "react";
import { initialStudioState } from "@/lib/demo-data";
import type { StudioState } from "@/lib/types";

const STORAGE_KEY = "studio-ops-state-v1";

export function usePersistentStudioState() {
  const [state, setState] = useState<StudioState>(initialStudioState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setState(JSON.parse(stored) as StudioState);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [loaded, state]);

  function reset() {
    window.localStorage.removeItem(STORAGE_KEY);
    setState(initialStudioState);
  }

  return { state, setState, reset, loaded };
}
