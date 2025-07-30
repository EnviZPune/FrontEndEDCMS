import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "../Styling/registerbusiness.css"
import Navbar from "../Components/Navbar"

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
})

const API_BASE = "http://77.242.26.150:8000/api"
const GCS_BUCKET = "https://storage.googleapis.com/edcms_bucket"

function getToken() {
  const raw = localStorage.getItem("token")
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed.token || parsed
  } catch {
    return raw
  }
}

export default function RegisterFormBusiness() {
  const navigate = useNavigate()
  const { search } = useLocation()
  const paymentToken = new URLSearchParams(search).get("token")

  const [business, setBusiness] = useState({
    name: "",
    description: "",
    businessEmail: "",
    location: "",
    businessPhoneNumber: "",
    nipt: "",
    openingHours: "",
  })

  const [profileUrl, setProfileUrl] = useState("")
  const [coverUrl, setCoverUrl] = useState("")
  const [suggestions, setSuggestions] = useState([])
  const [coords, setCoords] = useState(null) // [lat, lng]
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [tokenChecked, setTokenChecked] = useState(false)
  const [tokenValid, setTokenValid] = useState(false)
  const [formProgress, setFormProgress] = useState(0)
  const [validationErrors, setValidationErrors] = useState({})
  const [showSuggestions, setShowSuggestions] = useState(false)

  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const containerRef = useRef(null)
  const locationInputRef = useRef(null)

  // calculate progress
  useEffect(() => {
    const fields = ["name","description","businessPhoneNumber","nipt","openingHours"]
      .map(k => business[k].trim() !== "")
      .filter(Boolean).length
    const images = [profileUrl, coverUrl].filter((u) => u).length
    const locationDone = coords ? 1 : 0
    const total = 5 + 2 + 1
    const completed = fields + images + locationDone
    setFormProgress((completed / total) * 100)
  }, [business, profileUrl, coverUrl, coords])

  // fetch current user's email
  useEffect(() => {
    fetch(`${API_BASE}/User/me`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load user info")
        return res.json()
      })
      .then((user) => {
        setBusiness((b) => ({ ...b, businessEmail: user.email }))
      })
      .catch(() => {
        console.warn("Could not fetch user email")
      })
  }, [])

  // validate payment token
  useEffect(() => {
    if (!paymentToken) {
      setError("Missing access token")
      setTokenChecked(true)
      return
    }
    fetch(`${API_BASE}/payment/validate-token?token=${paymentToken}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setTokenValid(d.valid))
      .catch(() => setError("Invalid or expired token"))
      .finally(() => setTokenChecked(true))
  }, [paymentToken])

  // init map
  useEffect(() => {
    if (!tokenChecked || !tokenValid || !containerRef.current) return
    if (mapRef.current) {
      mapRef.current.remove()
      markerRef.current?.remove()
    }
    const map = L.map(containerRef.current, {
      center: [41.3275, 19.8187],
      zoom: 10,
      zoomControl: false,
      layers: [
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }),
      ],
    })
    map.on("click", (e) => {
      const { lat, lng } = e.latlng
      setCoords([lat, lng])
      setBusiness((b) => ({
        ...b,
        location: `${lat.toFixed(6)},${lng.toFixed(6)}`,
      }))
      setSuggestions([])
      setShowSuggestions(false)
      setValidationErrors((prev) => ({ ...prev, location: null }))
      reverseGeocode(lat, lng)
    })
    map.whenReady(() => map.invalidateSize())
    mapRef.current = map
    return () => map.remove()
  }, [tokenChecked, tokenValid])

  // marker on coords change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markerRef.current?.remove()
    if (!coords) return
    const m = L.marker(coords, { draggable: true }).addTo(map)
    m.on("dragend", (e) => {
      const { lat, lng } = e.target.getLatLng()
      setCoords([lat, lng])
      setBusiness((b) => ({
        ...b,
        location: `${lat.toFixed(6)},${lng.toFixed(6)}`,
      }))
      reverseGeocode(lat, lng)
    })
    markerRef.current = m
    map.setView(coords, 13)
  }, [coords])

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      )
      const data = await res.json()
      if (data.display_name) {
        setBusiness((b) => ({ ...b, location: data.display_name }))
      }
    } catch (e) {
      console.error("Reverse geocoding failed:", e)
    }
  }

  // autocomplete
  const handleLocationChange = useCallback(async (e) => {
    const q = e.target.value
    setBusiness((b) => ({ ...b, location: q }))
    setCoords(null)
    setValidationErrors((prev) => ({ ...prev, location: null }))
    if (q.length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=8&q=${encodeURIComponent(
          q
        )}&addressdetails=1&extratags=1`
      )
      const data = await res.json()
      const enhanced = data.map((item) => ({
        ...item,
        main: item.name || item.display_name.split(",")[0],
        sub: item.display_name.split(",").slice(1).join(",").trim(),
      }))
      setSuggestions(enhanced)
      setShowSuggestions(true)
    } catch {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [])

  const selectSuggestion = (s) => {
    setBusiness((b) => ({ ...b, location: s.display_name }))
    setCoords([+s.lat, +s.lon])
    setSuggestions([])
    setShowSuggestions(false)
    setValidationErrors((prev) => ({ ...prev, location: null }))
    locationInputRef.current?.blur()
  }

  const clearLocation = () => {
    setBusiness((b) => ({ ...b, location: "" }))
    setCoords(null)
    setSuggestions([])
    setShowSuggestions(false)
    setValidationErrors((prev) => ({ ...prev, location: null }))
    locationInputRef.current?.focus()
  }

  const zoomIn = () => mapRef.current?.zoomIn()
  const zoomOut = () => mapRef.current?.zoomOut()
  const centerMap = () => coords && mapRef.current?.setView(coords, 15)

  // image uploads
  const uploadImageToGCS = async (file) => {
    const ts = Date.now()
    const name = `${ts}-${file.name}`
    const url = `${GCS_BUCKET}/${name}`
    const txt = `${url}.txt`
    try {
      let r = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      })
      if (!r.ok) throw new Error("Upload failed")
      r = await fetch(txt, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: url,
      })
      if (!r.ok) throw new Error("TXT write failed")
      return url
    } catch (err) {
      console.error(err)
      return null
    }
  }

  const handleFile = (e, setter, field) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setValidationErrors((prev) => ({ ...prev, [field]: null }))
    uploadImageToGCS(file)
      .then((url) => {
        if (url) setter(url)
        else {
          setError("Image upload failed")
          setValidationErrors((prev) => ({ ...prev, [field]: "Upload failed" }))
        }
      })
      .finally(() => setLoading(false))
  }

  const removeImage = (setter, field) => {
    setter("")
    setValidationErrors((prev) => ({ ...prev, [field]: null }))
  }

  // form validation
  const validateForm = () => {
    const errors = {}
    if (!business.name.trim()) errors.name = "Business name is required"
    if (!business.description.trim()) errors.description = "Description is required"
    if (!business.businessPhoneNumber.trim())
      errors.businessPhoneNumber = "Phone number is required"
    if (!profileUrl) errors.profilePicture = "Profile photo is required"
    if (!business.businessEmail.trim()) errors.businessEmail = "Business email is required"
    if (!coverUrl) errors.coverPicture = "Cover photo is required"
    if (!coords) errors.location = "Please select a location"
    setValidationErrors(errors)
    return !Object.keys(errors).length
  }

  const handleInputChange = (field, value) => {
    setBusiness((b) => ({ ...b, [field]: value }))
    setValidationErrors((prev) => ({ ...prev, [field]: null }))
  }

  useEffect(() => {
    const onClickOutside = (e) => {
      if (
        locationInputRef.current &&
        !locationInputRef.current.contains(e.target)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  // submit
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!validateForm()) {
      setError("Please fill in all required fields")
      return
    }

    setLoading(true)
    try {
      const payload = {
        // send the raw name—backend will auto-generate slug
        name: business.name.trim(),
        description: business.description,
        businessEmail: business.businessEmail,
        businessPhoneNumber: business.businessPhoneNumber,
        nipt: business.nipt,
        openingHours: business.openingHours,
        profilePictureUrl: profileUrl,
        coverPictureUrl: coverUrl,
        location: `${coords[0]},${coords[1]}`,
      }

      const res = await fetch(
        `${API_BASE}/Business?token=${encodeURIComponent(paymentToken)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || "Registration failed")
      }
      const result = await res.json()
      setSuccess("Business registered successfully!")
      // reset
      setBusiness((b) => ({
        ...b,
        name: "",
        description: "",
        location: "",
        businessPhoneNumber: "",
        nipt: "",
        openingHours: "",
      }))
      setProfileUrl("")
      setCoverUrl("")
      setCoords(null)
      setSuggestions([])
      setShowSuggestions(false)
      setValidationErrors({})
      setTimeout(() => navigate(`/shop/${result.slug}`), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!tokenChecked) {
    return (
      <div>
        <Navbar />
        <div className="register-business-form-container">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p className="loading-text">Validating access token...</p>
          </div>
        </div>
      </div>
    )
  }
  if (!tokenValid) {
    return (
      <div>
        <Navbar />
        <div className="register-business-form-container">
          <div className="form-header">
            <h2>Access Denied</h2>
            <p className="error-message">
              ⚠️ {error || "Invalid or expired access token"}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Navbar />
      <div className="register-business-form-container">
        <div className="form-header">
          <h2>Register Your Business</h2>
          <p>Create your business profile and start reaching customers today</p>
        </div>

        <div className="form-progress">
          <div
            className="form-progress-bar"
            style={{ width: `${formProgress}%` }}
          />
        </div>

        <form
          className="register-business-form"
          onSubmit={handleSubmit}
          noValidate
        >
          {/* Business Name */}
          <div className={`form-group ${validationErrors.name ? "error" : ""}`}>
            <label htmlFor="name">Business Name *</label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Enter your business name"
              value={business.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              required
            />
            {validationErrors.name && (
              <div className="error-message">
                ⚠️ {validationErrors.name}
              </div>
            )}
          </div>

          {/* Description */}
          <div
            className={`form-group ${
              validationErrors.description ? "error" : ""
            }`}
          >
            <label htmlFor="description">Description *</label>
            <textarea
              id="description"
              name="description"
              placeholder="Describe your business and services"
              value={business.description}
              onChange={(e) =>
                handleInputChange("description", e.target.value)
              }
              required
            />
            {validationErrors.description && (
              <div className="error-message">
                ⚠️ {validationErrors.description}
              </div>
            )}
          </div>

         {/* Business Email (editable string) */}
            <div className={`form-group ${validationErrors.businessEmail ? "error" : ""}`}>
              <label htmlFor="businessEmail">Business Email *</label>
              <input
                id="businessEmail"
                name="businessEmail"
                type="text"
                placeholder="Enter your business email"
              value={business.businessEmail}
                onChange={e => handleInputChange("businessEmail", e.target.value)}
                required
              />
              {validationErrors.businessEmail && (
                <div className="error-message">⚠️ {validationErrors.businessEmail}</div>
              )}
            </div>

          {/* Phone Number */}
          <div
            className={`form-group ${
              validationErrors.businessPhoneNumber ? "error" : ""
            }`}
          >
            <label htmlFor="phone">Phone Number *</label>
            <input
              id="phone"
              name="businessPhoneNumber"
              type="tel"
              placeholder="Enter your business phone number"
              value={business.businessPhoneNumber}
              onChange={(e) =>
                handleInputChange("businessPhoneNumber", e.target.value)
              }
              required
            />
            {validationErrors.businessPhoneNumber && (
              <div className="error-message">
                ⚠️ {validationErrors.businessPhoneNumber}
              </div>
            )}
          </div>

          {/* NIPT */}
          <div className="form-group">
            <label htmlFor="nipt">NIPT (Tax Number)</label>
            <input
              id="nipt"
              name="nipt"
              type="text"
              placeholder="Enter your tax identification number"
              value={business.nipt}
              onChange={(e) => handleInputChange("nipt", e.target.value)}
            />
          </div>

          {/* Opening Hours */}
          <div className="form-group">
            <label htmlFor="hours">Opening Hours</label>
            <input
              id="hours"
              name="openingHours"
              type="text"
              placeholder="e.g., Mon-Fri: 9:00-18:00, Sat: 9:00-14:00"
              value={business.openingHours}
              onChange={(e) =>
                handleInputChange("openingHours", e.target.value)
              }
            />
          </div>

          {/* Location Input & Map */}
          <div
            className={`form-group ${
              validationErrors.location ? "error" : ""
            }`}
          >
            <label htmlFor="location">Location *</label>
            <div className="location-input-container" ref={locationInputRef}>
              <div className="location-input-wrapper">
                <div className="location-input-icon">📍</div>
                <input
                  id="location"
                  type="text"
                  className="location-input"
                  placeholder="Start typing to search for location..."
                  value={business.location}
                  onChange={handleLocationChange}
                  onFocus={() =>
                    setShowSuggestions(suggestions.length > 0)
                  }
                  required
                />
                {business.location && (
                  <button
                    type="button"
                    className="location-clear-btn"
                    onClick={clearLocation}
                    title="Clear location"
                  >
                    ✕
                  </button>
                )}
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <ul className="location-suggestions">
                  {suggestions.map((s) => (
                    <li
                      key={s.place_id}
                      onClick={() => selectSuggestion(s)}
                    >
                      <div className="location-suggestion-text">
                        <div className="location-suggestion-main">
                          {s.main}
                        </div>
                        <div className="location-suggestion-sub">
                          {s.sub}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {validationErrors.location && (
              <div className="error-message">
                ⚠️ {validationErrors.location}
              </div>
            )}
          </div>

          {/* Map */}
          <div className="form-group">
            <label>Select Location on Map</label>
            <div className="map-container">
              <div className="map-overlay">
                <div className="map-overlay-content">
                  <div className="map-overlay-icon">🗺️</div>
                  <div className="map-overlay-text">
                    Click on the map to place a marker at your business
                    location
                  </div>
                </div>
              </div>
              <div className="map-wrapper">
                <div
                  ref={containerRef}
                  style={{ height: "100%", width: "100%" }}
                />
                <div className="map-controls">
                  <button
                    type="button"
                    className="map-control-btn"
                    onClick={zoomIn}
                    title="Zoom In"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="map-control-btn"
                    onClick={zoomOut}
                    title="Zoom Out"
                  >
                    −
                  </button>
                  {coords && (
                    <button
                      type="button"
                      className="map-control-btn"
                      onClick={centerMap}
                      title="Center on Marker"
                    >
                      🎯
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Profile Photo */}
          <div
            className={`form-group ${
              validationErrors.profilePicture ? "error" : ""
            }`}
          >
            <label htmlFor="profile">Profile Photo *</label>
            <div className="file-input-wrapper">
              <input
                id="profile"
                type="file"
                accept="image/*"
                onChange={(e) => handleFile(e, setProfileUrl, "profilePicture")}
              />
              <div className="file-input-label">
                <span className="file-input-icon">📷</span>
                <span>Choose Profile Photo</span>
              </div>
            </div>
            {validationErrors.profilePicture && (
              <div className="error-message">
                ⚠️ {validationErrors.profilePicture}
              </div>
            )}
            {profileUrl && (
              <div className="image-preview profile-preview">
                <img src={profileUrl} alt="Profile preview" />
                <div
                  className="image-preview-overlay"
                  onClick={() => removeImage(setProfileUrl, "profilePicture")}
                  title="Remove image"
                >
                  ✕
                </div>
              </div>
            )}
          </div>

          {/* Cover Photo */}
          <div
            className={`form-group ${
              validationErrors.coverPicture ? "error" : ""
            }`}
          >
            <label htmlFor="cover">Cover Photo *</label>
            <div className="file-input-wrapper">
              <input
                id="cover"
                type="file"
                accept="image/*"
                onChange={(e) => handleFile(e, setCoverUrl, "coverPicture")}
              />
              <div className="file-input-label">
                <span className="file-input-icon">🖼️</span>
                <span>Choose Cover Photo</span>
              </div>
            </div>
            {validationErrors.coverPicture && (
              <div className="error-message">
                ⚠️ {validationErrors.coverPicture}
              </div>
            )}
            {coverUrl && (
              <div className="image-preview cover-preview">
                <img src={coverUrl} alt="Cover preview" />
                <div
                  className="image-preview-overlay"
                  onClick={() => removeImage(setCoverUrl, "coverPicture")}
                  title="Remove image"
                >
                  ✕
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className={`submit-button ${loading ? "loading" : ""}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                <span>Registering Business...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>Register Business</span>
              </>
            )}
          </button>

          {error && (
            <div className="error-message" style={{ textAlign: "center" }}>
              ⚠️ {error}
            </div>
          )}
          {success && (
            <div className="success-message" style={{ textAlign: "center" }}>
              ✅ {success}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
