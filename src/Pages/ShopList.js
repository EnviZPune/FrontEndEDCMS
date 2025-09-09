import { useEffect, useState, useRef } from "react";
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

const toSlug = (str) =>
  (str || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

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

  // Load spotlight shops (new/latest shops)
  useEffect(() => {
    let canceled = false;
    (async () => {
      setSpotlightLoading(true);
      try {
        const res = await fetch(`${API_BASE}/Business/paginated?pageNumber=1&pageSize=${SPOTLIGHT_SIZE}`);
        if (!res.ok) throw new Error((await res.text()) || res.statusText);
        const { items } = await res.json();
        const mapped = (items || []).map((shop) => ({
          ...shop,
          slug: shop.slug || toSlug(shop.name),
        }));
        if (!canceled) setSpotlightShops(mapped);
      } catch (err) {
        console.error("Error loading new shops:", err);
      } finally {
        if (!canceled) setSpotlightLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  // Load paginated shops for browse section
  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/Business/paginated?pageNumber=${page}&pageSize=${PAGE_SIZE}`);
        if (!res.ok) throw new Error((await res.text()) || res.statusText);
        const { items, totalCount: count } = await res.json();
        const mapped = (items || []).map((shop) => ({
          ...shop,
          slug: shop.slug || toSlug(shop.name),
        }));
        if (!canceled) {
          setShops(mapped);
          setTotalCount(count || 0);
        }
      } catch (err) {
        if (!canceled) setError(err.message || "Failed to load shops");
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [page]);

  // Fetch all categories once
  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoadingCats(true);
      setErrorCats("");
      try {
        const res = await fetch(`${API_BASE}/ClothingCategory/all`);
        if (!res.ok) throw new Error((await res.text()) || res.statusText);
        const data = await res.json();
        if (!canceled) setCategories(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!canceled) setErrorCats(err.message || "Failed to load categories");
      } finally {
        if (!canceled) setLoadingCats(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
                <Link key={shop.businessId} to={`/shop/${shop.slug}`} className="brand-card featured">
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
                <Link key={shop.businessId} to={`/shop/${shop.slug}`} className="brand-card">
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
                    key={cat.clothingCategoryId}
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
                      <p className="category-count">
                        {t("category_cta", { defaultValue: "Click To See Featured Shops" })}
                      </p>
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
