import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import Pagination from "../Components/Pagination.tsx";
import "../Styling/AllShops.css";

const API_URL = "https://api.triwears.com/api/Business";
const PAGE_SIZE = 6;
const LOADING_GIF_LIGHT = "/Assets/triwears-black-loading.gif";
const LOADING_GIF_DARK  = "/Assets/triwears-white-loading.gif";
const DEFAULT_LOGO_LIGHT = "/Assets/default-shop-logo-light.png";
const DEFAULT_LOGO_DARK  = "/Assets/default-shop-logo-dark.png";
const DEFAULT_COVER_LIGHT = "/Assets/default-shop-cover-light.png";
const DEFAULT_COVER_DARK  = "/Assets/default-shop-cover-dark.png";

const slugify = (str) =>
  (str || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

export default function AllShops() {
  const [shops, setShops] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 🌙 react to OS/theme changes
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setIsDarkMode(e.matches);
    try { mq.addEventListener("change", onChange); } catch { mq.addListener(onChange); }
    return () => {
      try { mq.removeEventListener("change", onChange); } catch { mq.removeListener(onChange); }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`${API_URL}/paginated?pageNumber=${page}&pageSize=${PAGE_SIZE}`);
        if (!res.ok) throw new Error((await res.text()) || res.statusText);
        const data = await res.json();
        if (cancelled) return;

        // keep raw URLs; choose theme-aware fallbacks at render time
        const mapped = (data.items || []).map((shop) => ({
          ...shop,
          slug: shop.slug || slugify(shop.name || `shop-${shop.businessId}`),
          name: shop.name || shop.slug || `Shop ${shop.businessId}`,
          profilePictureUrl: shop.profilePictureUrl || "", // (theme fallback later)
          coverPictureUrl: shop.coverPictureUrl || "",     // (theme fallback later)
        }));

        setShops(mapped);
        setTotalCount(data.totalCount || mapped.length);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page]);

  if (loading) {
    return (
      <>
        <div
          className="loading-container"
          aria-live="polite"
          aria-busy="true"
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 0" }}
        >
          <img
            className="loading-gif"
            src={isDarkMode ? LOADING_GIF_DARK : LOADING_GIF_LIGHT}
            alt="Loading"
            width={140}
            height={140}
            style={{ objectFit: "contain" }}
          />
          <p className="loading-text">Loading ...</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <div className="page-container">
          <div className="error-state">
            <p>Error loading shops: {error.message}</p>
            <button onClick={() => window.location.reload()} className="retry-button">
              Try Again
            </button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">All Shops</h1>
          <p className="page-subtitle">Discover {totalCount} amazing shops in our marketplace</p>
        </div>

        <div className="shops-grid">
          {shops.map((shop) => {
            const logoSrc =
              shop.profilePictureUrl || (isDarkMode ? DEFAULT_LOGO_DARK : DEFAULT_LOGO_LIGHT);
            const coverSrc =
              shop.coverPictureUrl || (isDarkMode ? DEFAULT_COVER_DARK : DEFAULT_COVER_LIGHT);

            return (
              <Link
                to={`/shop/${shop.slug}`}
                key={shop.businessId ?? shop.id ?? shop.slug}
                className="shop-card-link"
                aria-label={`Visit ${shop.name}`}
              >
                <article className="shop-card">
                  <div className="shop-card-image" role="img" aria-label={`${shop.name} cover image`}>
                    {/* Use an <img> so we can catch load errors and swap to theme default */}
                    <img
                      src={coverSrc}
                      alt=""
                      loading="lazy"
                      className="shop-cover-img"
                      onError={(e) => {
                        e.currentTarget.src = isDarkMode
                          ? DEFAULT_COVER_DARK
                          : DEFAULT_COVER_LIGHT;
                      }}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    <div className="shop-card-overlay" />
                  </div>

                  <div className="shop-card-content">
                    <div className="shop-info">
                      <img
                        src={logoSrc}
                        alt=""
                        className="shop-logo"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src = isDarkMode
                            ? DEFAULT_LOGO_DARK
                            : DEFAULT_LOGO_LIGHT;
                        }}
                      />
                      <div className="shop-details">
                        <h3 className="shop-name">{shop.name}</h3>
                      </div>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>

        <div className="pagination-wrapper">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={totalCount}
            onPageChange={setPage}
          />
        </div>
      </div>

      <Footer />
    </>
  );
}
