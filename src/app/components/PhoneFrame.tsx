import type { ReactNode } from "react";

/**
 * Mobile-first: the app is designed for a mid/low-end Android. On desktop we render
 * it inside a phone frame centered on the dark backdrop so the prototype reads
 * honestly as a handheld experience and tap targets stay truthful for handoff.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full w-full items-center justify-center p-0 sm:p-6">
      <div className="relative flex h-[100dvh] w-full max-w-[420px] flex-col overflow-hidden bg-paper shadow-lift sm:h-[860px] sm:rounded-[2.4rem] sm:border-[10px] sm:border-[#0a282a]">
        {/* notch */}
        <div className="pointer-events-none absolute left-1/2 top-0 z-30 hidden h-6 w-36 -translate-x-1/2 rounded-b-2xl bg-[#0a282a] sm:block" />
        {children}
      </div>
    </div>
  );
}
