/**
 * @typedef {'BadRequest'|'Unauthorized'|'Forbidden'|'NotFound'|'Conflict'|'TooManyRequests'|'ServerError'|'Network'|'Timeout'|'Parse'|'Canceled'|'Unknown'} ApiErrorKind
 */
export class AppError extends Error {
  constructor({ kind, status, message, cause, fieldErrors, retriable, meta } = {}) {
    super(message || kind);
    this.name = "AppError";
    this.kind = kind || "Unknown";
    this.status = status;
    this.cause = cause;
    this.fieldErrors = fieldErrors || null;
    this.retriable = !!retriable;
    this.meta = meta;
  }
}

export function parseValidationErrors(body) {
  try {
    if (body && typeof body === "object" && body.errors && typeof body.errors === "object") {
      const map = {};
      for (const [field, messages] of Object.entries(body.errors)) {
        if (Array.isArray(messages) && messages.length) {
          const k = field.charAt(0).toLowerCase() + field.slice(1);
          map[k] = String(messages[0]);
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
    try { return { json: await res.json() }; }
    catch { try { return { text: await res.text() }; } catch { return {}; } }
  }
  try { return { text: await res.text() }; } catch { return {}; }
}

export async function errorFromResponse(res) {
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

export function normalizeThrown(err) {
  if (err instanceof AppError) return err;
  if (err?.name === "AbortError") return new AppError({ kind: "Canceled", message: "Request was canceled." });
  if (err?.code === "ECONNABORTED" || err?.name === "TimeoutError")
    return new AppError({ kind: "Timeout", message: "The request timed out. Please try again." });
  if (err?.name === "TypeError" && /fetch/i.test(String(err.message || "")))
    return new AppError({ kind: "Network", message: "Network error. Check your connection.", cause: err });
  if (err instanceof SyntaxError)
    return new AppError({ kind: "Parse", message: "Received malformed response.", cause: err });
  return new AppError({ kind: "Unknown", message: err?.message || "Unexpected error", cause: err });
}
