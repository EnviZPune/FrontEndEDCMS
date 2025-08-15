import { emitNetworkError } from "./errorBus";
import { normalizeErrorPayload } from "./normalizeError";

export function installFetchInterceptor() {
  if (typeof window === "undefined" || !window.fetch || window.__fetch_interceptor_installed__) return;
  window.__fetch_interceptor_installed__ = true;

  const origFetch = window.fetch;

  window.fetch = async (input, init) => {
    let res;
    try {
      res = await origFetch(input, init);
    } catch (networkErr) {
      emitNetworkError({
        status: 0,
        url: typeof input === "string" ? input : (input?.url || "unknown"),
        messages: [networkErr?.message || "Network error. Check your connection."],
      });
      throw networkErr;
    }

    // If response is not ok, try to read its body (via clone)
    if (!res.ok) {
      const url = typeof input === "string" ? input : (input?.url || res.url || "unknown");
      let payload = null;
      try {
        const ct = res.headers.get("content-type") || "";
        const clone = res.clone();
        if (ct.includes("application/json") || ct.includes("problem+json")) {
          payload = await clone.json();
        } else {
          payload = await clone.text();
        }
      } catch {
        payload = null;
      }

      const { messages, fields } = normalizeErrorPayload(payload, res.status);
      // Emit immediately as toast/banner for the user
      emitNetworkError({ status: res.status, url, messages, fields });
    }

    return res; // preserve original behavior so existing code keeps working
  };
}
