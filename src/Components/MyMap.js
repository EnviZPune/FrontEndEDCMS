// src/Pages/Map.jsx (or wherever your map page lives)
import React, { useState, useEffect } from "react";
import { Map, Marker, Overlay } from "pigeon-maps";
import { Link } from "react-router-dom";
import "../Styling/map.css";

const API_BASE = "https://api.triwears.com/api";
const PAGE_SIZE = 100;
const IP_GEO_API = "https://ipapi.co/json/";

// Theme-aware loading GIFs
const LOADING_GIF_LIGHT = "/Assets/triwears-black-loading.gif";
const LOADING_GIF_DARK  = "/Assets/triwears-white-loading.gif";

// —— auth helpers —— //
const getToken = () => {
  const raw = localStorage.getItem("token") || localStorage.getItem("authToken");
  if (!raw || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.token || parsed;
  } catch {
    return raw;
  }
};

const getHeaders = () => {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

// —— helper to build slugs if missing —— //
const toSlug = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

// —— IP fallback (city-level) —— //
async function ipLookup() {
  const res = await fetch(IP_GEO_API);
  if (!res.ok) throw new Error("IP lookup failed");
  const data = await res.json();
  return {
    coords: {
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: 50000, // IP is coarse; annotate so we know
    },
  };
}

// —— Try to get a more precise GPS fix, with short watch to refine —— //
function getPreciseLocationOnce() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

async function getPreciseLocationWithRefine() {
  const first = await getPreciseLocationOnce();
  // If already fairly accurate (<= 1000m), use it
  if (!first.coords.accuracy || first.coords.accuracy <= 1000) return first;

  // Otherwise, try a short watch to refine for up to ~20s
  return new Promise((resolve) => {
    let best = first;
    let settled = false;
    const clear = () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
        // Good enough?
        if (pos.coords.accuracy && pos.coords.accuracy <= 1000 && !settled) {
          settled = true;
          clear();
          resolve(best);
        }
      },
      () => {}, // ignore interim errors
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
    // Stop trying after 20s and resolve with best we have
    setTimeout(() => {
      if (!settled) {
        settled = true;
        clear();
        resolve(best);
      }
    }, 20000);
  });
}

// —— unified location fetcher —— //
async function fetchBestLocation() {
  const secure = window.isSecureContext || window.location.hostname === "localhost";
  const canGeo = "geolocation" in navigator && secure;

  // If we can query permission, avoid prompting when already denied
  if (canGeo && navigator.permissions?.query) {
    try {
      const perm = await navigator.permissions.query({ name: "geolocation" });
      if (perm.state === "denied") {
        // Permission denied → fall back to IP city-level
        return ipLookup();
      }
    } catch {
      // ignore
    }
  }

  if (canGeo) {
    try {
      return await getPreciseLocationWithRefine();
    } catch {
      // fall through to IP if GPS fails
    }
  }
  // Fallback to IP-based lookup
  return ipLookup();
}

// —— reverse geocode helper —— //
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
    );
    if (!res.ok) throw new Error("Geocode error");
    const data = await res.json();
    return data.display_name || "";
  } catch {
    return "";
  }
}

export default function MyMap() {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationAccuracy, setLocationAccuracy] = useState(null); // meters
  const [shops, setShops] = useState([]);
  const [center, setCenter] = useState([50.879, 4.6997]);
  const [zoom, setZoom] = useState(12);
  const [selected, setSelected] = useState(null);
  const [hasLocation, setHasLocation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [locationStatus, setLocationStatus] = useState("requesting");

  // human-readable addresses
  const [defaultAddress, setDefaultAddress] = useState("");
  const [selectedAddress, setSelectedAddress] = useState("");

  // 🌙 Detect theme for loader GIF
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setIsDarkMode(e.matches);
    try { mq.addEventListener("change", onChange); } catch { mq.addListener(onChange); }
    return () => {
      try { mq.removeEventListener("change", onChange); } catch { mq.removeListener(onChange); }
    };
  }, []);

  // —— get current location —— //
  useEffect(() => {
    setLocationStatus("requesting");
    (async () => {
      try {
        const { coords } = await fetchBestLocation();
        const { latitude, longitude, accuracy } = coords || {};
        setCurrentLocation({ lat: latitude, lng: longitude });
        setLocationAccuracy(typeof accuracy === "number" ? Math.round(accuracy) : null);
        setCenter([latitude, longitude]);
        setZoom(15);
        setHasLocation(true);
        setLocationStatus("found");
        setLocationError(null);
      } catch (err) {
        console.error("Location error:", err);
        setLocationError(err.message || "Could not determine your location");
        setLocationStatus("error");
      }
    })();
  }, []);

  // —— Fetch detailed shop data —— //
  useEffect(() => {
    const loadShops = async () => {
      setLoading(true);
      try {
        const pageRes = await fetch(
          `${API_BASE}/Business/paginated?pageNumber=1&pageSize=${PAGE_SIZE}`,
          { headers: getHeaders() }
        );
        if (!pageRes.ok) throw new Error("Could not load shop list");
        const { items } = await pageRes.json();

        const detailed = await Promise.all(
          items.map(async (b) => {
            const res = await fetch(`${API_BASE}/Business/${b.businessId}`, {
              headers: getHeaders(),
            });
            if (!res.ok) throw new Error(`Shop ${b.businessId} failed`);
            const shop = await res.json();
            const [latS = "", lngS = ""] = (shop.location || "").split(",");
            return {
              id:                shop.businessId,
              name:              shop.name,
              slug:              shop.slug || toSlug(shop.name),
              address:           shop.address || "",
              lat:               parseFloat(latS.trim()),
              lng:               parseFloat(lngS.trim()),
              profilePictureUrl: shop.profilePictureUrl,
            };
          })
        );

        setShops(detailed.filter((s) => !isNaN(s.lat) && !isNaN(s.lng)));
      } catch (e) {
        console.error(e);
        setLocationError("Failed to load shop locations");
      } finally {
        setLoading(false);
      }
    };
    loadShops();
  }, []);

  // —— Reverse-geocode first shop for default address —— //
  useEffect(() => {
    if (!loading && shops.length > 0) {
      const first = shops[0];
      if (first.address) {
        setDefaultAddress(first.address);
      } else {
        reverseGeocode(first.lat, first.lng).then(setDefaultAddress);
      }
    }
  }, [loading, shops]);

  // —— Reverse-geocode selected marker —— //
  useEffect(() => {
    if (selected) {
      if (selected.address) {
        setSelectedAddress(selected.address);
      } else {
        reverseGeocode(selected.lat, selected.lng).then(setSelectedAddress);
      }
    }
  }, [selected]);

  // —— Fallback center if user denies location —— //
  useEffect(() => {
    if (!hasLocation && shops.length > 0 && locationStatus !== "requesting") {
      const { lat, lng } = shops[0];
      setCenter([lat, lng]);
      setZoom(13);
    }
  }, [hasLocation, shops, locationStatus]);

  const handleMarkerClick = (shop) => setSelected(shop);
  const handleClose = () => setSelected(null);
  const getDirections = (lat, lng) =>
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      "_blank"
    );

  const requestLocationAgain = async () => {
    setLocationStatus("requesting");
    setLocationError(null);
    try {
      const { coords } = await fetchBestLocation();
      const { latitude, longitude, accuracy } = coords || {};
      setCurrentLocation({ lat: latitude, lng: longitude });
      setLocationAccuracy(typeof accuracy === "number" ? Math.round(accuracy) : null);
      setCenter([latitude, longitude]);
      setZoom(15);
      setHasLocation(true);
      setLocationStatus("found");
    } catch (err) {
      console.error("Location retry error:", err);
      setLocationError(err.message || "Could not determine your location");
      setLocationStatus("error");
    }
  };

  if (loading) {
    return (
      <div className="map-container centered" aria-live="polite" aria-busy="true">
        <img
          className="loading-gif"
          src={isDarkMode ? LOADING_GIF_DARK : LOADING_GIF_LIGHT}
          alt="Loading"
          width={140}
          height={140}
          style={{ objectFit: "contain" }}
        />
        <p className="loading-text">Loading ...</p>
        {locationStatus === "requesting" && (
          <p className="location-status">Requesting your location...</p>
        )}
      </div>
    );
  }

  return (
    <div className="map-container fullMap">
      {locationError && (
        <div className="location-error-banner">
          <span>⚠️ {locationError}</span>
          <button onClick={requestLocationAgain} className="retry-location-btn">
            Try Again
          </button>
        </div>
      )}

      {/* show the human-readable address */}
      <div className="location-on-map">
        <h2>Location on Map</h2>
        {selected ? (selectedAddress || "Loading address…") : (defaultAddress || "Loading address…")}
      </div>

      <Map
        center={center}
        zoom={zoom}
        onBoundsChanged={({ center, zoom }) => {
          setCenter(center);
          setZoom(zoom);
        }}
        className="custom-map"
      >
        {currentLocation && (
          <Marker
            width={60}
            anchor={[currentLocation.lat, currentLocation.lng]}
            color="#2563eb"
          />
        )}

        {shops.map((shop) => (
          <Marker
            key={shop.id}
            width={40}
            anchor={[shop.lat, shop.lng]}
            color="#dc2626"
            onClick={() => handleMarkerClick(shop)}
          />
        ))}

        {selected && (
          <Overlay anchor={[selected.lat, selected.lng]} offset={[12, 30]}>
            <div className="overlay-container">
              <button className="close-overlay" onClick={handleClose}>
                ✕
              </button>
              {selected.profilePictureUrl && (
                <img
                  src={selected.profilePictureUrl}
                  alt={selected.name}
                  className="overlay-image"
                />
              )}
              <h4>{selected.name}</h4>
              <p>
                <strong>Address:</strong>{" "}
                {selectedAddress || "Loading address…"}
              </p>
              <div className="overlay-actions">
                <Link
                  to={`/shop/${selected.slug}`}
                  className="overlay-button primary"
                >
                  View Shop
                </Link>
                <button
                  className="overlay-button secondary"
                  onClick={() => getDirections(selected.lat, selected.lng)}
                >
                  Get Directions
                </button>
              </div>
            </div>
          </Overlay>
        )}
      </Map>

      <div className="map-controls">
        {currentLocation && (
          <button
            className="control-btn location-btn"
            onClick={() => {
              setCenter([currentLocation.lat, currentLocation.lng]);
              setZoom(16);
            }}
            title="Go to my location"
          >
            📍
          </button>
        )}
        <button
          className="control-btn zoom-in-btn"
          onClick={() => setZoom((z) => Math.min(z + 1, 18))}
          title="Zoom in"
        >
          +
        </button>
        <button
          className="control-btn zoom-out-btn"
          onClick={() => setZoom((z) => Math.max(z - 1, 1))}
          title="Zoom out"
        >
          −
        </button>
      </div>

      <div className="location-info-panel">
        <div className="info-item">
          <span className="info-label">Shops:</span>
          <span className="info-value">{shops.length}</span>
        </div>
        {currentLocation && (
          <div className="info-item">
            <span className="info-label">Your Location:</span>
            <span className="info-value">
              Found ✓{locationAccuracy != null ? ` (±${locationAccuracy}m)` : ""}
            </span>
          </div>
        )}
        {!hasLocation && locationStatus !== "requesting" && (
          <div className="info-item">
            <span className="info-label">Location:</span>
            <span className="info-value error">Not available</span>
          </div>
        )}
      </div>
    </div>
  );
}
