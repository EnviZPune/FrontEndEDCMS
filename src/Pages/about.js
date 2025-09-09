import React, { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "../Styling/about.css";

const API_BASE = "https://api.triwears.com";

/* ---------- auth helpers (no Bearer when missing) ---------- */
const getToken = () => {
  const raw = localStorage.getItem("token") || localStorage.getItem("authToken");
  if (!raw || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.token || parsed;
  } catch {
    return raw.replace(/^"|"$/g, "");
  }
};
const getHeaders = () => {
  const token = getToken();
  const h = {};
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};
/* ----------------------------------------------------------- */

const About = () => {
  const { t, i18n } = useTranslation("about");

  const [storesCount, setStoresCount] = useState(null);
  const [productsCount, setProductsCount] = useState(null);

  // locale-aware number formatting
  const nf = useMemo(() => new Intl.NumberFormat(i18n.language || "en"), [i18n.language]);

  useEffect(() => {
    let alive = true;

    const fetchStats = async () => {
      try {
        // Fetch all businesses
        const storesRes = await fetch(`${API_BASE}/api/Business`, { headers: getHeaders() });
        if (!storesRes.ok) {
          console.error("Failed to fetch stores:", storesRes.status);
          if (!alive) return;
          setStoresCount(0);
          setProductsCount(0);
          return;
        }
        const stores = await storesRes.json();
        const storeList = Array.isArray(stores) ? stores : [];
        if (!alive) return;

        setStoresCount(storeList.length);

        // To avoid hammering the API, fetch items in small batches
        const chunk = (arr, size) => {
          const out = [];
          for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
          return out;
        };

        const chunks = chunk(storeList, 8); // 8 stores at a time
        let total = 0;

        for (const group of chunks) {
          if (!alive) return;
          const results = await Promise.all(
            group.map(async (store) => {
              const businessId = store.id ?? store.businessId;
              if (businessId == null) return 0;
              try {
                const res = await fetch(`${API_BASE}/api/ClothingItem/business/${businessId}`, {
                  headers: getHeaders(),
                });
                if (!res.ok) return 0;
                const items = await res.json();
                return Array.isArray(items) ? items.length : 0;
              } catch {
                return 0;
              }
            })
          );
          total += results.reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0);
          if (!alive) return;
          setProductsCount((prev) => (prev == null ? total : prev + (total - prev))); // progressive update
        }

        if (alive) setProductsCount((prev) => (prev == null ? 0 : prev));
      } catch (err) {
        console.error("Error fetching stats:", err);
        if (!alive) return;
        setStoresCount(0);
        setProductsCount(0);
      }
    };

    fetchStats();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <Navbar />
      <div className="about-container">
        {/* Hero Section */}
        <div className="about-hero">
          <div className="about-hero-content">
            <h1 className="about-title">{t("hero.title")}</h1>
            <p className="about-subtitle">{t("hero.subtitle")}</p>
            <div className="about-logo-section">
              <img
                src={`${process.env.PUBLIC_URL}/Assets/logo.png`}
                alt={t("hero.logo_alt")}
                className="about-logo"
              />
              <p className="about-slogan">{t("hero.slogan")}</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="about-content">
          <div className="about-section">
            <h2 className="about-section-title">{t("sections.welcome.title")}</h2>
            <p className="about-paragraph">
              {t("sections.welcome.p1.a")}{" "}
              <span className="about-highlight">{t("sections.welcome.p1.b_highlight")}</span>{" "}
              {t("sections.welcome.p1.c")}{" "}
              <span className="about-highlight">{t("sections.welcome.p1.d_highlight")}</span>
              {t("sections.welcome.p1.e")}
            </p>
          </div>

          <div className="about-section">
            <h2 className="about-section-title">{t("sections.how.title")}</h2>
            <p className="about-paragraph">
              {t("sections.how.p1.a")}{" "}
              <span className="about-highlight">{t("sections.how.p1.b_highlight")}</span>{" "}
              {t("sections.how.p1.c")}
            </p>
          </div>

          <div className="about-section">
            <h2 className="about-section-title">{t("sections.real.title")}</h2>
            <p className="about-paragraph">
              {t("sections.real.p1.a")}{" "}
              <span className="about-highlight">{t("sections.real.p1.b_highlight")}</span>
            </p>
            <p className="about-paragraph">{t("sections.real.p2")}</p>
          </div>

          <div className="about-section">
            <h2 className="about-section-title">{t("sections.promise.title")}</h2>
            <p className="about-paragraph">
              {t("sections.promise.p1.a")}{" "}
              <span className="about-highlight">{t("sections.promise.p1.b_highlight")}</span>.
            </p>
            <p className="about-paragraph">{t("sections.promise.p2")}</p>
          </div>
        </div>

        {/* Features Section */}
        <div className="about-features">
          <div className="about-feature">
            <div className="about-feature-icon">🔍</div>
            <h3 className="about-feature-title">{t("features.realtime.title")}</h3>
            <p className="about-feature-description">{t("features.realtime.desc")}</p>
          </div>

          <div className="about-feature">
            <div className="about-feature-icon">🏪</div>
            <h3 className="about-feature-title">{t("features.verified.title")}</h3>
            <p className="about-feature-description">{t("features.verified.desc")}</p>
          </div>

          <div className="about-feature">
            <div className="about-feature-icon">📱</div>
            <h3 className="about-feature-title">{t("features.mobile.title")}</h3>
            <p className="about-feature-description">{t("features.mobile.desc")}</p>
          </div>
        </div>

        <div className="about-stats">
          <div className="about-stat">
            <div className="about-stat-value">
              {storesCount !== null ? nf.format(storesCount) : "…"}
            </div>
            <div className="about-stat-label">{t("stats.registered_stores")}</div>
          </div>

          <div className="about-stat">
            <div className="about-stat-value">
              {productsCount !== null ? nf.format(productsCount) : "…"}
            </div>
            <div className="about-stat-label">{t("stats.products_listed")}</div>
          </div>

          <div className="about-stat">
            <div className="about-stat-value">50+</div>
            <div className="about-stat-label">{t("stats.cities_covered")}</div>
          </div>

          <div className="about-stat">
            <div className="about-stat-value">24/7</div>
            <div className="about-stat-label">{t("stats.realtime_updates")}</div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="about-cta">
          <div className="about-cta-content">
            <h2 className="about-cta-title">{t("cta.title")}</h2>
            <p className="about-cta-text">{t("cta.text")}</p>
            <a href="/allshops" className="about-cta-button" aria-label={t("cta.explore_aria")}>
              {t("cta.explore")} <span>→</span>
            </a>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default About;
