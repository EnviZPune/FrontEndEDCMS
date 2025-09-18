// src/Pages/SearchResultsPage.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useLocation, Link } from "react-router-dom";
import Fuse from "fuse.js";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "../Styling/searchresults.css";

const API_BASE = "https://api.triwears.com/api";

// Theme-aware loading GIFs
const LOADING_GIF_LIGHT = "/Assets/triwears-black-loading.gif";
const LOADING_GIF_DARK = "/Assets/triwears-white-loading.gif";
const DEFAULT_LOGO_LIGHT = "/Assets/default-shop-logo-light.png";
const DEFAULT_LOGO_DARK = "/Assets/default-shop-logo-dark.png";

function getToken() {
  const raw = localStorage.getItem("token");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.token ?? raw;
  } catch {
    return raw;
  }
}

const slugify = (str) =>
  String(str || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

/** ─────────────────────────────────────────────────────────────────────────
 * Normalization & token helpers (bilingual SQ/EN, slang-aware)
 * ───────────────────────────────────────────────────────────────────────── */
const foldDiacritics = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ë/gi, "e")
    .replace(/ç/gi, "c");

const normalizeText = (s) => foldDiacritics(String(s || "").toLowerCase());
const tokenize = (s) => normalizeText(s).split(/[^a-z0-9]+/).filter(Boolean);

const STOP_EN = new Set(["the", "a", "an", "and", "or", "of", "with", "for", "to"]);
const STOP_AL = new Set(["dhe", "me", "per", "p\u00ebr", "te", "t\u00eb", "ne", "n\u00eb", "nga"]);
const removeStopWords = (tokens) => tokens.filter((t) => !STOP_EN.has(t) && !STOP_AL.has(t));

function buildReverseMap(canon) {
  const map = new Map();
  for (const [canonical, arr] of Object.entries(canon)) {
    for (const raw of arr) {
      const tok = normalizeText(raw);
      if (!map.has(tok)) map.set(tok, new Set());
      map.get(tok).add(canonical);
    }
  }
  return map;
}

// Colors, styles, categories, brands (keep all lowercase and diacritics-folded)
const COLOR_CANON = {
  black: ["black", "e zeze", "i zi", "zi"],
  white: ["white", "e bardhe", "bardhe", "bardh"],
  gray: ["gray", "grey", "gri"],
  blue: ["blue", "blu", "e kalter", "i kalter"],
  navy: ["navy", "navyblue", "blu e erret"],
  red: ["red", "e kuqe", "kuqe"],
  green: ["green", "jeshile", "i gjelber", "gjelber"],
  yellow: ["yellow", "e verdhe", "verdhe"],
  orange: ["orange", "portokalli"],
  brown: ["brown", "kafe"],
  beige: ["beige", "bezhe"],
  pink: ["pink", "roze", "roz"],
  purple: ["purple", "vjollce"],
};

const STYLE_CANON = {
  oversized: ["oversize", "oversized", "i gjere", "e gjere"],
  slimfit: ["slim", "slimfit", "i ngushte", "e ngushte"],
  regular: ["regular", "normal"],
  highwaist: ["high waist", "high-waist", "bel i larte", "i larte"],
  lowrise: ["low rise", "low-rise", "bel i ulet", "i ulet"],
  cargo: ["cargo", "xhepa", "kargo"],
  hooded: ["hoodie", "hooded", "me kapuc", "kapuc"],
  waterproof: ["waterproof", "rezistent ndaj ujit", "kundra ujit"],
  padded: ["padded", "me shtrese", "me jastek"],
  vintage: ["vintage", "retro", "i vjeter", "second hand", "sekond hand"],
};

const CATEGORY_CANON = {
  tshirt: ["tshirt", "t shirt", "tee", "t-shirt", "bluze", "maice", "maic"],
  shirt: ["shirt", "kemishe", "kemish"],
  jeans: ["jeans", "xhinse", "xhin", "denim"],
  pants: ["pants", "trousers", "pantallona", "pantalona"],
  shorts: ["shorts", "pantallona te shkurtra", "shorc", "shorte"],
  jacket: ["jacket", "xhaket", "xhakete"],
  hoodie: ["hoodie", "bluze me kapuc", "kapucon"],
  dress: ["dress", "fustan"],
  skirt: ["skirt", "fund"],
  shoes: ["shoes", "kepuce", "k\u00ebpuce"],
  sneakers: ["sneakers", "atlete", "adidas"],
  boots: ["boots", "cizme"],
  hat: ["hat", "kapele"],
  bag: ["bag", "cante", "cant"],
};

const BRAND_ALIASES = {
  "new balance": ["new balance", "nb"],
  nike: ["nike", "air force", "af1", "air max", "airmax"],
  adidas: ["adidas", "yeezy", "ultraboost", "ultra boost"],
  puma: ["puma"],
  reebok: ["reebok"],
  converse: ["converse", "all star", "chuck taylor"],
  jordan: ["jordan", "air jordan", "aj1", "j1", "retro"],
};

const REV_COLOR = buildReverseMap(COLOR_CANON);
const REV_STYLE = buildReverseMap(STYLE_CANON);
const REV_CATEGORY = buildReverseMap(CATEGORY_CANON);
const REV_BRAND = buildReverseMap(BRAND_ALIASES);

function expandTokens(tokens) {
  const out = new Set(tokens);
  for (const tok of tokens) {
    if (REV_CATEGORY.has(tok)) for (const c of REV_CATEGORY.get(tok)) out.add(c);
    if (REV_COLOR.has(tok)) for (const c of REV_COLOR.get(tok)) out.add(c);
    if (REV_STYLE.has(tok)) for (const c of REV_STYLE.get(tok)) out.add(c);
    if (REV_BRAND.has(tok)) for (const c of REV_BRAND.get(tok)) out.add(c);
  }
  return Array.from(out);
}

function detectCanonicalColors(textLike) {
  const toks = tokenize(textLike);
  const found = new Set();
  for (const t of toks) if (REV_COLOR.has(t)) for (const c of REV_COLOR.get(t)) found.add(c);
  return Array.from(found);
}

/** ------------------------ Size helpers ------------------------ */
const LETTER_SIZES = ["XXXS", "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "4XL", "5XL", "6XL"];
const normalizeSizeToken = (s) => String(s).trim().toUpperCase().replace(/\s+/g, "");

function pickSizeLabel(item) {
  if (!item) return "";
  const single = item.size || item.Size || item.sizeLabel || item.sizeName || item.dimension || item.Dimension;
  if (single && typeof single === "string") return single.trim();

  const arrayish =
    item.sizes || item.Sizes || item.availableSizes || item.AvailableSizes || item.sizeOptions || item.SizeOptions;
  if (Array.isArray(arrayish)) {
    const parts = arrayish.map(String).map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts.join("/");
  }
  if (typeof arrayish === "string") {
    const parts = arrayish.split(/[\,\|/]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts.join("/");
  }

  const dict = item.sizeMap || item.availability || item.Availability || item.stockBySize || item.StockBySize;
  if (dict && typeof dict === "object" && !Array.isArray(dict)) {
    const keys = Object.keys(dict).map((k) => String(k).trim()).filter(Boolean);
    if (keys.length) return keys.join("/");
  }

  const variants = item.variants || item.Variants || item.options || item.Options;
  if (Array.isArray(variants)) {
    const parts = Array.from(
      new Set(
        variants
          .map((v) => v?.size || v?.Size || v?.option || v?.Option)
          .map((s) => (s == null ? "" : String(s).trim()))
          .filter(Boolean)
      )
    );
    if (parts.length) return parts.join("/");
  }
  return "";
}

function extractSizeTokens(item) {
  const out = new Set();
  const pushToken = (t) => {
    const tok = normalizeSizeToken(t);
    if (!tok) return;
    if (LETTER_SIZES.includes(tok) || /^[0-9]{1,3}(\.[0-9])?$/.test(tok)) out.add(tok);
  };

  const label = pickSizeLabel(item);
  if (label) {
    label
      .split(/[\,\|/ ]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach(pushToken);
  }

  const rawArrays = [
    item.sizes,
    item.Sizes,
    item.availableSizes,
    item.AvailableSizes,
    item.sizeOptions,
    item.SizeOptions,
  ].filter(Boolean);
  rawArrays.forEach((arr) => {
    if (Array.isArray(arr)) arr.forEach(pushToken);
    else if (typeof arr === "string") arr.split(/[\,\|/ ]+/).forEach(pushToken);
  });

  const dicts = [item.sizeMap, item.availability, item.Availability, item.stockBySize, item.StockBySize].filter(Boolean);
  dicts.forEach((d) => {
    if (d && typeof d === "object" && !Array.isArray(d)) Object.keys(d).forEach(pushToken);
  });

  const variants = item.variants || item.Variants || item.options || item.Options;
  if (Array.isArray(variants)) variants.forEach((v) => pushToken(v?.size || v?.Size || v?.option || v?.Option));

  return Array.from(out);
}

function parseSizeFromQuery(q) {
  const parts = String(q).trim().split(/\s+/);
  const sizeTokens = [];
  const others = [];
  parts.forEach((p) => {
    const tok = normalizeSizeToken(p);
    if (LETTER_SIZES.includes(tok) || /^[0-9]{1,3}(\.[0-9])?$/.test(tok)) sizeTokens.push(tok);
    else others.push(p);
  });
  return { sizeTokens, nonSizeQuery: others.join(" ").trim() };
}

export default function SearchResultsPage() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const query = params.get("query")?.trim() || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shops, setShops] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [suggestion, setSuggestion] = useState("");

  // Theme for loaders & logo fallbacks
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setIsDarkMode(e.matches);
    try {
      mq.addEventListener("change", onChange);
    } catch {
      mq.addListener(onChange);
    }
    return () => {
      try {
        mq.removeEventListener("change", onChange);
      } catch {
        mq.removeListener(onChange);
      }
    };
  }, []);

  // Fetch all data once
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const token = getToken();
      if (!token) {
        setError("Please log in to search.");
        setLoading(false);
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };

      try {
        const [bizRes, catRes, userRes] = await Promise.all([
          fetch(`${API_BASE}/Business`, { headers }),
          fetch(`${API_BASE}/ClothingCategory/all`, { headers }),
          fetch(`${API_BASE}/User/all`, { headers }),
        ]);

        if (!bizRes.ok || !catRes.ok || !userRes.ok) throw new Error("Failed to fetch search data.");

        const bizData = await bizRes.json();
        const catData = await catRes.json();
        const userData = await userRes.json();

        // Enrich shops and items (build aliasText like in SearchBar)
        const withItems = await Promise.all(
          bizData.map(async (b) => {
            const itRes = await fetch(`${API_BASE}/ClothingItem/business/${b.businessId}`, { headers });
            const items = itRes.ok ? await itRes.json() : [];

            const enrichedItems = items.map((i) => {
              const sizeLabel = pickSizeLabel(i);
              const sizeTokens = extractSizeTokens(i);

              const alias = new Set();
              const brand = normalizeText(i.brand);
              const model = normalizeText(i.model);
              const name = normalizeText(i.name);
              const desc = normalizeText(i.description);
              const categoryRaw = normalizeText(i.category || i.categoryName);

              tokenize(i.name).forEach((t) => alias.add(t));
              tokenize(i.brand).forEach((t) => alias.add(t));
              tokenize(i.model).forEach((t) => alias.add(t));
              tokenize(i.description).forEach((t) => alias.add(t));

              if (categoryRaw) {
                alias.add(categoryRaw);
                if (REV_CATEGORY.has(categoryRaw)) for (const c of REV_CATEGORY.get(categoryRaw)) alias.add(c);
              }
              if (brand) {
                alias.add(brand);
                if (REV_BRAND.has(brand)) for (const c of REV_BRAND.get(brand)) alias.add(c);
              }
              [model, name].forEach((txt) => {
                tokenize(txt).forEach((tok) => {
                  if (REV_BRAND.has(tok)) for (const c of REV_BRAND.get(tok)) alias.add(c);
                });
              });

              const colorFields = [i.color, i.colour, i.colors, i.colours, i.Color, i.Colour]
                .filter(Boolean)
                .map((x) => (Array.isArray(x) ? x.join(" ") : String(x)));
              const colorTokens = new Set();
              colorFields.forEach((cf) => detectCanonicalColors(cf).forEach((c) => colorTokens.add(c)));
              detectCanonicalColors(i.name).forEach((c) => colorTokens.add(c));
              detectCanonicalColors(i.description).forEach((c) => colorTokens.add(c));
              for (const c of colorTokens) alias.add(c);

              const styleTokens = new Set();
              tokenize(i.name)
                .concat(tokenize(i.description))
                .forEach((tok) => {
                  if (REV_STYLE.has(tok)) for (const s of REV_STYLE.get(tok)) styleTokens.add(s);
                });
              for (const s of styleTokens) alias.add(s);

              sizeTokens.forEach((s) => alias.add(normalizeText(s)));

              return {
                id: i.clothingItemId,
                name: i.name,
                brand: i.brand,
                model: i.model,
                price: i.price,
                category: i.category,
                description: i.description,
                imageUrl: i.pictureUrls?.[0] || "/Assets/default-product.jpg",
                sizeLabel,
                sizeTokens,
                __aliasTokens: Array.from(alias),
                __aliasText: Array.from(alias).join(" "),
              };
            });

            return {
              id: b.businessId,
              slug: b.slug || slugify(b.name),
              name: b.name,
              logoUrlRaw: (b.profilePictureUrl || "").trim(),
              description: b.description,
              address: b.address,
              NIPT: b.nipt,
              phoneNumber: b.businessPhoneNumber,
              clothingItems: enrichedItems,
            };
          })
        );

        const enrichedUsers = userData.map((u) => ({
          userId: u.userId,
          name: u.name,
          email: u.email,
          imageUrl: u.profilePictureUrl || u.profileImage || "/Assets/default-avatar.jpg",
        }));

        setShops(withItems);
        setCategories(catData);
        setUsers(enrichedUsers);
      } catch (e) {
        console.error(e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // Flatten items for Fuse
  const flatItems = useMemo(
    () =>
      shops.flatMap((shop) =>
        shop.clothingItems.map((it) => ({
          ...it,
          shopSlug: shop.slug,
          shopName: shop.name,
        }))
      ),
    [shops]
  );

  /** Fuse indexes: tuned like SearchBar */
  const fuseShops = useMemo(
    () =>
      new Fuse(shops, {
        keys: [
          { name: "name", weight: 0.7 },
          { name: "description", weight: 0.3 },
          { name: "address", weight: 0.5 },
          { name: "NIPT", weight: 0.2 },
          { name: "phoneNumber", weight: 0.2 },
        ],
        threshold: 0.35,
        distance: 200,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [shops]
  );

  const fuseItems = useMemo(
    () =>
      new Fuse(flatItems, {
        includeScore: true,
        threshold: 0.36,
        distance: 300,
        ignoreLocation: true,
        minMatchCharLength: 2,
        keys: [
          { name: "__aliasText", weight: 1.1 },
          { name: "name", weight: 0.5 },
          { name: "brand", weight: 0.5 },
          { name: "model", weight: 0.35 },
          { name: "category", weight: 0.35 },
          { name: "description", weight: 0.2 },
          { name: "sizeLabel", weight: 0.7 },
          { name: "sizeTokens", weight: 0.9 },
        ],
      }),
    [flatItems]
  );

  const fuseCategories = useMemo(
    () =>
      new Fuse(categories, {
        keys: ["name"],
        threshold: 0.3,
        distance: 200,
        ignoreLocation: true,
      }),
    [categories]
  );

  const fuseUsers = useMemo(
    () =>
      new Fuse(users, {
        keys: ["name", "email"],
        threshold: 0.3,
        distance: 200,
        ignoreLocation: true,
      }),
    [users]
  );

  // Suggestions include alias text for better "Did you mean"
  const fuseSuggestions = useMemo(() => {
    const suggestions = [
      ...shops.map((s) => s.name),
      ...flatItems.map((i) => i.name),
      ...flatItems.flatMap((i) => i.__aliasTokens || []),
      ...categories.map((c) => c.name),
      ...users.map((u) => u.name),
    ];
    return new Fuse(suggestions, { includeScore: true, threshold: 0.6, distance: 300, ignoreLocation: true });
  }, [shops, flatItems, categories, users]);

  // Run fuzzy filter whenever data or query changes
  useEffect(() => {
    if (loading || error) return;

    if (!query) {
      setGroups([]);
      setSuggestion("");
      return;
    }

    const { sizeTokens, nonSizeQuery } = parseSizeFromQuery(query);
    const baseTokens = removeStopWords(tokenize(nonSizeQuery || query));
    const expanded = expandTokens(baseTokens);
    const expandedQuery = expanded.join(" ");

    const shopMatches = fuseShops.search(expandedQuery || query).map((r) => r.item);
    const categoryMatches = fuseCategories.search(expandedQuery || query).map((r) => r.item);
    const userMatches = fuseUsers.search(expandedQuery || query).map((r) => r.item);

    let itemMatches = [];
    if (sizeTokens.length) {
      const exact = flatItems.filter((it) => {
        if (!it.sizeTokens || it.sizeTokens.length === 0) return false;
        const set = new Set(it.sizeTokens.map(normalizeSizeToken));
        return sizeTokens.every((tok) => set.has(tok));
      });
      if (expandedQuery) {
        const fuseSubset = new Fuse(exact, fuseItems.options);
        itemMatches = fuseSubset.search(expandedQuery).map((r) => r.item);
      } else {
        itemMatches = exact;
      }
    } else {
      itemMatches = fuseItems.search(expandedQuery || query).map((r) => r.item);
    }

    const fallbackLogo = isDarkMode ? DEFAULT_LOGO_DARK : DEFAULT_LOGO_LIGHT;

    const shopsGroup = shopMatches.map((s) => ({
      type: "shop",
      id: s.id,
      slug: s.slug,
      name: s.name,
      imageUrl: s.logoUrlRaw && s.logoUrlRaw.trim() ? s.logoUrlRaw : fallbackLogo,
    }));

    const itemsGroup = itemMatches.map((it) => ({
      type: "item",
      id: it.id,
      name: it.name,
      brand: it.brand,
      shopSlug: it.shopSlug,
      shopName: it.shopName,
      imageUrl: it.imageUrl,
      sizeLabel: it.sizeLabel || "",
    }));

    const categoriesGroup = categoryMatches.map((c) => ({ type: "category", name: c.name, imageUrl: "/Assets/default-category.png" }));

    const usersGroup = userMatches.map((u) => ({ type: "user", id: u.userId, name: u.name, email: u.email, imageUrl: u.imageUrl }));

    const newGroups = [];
    if (shopsGroup.length) newGroups.push({ title: "Shops", items: shopsGroup });
    if (itemsGroup.length) newGroups.push({ title: "Clothing Items", items: itemsGroup });
    if (categoriesGroup.length) newGroups.push({ title: "Categories", items: categoriesGroup });
    if (usersGroup.length) newGroups.push({ title: "Users", items: usersGroup });

    setGroups(newGroups);

    if (newGroups.length === 0) {
      const [best] = fuseSuggestions.search(query);
      setSuggestion(best ? best.item : "");
    } else {
      setSuggestion("");
    }
  }, [loading, error, query, fuseShops, fuseItems, fuseCategories, fuseUsers, fuseSuggestions, flatItems, isDarkMode]);

  const highlight = (text, q) => {
    if (!q) return text;
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${safe})`, "gi");
    return String(text)
      .split(re)
      .map((part, i) => (re.test(part) ? (
        <span key={i} className="highlight">{part}</span>
      ) : (
        <span key={i} className="highlight-part">{part}</span>
      )));
  };

  return (
    <>
      <Navbar />

      <main className="search-results-page">
        {loading ? (
          <div className="loading-container" aria-live="polite" aria-busy="true" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 0" }}>
            <img className="loading-gif" src={isDarkMode ? LOADING_GIF_DARK : LOADING_GIF_LIGHT} alt="Loading" width={140} height={140} style={{ objectFit: "contain" }} />
            <p className="loading-text">Loading ...</p>
          </div>
        ) : error ? (
          <div className="search-results__error">{error}</div>
        ) : (
          <>
            <header className="search-results__header">
              <h1 className="search-results__title">Search Results for “{query}”</h1>
            </header>

            {groups.length === 0 ? (
              <>
                <p className="search-results__empty">No results found.</p>
                {suggestion && (
                  <p className="search-results__suggestion">
                    Did you mean {""}
                    <Link to={`/search?query=${encodeURIComponent(suggestion)}`}>
                      <strong>{suggestion}</strong>
                    </Link>
                    ?
                  </p>
                )}
              </>
            ) : (
              groups.map((group) => (
                <section key={group.title} className="search-results__group">
                  <h2 className="search-results__group-title">{group.title}</h2>
                  <ul className="search-results__list">
                    {group.items.map((item) => (
                      <li key={`${item.type}-${item.id ?? item.name}-${item.name}`} className="search-results__item">
                        {item.type === "shop" && (
                          <Link to={`/shop/${item.slug}`} className="search-results__link">
                            <img src={item.imageUrl} alt={item.name} className="search-results__image" />
                            <span className="search-results__item-name">{highlight(item.name, query)}</span>
                          </Link>
                        )}

                        {item.type === "item" && (
                          <Link to={`/product/${item.id}`} className="search-results__link search-results__item-with-image">
                            <img src={item.imageUrl} alt={item.name} className="search-results__image" />
                            <div className="search-results__item-info">
                              <span className="search-results__item-name">
                                {item.brand ? (
                                  <>
                                    {highlight(item.name, query)} — {highlight(item.brand, query)}
                                  </>
                                ) : (
                                  highlight(item.name, query)
                                )}
                              </span>
                              <span className="search-results__item-meta">
                                {item.shopSlug}
                                {item.sizeLabel ? (
                                  <>
                                    {" · "}
                                    <b>{item.sizeLabel}</b>
                                  </>
                                ) : null}
                              </span>
                            </div>
                          </Link>
                        )}

                        {item.type === "category" && (
                          <Link to={`/category-filter?category=${encodeURIComponent(item.name)}`} className="search-results__link">
                            <img src={item.imageUrl} alt={item.name} className="search-results__image" />
                            <span className="search-results__item-name">{highlight(item.name, query)}</span>
                          </Link>
                        )}

                        {item.type === "user" && (
                          <Link to={`/profile/${item.id}`} className="search-results__link search-results__item-user">
                            <img src={item.imageUrl} alt={item.name} className="search-results__image" />
                            <div className="search-results__item-info">
                              <span className="search-results__item-name">{highlight(item.name, query)}</span>
                              <span className="search-results__item-email">{item.email}</span>
                            </div>
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </>
        )}
      </main>

      <Footer />
    </>
  );
}
