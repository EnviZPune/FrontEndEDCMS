// src/utils/auth.js

// --- Token helpers ---
export function getToken() {
  const raw = localStorage.getItem("token") || localStorage.getItem("authToken");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // common shapes: { token: "..." } or already the string
    return typeof parsed === "string" ? parsed : (parsed?.token ?? null);
  } catch {
    return raw;
  }
}

export function authHeaders() {
  const t = getToken();
  const h = { "Content-Type": "application/json" };
  if (t && typeof t === "string") h.Authorization = `Bearer ${t}`;
  return h;
}

// --- JWT parsing ---
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
  try {
    // First try direct JSON parse from atob
    const json = atob(b64urlToB64(parts[1]));
    return JSON.parse(json);
  } catch {
    try {
      // Fallback for unicode payloads
      const s = atob(b64urlToB64(parts[1]));
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

// --- Roles ---
function toArray(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  if (typeof x === "string") return [x];
  return [];
}

export function getRoles() {
  const p = getJwtPayload();
  if (!p) return [];

  // Common claim keys across providers / ASP.NET
  const candidates = [
    "role",
    "roles",
    "Role",
    "Roles",
    "permissions",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
  ];

  let roles = [];
  for (const k of candidates) {
    roles = roles.concat(toArray(p[k]));
  }

  // Some tokens put comma-separated roles in a single string
  roles = roles
    .flatMap((r) => (typeof r === "string" ? r.split(",") : r))
    .map((r) => String(r).trim())
    .filter(Boolean);

  return roles;
}

export function isFounder() {
  return getRoles().map((r) => r.toLowerCase()).includes("founder");
}

export function isStaff() {
  const rs = getRoles().map((r) => r.toLowerCase());
  return rs.includes("support") || rs.includes("admin");
}

export function canAccessPanel() {
  return isFounder() || isStaff();
}
