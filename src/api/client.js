// src/api/client.js
import { createApiClient } from "../error-hooks-kit/hooks/useApiClient";

// CRA/CRACO uses process.env.REACT_APP_*
// (also accept VITE_API_BASE if you ever migrate, but only read from process.env)
const ENV_BASE =
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.REACT_APP_API_BASE || process.env.VITE_API_BASE)) ||
  "";

export const api = createApiClient({
  // normalize (strip trailing slashes), and fallback to your prod API
  baseURL: (ENV_BASE || "https://api.triwears.com/api").replace(/\/+$/, ""),
  getAuthToken: () => {
    try {
      return typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
    } catch {
      return null;
    }
  },
  onUnauthorized: () => {
    if (typeof window !== "undefined") window.location.href = "/login";
  },
});
