// src/Pages/CategoryFilter.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import Search from "../Components/SearchBar.js";
import Pagination from "../Components/Pagination.tsx";
import "../Styling/categoryfilter.css";

const API_BASE = "https://api.triwears.com/api";
const DEFAULT_LOGO_LIGHT = "/Assets/default-shop-logo-light.png";
const DEFAULT_LOGO_DARK  = "/Assets/default-shop-logo-dark.png";

const getToken = () => {
  const raw = localStorage.getItem("token");
  if (!raw) return null;
  try { const parsed = JSON.parse(raw); return parsed.token ?? raw; } catch { return raw; }
};

const fold = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const catKey = (s) => fold(s).replace(/[^a-z0-9]+/g, "-");

async function pMapLimited(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

export default function CategoryFilter() {
  const [searchParams] = useSearchParams();
  const categoryName   = searchParams.get("category") || "";
  const wantedKey      = useMemo(() => catKey(categoryName), [categoryName]);

  const [allMatches, setAllMatches] = useState([]);
  const [visible, setVisible]       = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  const pageSize    = 6;
  const cardsToShow = 5;
  const carouselRef = useRef(null);

  const [isDarkMode, setIsDarkMode] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setIsDarkMode(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else if (mq.removeListener) mq.removeListener(onChange);
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    async function load() {
      if (!wantedKey) {
        setAllMatches([]); setVisible([]); setTotalCount(0); setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setPage(1);
      setAllMatches([]);
      setVisible([]);

      const token   = getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      try {
        // Map category name -> id for robust comparisons
        const catsRes = await fetch(`${API_BASE}/ClothingCategory/all`, { headers });
        const cats    = catsRes.ok ? await catsRes.json() : [];
        const nameToId = new Map(
          cats.map((c) => [catKey(c?.name || c?.Name || ""), String(c?.clothingCategoryId ?? c?.categoryId ?? c?.CategoryId ?? "")])
        );
        const wantedId = nameToId.get(wantedKey) || "";

        // A) Shops directly tagged under this category name (backend endpoint)
        const resA  = await fetch(`${API_BASE}/Business/category-name/${encodeURIComponent(categoryName)}`, { headers });
        const listA = resA.ok ? (await resA.json()) : [];

        // B) Shops that have at least one item in this category (by name OR id)
        const resAllShops = await fetch(`${API_BASE}/Business`, { headers });
        const allShops    = resAllShops.ok ? await resAllShops.json() : [];

        const remaining = allShops.filter(
          (b) => !listA.some((s) => String(s.businessId) === String(b.businessId))
        );

        const resultsB = await pMapLimited(remaining, 8, async (b) => {
          try {
            const r = await fetch(`${API_BASE}/ClothingItem/business/${b.businessId}`, { headers });
            if (!r.ok) return null;
            const items = await r.json();
            const hasMatch = items.some((it) => {
              // normalize category NAME and ID from item
              const byNameKey =
                catKey(it?.category || it?.categoryName || it?.Category || it?.clothingCategoryName || "") || "";
              const itemCatId = String(
                it?.clothingCategoryId ??
                it?.ClothingCategoryId ??
                it?.categoryId ??
                it?.CategoryId ??
                it?.clothingCategory?.clothingCategoryId ??
                it?.category?.categoryId ??
                ""
              );

              return (byNameKey && byNameKey === wantedKey) || (wantedId && itemCatId === wantedId);
            });
            return hasMatch ? b : null;
          } catch {
            return null;
          }
        });

        // Union + de-dupe
        const unionMap = new Map();
        [...listA, ...resultsB.filter(Boolean)].forEach((b) => {
          if (!b) return;
          unionMap.set(String(b.businessId), b);
        });
        const union = Array.from(unionMap.values()).sort((a, b) =>
          fold(a?.name || a?.slug).localeCompare(fold(b?.name || b?.slug))
        );

        if (canceled) return;

        setAllMatches(union);
        setTotalCount(union.length);
        setVisible(union.slice(0, pageSize));
        setPage(1);
      } catch (e) {
        if (!canceled) setError(e?.message || "Failed to load category.");
      } finally {
        if (!canceled) setLoading(false);
      }
    }

    load();
    return () => { canceled = true; };
  }, [wantedKey, categoryName]);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const onScroll = () => {
      if (loading) return;
      if (el.scrollWidth - el.scrollLeft - el.clientWidth < 150 && visible.length < totalCount) {
        const nextPage = page + 1;
        setVisible(allMatches.slice(0, nextPage * pageSize));
        setPage(nextPage);
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [visible, totalCount, page, loading, allMatches]);

  const handlePageChange = (newPage) => {
    setVisible(allMatches.slice(0, newPage * pageSize));
    setPage(newPage);
    carouselRef.current?.scrollTo({ left: 0, behavior: "auto" });
  };

  const fallbackLogo = isDarkMode ? DEFAULT_LOGO_DARK : DEFAULT_LOGO_LIGHT;

  return (
    <>
      <Navbar />

      <div className="hero-banner">
        <div className="hero-overlay" />
        <div className="hero-content">
          <h1>Category: {categoryName}</h1>
          <p>Showing all shops in this category</p>
          <Search />
        </div>
      </div>

      <div className="shop-list-container">
        <div className="shop-list-header">
          <h2>Filtered Shops</h2>
        </div>

        {error && <p className="error-text">Error: {error}</p>}
        {!loading && !error && visible.length === 0 && (
          <p className="no-shops-text">No shops yet in this category</p>
        )}

        <div className="browse-shops-wrapper">
          <div className="browse-carousel" ref={carouselRef}>
            {visible.map((shop, i) => (
              <Link
                key={`${shop.businessId}-${i}`}
                to={`/shop/${encodeURIComponent(shop.slug || shop.name || "")}`}
                className="carousel-slide"
                style={{ flex: `0 0 ${100 / cardsToShow}%` }}
              >
                <div className="shop-card">
                  <div className="shop-card-media">
                    {shop.profilePictureUrl ? (
                      <img
                        src={shop.profilePictureUrl}
                        alt={`${shop.name || shop.slug || "Shop"} Logo`}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = fallbackLogo;
                        }}
                      />
                    ) : (
                      <img src={fallbackLogo} alt="Shop Logo" />
                    )}
                  </div>
                  <h3 className="shop-card-title">{shop.name || shop.slug}</h3>
                </div>
              </Link>
            ))}
            {loading && <div className="loading-spinner small" />}
            <div className="carousel-end-sentinel" />
          </div>
        </div>

        <Pagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={handlePageChange}
        />
      </div>

      <Footer />
    </>
  );
}
