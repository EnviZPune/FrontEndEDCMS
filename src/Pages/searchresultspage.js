// src/Pages/SearchResultsPage.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useLocation, Link } from "react-router-dom";
import Fuse from "fuse.js";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "../Styling/searchresults.css";

const API_BASE = "http://77.242.26.150:8000/api";

function getToken() {
  const raw = localStorage.getItem("token");
  if (!raw) return null;
  try {
    return JSON.parse(raw).token;
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

/** Build a readable size label from common shapes on the item */
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

export default function SearchResultsPage() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const query = params.get("query")?.trim() || "";

  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [shops, setShops]           = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers]           = useState([]);
  const [groups, setGroups]         = useState([]);
  const [suggestion, setSuggestion] = useState("");

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
          fetch(`${API_BASE}/Business`,             { headers }),
          fetch(`${API_BASE}/ClothingCategory/all`, { headers }),
          fetch(`${API_BASE}/User/all`,             { headers }),
        ]);

        if (!bizRes.ok || !catRes.ok || !userRes.ok) {
          throw new Error("Failed to fetch search data.");
        }

        const bizData  = await bizRes.json();
        const catData  = await catRes.json();
        const userData = await userRes.json();

        // enrich shops with logoUrl & items (+ sizeLabel)
        const withItems = await Promise.all(
          bizData.map(async (b) => {
            const itRes = await fetch(
              `${API_BASE}/ClothingItem/business/${b.businessId}`,
              { headers }
            );
            const items = itRes.ok ? await itRes.json() : [];
            return {
              id:            b.businessId,
              slug:          b.slug || slugify(b.name),
              name:          b.name,
              logoUrl:       b.profilePictureUrl || "/Assets/default-shop.png",
              description:   b.description,
              address:       b.address,
              NIPT:          b.nipt,
              phoneNumber:   b.businessPhoneNumber,
              clothingItems: items.map((i) => ({
                id:          i.clothingItemId,
                name:        i.name,
                brand:       i.brand,
                model:       i.model,
                price:       i.price,
                category:    i.category,
                description: i.description,
                imageUrl:    i.pictureUrls?.[0] || "/Assets/default-product.jpg",
                sizeLabel:   pickSizeLabel(i),
              })),
            };
          })
        );

        // enrich users with imageUrl
        const enrichedUsers = userData.map((u) => ({
          userId:   u.userId,
          name:     u.name,
          email:    u.email,
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
        }))
      ),
    [shops]
  );

  // Fuse instances for each type
  const fuseShops = useMemo(
    () =>
      new Fuse(shops, {
        keys: ["name", "description", "address", "NIPT", "phoneNumber"],
        threshold: 0.35,
      }),
    [shops]
  );

  const fuseItems = useMemo(
    () =>
      new Fuse(flatItems, {
        keys: ["name", "brand", "model", "category", "description", "price", "sizeLabel"],
        threshold: 0.35,
      }),
    [flatItems]
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

  // Combined suggestion list for "Did you mean"
  const fuseSuggestions = useMemo(() => {
    const suggestions = [
      ...shops.map((s) => s.name),
      ...flatItems.map((i) => i.name),
      ...categories.map((c) => c.name),
      ...users.map((u) => u.name),
    ];
    return new Fuse(suggestions, {
      includeScore: true,
      threshold: 0.6,
    });
  }, [shops, flatItems, categories, users]);

  // Run fuzzy filter and suggestion whenever data or query changes
  useEffect(() => {
    if (loading || error) return;
    if (!query) {
      setGroups([]);
      setSuggestion("");
      return;
    }

    const shopMatches     = fuseShops.search(query).map(r => r.item);
    const itemMatches     = fuseItems.search(query).map(r => r.item);
    const categoryMatches = fuseCategories.search(query).map(r => r.item);
    const userMatches     = fuseUsers.search(query).map(r => r.item);

    const shopsGroup = shopMatches.map((s) => ({
      type:     "shop",
      id:       s.id,
      slug:     s.slug,
      name:     s.name,
      imageUrl: s.logoUrl,
    }));

    const itemsGroup = itemMatches.map((it) => ({
      type:       "item",
      id:         it.id,
      name:       it.name,
      brand:      it.brand,
      shopSlug:   it.shopSlug,
      imageUrl:   it.imageUrl,
      sizeLabel:  it.sizeLabel || "",
    }));

    const categoriesGroup = categoryMatches.map((c) => ({
      type:     "category",
      name:     c.name,
      imageUrl: "/Assets/default-category.png",
    }));

    const usersGroup = userMatches.map((u) => ({
      type:     "user",
      id:       u.userId,
      name:     u.name,
      email:    u.email,
      imageUrl: u.imageUrl,
    }));

    const newGroups = [];
    if (shopsGroup.length)      newGroups.push({ title: "Shops",          items: shopsGroup });
    if (itemsGroup.length)      newGroups.push({ title: "Clothing Items", items: itemsGroup });
    if (categoriesGroup.length) newGroups.push({ title: "Categories",     items: categoriesGroup });
    if (usersGroup.length)      newGroups.push({ title: "Users",          items: usersGroup });

    setGroups(newGroups);

    // If no results, compute suggestion
    if (newGroups.length === 0) {
      const [best] = fuseSuggestions.search(query);
      setSuggestion(best ? best.item : "");
    } else {
      setSuggestion("");
    }
  }, [
    loading,
    error,
    query,
    fuseShops,
    fuseItems,
    fuseCategories,
    fuseUsers,
    fuseSuggestions,
  ]);

  return (
    <>
      <Navbar />

      <main className="search-results-page">
        {loading ? (
          <div className="search-results__loading">Loading search results…</div>
        ) : error ? (
          <div className="search-results__error">{error}</div>
        ) : (
          <>
            <header className="search-results__header">
              <h1 className="search-results__title">
                Search Results for “{query}”
              </h1>
            </header>

            {groups.length === 0 ? (
              <>
                <p className="search-results__empty">No results found.</p>
                {suggestion && (
                  <p className="search-results__suggestion">
                    Did you mean{" "}
                    <Link to={`/search?query=${encodeURIComponent(suggestion)}`}>
                      <strong>{suggestion}</strong>
                    </Link>
                    ?
                  </p>
                )}
              </>
            ) : (
              groups.map((group) => (
                <section
                  key={group.title}
                  className="search-results__group"
                >
                  <h2 className="search-results__group-title">
                    {group.title}
                  </h2>
                  <ul className="search-results__list">
                    {group.items.map((item) => (
                      <li
                        key={`${item.type}-${item.id}-${item.name}`}
                        className="search-results__item"
                      >
                        {item.type === "shop" && (
                          <Link
                            to={`/shop/${item.slug}`}
                            className="search-results__link"
                          >
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="search-results__image"
                            />
                            <span className="search-results__item-name">
                              {item.name}
                            </span>
                          </Link>
                        )}

                        {item.type === "item" && (
                          <Link
                            to={`/product/${item.id}`}
                            className="search-results__link search-results__item-with-image"
                          >
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="search-results__image"
                            />
                            <div className="search-results__item-info">
                              <span className="search-results__item-name">
                                {item.brand ? `${item.name} — ${item.brand}` : item.name}
                              </span>
                              <span className="search-results__item-meta">
                                {item.shopSlug}
                                {item.sizeLabel ? <>{" · "}<b>{item.sizeLabel}</b></> : null}
                              </span>
                            </div>
                          </Link>
                        )}

                        {item.type === "category" && (
                          <Link
                            to={`/category-filter?category=${encodeURIComponent(item.name)}`}
                            className="search-results__link"
                          >
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="search-results__image"
                            />
                            <span className="search-results__item-name">
                              {item.name}
                            </span>
                          </Link>
                        )}

                        {item.type === "user" && (
                          <Link
                            to={`/profile/${item.id}`}
                            className="search-results__link search-results__item-user"
                          >
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="search-results__image"
                            />
                            <div className="search-results__item-info">
                              <span className="search-results__item-name">
                                {item.name}
                              </span>
                              <span className="search-results__item-email">
                                {item.email}
                              </span>
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
