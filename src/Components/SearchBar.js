// src/components/SearchBar.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch } from "react-icons/fa";
import Fuse from "fuse.js";
import "../Styling/searchbar.css";

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

export default function SearchBar() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery]     = useState("");
  const [shops, setShops]                 = useState([]);
  const [categories, setCategories]       = useState([]);
  const [users, setUsers]                 = useState([]);
  const [groups, setGroups]               = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);

  const recognitionRef = useRef(null);

  // Fetch data & decode user ID
  useEffect(() => {
    const fetchAll = async () => {
      const token = getToken();
      if (!token) return;

      // Decode JWT
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

        // include logoUrl on shops and fetch items
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
              logoUrl:       b.profilePictureUrl || "/default-shop.png",
              address:       b.address,
              phoneNumber:   b.businessPhoneNumber,
              NIPT:          b.nipt,
              description:   b.description,
              clothingItems: itemsData.map((i) => ({
                id:          i.clothingItemId,
                name:        i.name,
                brand:       i.brand,
                model:       i.model,
                price:       i.price,
                category:    i.category,
                description: i.description,
                imageUrl:    i.pictureUrls?.[0] || "/default-product.jpg",
              })),
            };
          })
        );

        setShops(withItems);
        setCategories(catData);

        // include imageUrl on users
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

  const fuseItems = useMemo(
    () =>
      new Fuse(flatItems, {
        keys: ["name", "brand", "model", "category", "description", "price"],
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

  // Debounced fuzzy search grouping
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setGroups([]);
      return;
    }

    const timer = setTimeout(() => {
      // Fuzzy search each group
      const shopMatches = fuseShops.search(q).map((r) => r.item);
      const itemMatches = fuseItems.search(q).map((r) => r.item);
      const categoryMatches = fuseCategories.search(q).map((r) => r.item);
      const userMatches = fuseUsers.search(q).map((r) => r.item);

      // Map to unified result objects
      const shopsGroup = shopMatches.map((s) => ({
        type:     "shop",
        id:       s.id,
        slug:     s.slug,
        name:     s.name,
        imageUrl: s.logoUrl,
      }));

      const itemsGroup = itemMatches.map((it) => ({
        type:     "item",
        id:       it.id,
        name:     it.name,
        shopName: it.shopSlug,
        imageUrl: it.imageUrl,
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

      // Assemble groups in display order
      const newGroups = [];
      if (shopsGroup.length)      newGroups.push({ category: "Shops",          results: shopsGroup });
      if (itemsGroup.length)      newGroups.push({ category: "Clothing Items", results: itemsGroup });
      if (categoriesGroup.length) newGroups.push({ category: "Categories",     results: categoriesGroup });
      if (usersGroup.length)      newGroups.push({ category: "Users",          results: usersGroup });

      setGroups(newGroups);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, fuseShops, fuseItems, fuseCategories, fuseUsers]);

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

  // Highlight matches
  const highlight = (text) => {
    if (!searchQuery) return text;
    const re = new RegExp(`(${searchQuery})`, "gi");
    return text.split(re).map((part, i) =>
      re.test(part)
        ? <span key={i} className="highlight">{part}</span>
        : <span key={i} className="highlight-part">{part}</span>
    );
  };

  // Click handler
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
          placeholder="Search shops, items, categories, or users..."
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
              <p className="no-results"><b>You must have an account to use search!</b></p>
              <p>
                <a href="/login">Log in</a> or{" "}
                <a href="/register">Create an Account</a>
              </p>
            </div>
          ) : groups.length === 0 ? (
            <div className="search-category">
              <p className="no-results">No results found</p>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.category} className="search-category">
                <h4>{g.category}</h4>
                <ul>
                  {g.results.map((item) => (
                    <li
                      key={`${item.type}-${item.id}-${item.name}`}
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
                        {item.type === "item" && ` — ${item.shopName}`}
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
