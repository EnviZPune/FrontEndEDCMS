import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch } from "react-icons/fa";
import Fuse from "fuse.js";
import { useTranslation } from "react-i18next";
import "../Styling/searchbar.css";

const API_BASE = "https://api.triwears.com/api";
const DEFAULT_LOGO_LIGHT = "/Assets/default-shop-logo-light.png";
const DEFAULT_LOGO_DARK = "/Assets/default-shop-logo-dark.png";
const DEFAULT_PRODUCT_LIGHT = "/Assets/default-product-light.png";
const DEFAULT_PRODUCT_DARK  = "/Assets/default-product-dark.png";

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


const foldDiacritics = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ë/gi, "e")
    .replace(/ç/gi, "c");

const normalizeText = (s) => foldDiacritics(String(s || "").toLowerCase());
const tokenize = (s) => normalizeText(s).split(/[^a-z0-9]+/).filter(Boolean);
const LETTER_SIZES = [
  "XXXS",
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
  "XXXXL",
  "4XL",
  "5XL",
  "6XL",
];

const normalizeSizeToken = (s) => String(s).trim().toUpperCase().replace(/\s+/g, "");

function pickSizeLabel(item) {
  if (!item) return "";

  const single =
    item.size ||
    item.Size ||
    item.sizeLabel ||
    item.sizeName ||
    item.dimension ||
    item.Dimension;
  if (single && typeof single === "string") return single.trim();

  const arrayish =
    item.sizes ||
    item.Sizes ||
    item.availableSizes ||
    item.AvailableSizes ||
    item.sizeOptions ||
    item.SizeOptions;
  if (Array.isArray(arrayish)) {
    const parts = arrayish.map(String).map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts.join("/");
  }
  if (typeof arrayish === "string") {
    const parts = arrayish
      .split(/[\,\|/]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) return parts.join("/");
  }

  const dict =
    item.sizeMap ||
    item.availability ||
    item.Availability ||
    item.stockBySize ||
    item.StockBySize;
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
    if (LETTER_SIZES.includes(tok) || /^[0-9]{1,3}(\.[0-9])?$/.test(tok)) {
      out.add(tok);
    }
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

  const dicts = [
    item.sizeMap,
    item.availability,
    item.Availability,
    item.stockBySize,
    item.StockBySize,
  ].filter(Boolean);
  dicts.forEach((d) => {
    if (d && typeof d === "object" && !Array.isArray(d)) Object.keys(d).forEach(pushToken);
  });

  const variants = item.variants || item.Variants || item.options || item.Options;
  if (Array.isArray(variants)) {
    variants.forEach((v) => pushToken(v?.size || v?.Size || v?.option || v?.Option));
  }

  return Array.from(out);
}

function parseSizeFromQuery(q) {
  const parts = String(q).trim().split(/\s+/);
  const sizeTokens = [];
  const others = [];
  parts.forEach((p) => {
    const tok = normalizeSizeToken(p);
    if (LETTER_SIZES.includes(tok) || /^[0-9]{1,3}(\.[0-9])?$/.test(tok)) {
      sizeTokens.push(tok);
    } else {
      others.push(p);
    }
  });
  return { sizeTokens, nonSizeQuery: others.join(" ").trim() };
}

const COLOR_CANON = {
  black: ["black", "e zeze", "i zi", "zi"],
  white: ["white", "e bardhe", "bardh", "bardhe"],
  gray: ["gray", "grey", "gri"],
  blue: ["blue", "blu", "e kalter", "kalt\u00ebr", "i kalter"],
  lightblue: ["lightblue", "e kalter e hapur", "e qellet"],
  navy: ["navy", "navyblue", "blu e erret"],
  red: ["red", "e kuqe", "kuqe"],
  green: ["green", "jeshile", "i gjelber", "gjelber"],
  yellow: ["yellow", "e verdhe", "verdhe"],
  orange: ["orange", "portokalli"],
  brown: ["brown", "kafe"],
  beige: ["beige", "bezhe"],
  pink: ["pink", "roze", "roz"],
  purple: ["purple", "vjollce", "vjollce"],
};

const STYLE_CANON = {
  oversized: ["oversize", "oversized", "i gjere", "e gjere"],
  slimfit: ["slim", "slimfit", "i ngushte", "e ngushte"],
  regular: ["regular", "normal"],
  highwaist: ["high waist", "high-waist", "bel i larte", "i larte"],
  lowrise: ["low rise", "low-rise", "bel i ulet", "i ulet"],
  cargo: ["cargo", "xhepa", "kargo"],
  hooded: ["hoodie", "hooded", "me kapuc", "kapuc"],
  waterproof: ["waterproof", "rezistent ndaj ujit", "kundra ujit", "kund\u00ebr ujit"],
  padded: ["padded", "me shtrese", "me jastek"],
  vintage: ["vintage", "retro", "i vjeter", "second hand", "sekond hand"],
};

const CATEGORY_CANON = {
  tshirt: ["tshirt", "t shirt", "tee", "t-shirt", "bluze", "bluze e shkurter", "maice", "maic"],
  shirt: ["shirt", "kemishe", "kemish"],
  jeans: ["jeans", "xhinse", "xhin", "denim"],
  pants: ["pants", "trousers", "pantallona", "pantalona"],
  shorts: ["shorts", "pantallona te shkurtra", "shorc", "shorte"],
  jacket: ["jacket", "xhaket", "xhakete"],
  hoodie: ["hoodie", "bluze me kapuc", "kapucon"],
  dress: ["dress", "fustan"],
  skirt: ["skirt", "fund"],
  shoes: ["shoes", "kepuce", "k\u00ebpuce"],
  sneakers: ["sneakers", "atlete", "adidas"], // colloquial "adidas" for sneakers in Balkans
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

const REV_COLOR = buildReverseMap(COLOR_CANON);
const REV_STYLE = buildReverseMap(STYLE_CANON);
const REV_CATEGORY = buildReverseMap(CATEGORY_CANON);
const REV_BRAND = buildReverseMap(BRAND_ALIASES);

const STOP_EN = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "with",
  "for",
  "to",
]);
const STOP_AL = new Set(["dhe", "me", "per", "p\u00ebr", "te", "t\u00eb", "ne", "n\u00eb", "nga"]);

function removeStopWords(tokens) {
  return tokens.filter((t) => !STOP_EN.has(t) && !STOP_AL.has(t));
}

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

export default function SearchBar() {
  const { t } = useTranslation("searchbar");
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [shops, setShops] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);

  const [isDarkMode, setIsDarkMode] = useState(
    () =>
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

  const recognitionRef = useRef(null);

  useEffect(() => {
    const fetchAll = async () => {
      const token = getToken();
      if (!token) return;

      try {
        const payload = token.split(".")[1];
        const decoded = JSON.parse(window.atob(payload));
        setCurrentUserId(decoded.userId || decoded.id || decoded.sub);
      } catch (err) {
        console.error("Failed to decode token:", err);
      }

      const headers = { Authorization: `Bearer ${token}` };

      try {
        const [bizRes, catRes, userRes] = await Promise.all([
          fetch(`${API_BASE}/Business`, { headers }),
          fetch(`${API_BASE}/ClothingCategory/all`, { headers }),
          fetch(`${API_BASE}/User/all`, { headers }),
        ]);

        const bizData = await bizRes.json();
        const catData = await catRes.json();
        const userData = await userRes.json();

        const withItems = await Promise.all(
          bizData.map(async (b) => {
            const itemsRes = await fetch(`${API_BASE}/ClothingItem/business/${b.businessId}`, { headers });
            const itemsData = await itemsRes.json();
            return {
              id: b.businessId,
              slug: b.slug || slugify(b.name),
              name: b.name,
              logoUrl: (b.profilePictureUrl || "").trim(),
              address: b.address,
              phoneNumber: b.businessPhoneNumber,
              NIPT: b.nipt,
              description: b.description,
              clothingItems: itemsData.map((i) => {
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

                const colorFields = [i.color, i.colour, i.colors, i.Colours, i.Color, i.Colour]
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

                const aliasTokens = Array.from(alias);
                const aliasText = aliasTokens.join(" ");

                return {
                  id: i.clothingItemId,
                  name: i.name,
                  brand: i.brand,
                  model: i.model,
                  price: i.price,
                  category: i.category,
                  description: i.description,
                  imageUrl: (Array.isArray(i.pictureUrls) && i.pictureUrls.find(u => typeof u === "string" && u.trim())) || "",                  sizeLabel,
                  sizeTokens,
                  __aliasTokens: aliasTokens,
                  __aliasText: aliasText,
                };
              }),
            };
          })
        );

        setShops(withItems);
        setCategories(catData);

        const enrichedUsers = userData.map((u) => ({
          userId: u.userId,
          name: u.name,
          email: u.email,
          imageUrl: u.profilePictureUrl || u.profileImage || "/Assets/default-avatar.jpg",
        }));
        setUsers(enrichedUsers);
      } catch (err) {
        console.error("SearchBar fetch error:", err);
      }
    };

    fetchAll();
  }, []);

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

  const fuseItemsBaseOptions = useMemo(
    () => ({
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
    []
  );

  const fuseItems = useMemo(() => new Fuse(flatItems, fuseItemsBaseOptions), [flatItems, fuseItemsBaseOptions]);

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

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setGroups([]);
      return;
    }

    const timer = setTimeout(() => {
      const { sizeTokens, nonSizeQuery } = parseSizeFromQuery(q);

      const baseTokens = removeStopWords(tokenize(nonSizeQuery || q));
      const expanded = expandTokens(baseTokens);
      const expandedQuery = expanded.join(" ");
      const shopMatches = fuseShops.search(expandedQuery || q).map((r) => r.item);
      const categoryMatches = fuseCategories.search(expandedQuery || q).map((r) => r.item);
      const userMatches = fuseUsers.search(expandedQuery || q).map((r) => r.item);

      let itemMatches = [];
      if (sizeTokens.length) {
        const exact = flatItems.filter((it) => {
          if (!it.sizeTokens || it.sizeTokens.length === 0) return false;
          const set = new Set(it.sizeTokens.map(normalizeSizeToken));
          return sizeTokens.every((tok) => set.has(tok));
        });
        if (expandedQuery) {
          const fuseSubset = new Fuse(exact, fuseItemsBaseOptions);
          itemMatches = fuseSubset.search(expandedQuery).map((r) => r.item);
        } else {
          itemMatches = exact;
        }
      } else {
        itemMatches = fuseItems.search(expandedQuery || q).map((r) => r.item);
      }

          const fallbackLogo    = isDarkMode ? DEFAULT_LOGO_DARK  : DEFAULT_LOGO_LIGHT;
          const fallbackProduct = isDarkMode ? DEFAULT_PRODUCT_DARK : DEFAULT_PRODUCT_LIGHT;

      const shopsGroup = shopMatches.map((s) => ({
        type: "shop",
        id: s.id,
        slug: s.slug,
        name: s.name,
        imageUrl: s.logoUrl && s.logoUrl.trim() ? s.logoUrl : fallbackLogo,
      }));

      const itemsGroup = itemMatches.map((it) => ({
      type: "item",
      id: it.id,
      name: it.name,
      shopName: it.shopName || it.shopSlug,
      imageUrl: it.imageUrl && it.imageUrl.trim() ? it.imageUrl : fallbackProduct,
      sizeLabel: it.sizeLabel || "",
    }));

      const categoriesGroup = categoryMatches.map((c) => ({ type: "category", name: c.name }));

      const usersGroup = userMatches.map((u) => ({
        type: "user",
        id: u.userId,
        name: u.name,
        email: u.email,
        imageUrl: u.imageUrl,
      }));

      const groupTitles = {
        shops: t("groups.shops", { defaultValue: "Shops" }),
        items: t("groups.items", { defaultValue: "Clothing Items" }),
        categories: t("groups.categories", { defaultValue: "Categories" }),
        users: t("groups.users", { defaultValue: "Users" }),
      };

      const newGroups = [];
      if (shopsGroup.length) newGroups.push({ category: groupTitles.shops, results: shopsGroup });
      if (itemsGroup.length) newGroups.push({ category: groupTitles.items, results: itemsGroup });
      if (categoriesGroup.length) newGroups.push({ category: groupTitles.categories, results: categoriesGroup });
      if (usersGroup.length) newGroups.push({ category: groupTitles.users, results: usersGroup });

      setGroups(newGroups);
    }, 220);

    return () => clearTimeout(timer);
    }, 
    
    [
    searchQuery,
    fuseShops,
    fuseItems,
    fuseItemsBaseOptions,
    fuseCategories,
    fuseUsers,
    flatItems,
    isDarkMode,
    t,
  ]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      navigate(`/search?query=${encodeURIComponent(q)}`);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setGroups([]);
  };

  const highlight = (text) => {
    if (!searchQuery) return text;
    const safe = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${safe})`, "gi");
    return String(text)
      .split(re)
      .map((part, i) => (re.test(part) ? (
        <span key={i} className="highlight">{part}</span>
      ) : (
        <span key={i} className="highlight-part">{part}</span>
      )));
  };

  const handleClick = (item, e) => {
    e.preventDefault();
    if (!currentUserId) return;
    switch (item.type) {
      case "shop":
        window.location.href = `/shop/${item.slug}`;
        break;
      case "item":
        window.location.href = `/product/${item.id}`;
        break;
      case "category":
        window.location.href = `/category-filter?category=${encodeURIComponent(item.name)}`;
        break;
      case "user":
        window.location.href = item.id === currentUserId ? "/my-profile" : `/profile/${item.id}`;
        break;
      default:
        break;
    }
  };

  return (
    <form className="search-bar-container" onSubmit={handleSubmit}>
      <div className="search-input-container">
        <input
          type="text"
          placeholder={t("placeholder", {
            defaultValue:
              "Search shops, items, sizes (e.g., M, 42), colors (e.g., e zezë/black), categories, or users...",
          })}
          className="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <FaSearch className="search-icon" />
        <button type="submit" className="search-icon-button" />
        {searchQuery && (
          <button type="button" className="clear-button" onClick={clearSearch}>
            ✕
          </button>
        )}
      </div>

      {searchQuery && (
        <div className="search-dropdown active">
          {!currentUserId ? (
            <div className="search-category">
              <p className="no-results">
                <b>{t("mustLogin.title", { defaultValue: "You must have an account to use search!" })}</b>
              </p>
              <p>
                <a href="/login">{t("mustLogin.login", { defaultValue: "Log in" })}</a>{" "}
                {t("text.or", { defaultValue: "or" })}{" "}
                <a href="/register">{t("mustLogin.register", { defaultValue: "Create an Account" })}</a>
              </p>
            </div>
          ) : groups.length === 0 ? (
            <div className="search-category">
              <p className="no-results">{t("noResults", { defaultValue: "No results found" })}</p>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.category} className="search-category">
                <h4>{g.category}</h4>
                <ul>
                  {g.results.map((item) => (
                    <li
                      key={`${item.type}-${item.id ?? item.name}-${item.name}`}
                      className="search-result-item"
                      onClick={(e) => handleClick(item, e)}
                    >
                      {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="result-image"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = isDarkMode ? DEFAULT_PRODUCT_DARK : DEFAULT_PRODUCT_LIGHT;
                            }}
                          />
                        )}
                      <span>
                        {highlight(item.name)}
                        {item.type === "item" && (
                          <>
                            {" — "}
                            {item.shopName}
                            {item.sizeLabel ? (
                              <>
                                {" · "}
                                <b>{item.sizeLabel}</b>
                              </>
                            ) : null}
                          </>
                        )}
                        {item.type === "user" && ` — ${item.email}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
    </form>
  );
}
