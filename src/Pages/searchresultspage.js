// src/Pages/SearchResultsPage.jsx
import React, { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
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

export default function SearchResultsPage() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const query = params.get("query")?.trim().toLowerCase() || "";

  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [shops, setShops]             = useState([]);
  const [categories, setCategories]   = useState([]);
  const [users, setUsers]             = useState([]);
  const [groups, setGroups]           = useState([]);

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
                imageUrl:    i.pictureUrls?.[0] || "",
              })),
            };
          })
        );

        setShops(withItems);
        setCategories(catData);
        setUsers(userData);
      } catch (e) {
        console.error(e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // Filter whenever data or query changes
  useEffect(() => {
    if (loading || error) return;
    if (!query) {
      setGroups([]);
      return;
    }

    const shopMatches = shops
      .filter((s) =>
        [s.name, s.description, s.address, s.NIPT, s.phoneNumber]
          .some((f) => f?.toLowerCase().includes(query))
      )
      .map((s) => ({
        type: "shop",
        id:   s.id,
        slug: s.slug,
        name: s.name,
      }));

    const itemMatches = shops.flatMap((shop) =>
      shop.clothingItems
        .filter((it) =>
          [
            it.name,
            it.brand,
            it.model,
            it.category,
            it.description,
            it.price?.toString(),
          ].some((f) => f?.toLowerCase().includes(query))
        )
        .map((it) => ({
          type:     "item",
          id:       it.id,
          name:     it.name,
          shopSlug: shop.slug,
          imageUrl: it.imageUrl,
        }))
    );

    const categoryMatches = categories
      .filter((c) => c.name?.toLowerCase().includes(query))
      .map((c) => ({ type: "category", name: c.name }));

    const userMatches = users
      .filter((u) =>
        [u.name, u.email].some((f) => f?.toLowerCase().includes(query))
      )
      .map((u) => ({
        type:  "user",
        id:    u.userId,
        name:  u.name,
        email: u.email,
      }));

    const g = [];
    if (shopMatches.length)     g.push({ title: "Shops",          items: shopMatches });
    if (itemMatches.length)     g.push({ title: "Clothing Items", items: itemMatches });
    if (categoryMatches.length) g.push({ title: "Categories",     items: categoryMatches });
    if (userMatches.length)     g.push({ title: "Users",          items: userMatches });

    setGroups(g);
  }, [loading, error, shops, categories, users, query]);

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
              <p className="search-results__empty">No results found.</p>
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
                            {item.imageUrl && (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="search-results__image"
                              />
                            )}
                            <div className="search-results__item-info">
                              <span className="search-results__item-name">
                                {item.name}
                              </span>
                              <span className="search-results__item-meta">
                                {item.shopSlug}
                              </span>
                            </div>
                          </Link>
                        )}
                        {item.type === "category" && (
                          <Link
                            to={`/category-filter?category=${encodeURIComponent(item.name)}`}
                            className="search-results__link"
                          >
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
