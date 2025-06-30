import React, { useState, useEffect, useRef } from "react";
import { FaSearch, FaMicrophone } from "react-icons/fa";
import "../Styling/searchbar.css";

const SearchBar = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [groups, setGroups] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [shops, setShops] = useState([]);
  const recognitionRef = useRef(null);

  // Fetch businesses + items
  useEffect(() => {
    const fetchAll = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch("http://77.242.26.150:8000/api/Business", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const bizData = await res.json();
        const withItems = await Promise.all(
          bizData.map(async (b) => {
            const r2 = await fetch(
              `http://77.242.26.150:8000/api/ClothingItem/business/${b.businessId}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const items = await r2.json();
            return {
              id: b.businessId,
              name: b.name,
              address: b.address,
              phoneNumber: b.businessPhoneNumber,
              NIPT: b.nipt,
              description: b.description,
              clothingItems: items.map((i) => ({
                id: i.clothingItemId,
                name: i.name,
                category: i.category,
                description: i.description,
                imageUrl: i.pictureUrls?.[0] || "",
              })),
            };
          })
        );
        setShops(withItems);
      } catch (err) {
        console.error(err);
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
      const shopMatches = shops
        .filter((s) =>
          [s.name, s.description, s.address, s.NIPT, s.phoneNumber].some((f) =>
            f?.toLowerCase().includes(q)
          )
        )
        .map((s) => ({ type: "shop", id: s.id, name: s.name }));

      const itemMatches = shops.flatMap((shop) =>
        shop.clothingItems
          .filter((it) =>
            [it.name, it.category, it.description].some((f) =>
              f?.toLowerCase().includes(q)
            )
          )
          .map((it) => ({
            type: "item",
            id: it.id,
            name: it.name,
            shopId: shop.id,
            shopName: shop.name,
            imageUrl: it.imageUrl,
          }))
      );

      const newGroups = [];
      if (shopMatches.length) newGroups.push({ category: "Shops", results: shopMatches });
      if (itemMatches.length) newGroups.push({ category: "Clothing Items", results: itemMatches });
      setGroups(newGroups);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, shops]);

  const startVoiceSearch = () => {
    if (!window.webkitSpeechRecognition) {
      alert("Voice not supported");
      return;
    }
    if (!recognitionRef.current) {
      const rec = new window.webkitSpeechRecognition();
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.onstart = () => setIsListening(true);
      rec.onresult = (evt) => {
        const t = evt.results[0][0].transcript;
        setSearchQuery(t);
      };
      rec.onend = () => setIsListening(false);
      rec.onerror = () => setIsListening(false);
      recognitionRef.current = rec;
    }
    recognitionRef.current.start();
  };

  const onChange = (e) => setSearchQuery(e.target.value);
  const clearSearch = () => {
    setSearchQuery("");
    setGroups([]);
  };
  const highlight = (text) => {
    if (!searchQuery) return text;
    const re = new RegExp(`(${searchQuery})`, "gi");
    return text.split(re).map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <span key={i} className="highlight">{part}</span>
      ) : (
        part
      )
    );
  };

  const handleClick = (item, e) => {
    e.preventDefault();
    if (item.type === "shop") {
      window.location.href = `/shops/${item.id}`;
    } else {
      window.location.href = `/product/${item.id}`; // <-- your new route
    }
  };

  return (
    <div className="search-bar-container">
      <div className="search-input-container">
        <input
          type="text"
          placeholder="Search shops or clothing items..."
          className="search-input"
          value={searchQuery}
          onChange={onChange}
        />
        <FaSearch className="search-icon" />
        <FaMicrophone
          className={`microphone-icon ${isListening ? "listening" : ""}`}
          onClick={startVoiceSearch}
        />
        {searchQuery && (
          <button className="clear-button" onClick={clearSearch}>✕</button>
        )}
      </div>

      {searchQuery && (
        <div className="search-dropdown active">
          {groups.length === 0 ? (
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
                      key={`${item.type}-${item.id}`}
                      className="search-result-item"
                      onClick={(e) => handleClick(item, e)}
                    >
                      {item.type === "item" && item.imageUrl && (
                        <img src={item.imageUrl} alt={item.name} className="result-image" />
                      )}
                      <span>
                        {highlight(item.name)}
                        {item.type === "item" ? ` — ${item.shopName}` : ""}
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
