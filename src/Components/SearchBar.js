import React, { useState, useEffect } from "react";
import { FaSearch, FaMicrophone } from "react-icons/fa";
import "../Styling/searchbar.css";

const SearchBar = ({ onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [shops, setShops] = useState([]);

  // Fetch live shops from your backend
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const fetchShops = async () => {
      try {
        const response = await fetch(
          "https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/Business",
          {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            }
          }
        );
        if (!response.ok) {
          console.error("Failed to fetch shops.");
          return;
        }
        const data = await response.json();
        setShops(data);
      } catch (error) {
        console.error("Error fetching shops:", error);
      }
    };
    fetchShops();
  }, []);

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
  
    if (query.trim() === "") {
      setSearchResults([]);
      return;
    }
  
    console.log("Searching for:", query);
    console.log("Shops:", shops);
  
    // Search for shops
    const filteredShops = shops
      .filter((shop) => shop.name && shop.name.toLowerCase().includes(query))
      .map((shop) => ({ name: shop.name, slug: shop.slug }));
    console.log("Filtered Shops:", filteredShops);
  
    // Search for clothing items inside each shop, if available
    const clothingItems = shops.flatMap((shop) =>
      (shop.clothingItems || [])
        .filter(
          (item) =>
            item.name && item.name.toLowerCase().includes(query) ||
            item.category && item.category.toLowerCase().includes(query)
        )
        .map((item) => ({
          ...item,
          shopName: shop.name,
          shopSlug: shop.slug,
        }))
    );
    console.log("Clothing Items:", clothingItems);
  
    setSearchResults([
      { category: "Shops", results: filteredShops },
      {
        category: "Clothing Items",
        results: clothingItems.map((item) => ({
          display: `${item.name} (${item.category})`,
          shop: item.shopName,
          data: item,
        })),
      },
    ]);
  };
  

  const highlightQuery = (text, query) => {
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={index} className="highlight">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleNavigation = (selectedItem) => {
    if (selectedItem.slug) {
      // It's a shop
      window.location.href = `/${selectedItem.slug}`;
    } else if (selectedItem.data) {
      // It's a clothing item
      const { slug: productSlug, shopSlug } = selectedItem.data;
      window.location.href = `/${shopSlug}/${productSlug}`;
    } else {
      console.error("Unknown navigation item:", selectedItem);
    }
  };

  const startVoiceSearch = () => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("Voice search is not supported in your browser.");
      return;
    }
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      handleSearch({ target: { value: transcript } });
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <div className="search-bar-container">
      <div className="search-input-container">
        <input
          type="text"
          placeholder="Search shops, clothing items ..."
          value={searchQuery}
          onChange={handleSearch}
          className="search-input"
        />
        <FaSearch className="search-icon" />
        <FaMicrophone
          className={`microphone-icon ${isListening ? "Listening" : ""}`}
          onClick={startVoiceSearch}
        />
        {searchQuery && (
          <button className="clear-button" onClick={clearSearch}>
            ✕
          </button>
        )}
      </div>

      {searchResults.length > 0 && (
        <div
          className={`search-dropdown ${
            searchResults.length > 0 ? "active" : ""
          }`}
        >
          {searchResults.map((group, index) => (
            <div key={index} className="search-category">
              <h4>{group.category}</h4>
              <ul>
                {group.results.map((item, idx) => (
                  <li
                    key={idx}
                    onClick={() => handleNavigation(item)}
                    className="search-result-item"
                  >
                    {group.category === "Clothing Items" ? (
                      <div className="result-with-image">
                        <img
                          src={item.data.imageUrl}
                          alt={item.display}
                          className="result-image"
                        />
                        <span>
                          {highlightQuery(item.display, searchQuery)} (
                          {item.shop})
                        </span>
                      </div>
                    ) : (
                      highlightQuery(item.name, searchQuery)
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
