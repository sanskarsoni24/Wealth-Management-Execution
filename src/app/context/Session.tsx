import { createContext, useContext, useState, type ReactNode } from "react";
import type { Nominee } from "@rail/types";
import { seededSession } from "@rail/index";

/**
 * Session + onboarding draft. The "ghost user" resume story lives here: a draft is
 * accumulated across gates so a user who drops mid-flow and re-enters the same PAN
 * lands at their furthest completed step rather than restarting. (State resets on
 * reload, like the rest of the prototype.)
 */
export interface OnboardingDraft {
  pan?: string;
  mobile?: string;
  kycId?: string;
  ekycId?: string;
  holderName?: string;
  taxResident?: boolean;
  nominee?: Nominee | null;
  nomineeOptOut?: boolean;
  accountId?: string;
  mandateId?: string;
  /** furthest route reached, for the resume nudge */
  furthestStep?: string;
}

export interface ActiveSession {
  accountId: string;
  holderName: string;
  pan: string;
}

interface SessionCtx {
  session: ActiveSession | null;
  setSession: (s: ActiveSession | null) => void;
  draft: OnboardingDraft;
  patchDraft: (p: Partial<OnboardingDraft>) => void;
  resetDraft: () => void;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  // Onboarding is removed for this execution-focused build — boot straight into the
  // seeded, fully set-up investor so every execution flow is reachable immediately.
  const [session, setSession] = useState<ActiveSession | null>(() => seededSession());
  const [draft, setDraft] = useState<OnboardingDraft>({});

  const patchDraft = (p: Partial<OnboardingDraft>) => setDraft((d) => ({ ...d, ...p }));
  const resetDraft = () => setDraft({});

  return (
    <Ctx.Provider value={{ session, setSession, draft, patchDraft, resetDraft }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSession(): SessionCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used within SessionProvider");
  return v;
}
