import { errorFromResponse, normalizeThrown } from "../lib/errors";

export function createApiClient(options) {
  const baseURL = (options?.baseURL || "").replace(/\/+$/,"");
  const getAuthToken = options?.getAuthToken;
  const timeoutMs = options?.timeoutMs ?? 20000;
  const onUnauthorized = options?.onUnauthorized;
  const inflight = new Set();

  async function request(method, url, body, init) {
    const controller = new AbortController();
    inflight.add(controller);
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const req = {
        method,
        signal: controller.signal,
        headers: { "Accept": "application/json, text/plain;q=0.9, */*;q=0.8" },
        ...init
      };
      const token = getAuthToken?.();
      if (token) req.headers["Authorization"] = `Bearer ${token}`;
      if (body != null) {
        if (body instanceof FormData) req.body = body;
        else { req.headers["Content-Type"] = "application/json"; req.body = JSON.stringify(body); }
      }
      const full = url.startsWith("http") ? url : baseURL + url;
      const res = await fetch(full, req);
      if (!res.ok) {
        const err = await errorFromResponse(res);
        if (err.kind === "Unauthorized" && onUnauthorized) onUnauthorized();
        throw err;
      }
      if (res.status === 204) return null;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) return await res.json();
      const txt = await res.text();
      if (/^\s*(true|false|null)\s*$/i.test(txt)) return JSON.parse(txt.toLowerCase());
      if (/^\s*-?\d+(\.\d+)?\s*$/.test(txt)) return Number(txt);
      return txt;
    } catch (e) {
      throw normalizeThrown(e);
    } finally {
      clearTimeout(id);
      inflight.delete(controller);
    }
  }

  return {
    get: (url, init) => request("GET", url, null, init),
    post: (url, body, init) => request("POST", url, body, init),
    put: (url, body, init) => request("PUT", url, body, init),
    patch: (url, body, init) => request("PATCH", url, body, init),
    del: (url, init) => request("DELETE", url, null, init),
    cancelAll: () => { for (const c of inflight) c.abort(); inflight.clear(); },
  };
}
