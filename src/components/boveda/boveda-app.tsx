"use client";

import { useEffect } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useBoveda } from "@/lib/store";
import Landing from "./landing";
import { LockScreen } from "./gate";
import Workspace from "./workspace";

export default function BovedaApp() {
  const phase = useBoveda((s) => s.phase);
  const busyMsg = useBoveda((s) => s.busyMsg);
  const boot = useBoveda((s) => s.boot);

  useEffect(() => {
    void boot();
  }, [boot]);

  return (
    <div className="min-h-screen flex flex-col">
      {phase === "boot" && (
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
            <p className="text-sm">Comprobando tu bóveda…</p>
          </div>
        </main>
      )}

      {phase === "fresh" && <Landing />}
      {phase === "locked" && <LockScreen />}
      {phase === "unlocked" && <Workspace />}

      {phase === "busy" && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-4 text-center px-6">
            <div className="relative">
              <ShieldCheck className="h-12 w-12 text-primary" aria-hidden />
              <Loader2 className="h-5 w-5 animate-spin text-primary absolute -bottom-1 -right-1" aria-hidden />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">{busyMsg ?? "Trabajando…"}</p>
            <p className="text-xs text-muted-foreground/60">
              La derivación PBKDF2 (310.000 iteraciones) ocurre en tu navegador. Nada sale de aquí.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
