import { useMemo, useRef } from "react";
import { useAuth } from "./useAuth";

/** CRA/CRACO env: set REACT_APP_API_BASE_URL in .env */
const API_BASE =
  (typeof process !== "undefined" &&
    process.env &&
    process.env.REACT_APP_API_BASE_URL) ||
  "https://api.triwears.com/api";

/** App-wide normalized error */
export class AppError extends Error {
  /**
   * @param {{ kind?: string, status?: number, message?: string, cause?: any, fieldErrors?: Record<string,string>|null, retriable?: boolean, meta?: any }} o
   */
  constructor(o = {}) {
    super(o.message || o.kind || "Error");
    this.name = "AppError";
    this.kind = o.kind || "Unknown";
    this.status = o.status;
    this.cause = o.cause;
    this.fieldErrors = o.fieldErrors || null;
    this.retriable = !!o.retriable;
    this.meta = o.meta;
  }
}

function parseValidationErrors(json) {
  try {
    if (json && json.errors && typeof json.errors === "object") {
      const map = {};
      for (const [field, arr] of Object.entries(json.errors)) {
        if (Array.isArray(arr) && arr.length) {
          const k = field.charAt(0).toLowerCase() + field.slice(1);
          map[k] = String(arr[0]);
        }
      }
      return Object.keys(map).length ? map : null;
    }
  } catch {}
  return null;
}

async function readBody(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      return { json: await res.json() };
    } catch {
      try {
        return { text: await res.text() };
      } catch {
        return {};
      }
    }
  }
  try {
    return { text: await res.text() };
  } catch {
    return {};
  }
}

async function errorFromResponse(res) {
  const { json, text } = await readBody(res);
  const status = res.status;
  let kind = "Unknown";
  if (status === 400) kind = "BadRequest";
  else if (status === 401) kind = "Unauthorized";
  else if (status === 403) kind = "Forbidden";
  else if (status === 404) kind = "NotFound";
  else if (status === 409) kind = "Conflict";
  else if (status === 429) kind = "TooManyRequests";
  else if (status >= 500) kind = "ServerError";

  const fieldErrors = parseValidationErrors(json);
  let message;
  if (fieldErrors) {
    message = json?.title || "Please fix the highlighted fields.";
  } else if (json && typeof json === "object") {
    message = json.message || json.title || json.detail || text;
  } else {
    message = text;
  }
  if (!message || !String(message).trim()) message = res.statusText || "Request failed";

  const retriable = kind === "ServerError" || kind === "TooManyRequests";
  return new AppError({ kind, status, message, fieldErrors, retriable, meta: { json, text } });
}

function normalizeThrown(err) {
  if (err instanceof AppError) return err;
  if (err?.name === "AbortError")
    return new AppError({ kind: "Canceled", message: "Request was canceled." });
  if (err?.code === "ECONNABORTED" || err?.name === "TimeoutError")
    return new AppError({ kind: "Timeout", message: "The request timed out. Please try again." });
  if (err?.name === "TypeError" && /fetch/i.test(String(err.message || "")))
    return new AppError({ kind: "Network", message: "Network error. Check your connection.", cause: err });
  if (err instanceof SyntaxError)
    return new AppError({ kind: "Parse", message: "Received malformed response.", cause: err });
  return new AppError({ kind: "Unknown", message: err?.message || "Unexpected error", cause: err });
}

export function useApiClient({ timeoutMs = 20000 } = {}) {
  const { token, logout } = useAuth() || {};
  const inflight = useRef(new Set());

  // Stable defaults which update when token changes
  const defaultHeaders = useMemo(() => {
    const hdrs = { Accept: "application/json, text/plain;q=0.9, */*;q=0.8" };
    if (token) hdrs.Authorization = `Bearer ${token}`;
    return hdrs;
  }, [token]);

  /** Core request w/ timeout, abort, and robust error parsing */
  const request = async (
    endpoint,
    { method = "GET", body, headers = {}, signal, ...opts } = {}
  ) => {
    const url = `${API_BASE.replace(/\/+$/, "")}${endpoint}`;
    const controller = new AbortController();

    // Bridge external signal to our controller (so either can cancel)
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    inflight.current.add(controller);
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const init = {
        method,
        signal: controller.signal,
        headers: { ...defaultHeaders, ...headers },
        ...opts,
      };

      const isForm = body instanceof FormData;
      if (body !== undefined) {
        if (isForm) {
          init.body = body; // let browser set boundary; do NOT set content-type
        } else {
          init.headers["Content-Type"] = "application/json";
          init.body = JSON.stringify(body);
        }
      }

      const res = await fetch(url, init);

      // No Content
      if (res.status === 204) return null;

      if (!res.ok) {
        const err = await errorFromResponse(res);
        // Handle 401 centrally
        if (err.kind === "Unauthorized") {
          try {
            logout?.();
          } catch {}
          if (typeof window !== "undefined") window.location.href = "/login";
        }
        throw err;
      }

      // Parse success body
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) return await res.json();
      const txt = await res.text();
      if (/^\s*(true|false|null)\s*$/i.test(txt)) return JSON.parse(txt.toLowerCase());
      if (/^\s*-?\d+(\.\d+)?\s*$/.test(txt)) return Number(txt);
      return txt;
    } catch (e) {
      throw normalizeThrown(e);
    } finally {
      clearTimeout(timer);
      inflight.current.delete(controller);
    }
  };

  // Shorthand methods (stable identities)
  const get   = (endpoint, opts)           => request(endpoint, { method: "GET",    ...opts });
  const post  = (endpoint, body, opts)     => request(endpoint, { method: "POST", body, ...opts });
  const put   = (endpoint, body, opts)     => request(endpoint, { method: "PUT",  body, ...opts });
  const patch = (endpoint, body, opts)     => request(endpoint, { method: "PATCH", body, ...opts });
  const del   = (endpoint, opts)           => request(endpoint, { method: "DELETE", ...opts });

  const cancelAll = () => {
    for (const c of inflight.current) c.abort();
    inflight.current.clear();
  };

  return { API_BASE, get, post, put, patch, del, cancelAll };
}
