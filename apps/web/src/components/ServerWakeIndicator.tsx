import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";

// Abaixo disso a API respondeu rápido o bastante para não valer mostrar aviso
const SLOW_AFTER_MS = 1500;
const RETRY_MS = 4000;

type Status = "checking" | "waking" | "online" | "idle";

/**
 * Faz um ping leve na API ao abrir o app. Em hospedagem gratuita (Render) a API
 * hiberna e leva até ~1 min para acordar; enquanto isso mostramos um aviso em vez
 * de deixar a tela parecer travada.
 */
export function ServerWakeIndicator() {
  const [status, setStatus] = useState<Status>("checking");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();
    const slowTimer = window.setTimeout(() => !cancelled && setStatus("waking"), SLOW_AFTER_MS);
    const tick = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    let retryTimer: number | undefined;
    let hideTimer: number | undefined;

    const markOnline = () => {
      if (cancelled) return;
      window.clearTimeout(slowTimer);
      window.clearInterval(tick);
      setStatus((prev) => {
        if (prev === "waking") {
          hideTimer = window.setTimeout(() => !cancelled && setStatus("idle"), 2000);
          return "online";
        }
        return "idle";
      });
    };

    const ping = () => {
      api
        .get("/health/live", { timeout: 70_000 })
        .then(markOnline)
        .catch((error) => {
          if (cancelled) return;
          const status: number | undefined = error?.response?.status;
          // Qualquer resposta HTTP (ex.: 404 numa API sem /health/live) prova que o servidor
          // está de pé. Só erro de rede ou 502/503/504 do proxy significam "ainda acordando".
          if (status !== undefined && ![502, 503, 504].includes(status)) {
            markOnline();
            return;
          }
          retryTimer = window.setTimeout(ping, RETRY_MS);
        });
    };
    ping();

    return () => {
      cancelled = true;
      window.clearTimeout(slowTimer);
      window.clearTimeout(retryTimer);
      window.clearTimeout(hideTimer);
      window.clearInterval(tick);
    };
  }, []);

  const visible = status === "waking" || status === "online";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-20 left-1/2 z-60 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 border border-ink bg-card px-4 py-3 shadow-hard md:bottom-6"
        >
          {status === "waking" ? (
            <>
              <Loader2 className="size-4 shrink-0 animate-spin text-brand" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Acordando o servidor…</p>
                <p className="text-xs text-muted-foreground">
                  Ele hiberna quando fica parado. Pode levar até 1 min.
                </p>
              </div>
              <span className="label-tech tabular-nums text-muted-foreground">{elapsed}s</span>
            </>
          ) : (
            <>
              <span className="size-2 shrink-0 bg-success" />
              <p className="text-sm font-medium">Servidor online</p>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
