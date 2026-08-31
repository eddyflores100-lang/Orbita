import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, Sparkles } from "lucide-react";

type Kind = "ok" | "info" | "magic";
interface ToastItem {
  id: number;
  msg: string;
  kind: Kind;
}

const ToastCtx = createContext<(msg: string, kind?: Kind) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((msg: string, kind: Kind = "ok") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-3), { id, msg, kind }]);
    window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3400);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[90] flex w-80 flex-col gap-2">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line2 bg-panel2/95 px-3.5 py-3 shadow-lift backdrop-blur-sm"
            >
              {t.kind === "ok" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint" />}
              {t.kind === "info" && <Info className="mt-0.5 h-4 w-4 shrink-0 text-azure" />}
              {t.kind === "magic" && <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber" />}
              <p className="text-[13px] leading-snug text-paper">{t.msg}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
