const API_BASE = process.env.REACT_APP_API_BASE || "https://api.triwears.com/api/api";
const HUB_URL  = process.env.REACT_APP_SUPPORT_HUB || API_BASE.replace(/\/api$/, "") + "/supportHub";
export { API_BASE, HUB_URL };
