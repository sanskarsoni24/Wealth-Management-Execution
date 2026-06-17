import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * The dev panel's "jump NAV cutoff" toggle. Lives in app state (not the rail) because
 * it's a presentation override: `undefined` = use real clock vs cutoffHour;
 * true = pretend we're past cutoff; false = pretend we're before. Both the countdown
 * component and order placement read this so the demoed copy + the priced navDate agree.
 */
interface DevCutoffCtx {
  forcePassed: boolean | undefined;
  setForcePassed: (v: boolean | undefined) => void;
}

const Ctx = createContext<DevCutoffCtx>({ forcePassed: undefined, setForcePassed: () => {} });

export function DevCutoffProvider({ children }: { children: ReactNode }) {
  const [forcePassed, setForcePassed] = useState<boolean | undefined>(undefined);
  return <Ctx.Provider value={{ forcePassed, setForcePassed }}>{children}</Ctx.Provider>;
}

export function useDevCutoff() {
  return useContext(Ctx);
}
