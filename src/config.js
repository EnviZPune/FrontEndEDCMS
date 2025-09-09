// src/config.js
// Centralized config for API + SignalR hubs

// Detect prod (live) vs dev
const isProd =
  typeof window !== 'undefined' &&
  /^https:\/\/(www\.)?triwears\.com$/i.test(window.location.origin);

// Allow CRA env overrides if you use them:
//   REACT_APP_API_BASE=https://api.triwears.com
//   REACT_APP_HUB_URL=https://api.triwears.com
const ENV_API = process.env.REACT_APP_API_BASE;
const ENV_HUB = process.env.REACT_APP_HUB_URL;

// Defaults
const DEFAULT_DEV_API = 'http://localhost:8000';
const DEFAULT_PROD_API = 'https://api.triwears.com';

// Base API host (no trailing slash)
export const API_BASE = ENV_API || (isProd ? DEFAULT_PROD_API : DEFAULT_DEV_API);

// SignalR hubs live on the same host as the API
// Older code imports HUB_URL, so we export it for compatibility.
export const HUB_URL = ENV_HUB || API_BASE;

// Optional convenience endpoints (use if helpful)
export const NOTIFICATION_HUB = `${HUB_URL}/notificationHub`;
export const SUPPORT_HUB = `${HUB_URL}/supportHub`;
