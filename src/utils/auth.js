// src/utils/auth.js

// ---------- Token helpers ----------
export function getToken() {
  // Support either a raw string token or a stored JSON object { token: "..." }
  const raw = localStorage.getItem("token") || localStorage.getItem("authToken");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : (parsed?.token ?? null);
  } catch {
    return raw;
  }
}

/**
 * Build Authorization + optional Content-Type headers.
 * - json=true  -> adds "Content-Type: application/json"
 * - bearer=true -> attaches Bearer token if available
 * - extra       -> merge in any extra headers (last wins)
 *
 * For file uploads (multipart/form-data), call: authHeaders({ json: false })
 */
export function authHeaders({ json = true, bearer = true, extra = {} } = {}) {
  const h = {};
  if (json) h["Content-Type"] = "application/json";
  if (bearer) {
    const t = getToken();
    if (t) h.Authorization = `Bearer ${t}`;
  }
  return { ...h, ...extra };
}

// Convenience alias specifically for uploads (no Content-Type so the browser sets boundary)
export const authHeadersUpload = (opts = {}) => authHeaders({ json: false, ...opts });

// ---------- JWT helpers ----------
function b64urlToB64(s) {
  let out = (s || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = out.length % 4;
  if (pad) out += "=".repeat(4 - pad);
  return out;
}

export function getJwtPayload() {
  const t = getToken();
  if (!t || typeof t !== "string") return null;
  const parts = t.split(".");
  if (parts.length < 2) return null;
  const mid = parts[1];

  try {
    // Most payloads
    return JSON.parse(atob(b64urlToB64(mid)));
  } catch {
    // Fallback for unicode payloads
    try {
      const s = atob(b64urlToB64(mid));
      const json = decodeURIComponent(
        Array.prototype.map
          .call(s, (c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
}

// Optional: extract a user id from common claim keys
export function getUserIdFromToken() {
  const p = getJwtPayload();
  if (!p) return null;
  const keys = [
    "nameid",
    "sub",
    "uid",
    "userId",
    "UserId",
    "user_id",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
  ];
  for (const k of keys) {
    const v = p[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

// ---------- Roles & access ----------
function toArray(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  if (typeof x === "string") return [x];
  return [];
}

export function getRoles() {
  const p = getJwtPayload();
  if (!p) return [];

  // Common role/permission claim keys (includes ASP.NET Core default role claim)
  const candidates = [
    "role",
    "roles",
    "Role",
    "Roles",
    "permissions",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
  ];

  let roles = [];
  for (const k of candidates) roles = roles.concat(toArray(p[k]));

  // Split any comma-separated strings and normalize
  return roles
    .flatMap((r) => (typeof r === "string" ? r.split(",") : r))
    .map((r) => String(r).trim())
    .filter(Boolean);
}

export const hasRole = (role) =>
  getRoles().some((r) => r.toLowerCase() === String(role).toLowerCase());

export const isAdmin = () => hasRole("admin");
export const isSupport = () => hasRole("support") || hasRole("agent");
export const isFounder = () => hasRole("founder");

// Your server policies use Admin-only for panel access.
// If you want to keep it strict, use isAdmin() here.
export const canAccessPanel = () => isAdmin();
