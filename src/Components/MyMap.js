"use client"

import { useState, useEffect } from "react"
import { Map, Marker, Overlay } from "pigeon-maps"
import { Link } from "react-router-dom"
import "../Styling/map.css"

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

  // 1️⃣ Enhanced geolocation with better error handling and fallback
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported")
      setLocationError("Geolocation is not supported by this browser")
      setLocationStatus("unsupported")
      setHasLocation(false)
      return
    }

    setLocationStatus("requesting")

    // High accuracy options
    const highAccuracyOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000, // 1 minute cache
    }

    // Fallback options with lower accuracy
    const fallbackOptions = {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000, // 5 minute cache
    }

    const handleSuccess = (position) => {
      const { latitude, longitude, accuracy } = position.coords

      console.log("Location found:", { latitude, longitude, accuracy })

      const userLocation = { lat: latitude, lng: longitude }
      setCurrentLocation(userLocation)
      setCenter([latitude, longitude])
      setZoom(15) // Closer zoom for user location
      setHasLocation(true)
      setLocationStatus("found")
      setLocationError(null)
    }

    const handleError = (error) => {
      console.error("Geolocation error:", error)

      let errorMessage = ""
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = "Location access denied by user"
          setLocationStatus("denied")
          break
        case error.POSITION_UNAVAILABLE:
          errorMessage = "Location information unavailable"
          setLocationStatus("unavailable")
          break
        case error.TIMEOUT:
          errorMessage = "Location request timed out"
          setLocationStatus("timeout")
          break
        default:
          errorMessage = "An unknown error occurred"
          setLocationStatus("error")
          break
      }

      setLocationError(errorMessage)
      setHasLocation(false)

      // Try fallback with lower accuracy if high accuracy failed
      if (error.code === error.TIMEOUT && highAccuracyOptions.enableHighAccuracy) {
        console.log("Trying fallback location with lower accuracy...")
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          (fallbackError) => {
            console.error("Fallback location also failed:", fallbackError)
            setLocationStatus("failed")
          },
          fallbackOptions,
        )
      }
    }

    // Request location permission and get current position
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, highAccuracyOptions)

    // Set up location watching for continuous updates
    let watchId = null
    const startWatching = () => {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          const userLocation = { lat: latitude, lng: longitude }
          setCurrentLocation(userLocation)
          console.log("Location updated:", userLocation)
        },
        (error) => {
          console.warn("Watch position error:", error)
        },
        {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 60000,
        },
      )
    }

    // Start watching after initial location is found
    const watchTimer = setTimeout(startWatching, 2000)

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
      clearTimeout(watchTimer)
    }
  }, [])

  // 2️⃣ Fetch shops
  useEffect(() => {
    setLoading(true)
    fetch("http://77.242.26.150:8000/api/Business")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        const parsed = data
          .map((b) => {
            const [latS = "", lngS = ""] = (b.location || "").split(",")
            const lat = Number.parseFloat(latS.trim())
            const lng = Number.parseFloat(lngS.trim())
            return {
              id: b.businessId,
              name: b.name,
              slug: b.slug,
              address: b.address,
              lat,
              lng,
            }
          })
          .filter((s) => !isNaN(s.lat) && !isNaN(s.lng))

        console.log("Shops loaded:", parsed.length)
        setShops(parsed)
      })
      .catch((err) => {
        console.error("Failed to load shops:", err)
        setLocationError("Failed to load shop locations")
      })
      .finally(() => setLoading(false))
  }, [])

  // 3️⃣ Center on first shop if no user location
  useEffect(() => {
    if (!hasLocation && shops.length > 0 && locationStatus !== "requesting") {
      const first = shops[0]
      setCenter([first.lat, first.lng])
      setZoom(13)
      console.log("Centered on first shop:", first.name)
    }
  }, [hasLocation, shops, locationStatus])

  const handleMarkerClick = (shop) => setSelected(shop)
  const handleClose = () => setSelected(null)

  const getDirections = (lat, lng) =>
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank")

  const requestLocationAgain = () => {
    setLocationStatus("requesting")
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const userLocation = { lat: latitude, lng: longitude }
        setCurrentLocation(userLocation)
        setCenter([latitude, longitude])
        setZoom(15)
        setHasLocation(true)
        setLocationStatus("found")
      },
      (error) => {
        console.error("Location retry failed:", error)
        setLocationStatus("failed")
        setLocationError("Unable to get your location. Please check your browser settings.")
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    )
  }

  // 🔄 Loading state
  if (loading) {
    return (
      <div className="map-container centered">
        <div className="loading-spinner"></div>
        <p>Loading map and shops...</p>
        {locationStatus === "requesting" && <p className="location-status">Requesting your location...</p>}
      </div>
    )
  }

  return (
    <div className="map-container fullMap">
      {/* Location status indicator */}
      {locationError && (
        <div className="location-error-banner">
          <span>⚠️ {locationError}</span>
          <button onClick={requestLocationAgain} className="retry-location-btn">
            Try Again
          </button>
        </div>
      )}

      {locationStatus === "requesting" && (
        <div className="location-loading-banner">
          <span>📍 Getting your location...</span>
        </div>
      )}

      <Map
        center={center}
        defaultZoom={zoom}
        className="custom-map"
        onBoundsChanged={({ center, zoom }) => {
          setCenter(center)
          setZoom(zoom)
        }}
      >
        {/* User location marker */}
        {currentLocation && (
          <Marker
            width={60}
            anchor={[currentLocation.lat, currentLocation.lng]}
            color="#2563eb"
            onClick={() => {
              setCenter([currentLocation.lat, currentLocation.lng])
              setZoom(16)
            }}
          />
        )}

        {/* Shop markers */}
        {shops.map((shop) => (
          <Marker
            key={shop.id}
            width={40}
            anchor={[shop.lat, shop.lng]}
            color="#dc2626"
            onClick={() => handleMarkerClick(shop)}
          />
        ))}

        {/* Shop overlay */}
        {selected && (
          <Overlay anchor={[selected.lat, selected.lng]} offset={[12, 30]}>
            <div className="overlay-container">
              <button className="close-overlay" onClick={handleClose}>
                ✕
              </button>
              <h4>{selected.name}</h4>
              <p>
                <strong>Address:</strong> {selected.address}
              </p>
              <div className="overlay-actions">
                <Link to={`/shop/${selected.slug || selected.id}`} className="overlay-button primary">
                  View Shop
                </Link>
                <button className="overlay-button secondary" onClick={() => getDirections(selected.lat, selected.lng)}>
                  Get Directions
                </button>
              </div>
            </div>
          </Overlay>
        )}
      </Map>

      {/* Map controls */}
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

        <button className="control-btn zoom-in-btn" onClick={() => setZoom(Math.min(zoom + 1, 18))} title="Zoom in">
          +
        </button>

        <button className="control-btn zoom-out-btn" onClick={() => setZoom(Math.max(zoom - 1, 1))} title="Zoom out">
          −
        </button>
      </div>

      {/* Location info panel */}
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
