// src/components/SearchBar.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch } from "react-icons/fa";
import Fuse from "fuse.js";
import { useTranslation } from "react-i18next";
import "../Styling/searchbar.css";

const API_BASE = "https://api.triwears.com/api/api";

/* ---------- THEME-AWARE DEFAULT LOGOS ---------- */
const DEFAULT_LOGO_LIGHT  = "/Assets/default-shop-logo-light.png";
const DEFAULT_LOGO_DARK   = "/Assets/default-shop-logo-dark.png";
/* ----------------------------------------------- */

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
  str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

/* ------------------------- Size helpers ------------------------- */
const LETTER_SIZES = [
  "XXXS", "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "4XL", "5XL", "6XL"
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
      .split(/[,\|/]+/)
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
      .split(/[,\|/ ]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach(pushToken);
  }

  const rawArrays = [
    item.sizes, item.Sizes, item.availableSizes, item.AvailableSizes,
    item.sizeOptions, item.SizeOptions,
  ].filter(Boolean);
  rawArrays.forEach((arr) => {
    if (Array.isArray(arr)) arr.forEach(pushToken);
    else if (typeof arr === "string") arr.split(/[,\|/ ]+/).forEach(pushToken);
  });

  const dicts = [
    item.sizeMap, item.availability, item.Availability,
    item.stockBySize, item.StockBySize,
  ].filter(Boolean);
  dicts.forEach((d) => {
    if (d && typeof d === "object" && !Array.isArray(d))
      Object.keys(d).forEach(pushToken);
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
/* --------------------------------------------------------------- */

export default function SearchBar() {
  const { t } = useTranslation("searchbar");
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery]     = useState("");
  const [shops, setShops]                 = useState([]);
  const [categories, setCategories]       = useState([]);
  const [users, setUsers]                 = useState([]);
  const [groups, setGroups]               = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Theme (for choosing light/dark default logos)
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

  const recognitionRef = useRef(null);

  // Fetch data & decode user ID
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
          fetch(`${API_BASE}/Business`,             { headers }),
          fetch(`${API_BASE}/ClothingCategory/all`, { headers }),
          fetch(`${API_BASE}/User/all`,             { headers }),
        ]);

        const bizData  = await bizRes.json();
        const catData  = await catRes.json();
        const userData = await userRes.json();

        // Keep raw backend logo and decide fallback at render time
        const withItems = await Promise.all(
          bizData.map(async (b) => {
            const itemsRes = await fetch(
              `${API_BASE}/ClothingItem/business/${b.businessId}`,
              { headers }
            );
            const itemsData = await itemsRes.json();
            return {
              id:            b.businessId,
              slug:          b.slug || slugify(b.name),
              name:          b.name,
              logoUrl:       (b.profilePictureUrl || "").trim(), // raw value only
              address:       b.address,
              phoneNumber:   b.businessPhoneNumber,
              NIPT:          b.nipt,
              description:   b.description,
              clothingItems: itemsData.map((i) => {
                const sizeLabel = pickSizeLabel(i);
                const sizeTokens = extractSizeTokens(i);
                return {
                  id:          i.clothingItemId,
                  name:        i.name,
                  brand:       i.brand,
                  model:       i.model,
                  price:       i.price,
                  category:    i.category,
                  description: i.description,
                  imageUrl:    i.pictureUrls?.[0] || "/default-product.jpg",
                  sizeLabel,
                  sizeTokens,
                };
              }),
            };
          })
        );

        setShops(withItems);
        setCategories(catData);

        const enrichedUsers = userData.map((u) => ({
          userId:   u.userId,
          name:     u.name,
          email:    u.email,
          imageUrl: u.profilePictureUrl || u.profileImage || "/Assets/default-avatar.jpg",
        }));
        setUsers(enrichedUsers);
      } catch (err) {
        console.error("SearchBar fetch error:", err);
      }
    };

    fetchAll();
  }, []);

  // Flattened items list for Fuse
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

  // Create Fuse instances
  const fuseShops = useMemo(
    () =>
      new Fuse(shops, {
        keys: ["name", "description", "address", "NIPT", "phoneNumber"],
        threshold: 0.35,
      }),
    [shops]
  );

  const fuseItemsBaseOptions = useMemo(
    () => ({
      includeScore: true,
      threshold: 0.35,
      keys: [
        { name: "name", weight: 0.4 },
        { name: "brand", weight: 0.3 },
        { name: "model", weight: 0.25 },
        { name: "category", weight: 0.25 },
        { name: "description", weight: 0.2 },
        { name: "sizeLabel", weight: 0.6 },
        { name: "sizeTokens", weight: 0.9 }
      ],
    }),
    []
  );

  const fuseItems = useMemo(
    () => new Fuse(flatItems, fuseItemsBaseOptions),
    [flatItems, fuseItemsBaseOptions]
  );

  const fuseCategories = useMemo(
    () =>
      new Fuse(categories, {
        keys: ["name"],
        threshold: 0.3,
      }),
    [categories]
  );

  const fuseUsers = useMemo(
    () =>
      new Fuse(users, {
        keys: ["name", "email"],
        threshold: 0.3,
      }),
    [users]
  );

  // Debounced fuzzy search grouping (with size-aware logic)
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setGroups([]);
      return;
    }

    const timer = setTimeout(() => {
      const { sizeTokens, nonSizeQuery } = parseSizeFromQuery(q);

      const shopMatches     = fuseShops.search(q).map((r) => r.item);
      const categoryMatches = fuseCategories.search(q).map((r) => r.item);
      const userMatches     = fuseUsers.search(q).map((r) => r.item);

      let itemMatches = [];
      if (sizeTokens.length) {
        const exact = flatItems.filter((it) => {
          if (!it.sizeTokens || it.sizeTokens.length === 0) return false;
          const set = new Set(it.sizeTokens.map(normalizeSizeToken));
          return sizeTokens.every((tok) => set.has(tok));
        });
        if (nonSizeQuery) {
          const fuseSubset = new Fuse(exact, fuseItemsBaseOptions);
          itemMatches = fuseSubset.search(nonSizeQuery).map((r) => r.item);
        } else {
          itemMatches = exact;
        }
      } else {
        itemMatches = fuseItems.search(q).map((r) => r.item);
      }

      // Theme-aware fallback logo
      const fallbackLogo = isDarkMode ? DEFAULT_LOGO_DARK : DEFAULT_LOGO_LIGHT;

      const shopsGroup = shopMatches.map((s) => ({
        type:     "shop",
        id:       s.id,
        slug:     s.slug,
        name:     s.name,
        imageUrl: s.logoUrl && s.logoUrl.trim() ? s.logoUrl : fallbackLogo,
      }));

      const itemsGroup = itemMatches.map((it) => ({
        type:       "item",
        id:         it.id,
        name:       it.name,
        shopName:   it.shopName || it.shopSlug,
        imageUrl:   it.imageUrl,
        sizeLabel:  it.sizeLabel || "",
      }));

      const categoriesGroup = categoryMatches.map((c) => ({
        type: "category",
        name: c.name,
      }));

      const usersGroup = userMatches.map((u) => ({
        type:     "user",
        id:       u.userId,
        name:     u.name,
        email:    u.email,
        imageUrl: u.imageUrl,
      }));

      // Localized group titles
      const groupTitles = {
        shops:      t("groups.shops", { defaultValue: "Shops" }),
        items:      t("groups.items", { defaultValue: "Clothing Items" }),
        categories: t("groups.categories", { defaultValue: "Categories" }),
        users:      t("groups.users", { defaultValue: "Users" })
      };

      const newGroups = [];
      if (shopsGroup.length)      newGroups.push({ category: groupTitles.shops,      results: shopsGroup });
      if (itemsGroup.length)      newGroups.push({ category: groupTitles.items,      results: itemsGroup });
      if (categoriesGroup.length) newGroups.push({ category: groupTitles.categories, results: categoriesGroup });
      if (usersGroup.length)      newGroups.push({ category: groupTitles.users,      results: usersGroup });

      setGroups(newGroups);
    }, 250);

    return () => clearTimeout(timer);
    // re-run on theme or language changes so fallback logo and titles update
  }, [
    searchQuery,
    fuseShops,
    fuseItems,
    fuseItemsBaseOptions,
    fuseCategories,
    fuseUsers,
    flatItems,
    isDarkMode,
    t
  ]);

  // Redirect on Enter
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
    const re = new RegExp(`(${searchQuery})`, "gi");
    return text.split(re).map((part, i) =>
      re.test(part)
        ? <span key={i} className="highlight">{part}</span>
        : <span key={i} className="highlight-part">{part}</span>
    );
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
        window.location.href = item.id === currentUserId
          ? "/my-profile"
          : `/profile/${item.id}`;
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
            defaultValue: "Search shops, items, sizes (e.g., M, 42), categories, or users..."
          })}
          className="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <FaSearch className="search-icon" />
        <button type="submit" className="search-icon-button" />
        {searchQuery && (
          <button
            type="button"
            className="clear-button"
            onClick={clearSearch}
          >
            ✕
          </button>
        )}
      </div>

      {searchQuery && (
        <div className="search-dropdown active">
          {!currentUserId ? (
            <div className="search-category">
              <p className="no-results">
                <b>
                  {t("mustLogin.title", {
                    defaultValue: "You must have an account to use search!"
                  })}
                </b>
              </p>
              <p>
                <a href="/login">
                  {t("mustLogin.login", { defaultValue: "Log in" })}
                </a>{" "}
                {t("text.or", { defaultValue: "or" })}{" "}
                <a href="/register">
                  {t("mustLogin.register", { defaultValue: "Create an Account" })}
                </a>
              </p>
            </div>
          ) : groups.length === 0 ? (
            <div className="search-category">
              <p className="no-results">
                {t("noResults", { defaultValue: "No results found" })}
              </p>
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
                        />
                      )}
                      <span>
                        {highlight(item.name)}
                        {item.type === "item" && (
                          <>
                            {" — "}{item.shopName}
                            {item.sizeLabel ? <>{" · "}<b>{item.sizeLabel}</b></> : null}
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
