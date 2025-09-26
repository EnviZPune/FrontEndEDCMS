import { AppError } from "../lib/errors";
import { emitError } from "./useGlobalErrorBus";

export function attachUnhandledErrorListeners() {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (e) => {
    const er = e?.error instanceof Error ? e.error : new AppError({ kind: "Unknown", message: String(e?.message || "Script error") });
    emitError(er);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e?.reason;
    const msg = reason?.message || (typeof reason === "string" ? reason : "Unhandled rejection");
    emitError(new AppError({ kind: "Unknown", message: msg, cause: reason }));
  });
}
