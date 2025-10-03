import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Map as PigeonMap, Marker } from "pigeon-maps";
import { FaClock, FaPhoneAlt, FaInfoCircle, FaHeart, FaFlag } from "react-icons/fa"; // REPORT: added FaFlag
import { useTranslation } from "react-i18next";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "../Styling/sd-shopdetail.css";

const API_BASE = "https://api.triwears.com"; 
const PAGE_SIZE = 8;

/* ====================== THEME-AWARE DEFAULT IMAGES ====================== */
const DEFAULT_LOGO_LIGHT = "/Assets/default-shop-logo-light.png";
const DEFAULT_LOGO_DARK = "/Assets/default-shop-logo-dark.png";
const DEFAULT_COVER_LIGHT = "/Assets/default-shop-cover-light.png";
const DEFAULT_COVER_DARK = "/Assets/default-shop-cover-dark.png";
const DEFAULT_PRODUCT_LIGHT = "/Assets/default-product-light.png";
const DEFAULT_PRODUCT_DARK  = "/Assets/default-product-dark.png";
/* ======================================================================= */

/* Loading Spinners */
const LOADING_GIF_LIGHT = "/Assets/triwears-black-loading.gif";
const LOADING_GIF_DARK  = "/Assets/triwears-white-loading.gif";

/* ---------- Opening hours helpers ---------- */
const DAY_KEYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const ABBR_SHORT = ["Mo","Tu","We","Th","Fr","Sa","Su"];
const DAY_LABELS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const getDefaultSchedule = () => ({
  monday: { open: "09:00", close: "18:00", closed: false },
  tuesday: { open: "09:00", close: "18:00", closed: false },
  wednesday: { open: "09:00", close: "18:00", closed: false },
  thursday: { open: "09:00", close: "18:00", closed: false },
  friday: { open: "09:00", close: "18:00", closed: false },
  saturday: { open: "10:00", close: "14:00", closed: true },
  sunday: { open: "10:00", close: "14:00", closed: true }
});

const toHHMM = (s) => {
  if (typeof s !== "string") return "00:00";
  const [hRaw, mRaw] = s.split(":");
  const h = Math.max(0, Math.min(23, parseInt(hRaw, 10) || 0));
  const m = Math.max(0, Math.min(59, parseInt(mRaw ?? "0", 10) || 0));
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
};
const fmtTime = (t) => toHHMM(t);
const sameTime = (a, b) => a && b && a.open === b.open && a.close === b.close && !a.closed && !b.closed;

const normalizeSchedule = (obj) => {
  const base = getDefaultSchedule();
  try {
    for (const k of DAY_KEYS) {
      const d = obj?.[k] ?? {};
      base[k] = {
        open: toHHMM(d.open ?? base[k].open),
        close: toHHMM(d.close ?? base[k].close),
        closed: Boolean(d.closed)
      };
    }
  } catch {
    return getDefaultSchedule();
  }
  return base;
};

const parseCompact = (raw) => {
  const base = getDefaultSchedule();
  for (const k of DAY_KEYS) base[k].closed = true;

  const str = String(raw || "").trim();
  if (!str) return getDefaultSchedule();
  const lower = str.toLowerCase();
  if (lower === "closed") return base;

  const mDaily = str.match(/^\s*Daily\s+(\d{1,2}(?::\d{2})?)\s*-\s*(\d{1,2}(?::\d{2})?)\s*$/i);
  if (mDaily) {
    const open = toHHMM(mDaily[1]), close = toHHMM(mDaily[2]);
    for (const k of DAY_KEYS) base[k] = { open, close, closed: false };
    return base;
  }

  const dayToken = "(?:Mo|Tu|We|Th|Fr|Sa|Su|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)";
  const re = new RegExp(
    `(${dayToken}(?:\\s*-\\s*${dayToken})?)\\s+(Closed|closed|(\\d{1,2}(?::\\d{2})?)\\s*-\\s*(\\d{1,2}(?::\\d{2})?))`,"g"
  );

  const dayNameToIndex = (token) => {
    const t = token.trim().toLowerCase();
    const full = DAY_LABELS.findIndex((d) => d.toLowerCase() === t);
    if (full !== -1) return full;
    const short = ABBR_SHORT.findIndex((s) => s.toLowerCase() === t);
    return short;
  };

  let m, matched = false;
  while ((m = re.exec(str)) !== null) {
    matched = true;
    const dayPart = m[1];
    const isClosed = String(m[2]).toLowerCase() === "closed";
    let open = null, close = null;
    if (!isClosed) {
      open = toHHMM(m[3]); close = toHHMM(m[4]);
    }
    const applyRange = (startIdx, endIdx) => {
      for (let i = startIdx; i <= endIdx; i++) {
        base[DAY_KEYS[i]] = isClosed ? { ...base[DAY_KEYS[i]], closed: true } : { open, close, closed: false };
      }
    };
    if (dayPart.includes("-")) {
      const [a, b] = dayPart.split("-").map((s) => s.trim());
      const sIdx = dayNameToIndex(a);
      const eIdx = dayNameToIndex(b);
      if (sIdx !== -1 && eIdx !== -1 && sIdx <= eIdx) applyRange(sIdx, eIdx);
    } else {
      const idx = dayNameToIndex(dayPart);
      if (idx !== -1) applyRange(idx, idx);
    }
  }
  return matched ? base : getDefaultSchedule();
};

const parseIncomingOpeningHours = (incoming) => {
  if (!incoming) return getDefaultSchedule();
  if (typeof incoming === "object") return normalizeSchedule(incoming);
  if (typeof incoming === "string") {
    const trimmed = incoming.trim();
    if (!trimmed) return getDefaultSchedule();
    if (trimmed.toLowerCase() === "closed") {
      const all = getDefaultSchedule();
      for (const k of DAY_KEYS) all[k].closed = true;
      return all;
    }
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const obj = JSON.parse(trimmed);
        if (obj && typeof obj === "object") return normalizeSchedule(obj);
      } catch {}
    }
    return parseCompact(trimmed);
  }
  return getDefaultSchedule();
};

const compactSchedule = (schedule, maxLen = 60) => {
  const days = DAY_KEYS.map((k) => schedule[k]);
  const openMask = days.map((d) => !d.closed);
  if (openMask.every((v) => !v)) return "Closed";

  const firstOpenIdx = openMask.findIndex(Boolean);
  const firstOpen = days[firstOpenIdx];
  const allSame =
    openMask.every((v) => v === openMask[firstOpenIdx]) && !firstOpen.closed
      ? days.every((d) => sameTime(d, firstOpen))
      : false;

  if (allSame) {
    const token = `Daily ${fmtTime(firstOpen.open)} - ${fmtTime(firstOpen.close)}`;
    return token.length <= maxLen ? token : "Varies by day";
  }

  const groups = [];
  let i = 0;
  while (i < 7) {
    if (!openMask[i]) { i++; continue; }
    const start = i;
    const ref = days[i];
    while (i + 1 < 7 && openMask[i + 1] && sameTime(days[i + 1], ref)) i++;
    const end = i;
    groups.push({ start, end, open: fmtTime(ref.open), close: fmtTime(ref.close) });
    i++;
  }

  const tokens = groups.map((g) => {
    const dayPart = g.start === g.end ? DAY_LABELS[g.start] : `${DAY_LABELS[g.start]}-${DAY_LABELS[g.end]}`;
    return `${dayPart} ${g.open} - ${g.close}`;
  });

  let out = "";
  for (const t of tokens) {
    const candidate = out ? `${out} ${t}` : t;
    if (candidate.length <= maxLen) out = candidate; else break;
  }
  if (!out) out = tokens[0] || "Varies by day";
  if (out.length > maxLen) out = "Varies by day";
  return out;
};

const isOpenNow = (schedule, now = new Date()) => {
  const idx = (now.getDay() + 6) % 7;
  const d = schedule[DAY_KEYS[idx]];
  if (!d || d.closed) return false;
  const [oh, om] = d.open.split(":").map(Number);
  const [ch, cm] = d.close.split(":").map(Number);
  const s = new Date(now); s.setHours(oh, om, 0, 0);
  const e = new Date(now); e.setHours(ch, cm, 0, 0);
  return now >= s && now <= e;
};

const nextTransitionInfo = (schedule, now = new Date()) => {
  const todayIdx = (now.getDay() + 6) % 7;
  const today = schedule[DAY_KEYS[todayIdx]];
  const res = (type, timeStr, dayIdx, isToday) => ({ type, timeStr: fmtTime(timeStr), dayIdx, isToday });
  if (today && !today.closed) {
    const [oh, om] = today.open.split(":").map(Number);
    const [ch, cm] = today.close.split(":").map(Number);
    const openAt = new Date(now); openAt.setHours(oh, om, 0, 0);
    const closeAt = new Date(now); closeAt.setHours(ch, cm, 0, 0);
    if (now < openAt) return res("opens", today.open, todayIdx, true);
    if (now >= openAt && now < closeAt) return res("closes", today.close, todayIdx, true);
  }
  for (let offset = 1; offset <= 7; offset++) {
    const idx = (todayIdx + offset) % 7;
    const d = schedule[DAY_KEYS[idx]];
    if (d && !d.closed) return res("opens", d.open, idx, false);
  }
  return { type: "none" };
};

/* ----------------------- Token & headers helpers ----------------------- */
const getToken = () => {
  const raw = localStorage.getItem("token") || localStorage.getItem("authToken");
  if (!raw || raw.trim() === "") return null;
  try { const parsed = JSON.parse(raw); return parsed.token || parsed; } catch { return raw.replace(/^"|"$/g, ""); }
};
const authHeaders = (token) => (token ? { Authorization: `Bearer ${token}` } : {});
/* ---------------------------------------------------------------------- */

/* REPORT: enums synced with backend Application.DTOs.ShopReportReason */
const REPORT_REASONS = [
  { value: 1,  label: "Scam or fraud" },
  { value: 2,  label: "Counterfeit goods" },
  { value: 3,  label: "Inaccurate listing" },
  { value: 4,  label: "Offensive content" },
  { value: 5,  label: "Safety concern" },
  { value: 6,  label: "Spam" },
  { value: 99, label: "Other" }
];

export default function ShopDetailsPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation("shopdetails");

  const [shop, setShop] = useState(null);
  const [routeName, setRouteName] = useState("");
  const [schedule, setSchedule] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(0);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isFavorited, setIsFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  const [pinnedIds, setPinnedIds] = useState(() => new Set());
  const [pinnedOrder, setPinnedOrder] = useState(() => new Map());

  const [copied, setCopied] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(() =>
    typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  // REPORT: modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0].value);
  const [reportOther, setReportOther] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportResult, setReportResult] = useState(null); // { ok:bool, msg:string }

  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setIsDarkMode(e.matches);
    if (mql.addEventListener) mql.addEventListener("change", handler);
    else if (mql.addListener) mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", handler);
      else if (mql.removeListener) mql.removeListener(handler);
    };
  }, []);

  const token = useMemo(() => getToken(), []);

  useEffect(() => {
    if (!token) {
      setError(t("errors.login_required"));
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const shopRes = await fetch(`${API_BASE}/api/Business/slug/${encodeURIComponent(slug)}`, {
          headers: { ...authHeaders(token) }
        });
        if (shopRes.status === 401) { navigate("/login"); return; }
        if (!shopRes.ok) throw new Error(`Shop fetch failed: ${shopRes.status}`);
        const shopData = await shopRes.json();

        setShop(shopData);
        document.title = shopData.name || "Shop";

        const sched = parseIncomingOpeningHours(shopData.openingHours);
        setSchedule(sched);
        const computedOpen = isOpenNow(sched);
        const manual = typeof shopData.isManuallyOpen === "boolean" ? shopData.isManuallyOpen : null;
        setIsOpen(manual ?? computedOpen);

        if (shopData.location?.includes(",")) {
          const [lat, lon] = shopData.location.split(",").map((n) => parseFloat(String(n).trim()));
          if (!isNaN(lat) && !isNaN(lon)) {
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((j) => setRouteName(j?.display_name || shopData.location))
              .catch(() => setRouteName(shopData.location));
          }
        }

        const bizId = shopData.businessId;
        const [catsRes, itemsRes] = await Promise.all([
          fetch(`${API_BASE}/api/ClothingCategory/business/${bizId}`, { headers: { ...authHeaders(token) } }),
          fetch(`${API_BASE}/api/ClothingItem/business/${bizId}`, { headers: { ...authHeaders(token) } })
        ]);

        const cats = catsRes.ok ? await catsRes.json() : [];
        const allItems = itemsRes.ok ? await itemsRes.json() : [];

        setCategories([{ clothingCategoryId: 0, name: t("categories_all") }, ...cats]);
        setItems(Array.isArray(allItems) ? allItems : []);
      } catch (err) {
        console.error(err);
        setError(t("errors.load_failed"));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, token, navigate, t]);

  useEffect(() => {
    if (!token || !shop?.businessId) return;
    fetch(`${API_BASE}/api/favorites/${shop.businessId}/is-favorited`, {
      headers: { ...authHeaders(token) }
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && typeof j.isFavorited !== "undefined") setIsFavorited(!!j.isFavorited);
      })
      .catch(() => {});
  }, [token, shop?.businessId]);

  useEffect(() => {
    if (!token || !shop?.businessId) return;
    fetch(`${API_BASE}/api/ClothingItem/clothingItems/${shop.businessId}/pinned?pageNumber=1&pageSize=200`,
      { headers: { ...authHeaders(token) } }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.items ?? data?.Items ?? data?.data ?? [];
        const ids = new Set(); const order = new Map();
        list.forEach((ci, i) => {
          const id = ci?.clothingItemId ?? ci?.clothingItemID ?? ci?.id ?? null;
          if (id != null) { ids.add(id); const po = typeof ci?.pinOrder === "number" ? ci.pinOrder : i + 1; order.set(id, po); }
        });
        setPinnedIds(ids); setPinnedOrder(order);
      })
      .catch(() => { setPinnedIds(new Set()); setPinnedOrder(new Map()); });
  }, [token, shop?.businessId]);

  async function toggleFavorite() {
    if (!token || !shop?.businessId || favLoading) return;
    setFavLoading(true);
    try {
      if (isFavorited) {
        const r = await fetch(`${API_BASE}/api/favorites/${shop.businessId}`, {
          method: "DELETE", headers: { ...authHeaders(token) }
        });
        if (r.status === 401) return navigate("/login");
        if (r.ok) setIsFavorited(false);
      } else {
        const r = await fetch(`${API_BASE}/api/favorites/${shop.businessId}`, {
          method: "POST", headers: { ...authHeaders(token) }
        });
        if (r.status === 401) return navigate("/login");
        if (r.ok) setIsFavorited(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFavLoading(false);
    }
  }

  useEffect(() => {
    const filtered = selectedCategoryId === 0 ? items : items.filter((i) => i.clothingCategoryId === selectedCategoryId);
    setTotalPages(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
    setPage(1);
  }, [items, selectedCategoryId]);

  const filteredItems = useMemo(
    () => (selectedCategoryId === 0 ? items : items.filter((i) => i.clothingCategoryId === selectedCategoryId)),
    [items, selectedCategoryId]
  );

  const sortedFilteredItems = useMemo(() => {
    const arr = [...filteredItems];
    arr.sort((a, b) => {
      const aPinned = pinnedIds.has(a.clothingItemId);
      const bPinned = pinnedIds.has(b.clothingItemId);
      if (aPinned && bPinned) {
        const ao = pinnedOrder.get(a.clothingItemId);
        const bo = pinnedOrder.get(b.clothingItemId);
        if (typeof ao === "number" && typeof bo === "number" && ao !== bo) return ao - bo;
        const byName = String(a.name ?? "").localeCompare(String(b.name ?? ""));
        if (byName !== 0) return byName;
        return (a.clothingItemId ?? 0) - (b.clothingItemId ?? 0);
      }
      if (aPinned) return -1;
      if (bPinned) return 1;
      return 0;
    });
    return arr;
  }, [filteredItems, pinnedIds, pinnedOrder]);

  const pageItems = useMemo(() => {
    const startIdx = (page - 1) * PAGE_SIZE;
    return sortedFilteredItems.slice(startIdx, startIdx + PAGE_SIZE);
  }, [sortedFilteredItems, page]);

  const coords = useMemo(() => {
    if (!shop?.location?.includes(",")) return null;
    const [lat, lon] = shop.location.split(",").map((n) => parseFloat(String(n).trim()));
    if (isNaN(lat) || isNaN(lon)) return null;
    return [lat, lon];
  }, [shop?.location]);

  const logoSrc =
    shop?.profilePictureUrl && shop.profilePictureUrl.trim()
      ? shop.profilePictureUrl
      : isDarkMode ? DEFAULT_LOGO_DARK : DEFAULT_LOGO_LIGHT;

  const coverSrc =
    shop?.coverPictureUrl && shop.coverPictureUrl.trim()
      ? shop.coverPictureUrl
      : isDarkMode ? DEFAULT_COVER_DARK : DEFAULT_COVER_LIGHT;

  const openingText = useMemo(() => (schedule ? compactSchedule(schedule, 80) : "—"), [schedule]);
  const todayText = useMemo(() => {
    if (!schedule) return "—";
    const idx = (new Date().getDay() + 6) % 7;
    const d = schedule[DAY_KEYS[idx]];
    if (!d || d.closed) return t("info.closed");
    return `${fmtTime(d.open)} - ${fmtTime(d.close)}`;
  }, [schedule, t]);

  const nextText = useMemo(() => {
    if (!schedule) return "";
    const next = nextTransitionInfo(schedule, new Date());
    if (next.type === "closes") return t("info.next_closes_at", { time: next.timeStr });
    if (next.type === "opens")
      return next.isToday ? t("info.next_opens_at", { time: next.timeStr })
                          : t("info.next_opens_on_at", { day: DAY_LABELS[next.dayIdx], time: next.timeStr });
    return "";
  }, [schedule, t]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const el = document.createElement("textarea");
      el.value = window.location.href;
      document.body.appendChild(el);
      el.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // REPORT: submit handler
  const submitReport = async () => {
    if (!token) { navigate("/login"); return; }
    if (!shop?.businessId) return;

    // Validate "Other"
    if (Number(reportReason) === 99 && !reportOther.trim()) {
      setReportResult({ ok:false, msg:"Please specify a reason." });
      return;
    }

    setReportSending(true);
    setReportResult(null);
    try {
      const payload = {
        businessId: shop.businessId,
        reason: Number(reportReason),
        otherReason: Number(reportReason) === 99 ? reportOther.trim() : "",
        details: reportDetails.trim()
      };
      const res = await fetch(`${API_BASE}/api/Support/report-shop`, {
        method: "POST",
        headers: { "Content-Type":"application/json", ...authHeaders(token) },
        body: JSON.stringify(payload)
      });
      if (res.status === 401) { navigate("/login"); return; }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Failed (${res.status})`);
      }
      setReportResult({ ok:true, msg:"Thank You — your report was submitted. Our team will review it shortly. We appriciate your help on keeping this site clean" });
      // Optionally auto-close after a moment
      setTimeout(() => { setReportOpen(false); }, 1400);
    } catch (e) {
      console.error(e);
      setReportResult({ ok:false, msg:"Could not submit the report. Please try again later." });
    } finally {
      setReportSending(false);
    }
  };

  if (loading) {
    return (
      <>
        <div className="loading-container" aria-live="polite" aria-busy="true" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12, padding:"40px 0" }}>
          <img className="loading-gif" src={isDarkMode ? LOADING_GIF_DARK : LOADING_GIF_LIGHT} alt="Loading" width={140} height={140} style={{ objectFit:"contain" }} />
          <p className="loading-text">Loading ...</p>
        </div>
      </>
    );
  }
  if (error) return <p className="sd-error">{error}</p>;
  if (!shop) return <p className="sd-error">{t("errors.not_found")}</p>;

  return (
    <>
      <Navbar />
      <div className="sd-page-wrapper">
        <div className="sd-shop-hero" style={{ backgroundImage: `url(${coverSrc})` }}>
          <div className="sd-shop-hero-content">
            <img className="sd-shop-logo" src={logoSrc} alt={`${shop.name} Logo`} />
            <h1 className="sd-shop-name">{shop.name}</h1>
          </div>
        </div>

        <div className="sd-body-wrapper">
          <main className="sd-main-col">
            <nav className="sd-category-bar" aria-label={t("categories_aria")}>
              {categories.map((cat) => (
                <button
                  key={cat.clothingCategoryId}
                  className={`sd-category-pill ${selectedCategoryId === cat.clothingCategoryId ? "active" : ""}`}
                  onClick={() => setSelectedCategoryId(cat.clothingCategoryId)}
                >
                  {cat.name}
                </button>
              ))}
            </nav>

            <section className="sd-products-section">
              <h2>
                {selectedCategoryId === 0
                  ? t("lists.all_items")
                  : categories.find((c) => c.clothingCategoryId === selectedCategoryId)?.name}
              </h2>

              {sortedFilteredItems.length === 0 ? (
                <p className="sd-no-items">{t("lists.empty_category")}</p>
              ) : (
                <>
                  <ul className="sd-product-list">
                    {pageItems.map((p) => {
                      const firstPic =
                        Array.isArray(p.pictureUrls) && p.pictureUrls.find((u) => typeof u === "string" && u.trim().length > 0);
                      const fallbackSrc = isDarkMode ? DEFAULT_PRODUCT_DARK : DEFAULT_PRODUCT_LIGHT;
                      const name =
                        (p.name && p.brand && `${p.name} - ${p.brand}`) ||
                        p.name || p.model || t("product.alt", { shop: shop.name });

                      const priceNum = typeof p.price === "number" ? p.price : Number(p.price);
                      const price = !isNaN(priceNum) ? t("product.price", { value: priceNum.toFixed(2) }) : "—";
                      const desc = typeof p.description === "string" ? p.description : "";

                      const isPinnedCard = pinnedIds.has(p.clothingItemId);

                      return (
                        <li key={p.clothingItemId} className="sd-product-card" style={{ position:"relative" }}>
                          {isPinnedCard && (
                            <span aria-label={t("product.pinned_aria", { defaultValue:"Pinned item" })} title={t("product.pinned_title", { defaultValue:"Pinned item" })} style={{ position:"absolute", top:8, left:8, fontSize:18, lineHeight:1, userSelect:"none" }}>
                              📌
                            </span>
                          )}
                          {(Number(p.quantity) <= 0) && (
                            <span title={t("stock.out_now", { defaultValue:"Currently Out Of Stock" })} style={{ position:"absolute", top:8, right:8, background:"#991b1b", color:"#fff", fontSize:12, padding:"4px 8px", borderRadius:999, fontWeight:600 }}>
                              {t("stock.out_now", { defaultValue:"Out Of Stock" })}
                            </span>
                          )}

                          <Link to={`/product/${p.clothingItemId}`} className="sd-product-link">
                            <img
                              key={fallbackSrc}
                              className="sd-product-image"
                              src={firstPic || fallbackSrc}
                              alt={t("product.alt", { shop: shop.name })}
                              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = fallbackSrc; }}
                            />
                            <div className="sd-product-inline">
                              <span className="product-name">{name}</span>
                              <span className="product-price">{price}</span>
                              {desc && <span className="product-desc">{desc}</span>}
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>

                  {totalPages > 1 && (
                    <div className="sd-pagination">
                      <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>{t("lists.prev")}</button>
                      <span>{t("lists.page_x_of_y", { page, total: totalPages })}</span>
                      <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>{t("lists.next")}</button>
                    </div>
                  )}
                </>
              )}
            </section>
          </main>

          <aside className="sd-info-col">
            <div className="sd-shop-info">
              <div className="sd-shop-info-section">
                <h4><FaInfoCircle /> {t("info.description")}</h4>
                <p>{shop.description || "—"}</p>
              </div>

              <div className="sd-shop-info-section">
                <h4><FaPhoneAlt /> {t("info.contact")}</h4>
                <p><strong>{t("info.phone")}:</strong> {shop.businessPhoneNumber || "—"}</p>
                <p><strong>{t("info.email")}:</strong> {shop.businessEmailAddress || "—"}</p>
              </div>

              <div className="sd-shop-info-section">
                <h4><FaClock /> {t("info.hours")}</h4>
                <p><strong>{t("info.weekly")}:</strong> {openingText || "—"}</p>
                <p><strong>{t("info.today")}:</strong> {todayText || "—"}</p>
                <p>
                  <strong>{t("info.status")}:</strong>{" "}
                  <span className={`shop-status ${isOpen ? "open" : "closed"}`}>
                    {isOpen ? t("info.open") : t("info.closed")}
                  </span>
                  {nextText && <span className="status-next"> • {nextText}</span>}
                </p>

                <div className="sd-shop-favorite" role="region" aria-labelledby="fav-heading">
                  <h4 id="fav-heading"><FaHeart /> {t("favorite.title")}</h4>
                  <div className="sd-fav-row">
                    <strong>{t("favorite.cta")}</strong>
                    <button
                      onClick={toggleFavorite}
                      disabled={favLoading}
                      aria-pressed={isFavorited}
                      aria-label={isFavorited ? t("favorite.aria_remove") : t("favorite.aria_add")}
                      className="sd-favorite-btn"
                      style={{
                        display:"inline-flex", alignItems:"center", gap:"6px", padding:"6px 10px",
                        borderRadius:"999px", border:`1px solid ${isFavorited ? "#ff1616f3" : "#e5e7eb"}`,
                        background: isFavorited ? "#fa9097ff" : "#fff",
                        color: isFavorited ? "#e11d48" : "#111", cursor: favLoading ? "not-allowed" : "pointer"
                      }}
                      type="button"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                        {isFavorited ? (
                          <path d="M12 21s-6.716-4.315-9.428-7.027A6.5 6.5 0 1 1 12 5.07a6.5 6.5 0 1 1 9.428 8.903C18.716 16.685 12 21 12 21z"></path>
                        ) : (
                          <path fill="none" stroke="currentColor" strokeWidth="1.8" d="M20.84 4.61a5.5 5.5 0 0 1 .11 7.78L12 21l-8.95-8.61a5.5 5.5 0 0 1 7.78-7.78L12 5.5l1.17-1.17a5.5 5.5 0 0 1 7.67-.28z"></path>
                        )}
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {coords && (
              <div className="sd-shop-location">
                <h3>{t("location.title")}</h3>
                <small>{routeName || `${coords[0]}, ${coords[1]}`}</small>
                <div className="sd-location-map">
                  <PigeonMap height={300} defaultCenter={coords} defaultZoom={13} metaWheelZoom mouseEvents>
                    <Marker width={40} anchor={coords} />
                  </PigeonMap>
                </div>
                <a
                  href={`https://www.google.com/maps?q=${coords[0]},${coords[1]}`}
                  target="_blank" rel="noopener noreferrer" className="map-link"
                >
                  {t("location.open_in_maps")}
                </a>
              </div>
            )}

            <div className="sd-shop-share">
              <h3>{t("share.section_title", { name: shop.name })}</h3>
              <br />
              <input
                type="text" readOnly value={window.location.href} onClick={(e) => e.target.select()}
                className="sd-share-input" aria-label={t("share.aria_link")}
              />
              <button onClick={copyLink} className="sd-share-btn">
                {copied ? t("share.copied") : t("share.copy")}
              </button>

              <div className="sd-social-buttons">
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noopener noreferrer" className="sd-social facebook">
                  {t("share.facebook")}
                </a>
                <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=Check%20out%20${encodeURIComponent(shop.name)}!`} target="_blank" rel="noopener noreferrer" className="sd-social twitter">
                  {t("share.twitter")}
                </a>
                <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out ${shop.name}: ${window.location.href}`)}`} target="_blank" rel="noopener noreferrer" className="sd-social whatsapp">
                  {t("share.whatsapp")}
                </a>
                <a href={`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=Check%20out%20${encodeURIComponent(shop.name)}!`} target="_blank" rel="noopener noreferrer" className="sd-social telegram">
                  {t("share.telegram")}
                </a>
              </div>
            </div>
              <div>
              <button
              type="button"
              onClick={() => { setReportOpen(true); setReportResult(null); }}
              className="sd-report-btn"
              title="Report this shop"
            >
              {/* e.g. <Flag size={16}/> */}
              <span>Report This Shop</span>
            </button>
              </div>
          </aside>
        </div>
      </div>
      {/* REPORT: Modal */}
      {reportOpen && (
        <div
          className="report-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-title"
          onClick={(e) => { if (e.target === e.currentTarget) setReportOpen(false); }}
          style={{
            position:"fixed", inset:0, background:"rgba(0,0,0,.38)", display:"flex",
            alignItems:"center", justifyContent:"center", zIndex: 1000, padding:"16px"
          }}
        >
          <div
            className="report-modal"
            style={{
              width:"100%", maxWidth:520, background:"#fff", borderRadius:12,
              boxShadow:"0 10px 30px rgba(0,0,0,.2)", overflow:"hidden"
            }}
          >
            <div style={{ padding:"16px 20px", borderBottom:"1px solid #e5e7eb" }}>
              <h3 id="report-title" style={{ margin:0, fontSize:18, fontWeight:700 }}>
                Report “{shop.name}”
              </h3>
            </div>

            <div style={{ padding:"16px 20px" }}>
              <fieldset style={{ border:"none", padding:0, margin:0 }}>
                <legend style={{ fontWeight:600, marginBottom:8 }}>Reason</legend>
                <div style={{ display:"grid", gap:8 }}>
                  {REPORT_REASONS.map(r => (
                    <label key={r.value} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                      <input
                        type="radio"
                        name="reportReason"
                        value={r.value}
                        checked={Number(reportReason) === r.value}
                        onChange={() => setReportReason(r.value)}
                      />
                      <span>{r.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {Number(reportReason) === 99 && (
                <div style={{ marginTop:12 }}>
                  <label style={{ display:"block", fontWeight:600, marginBottom:6 }}>Please specify</label>
                  <input
                    type="text"
                    value={reportOther}
                    onChange={(e) => setReportOther(e.target.value)}
                    maxLength={200}
                    placeholder="Describe the reason…"
                    style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:8, padding:"8px 10px" }}
                  />
                </div>
              )}

              <div style={{ marginTop:12 }}>
                <label style={{ display:"block", fontWeight:600, marginBottom:6 }}>Additional details (optional)</label>
                <textarea
                  rows={4}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Add any links or context that may help our team…"
                  style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:8, padding:"8px 10px", resize:"vertical" }}
                />
              </div>

              {reportResult && (
                <div
                  role="status"
                  style={{
                    marginTop:12, padding:"8px 10px", borderRadius:8,
                    background: reportResult.ok ? "#ecfdf5" : "#fef2f2",
                    color: reportResult.ok ? "#065f46" : "#991b1b",
                    border: `1px solid ${reportResult.ok ? "#10b981" : "#ef4444"}`
                  }}
                >
                  {reportResult.msg}
                </div>
              )}
            </div>

            <div style={{ padding:"12px 20px", borderTop:"1px solid #e5e7eb", display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                disabled={reportSending}
                style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #e5e7eb", background:"#fff", cursor:"pointer" , color:"black"}}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReport}
                disabled={reportSending}
                style={{
                  padding:"8px 12px", borderRadius:8, border:"1px solid #111827",
                  background:"#111827", color:"#fff", fontWeight:600, cursor: reportSending ? "not-allowed" : "pointer",
                  opacity: reportSending ? .8 : 1
                }}
              >
                {reportSending ? "Submitting…" : "Submit report"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
