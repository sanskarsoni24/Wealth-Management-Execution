import { useEffect, useRef, useState, useCallback } from "react";
import { subscribe } from "@rail/index";

/**
 * The app↔rail liveness contract. Polls a consumer-shaped getter on the rail at the
 * resource's hinted cadence AND re-reads instantly whenever the rail bus emits a
 * transition for the matching resource type — that bus emission is the "webhook"
 * that makes the payment screen feel live, not just polled.
 */
export function useRailResource<T>(
  getter: () => T | undefined,
  opts: { pollMs?: number; resourceMatch?: string; enabled?: boolean } = {},
): { data: T | undefined; refetch: () => void } {
  const { pollMs = 1000, resourceMatch, enabled = true } = opts;
  const getterRef = useRef(getter);
  getterRef.current = getter;
  const [data, setData] = useState<T | undefined>(() => getter());

  const refetch = useCallback(() => {
    setData(getterRef.current());
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refetch();
    const interval = setInterval(refetch, pollMs);
    const unsub = subscribe((e) => {
      if (!resourceMatch || e.resource === resourceMatch || e.resource === "system") {
        refetch();
      }
    });
    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [pollMs, resourceMatch, enabled, refetch]);

  return { data, refetch };
}

/** A live wall-clock ticker (for the cutoff countdown + UPI expiry timer). */
export function useTicker(intervalMs = 1000): number {
  const [, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((n) => n + 1), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return Date.now();
}
