import { useEffect, useState, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import Search from "../Components/SearchBar";
import Pagination from "../Components/Pagination.tsx";
import { useTranslation } from "react-i18next";
import "../Styling/shoplist.css";

const API_BASE = "https://api.triwears.com/api";
const PAGE_SIZE = 9;
const SPOTLIGHT_SIZE = 8;
const MAX_NEAR_KM = 3;

const toSlug = (str) =>
  (str || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

/* ────────────────────────────────────────────────────────────────
 * Helpers (robust coordinate parsing + distance)
 * ──────────────────────────────────────────────────────────────── */
const coerceNum = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const isLat = (n) => Number.isFinite(n) && Math.abs(n) <= 90;
const isLon = (n) => Number.isFinite(n) && Math.abs(n) <= 180;
const validLatLon = ([lat, lon]) =>
  isLat(lat) && isLon(lon) && !(lat === 0 && lon === 0);

/** Try many common shapes:
 * - explicit numeric fields (latitude/longitude, lat/lng, etc.)
 * - nested objects: { location: { lat, lng } }, { geo: { lat, lng } }, …
 * - arrays: coordinates: [lat, lon]
 * - strings: "lat,lon" / "lat; lon" / "lat lon"
 */
function parseCoordsFromBusiness(b) {
  // explicit numeric fields on root
  const la =
    coerceNum(b?.latitude) ??
    coerceNum(b?.Lat) ??
    coerceNum(b?.Latitude);
  const lo =
    coerceNum(b?.longitude) ??
    coerceNum(b?.lng) ??
    coerceNum(b?.lon) ??
    coerceNum(b?.Longitude);
  if (isLat(la) && isLon(lo)) return [la, lo];

  // nested objects
  const bases = [
    b?.location,
    b?.Location,
    b?.geo,
    b?.Geo,
    b?.coords,
    b?.Coords,
    b?.position,
    b?.Position,
  ].filter(Boolean);

  for (const base of bases) {
    if (typeof base === "object") {
      const _la =
        coerceNum(base?.lat) ??
        coerceNum(base?.Lat) ??
        coerceNum(base?.latitude) ??
        coerceNum(base?.Latitude);
      const _lo =
        coerceNum(base?.lng) ??
        coerceNum(base?.Lng) ??
        coerceNum(base?.lon) ??
        coerceNum(base?.Lon) ??
        coerceNum(base?.longitude) ??
        coerceNum(base?.Longitude);
      if (isLat(_la) && isLon(_lo)) return [_la, _lo];
    }
  }

  // array-like
  const arrayish =
    (Array.isArray(b?.coordinates) && b.coordinates) ||
    (Array.isArray(b?.coords) && b.coords) ||
    (Array.isArray(b?.locationCoordinates) && b.locationCoordinates) ||
    (Array.isArray(b?.LocationCoordinates) && b.LocationCoordinates) ||
    null;
  if (arrayish && arrayish.length >= 2) {
    const a = coerceNum(arrayish[0]);
    const c = coerceNum(arrayish[1]);
    if (Number.isFinite(a) && Number.isFinite(c)) return [a, c];
  }

  // strings (including Business.Location)
  const candidates = [
    b?.mapCoordinates,
    b?.coordinates,
    b?.locationCoordinates,
    b?.LocationCoordinates,
    b?.location,
    b?.Location,
  ].filter((x) => typeof x === "string");
  for (const s of candidates) {
    const m = s.match(/(-?\d+(?:[\.,]\d+)?)\s*[;, ]\s*(-?\d+(?:[\.,]\d+)?)/);
    if (m) {
      const a = coerceNum(m[1]);
      const c = coerceNum(m[2]);
      if (Number.isFinite(a) && Number.isFinite(c)) return [a, c];
    }
  }
  return null;
}

function haversineKm([lat1, lon1], [lat2, lon2]) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Given a raw pair [a,b] that might be [lat,lon] or [lon,lat],
// choose the most plausible one, preferring the closest to `hintPos`.
function normalizeLatLon(rawPair, hintPos /* [lat,lon] or null */) {
  if (!Array.isArray(rawPair) || rawPair.length !== 2) return null;
  const [a, b] = rawPair;

  const cand1 = isLat(a) && isLon(b) ? [a, b] : null; // assume [lat,lon]
  const cand2 = isLat(b) && isLon(a) ? [b, a] : null; // assume [lon,lat] swapped

  if (cand1 && !cand2) return validLatLon(cand1) ? cand1 : null;
  if (!cand1 && cand2) return validLatLon(cand2) ? cand2 : null;

  if (cand1 && cand2 && hintPos && isLat(hintPos[0]) && isLon(hintPos[1])) {
    const d1 = haversineKm(hintPos, cand1);
    const d2 = haversineKm(hintPos, cand2);
    const best = d1 <= d2 ? cand1 : cand2;
    return validLatLon(best) ? best : null;
  }

  return cand1 && validLatLon(cand1) ? cand1 : cand2 && validLatLon(cand2) ? cand2 : null;
}

function formatKm(km) {
  if (km == null) return "";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

const getCreatedTs = (b) => {
  const candidates = [b?.createdAt, b?.CreatedAt, b?.updatedAt];
  for (const v of candidates) {
    if (!v) continue;
    const t = new Date(v).getTime();
    if (Number.isFinite(t)) return t;
  }
  return 0;
};

/* ────────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────────── */
export default function ShopList() {
  const { t } = useTranslation("shoplist");

  const [shops, setShops] = useState([]);
  const [spotlightShops, setSpotlightShops] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [spotlightLoading, setSpotlightLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [errorCats, setErrorCats] = useState("");
  const navigate = useNavigate();
  const spotlightRef = useRef(null);

  // Near-me state
  const [nearRaw, setNearRaw] = useState([]); // all shops (coords parsed, order unknown)
  const [nearLoading, setNearLoading] = useState(true);
  const [nearError, setNearError] = useState("");
  const [nearPage, setNearPage] = useState(1);
  const [myPos, setMyPos] = useState(null); // [lat, lon]
  const [posMsg, setPosMsg] = useState("");

  /* ────────────────────────────────────────────────────────────────
   * Spotlight (New shops) — last 7 days, capped to 8
   * ──────────────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSpotlightLoading(true);
      try {
        // This endpoint exists in your controller: GET /api/Business/latest?days=7
        const res = await fetch(`${API_BASE}/Business/latest?days=7`);
        if (!res.ok) throw new Error((await res.text()) || res.statusText);
        let data = await res.json();
        if (!Array.isArray(data)) data = Array.isArray(data?.items) ? data.items : [];

        // Sort newest first, cap to 8 (defensive if backend isn’t capping)
        const mapped = data
          .sort((a, b) => getCreatedTs(b) - getCreatedTs(a))
          .slice(0, SPOTLIGHT_SIZE)
          .map((shop) => ({
            ...shop,
            slug: shop.slug || toSlug(shop.name),
          }));

        if (!cancelled) setSpotlightShops(mapped);
      } catch (err) {
        if (!cancelled) console.error("Error loading new shops:", err);
      } finally {
        if (!cancelled) setSpotlightLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ────────────────────────────────────────────────────────────────
   * Browse (paginated) shops
   * ──────────────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/Business/paginated?pageNumber=${page}&pageSize=${PAGE_SIZE}`);
        if (!res.ok) throw new Error((await res.text()) || res.statusText);
        const { items, totalCount: count } = await res.json();
        const mapped = (Array.isArray(items) ? items : []).map((shop) => ({
          ...shop,
          slug: shop.slug || toSlug(shop.name),
        }));
        if (!cancelled) {
          setShops(mapped);
          setTotalCount(Number.isFinite(count) ? count : 0);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load shops");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page]);

  /* ────────────────────────────────────────────────────────────────
   * Categories — fetch once
   * ──────────────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCats(true);
      setErrorCats("");
      try {
        const res = await fetch(`${API_BASE}/ClothingCategory/all`);
        if (!res.ok) throw new Error((await res.text()) || res.statusText);
        const data = await res.json();
        if (!cancelled) setCategories(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setErrorCats(err.message || "Failed to load categories");
      } finally {
        if (!cancelled) setLoadingCats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ────────────────────────────────────────────────────────────────
   * Near Me — fetch ALL shops once (unpaginated) and parse coordinates
   * ──────────────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setNearLoading(true);
      setNearError("");
      try {
        const res = await fetch(`${API_BASE}/Business/geo`);
        if (!res.ok) throw new Error((await res.text()) || res.statusText);
        const data = await res.json();
        const withCoords = (Array.isArray(data) ? data : []).map((shop) => ({
          id: shop.businessId ?? shop.id,
          name: shop.name,
          slug: shop.slug || toSlug(shop.name),
          profilePictureUrl: shop.profilePictureUrl,
          address: shop.location || shop.address,
          phone: shop.businessPhoneNumber,
          coords: parseCoordsFromBusiness(shop), // raw pair [lat,lon] or [lon,lat] or null
        }));
        if (!cancelled) setNearRaw(withCoords);
      } catch (err) {
        if (!cancelled) setNearError(err.message || "Failed to load shops for near me");
      } finally {
        if (!cancelled) setNearLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ────────────────────────────────────────────────────────────────
   * Request location on mount (user will get a prompt); allow manual retry
   * ──────────────────────────────────────────────────────────────── */
  useEffect(() => {
    requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function requestLocation() {
    if (!navigator.geolocation) {
      setPosMsg(t("geoloc_unsupported", { defaultValue: "Your browser doesn't support location." }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyPos([pos.coords.latitude, pos.coords.longitude]);
        setPosMsg("");
      },
      (err) => {
        const msg =
          err?.code === 1
            ? t("geoloc_denied", { defaultValue: "Allow location access to see shops near you." })
            : t("geoloc_failed", { defaultValue: "Couldn't get your location. Try again." });
        setPosMsg(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,      // generous timeout for GPS
        maximumAge: 60_000,  // reuse recent fix to speed things up
      }
    );
  }

  /* ────────────────────────────────────────────────────────────────
   * Compute nearby with normalization and distance
   * ──────────────────────────────────────────────────────────────── */
  const nearFiltered = useMemo(() => {
    if (!myPos) return [];
    return nearRaw
      .map((s) => {
        const normalized = normalizeLatLon(s.coords, myPos);
        if (!normalized || !validLatLon(normalized)) return null;
        const distanceKm = haversineKm(myPos, normalized);
        if (!Number.isFinite(distanceKm) || distanceKm > 20000) return null; // guard against bogus coords
        return { ...s, coords: normalized, distanceKm };
      })
      .filter(Boolean)
      .filter((s) => s.distanceKm <= MAX_NEAR_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [nearRaw, myPos]);

  const nearTotal = nearFiltered.length;
  const nearStart = (nearPage - 1) * PAGE_SIZE;
  const nearSlice = nearFiltered.slice(nearStart, nearStart + PAGE_SIZE);

  // Reset near-page when location changes or results length changes
  useEffect(() => {
    setNearPage(1);
  }, [myPos, nearTotal]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNearPageChange = (newPage) => {
    setNearPage(newPage);
    // scroll to near-me section anchor
    const el = document.getElementById("near-me-section");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onCategoryClick = (categoryName) => {
    navigate(`/category-filter?category=${encodeURIComponent(categoryName)}`);
  };

  // Auto-scroll spotlight carousel
  useEffect(() => {
    const carousel = spotlightRef.current;
    if (!carousel || spotlightShops.length === 0) return;

    let scrollInterval;
    let isUserScrolling = false;
    let userScrollTimeout;

    const startAutoScroll = () => {
      scrollInterval = setInterval(() => {
        if (!isUserScrolling && carousel) {
          const maxScroll = carousel.scrollWidth - carousel.clientWidth;
          const currentScroll = carousel.scrollLeft;
          if (currentScroll >= maxScroll) {
            carousel.scrollTo({ left: 0, behavior: "smooth" });
          } else {
            carousel.scrollBy({ left: 320, behavior: "smooth" });
          }
        }
      }, 4000);
    };

    const handleUserScroll = () => {
      isUserScrolling = true;
      clearTimeout(userScrollTimeout);
      userScrollTimeout = setTimeout(() => {
        isUserScrolling = false;
      }, 3000);
    };

    carousel.addEventListener("scroll", handleUserScroll);
    startAutoScroll();

    return () => {
      clearInterval(scrollInterval);
      clearTimeout(userScrollTimeout);
      carousel?.removeEventListener("scroll", handleUserScroll);
    };
  }, [spotlightShops]);

  return (
    <>
      <Navbar />

      <section className="hero-section" aria-label={t("hero_aria", { defaultValue: "Hero" })}>
        <div className="hero-background">
          <div className="hero-gradient"></div>
          <div className="hero-pattern"></div>
          <div className="floating-elements">
            <div className="floating-element element-1"></div>
            <div className="floating-element element-2"></div>
            <div className="floating-element element-3"></div>
            <div className="floating-element element-4"></div>
            <div className="floating-element element-5"></div>
          </div>
        </div>

        <div className="hero-content">
          <h1 className="hero-title">
            {t("hero_title_prefix", { defaultValue: "Welcome, To" })}{" "}
            <span className="hero-title-accent">{t("brand_name", { defaultValue: "Triwears" })}</span>
          </h1>

          <p className="hero-subtitle">
            {t("hero_subtitle", {
              defaultValue:
                "Discover thousands of clothing brands and shops in one place. Search, explore, discover and find exactly what you're looking for.",
            })}
          </p>

          <div className="hero-search">
            <Search />
          </div>

          <div className="hero-stats" aria-label={t("stats_aria", { defaultValue: "Site statistics" })}>
            <div className="stat-item">
              <span className="stat-number">{totalCount}+</span>
              <span className="stat-label">{t("stats_shops", { defaultValue: "Shops" })}</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">{categories.length}+</span>
              <span className="stat-label">{t("stats_categories", { defaultValue: "Categories" })}</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">24/7</span>
              <span className="stat-label">{t("stats_support", { defaultValue: "Support" })}</span>
            </div>
          </div>
        </div>
      </section>

      <main className="main-container">
        <section className="featured-section" aria-label={t("featured_aria", { defaultValue: "New shops" })}>
          <div className="section-header">
            <h2 className="section-title">
              <span className="title-gradient">{t("featured_title", { defaultValue: "New Shops" })}</span>
            </h2>
            <p className="section-subtitle">
              {t("featured_subtitle", {
                defaultValue: "Discover the latest shops and newest brands in our marketplace",
              })}
            </p>
          </div>

          <div className="featured-carousel" ref={spotlightRef}>
            {spotlightLoading ? (
              <div className="loading-carousel">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="brand-card-skeleton">
                    <div className="skeleton-image">
                      <div className="skeleton-shimmer"></div>
                    </div>
                    <div className="skeleton-content">
                      <div className="skeleton-line"></div>
                      <div className="skeleton-line short"></div>
                      <div className="skeleton-tags">
                        <div className="skeleton-tag"></div>
                        <div className="skeleton-tag"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : spotlightShops.length > 0 ? (
              spotlightShops.map((shop) => (
                <Link key={shop.businessId ?? shop.id ?? shop.slug ?? shop.name} to={`/shop/${shop.slug}`} className="brand-card featured">
                  <div className="brand-card-image">
                    {shop.profilePictureUrl ? (
                      <img src={shop.profilePictureUrl || "/placeholder.svg"} alt={shop.name} />
                    ) : (
                      <div className="brand-placeholder" aria-label={t("brand_placeholder_aria", { defaultValue: "Shop placeholder" })}>
                        <div className="placeholder-glow"></div>
                        <div className="placeholder-icon">🏪</div>
                        <div className="placeholder-text">{(shop.name || "?").charAt(0)}</div>
                      </div>
                    )}
                    <div className="brand-overlay">
                      <div className="overlay-content">
                        <span className="view-brand">{t("view_shop", { defaultValue: "View Shop" })}</span>
                        <svg className="overlay-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>
                    </div>
                    <div className="brand-badge">{t("badge_new", { defaultValue: "New" })}</div>
                  </div>
                  <div className="brand-info">
                    <h3 className="brand-name">{shop.name}</h3>
                  </div>
                </Link>
              ))
            ) : (
              <div className="empty-state">
                <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h3>{t("empty_new_title", { defaultValue: "No New Shops" })}</h3>
                <p>{t("empty_new_desc", { defaultValue: "Check back later for new shops and latest brands." })}</p>
              </div>
            )}
          </div>
        </section>

        {/* ───────────────────────── Shops near me ───────────────────────── */}
        <section id="near-me-section" className="nearby-section" aria-label={t("nearby_aria", { defaultValue: "Shops near me" })}>
          <div className="section-header">
            <h2 className="section-title">{t("nearby_title", { defaultValue: "Shops near me" })}</h2>
            <p className="section-subtitle">
              {t("nearby_subtitle", { defaultValue: "Check out shops standing near your current location" })}
            </p>
          </div>

          {nearLoading ? (
            <div className="brands-grid">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="brand-card-skeleton" aria-hidden="true">
                  <div className="skeleton-image">
                    <div className="skeleton-shimmer"></div>
                  </div>
                  <div className="skeleton-content">
                    <div className="skeleton-line"></div>
                    <div className="skeleton-line short"></div>
                    <div className="skeleton-tags">
                      <div className="skeleton-tag"></div>
                      <div className="skeleton-tag"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : nearError ? (
            <div className="error-message" role="alert">
              <svg className="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4>{t("error_near_title", { defaultValue: "Error loading nearby shops" })}</h4>
                <p>{nearError}</p>
              </div>
            </div>
          ) : !myPos ? (
            <div className="nearby-cta">
              <p className="nearby-cta-text">{posMsg || t("nearby_cta", { defaultValue: "Turn on location to see shops closest to you." })}</p>
              <button className="nearby-cta-btn" onClick={requestLocation}>{t("nearby_btn", { defaultValue: "Use my location" })}</button>
            </div>
          ) : nearFiltered.length > 0 ? (
            <>
              <div className="brands-grid">
                {nearSlice.map((shop) => (
                  <Link key={shop.id ?? shop.businessId ?? shop.slug ?? shop.name} to={`/shop/${shop.slug}`} className="brand-card">
                    <div className="brand-card-image">
                      {shop.profilePictureUrl ? (
                        <img src={shop.profilePictureUrl || "/placeholder.svg"} alt={shop.name} />
                      ) : (
                        <div className="brand-placeholder" aria-label={t("brand_placeholder_aria", { defaultValue: "Shop placeholder" })}>
                          <div className="placeholder-glow"></div>
                          <div className="placeholder-icon">🏪</div>
                          <div className="placeholder-text">{(shop.name || "?").charAt(0)}</div>
                        </div>
                      )}
                    </div>
                    <div className="brand-info">
                      <h3 className="brand-name">{shop.name}</h3>
                      <div className="brand-tags">
                        <span className="brand-distance">{formatKm(shop.distanceKm)} {t("away", { defaultValue: "away" })}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="pagination-wrapper">
                <Pagination page={nearPage} pageSize={PAGE_SIZE} totalCount={nearTotal} onPageChange={handleNearPageChange} />
              </div>
            </>
          ) : (
            <div className="empty-state">
              <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3>{t("empty_near_title", { defaultValue: "No shops within 3 km" })}</h3>
             <p>{t("empty_near_desc", { defaultValue: "Try increasing the radius or enable location access." })}</p>
            </div>
          )}
        </section>

        {/* Browse All Shops */}
        <section className="browse-section" aria-label={t("browse_aria", { defaultValue: "Browse shops" })}>
          <div className="section-header">
            <h2 className="section-title">{t("browse_title", { defaultValue: "Browse Shops" })}</h2>
            <p className="section-subtitle">
              {t("browse_subtitle", { defaultValue: "Explore our complete collection of clothing shops and brands" })}
            </p>
          </div>

          {error && (
            <div className="error-message" role="alert">
              <svg className="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4>{t("error_shops_title", { defaultValue: "Error Loading Shops" })}</h4>
                <p>{error}</p>
              </div>
            </div>
          )}

          <div className="brands-grid">
            {loading ? (
              [...Array(8)].map((_, i) => (
                <div key={i} className="brand-card-skeleton" aria-hidden="true">
                  <div className="skeleton-image">
                    <div className="skeleton-shimmer"></div>
                  </div>
                  <div className="skeleton-content">
                    <div className="skeleton-line"></div>
                    <div className="skeleton-line short"></div>
                    <div className="skeleton-tags">
                      <div className="skeleton-tag"></div>
                      <div className="skeleton-tag"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : shops.length > 0 ? (
              shops.map((shop) => (
                <Link key={shop.businessId ?? shop.id ?? shop.slug ?? shop.name} to={`/shop/${shop.slug}`} className="brand-card">
                  <div className="brand-card-image">
                    {shop.profilePictureUrl ? (
                      <img src={shop.profilePictureUrl || "/placeholder.svg"} alt={shop.name} />
                    ) : (
                      <div className="brand-placeholder" aria-label={t("brand_placeholder_aria", { defaultValue: "Shop placeholder" })}>
                        <div className="placeholder-glow"></div>
                        <div className="placeholder-icon">🏪</div>
                        <div className="placeholder-text">{(shop.name || "?").charAt(0)}</div>
                      </div>
                    )}
                    <div className="brand-overlay">
                      <div className="overlay-content">
                        <span className="view-brand">{t("view_shop", { defaultValue: "View Shop" })}</span>
                        <svg className="overlay-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="brand-info">
                    <h3 className="brand-name">{shop.name}</h3>
                    <div className="brand-tags"></div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="empty-state">
                <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h3>{t("empty_browse_title", { defaultValue: "No Shops Found" })}</h3>
                <p>{t("empty_browse_desc", { defaultValue: "Try adjusting your search or check back later for new shops." })}</p>
              </div>
            )}
          </div>

          <div className="pagination-wrapper">
            <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={handlePageChange} />
          </div>
        </section>

        {/* Categories */}
        <section className="categories-section" aria-label={t("categories_aria", { defaultValue: "Categories" })}>
          <div className="section-header">
            <h2 className="section-title">{t("categories_title", { defaultValue: "Shop by Category" })}</h2>
            <p className="section-subtitle">
              {t("categories_subtitle", {
                defaultValue: "Browse through our organized categories to find exactly what you need",
              })}
            </p>
          </div>

          {errorCats && (
            <div className="error-message" role="alert">
              <svg className="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4>{t("error_categories_title", { defaultValue: "Error Loading Categories" })}</h4>
                <p>{errorCats}</p>
              </div>
            </div>
          )}

          <div className="categories-grid">
            {loadingCats ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="category-card-skeleton" aria-hidden="true">
                  <div className="skeleton-icon"></div>
                  <div className="category-content">
                    <div className="skeleton-line"></div>
                    <div className="skeleton-line short"></div>
                  </div>
                  <div className="skeleton-arrow"></div>
                </div>
              ))
            ) : categories.length > 0 ? (
              categories
                .filter((cat, idx, self) => self.findIndex((c) => c.name === cat.name) === idx)
                .map((cat) => (
                  <div
                    key={cat.clothingCategoryId ?? cat.name}
                    className="category-card"
                    onClick={() => onCategoryClick(cat.name)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === "Enter" ? onCategoryClick(cat.name) : null)}
                    aria-label={t("category_card_aria", { defaultValue: "Open category" })}
                  >
                    <div className="category-hover-effect"></div>
                    <div className="category-icon">
                      {cat.iconUrl ? (
                        <img src={cat.iconUrl || "/placeholder.svg"} alt={cat.name} />
                      ) : (
                        <div className="category-placeholder">{(cat.name || "?").charAt(0)}</div>
                      )}
                    </div>
                    <div className="category-content">
                      <h3 className="category-name">{cat.name}</h3>
                      <p className="category-count">{t("category_cta", { defaultValue: "Click To See Featured Shops" })}</p>
                    </div>
                    <svg className="category-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                ))
            ) : (
              <div className="empty-state">
                <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h3>{t("empty_categories_title", { defaultValue: "No Categories Available" })}</h3>
                <p>{t("empty_categories_desc", { defaultValue: "Categories will appear here once they are added to the system." })}</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
