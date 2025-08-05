"use client"

import React, { useState, useEffect } from "react"
import { Map, Marker, Overlay } from "pigeon-maps"
import { Link } from "react-router-dom"
import "../Styling/map.css"

const API_BASE = "http://77.242.26.150:8000/api"
const PAGE_SIZE = 100

// —— copy auth helpers from ProductDetailsPage —— //
const getToken = () => {
  const raw = localStorage.getItem("token") || localStorage.getItem("authToken")
  if (!raw || raw.trim() === "") return null
  try {
    const parsed = JSON.parse(raw)
    return parsed.token || parsed
  } catch {
    return raw
  }
}

const getHeaders = () => {
  const token = getToken()
  const headers = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

// —— helper to build slugs if missing —— //
const toSlug = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")

// —— reverse-geocode a lat/lng into a display name —— //
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
    )
    if (!res.ok) throw new Error("Geocode error")
    const data = await res.json()
    return data.display_name || ""
  } catch {
    return ""
  }
}

export default function MyMap() {
  const [currentLocation, setCurrentLocation] = useState(null)
  const [shops, setShops] = useState([])
  const [center, setCenter] = useState([50.879, 4.6997])
  const [zoom, setZoom] = useState(12)
  const [selected, setSelected] = useState(null)
  const [hasLocation, setHasLocation] = useState(false)
  const [loading, setLoading] = useState(true)
  const [locationError, setLocationError] = useState(null)
  const [locationStatus, setLocationStatus] = useState("requesting")

  // 👇 store the resolved addresses
  const [defaultAddress, setDefaultAddress] = useState("")
  const [selectedAddress, setSelectedAddress] = useState("")

  // Geolocation logic
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser")
      setLocationStatus("unsupported")
      return
    }

    setLocationStatus("requesting")
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude } }) => {
        setCurrentLocation({ lat: latitude, lng: longitude })
        setCenter([latitude, longitude])
        setZoom(15)
        setHasLocation(true)
        setLocationStatus("found")
        setLocationError(null)
      },
      (err) => {
        let msg = "An unknown error occurred"
        if (err.code === err.PERMISSION_DENIED) msg = "Location access denied"
        else if (err.code === err.POSITION_UNAVAILABLE) msg = "Location unavailable"
        else if (err.code === err.TIMEOUT) msg = "Location request timed out"
        setLocationError(msg)
        setLocationStatus(err.code === err.TIMEOUT ? "timeout" : "error")
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    )
  }, [])

  // Fetch detailed shop data (so we can reverse-geocode if needed)
  useEffect(() => {
    const loadShops = async () => {
      setLoading(true)
      try {
        const pageRes = await fetch(
          `${API_BASE}/Business/paginated?pageNumber=1&pageSize=${PAGE_SIZE}`,
          { headers: getHeaders() }
        )
        if (!pageRes.ok) throw new Error("Could not load shop list")
        const { items } = await pageRes.json()

        const detailed = await Promise.all(
          items.map(async (b) => {
            const res = await fetch(
              `${API_BASE}/Business/${b.businessId}`,
              { headers: getHeaders() }
            )
            if (!res.ok) throw new Error(`Shop ${b.businessId} failed`)
            const shop = await res.json()
            const [latS = "", lngS = ""] = (shop.location || "").split(",")
            return {
              id:                shop.businessId,
              name:              shop.name,
              slug:              shop.slug || toSlug(shop.name),
              address:           shop.address || "",
              lat:               parseFloat(latS.trim()),
              lng:               parseFloat(lngS.trim()),
              profilePictureUrl: shop.profilePictureUrl,
            }
          })
        )

        setShops(detailed.filter((s) => !isNaN(s.lat) && !isNaN(s.lng)))
      } catch (e) {
        console.error(e)
        setLocationError("Failed to load shop locations")
      } finally {
        setLoading(false)
      }
    }
    loadShops()
  }, [])

  // Once we have shops, reverse-geocode the first one if it lacks an address
  useEffect(() => {
    if (!loading && shops.length > 0) {
      const first = shops[0]
      if (first.address) {
        setDefaultAddress(first.address)
      } else {
        reverseGeocode(first.lat, first.lng).then(setDefaultAddress)
      }
    }
  }, [loading, shops])

  // When user selects a marker, reverse-geocode if needed
  useEffect(() => {
    if (selected) {
      if (selected.address) {
        setSelectedAddress(selected.address)
      } else {
        reverseGeocode(selected.lat, selected.lng).then(setSelectedAddress)
      }
    }
  }, [selected])

  // Fallback center if user denies location
  useEffect(() => {
    if (!hasLocation && shops.length > 0 && locationStatus !== "requesting") {
      const { lat, lng } = shops[0]
      setCenter([lat, lng])
      setZoom(13)
    }
  }, [hasLocation, shops, locationStatus])

  const handleMarkerClick = (shop) => setSelected(shop)
  const handleClose       = () => setSelected(null)
  const getDirections     = (lat, lng) =>
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      "_blank"
    )

  const requestLocationAgain = () => {
    setLocationStatus("requesting")
    setLocationError(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude } }) => {
        setCurrentLocation({ lat: latitude, lng: longitude })
        setCenter([latitude, longitude])
        setZoom(15)
        setHasLocation(true)
        setLocationStatus("found")
      },
      (err) => {
        let msg = "Unable to get your location"
        if (err.code === err.PERMISSION_DENIED) msg = "Location access denied"
        else if (err.code === err.TIMEOUT) msg = "Location request timed out"
        setLocationError(msg)
        setLocationStatus("error")
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  if (loading) {
    return (
      <div className="map-container centered">
        <div className="loading-spinner"></div>
        <p>Loading map and shops...</p>
        {locationStatus === "requesting" && (
          <p className="location-status">Requesting your location...</p>
        )}
      </div>
    )
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
        {selected
          ? (selectedAddress || "Loading address…")
          : (defaultAddress || "Loading address…")}
      </div>

      <Map
        center={center}
        defaultZoom={zoom}
        onBoundsChanged={({ center, zoom }) => {
          setCenter(center)
          setZoom(zoom)
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
              setCenter([currentLocation.lat, currentLocation.lng])
              setZoom(16)
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
            <span className="info-value">Found ✓</span>
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
  )
}
