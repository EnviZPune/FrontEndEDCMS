// src/components/SearchBar.jsx
import React, { useState, useEffect, useRef } from "react";
import { FaSearch } from "react-icons/fa";
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

// Fallback slug generator
const slugify = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const SearchBar = () => {
  const [searchQuery, setSearchQuery]     = useState("");
  const [groups, setGroups]               = useState([]);
  const [shops, setShops]                 = useState([]);
  const [categories, setCategories]       = useState([]);
  const [users, setUsers]                 = useState([]);
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
          fetch(`${API_BASE}/Business`,            { headers }),
          fetch(`${API_BASE}/ClothingCategory/all`,{ headers }),
          fetch(`${API_BASE}/User/all`,            { headers }),
        ]);

        const bizData  = await bizRes.json();
        const catData  = await catRes.json();
        const userData = await userRes.json();

        // Include slug in each shop
        const withItems = await Promise.all(
          bizData.map(async (b) => {
            const itemsRes = await fetch(
              `${API_BASE}/ClothingItem/business/${b.businessId}`,
              { headers }
            );
            const itemsData = await itemsRes.json();
            return {
              id:             b.businessId,
              slug:           b.slug || slugify(b.name),
              name:           b.name,
              address:        b.address,
              phoneNumber:    b.businessPhoneNumber,
              NIPT:           b.nipt,
              description:    b.description,
              clothingItems:  itemsData.map((i) => ({
                id:          i.clothingItemId,
                name:        i.name,
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
      } catch (err) {
        console.error("SearchBar fetch error:", err);
      }
    };

    fetchAll();
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setGroups([]);
      return;
    }
    const q = searchQuery.trim().toLowerCase();
    const timer = setTimeout(() => {
      // Shop matches now include slug
      const shopMatches = shops
        .filter((s) =>
          [s.name, s.description, s.address, s.NIPT, s.phoneNumber].some((f) =>
            f?.toLowerCase().includes(q)
          )
        )
        .map((s) => ({ type: "shop", id: s.id, slug: s.slug, name: s.name }));

      const itemMatches = shops.flatMap((shop) =>
        shop.clothingItems
          .filter((it) =>
            [it.name, it.category, it.description].some((f) =>
              f?.toLowerCase().includes(q)
            )
          )
          .map((it) => ({
            type:     "item",
            id:       it.id,
            name:     it.name,
            shopName: shop.name,
            imageUrl: it.imageUrl,
          }))
      );

      const categoryMatches = categories
        .filter((c) => c.name?.toLowerCase().includes(q))
        .map((c) => ({ type: "category", name: c.name }));

      const userMatches = users
        .filter((u) =>
          [u.name, u.email].some((f) =>
            f?.toLowerCase().includes(q)
          )
        )
        .map((u) => ({
          type:  "user",
          id:    u.userId,
          name:  u.name,
          email: u.email,
        }));

      const newGroups = [];
      if (shopMatches.length)     newGroups.push({ category: "Shops",         results: shopMatches });
      if (itemMatches.length)     newGroups.push({ category: "Clothing Items", results: itemMatches });
      if (categoryMatches.length) newGroups.push({ category: "Categories",    results: categoryMatches });
      if (userMatches.length)     newGroups.push({ category: "Users",         results: userMatches });

      setGroups(newGroups);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, shops, categories, users]);

  const onChange     = (e) => setSearchQuery(e.target.value);
  const clearSearch = () => { setSearchQuery(""); setGroups([]); };

  const highlight = (text) => {
    if (!searchQuery) return text;
    const re = new RegExp(`(${searchQuery})`, "gi");
    return text.split(re).map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase()
        ? <span key={i} className="highlight">{part}</span>
        : part
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
    <div className="search-bar-container">
      <div className="search-input-container">
        <input
          type="text"
          placeholder="Search shops, items, categories, or users..."
          className="search-input"
          value={searchQuery}
          onChange={onChange}
        />
        <FaSearch className="search-icon" />
        {searchQuery && (
          <button className="clear-button" onClick={clearSearch}>✕</button>
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
                      {item.type === "item" && item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="result-image"
                        />
                      )}
                      <span>
                        {highlight(item.name)}
                        {item.type === "item" && ` — ${ (item.shopName)}`}
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
    </div>
  );
};

export default SearchBar;
