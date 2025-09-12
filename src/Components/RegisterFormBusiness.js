// src/Pages/RegisterFormBusiness.jsx
import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "../Styling/registerbusiness.css"
import Navbar from "../Components/Navbar"
import { useTranslation } from "react-i18next"

// local UI
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select"
import { Switch } from "./ui/switch"
import { Button } from "./ui/button"

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
})

const API_BASE = "https://api.triwears.com/api/api"
const GCS_BUCKET = "https://storage.googleapis.com/edcms_bucket"

// 15-minute increments 00:00 → 23:45
const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, "0")
  const m = String((i % 4) * 15).padStart(2, "0")
  return `${h}:${m}`
})

const DAYS = [
  { key: "monday", label: "days.monday" },
  { key: "tuesday", label: "days.tuesday" },
  { key: "wednesday", label: "days.wednesday" },
  { key: "thursday", label: "days.thursday" },
  { key: "friday", label: "days.friday" },
  { key: "saturday", label: "days.saturday" },
  { key: "sunday", label: "days.sunday" },
]

const ABBR = ["Mo","Tu","We","Th","Fr","Sa","Su"]

const defaultSchedule = {
  monday:    { open: "09:00", close: "18:00", closed: false },
  tuesday:   { open: "09:00", close: "18:00", closed: false },
  wednesday: { open: "09:00", close: "18:00", closed: false },
  thursday:  { open: "09:00", close: "18:00", closed: false },
  friday:    { open: "09:00", close: "18:00", closed: false },
  saturday:  { open: "10:00", close: "14:00", closed: true },
  sunday:    { open: "10:00", close: "14:00", closed: true },
}

const timeLt = (a, b) => a < b

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

// ---------- Compact hours formatter (<= 20 chars) ----------
function fmtTimeShort(t) {
  const [hh, mm] = t.split(":")
  const h = String(Number(hh))
  return mm === "00" ? h : `${h}:${mm}`
}
function sameTime(a, b) {
  return a.open === b.open && a.close === b.close && !a.closed && !b.closed
}
function compactSchedule(schedule, maxLen = 20) {
  const days = [
    schedule.monday, schedule.tuesday, schedule.wednesday, schedule.thursday,
    schedule.friday, schedule.saturday, schedule.sunday
  ]
  const openMask = days.map(d => !d.closed)
  if (openMask.every(v => !v)) return "Closed"

  const firstOpenIdx = openMask.findIndex(Boolean)
  const firstOpen = days[firstOpenIdx]
  const allSame = openMask.every((v, i) => v === openMask[firstOpenIdx])
    ? days.every(d => sameTime(d, firstOpen))
    : false
  if (allSame && !firstOpen.closed) {
    const token = `Daily ${fmtTimeShort(firstOpen.open)}-${fmtTimeShort(firstOpen.close)}`
    return token.length <= maxLen ? token : "Varies by day"
  }

  const groups = []
  let i = 0
  while (i < 7) {
    if (!openMask[i]) { i++; continue }
    const start = i
    const ref = days[i]
    while (i + 1 < 7 && openMask[i + 1] && sameTime(days[i + 1], ref)) i++
    const end = i
    groups.push({ start, end, open: fmtTimeShort(ref.open), close: fmtTimeShort(ref.close) })
    i++
  }

  const tokens = groups.map(g => {
    const dayPart = g.start === g.end ? ABBR[g.start] : `${ABBR[g.start]}-${ABBR[g.end]}`
    return `${dayPart} ${g.open}-${g.close}`
  })

  let out = ""
  for (let t of tokens) {
    const candidate = out ? `${out} ${t}` : t
    if (candidate.length <= maxLen) out = candidate
    else break
  }
  if (!out) out = tokens[0] || "Varies by day"
  if (out.length > maxLen) out = "Varies by day"
  return out
}

// HoursPicker (UI)
function HoursPicker({ value, onChange }) {
  const { t } = useTranslation("registerBusiness")
  const updateDay = (dayKey, patch) => onChange({ ...value, [dayKey]: { ...value[dayKey], ...patch } })
  const copyMondayToAll = () => {
    const m = value.monday
    const next = {}
    for (const d of DAYS) next[d.key] = { ...m }
    onChange(next)
  }
  const closeAll = () => {
    const next = {}
    for (const d of DAYS) next[d.key] = { ...value[d.key], closed: true }
    onChange(next)
  }

  return (
    <div className="hours-picker">
      <div className="hours-toolbar">
        <Button type="button" variant="secondary" onClick={copyMondayToAll}>
          {t("hours.use_monday", { defaultValue: "Use Monday for all" })}
        </Button>
        <Button type="button" variant="outline" onClick={closeAll}>
          {t("hours.mark_all_closed", { defaultValue: "Mark all closed" })}
        </Button>
      </div>

      <div className="hours-grid">
        <div className="hours-grid-head">
          <div>{t("hours.day", { defaultValue: "Day" })}</div>
          <div>{t("hours.open", { defaultValue: "Open" })}</div>
          <div>{t("hours.close", { defaultValue: "Close" })}</div>
          <div>{t("hours.closed", { defaultValue: "Closed" })}</div>
        </div>

        {DAYS.map(({ key, label }) => {
          const day = value[key]
          const disabled = !!day.closed
          return (
            <div className="hours-row" key={key}>
              <div className="hours-day">{t(label)}</div>

              <div className={`hours-cell ${disabled ? "disabled" : ""}`}>
                <Select value={day.open} onValueChange={(v) => updateDay(key, { open: v })} disabled={disabled}>
                  <SelectTrigger className="time-trigger">
                    <SelectValue placeholder={t("hours.open_ph", { defaultValue: "Open" })} />
                  </SelectTrigger>
                  <SelectContent className="time-content">
                    {TIME_OPTIONS.map((topt) => (<SelectItem key={topt} value={topt}>{topt}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              <div className={`hours-cell ${disabled ? "disabled" : ""}`}>
                <Select value={day.close} onValueChange={(v) => updateDay(key, { close: v })} disabled={disabled}>
                  <SelectTrigger className="time-trigger">
                    <SelectValue placeholder={t("hours.close_ph", { defaultValue: "Close" })} />
                  </SelectTrigger>
                  <SelectContent className="time-content">
                    {TIME_OPTIONS.map((topt) => (<SelectItem key={topt} value={topt}>{topt}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              <div className="hours-cell">
                <Switch
                  checked={day.closed}
                  onCheckedChange={(ck) => updateDay(key, { closed: ck })}
                  aria-label={t("hours.closed_on", { day: t(label), defaultValue: "Closed on {{day}}" })}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function RegisterFormBusiness() {
  const { t } = useTranslation("registerBusiness")
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
  const [coords, setCoords] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [tokenChecked, setTokenChecked] = useState(false)
  const [tokenValid, setTokenValid] = useState(false)
  const [formProgress, setFormProgress] = useState(0)
  const [validationErrors, setValidationErrors] = useState({})
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [schedule, setSchedule] = useState(defaultSchedule)

  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const containerRef = useRef(null)
  const locationInputRef = useRef(null)

  useEffect(() => {
    const compact = compactSchedule(schedule, 20)
    setBusiness((b) => ({ ...b, openingHours: compact }))
  }, [schedule])

  useEffect(() => {
    const fields = ["name","description","businessPhoneNumber","nipt","openingHours"]
      .map(k => business[k]?.trim ? business[k].trim() !== "" : !!business[k])
      .filter(Boolean).length
    const images = [profileUrl, coverUrl].filter(Boolean).length
    const locationDone = coords ? 1 : 0
    const total = 5 + 2 + 1
    const completed = fields + images + locationDone
    setFormProgress((completed / total) * 100)
  }, [business, profileUrl, coverUrl, coords])

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

  useEffect(() => {
    if (!paymentToken) {
      setError(t("errors.missing_token", { defaultValue: "Missing access token" }))
      setTokenChecked(true)
      return
    }
    fetch(`${API_BASE}/payment/validate-token?token=${paymentToken}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setTokenValid(d.valid))
      .catch(() => setError(t("errors.invalid_token", { defaultValue: "Invalid or expired token" })))
      .finally(() => setTokenChecked(true))
  }, [paymentToken, t])

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
      setBusiness((b) => ({ ...b, location: `${lat.toFixed(6)},${lng.toFixed(6)}` }))
      setSuggestions([]); setShowSuggestions(false)
      setValidationErrors((prev) => ({ ...prev, location: null }))
      reverseGeocode(lat, lng)
    })
    map.whenReady(() => map.invalidateSize())
    mapRef.current = map
    return () => map.remove()
  }, [tokenChecked, tokenValid])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markerRef.current?.remove()
    if (!coords) return
    const m = L.marker(coords, { draggable: true }).addTo(map)
    m.on("dragend", (e) => {
      const { lat, lng } = e.target.getLatLng()
      setCoords([lat, lng])
      setBusiness((b) => ({ ...b, location: `${lat.toFixed(6)},${lng.toFixed(6)}` }))
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

  const handleLocationChange = useCallback(async (e) => {
    const q = e.target.value
    setBusiness((b) => ({ ...b, location: q }))
    setCoords(null)
    setValidationErrors((prev) => ({ ...prev, location: null }))
    if (q.length < 3) { setSuggestions([]); setShowSuggestions(false); return }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=8&q=${encodeURIComponent(q)}&addressdetails=1&extratags=1`
      )
      const data = await res.json()
      const enhanced = data.map((item) => ({
        ...item,
        main: item.name || item.display_name.split(",")[0],
        sub: item.display_name.split(",").slice(1).join(",").trim(),
      }))
      setSuggestions(enhanced); setShowSuggestions(true)
    } catch {
      setSuggestions([]); setShowSuggestions(false)
    }
  }, [])

  const selectSuggestion = (s) => {
    setBusiness((b) => ({ ...b, location: s.display_name }))
    setCoords([+s.lat, +s.lon])
    setSuggestions([]); setShowSuggestions(false)
    setValidationErrors((prev) => ({ ...prev, location: null }))
    locationInputRef.current?.blur()
  }

  const clearLocation = () => {
    setBusiness((b) => ({ ...b, location: "" }))
    setCoords(null); setSuggestions([]); setShowSuggestions(false)
    setValidationErrors((prev) => ({ ...prev, location: null }))
    locationInputRef.current?.focus()
  }

  const zoomIn = () => mapRef.current?.zoomIn()
  const zoomOut = () => mapRef.current?.zoomOut()
  const centerMap = () => coords && mapRef.current?.setView(coords, 15)

  const uploadImageToGCS = async (file) => {
    const ts = Date.now()
    const name = `${ts}-${file.name}`
    const url = `${GCS_BUCKET}/${name}`
    const txt = `${url}.txt`
    try {
      let r = await fetch(url, { method: "PUT", headers: { "Content-Type": file.type }, body: file })
      if (!r.ok) throw new Error("Upload failed")
      r = await fetch(txt, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: url })
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
          setError(t("errors.image_upload_failed", { defaultValue: "Image upload failed" }))
          setValidationErrors((prev) => ({ ...prev, [field]: t("errors.upload_failed", { defaultValue: "Upload failed" }) }))
        }
      })
      .finally(() => setLoading(false))
  }

  const removeImage = (setter, field) => {
    setter("")
    setValidationErrors((prev) => ({ ...prev, [field]: null }))
  }

  const validateSchedule = (s) => {
    const dayEntries = Object.values(s)
    const hasOpenDay = dayEntries.some((d) => !d.closed)
    const allValid = dayEntries.every((d) => d.closed || (d.open && d.close && timeLt(d.open, d.close)))
    return hasOpenDay && allValid
  }

  const validateForm = () => {
    const errors = {}
    if (!business.name.trim()) errors.name = t("errors.name_required", { defaultValue: "Business name is required" })
    if (!business.description.trim()) errors.description = t("errors.desc_required", { defaultValue: "Description is required" })
    if (!business.businessPhoneNumber.trim()) errors.businessPhoneNumber = t("errors.phone_required", { defaultValue: "Phone number is required" })
    if (!validateSchedule(schedule)) errors.openingHours = t("errors.hours_invalid", { defaultValue: "Please provide valid hours (open < close) and at least one open day" })
    if (!business.businessEmail.trim()) errors.businessEmail = t("errors.email_required", { defaultValue: "Business email is required" })
    if (!coords) errors.location = t("errors.location_required", { defaultValue: "Please select a location" })
    if (business.openingHours && business.openingHours.length > 1000)
      errors.openingHours = t("errors.hours_length", { defaultValue: "Opening hours text must be ≤ 1000 characters" })
    setValidationErrors(errors)
    return !Object.keys(errors).length
  }

  const handleInputChange = (field, value) => {
    setBusiness((b) => ({ ...b, [field]: value }))
    setValidationErrors((prev) => ({ ...prev, [field]: null }))
  }

  useEffect(() => {
    const onClickOutside = (e) => {
      if (locationInputRef.current && !locationInputRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null); setSuccess(null)
    if (!validateForm()) { setError(t("errors.fill_required", { defaultValue: "Please fill in all required fields" })); return }

    setLoading(true)
    try {
      const payload = {
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
      setSuccess(t("success.registered", { defaultValue: "Business registered successfully!" }))
      setBusiness((b) => ({
        ...b, name: "", description: "", location: "", businessPhoneNumber: "", nipt: "", openingHours: "",
      }))
      setProfileUrl(""); setCoverUrl(""); setCoords(null)
      setSuggestions([]); setShowSuggestions(false)
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
            <p className="loading-text">{t("status.validating_token", { defaultValue: "Validating access token..." })}</p>
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
            <h2>{t("denied.title", { defaultValue: "Access Denied" })}</h2>
            <p className="error-message">⚠️ {error || t("errors.invalid_token", { defaultValue: "Invalid or expired access token" })}</p>
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
          <h2>{t("hero.title", { defaultValue: "Register Your Business" })}</h2>
          <p>{t("hero.subtitle", { defaultValue: "Create your business profile and start reaching customers today" })}</p>
        </div>

        <div className="form-progress" aria-label={t("progress.aria", { defaultValue: "Form progress" })}>
          <div className="form-progress-bar" style={{ width: `${formProgress}%` }} />
        </div>

        <form className="register-business-form" onSubmit={handleSubmit} noValidate>
          {/* Business Name */}
          <div className={`form-group ${validationErrors.name ? "error" : ""}`}>
            <label htmlFor="name">{t("fields.name.label", { defaultValue: "Business Name *" })}</label>
            <input
              id="name" name="name" type="text"
              placeholder={t("fields.name.ph", { defaultValue: "Enter your business name" })}
              value={business.name} onChange={(e) => handleInputChange("name", e.target.value)} required
            />
            {validationErrors.name && <div className="error-message">⚠️ {validationErrors.name}</div>}
          </div>

          {/* Description */}
          <div className={`form-group ${validationErrors.description ? "error" : ""}`}>
            <label htmlFor="description">{t("fields.description.label", { defaultValue: "Description *" })}</label>
            <textarea
              id="description" name="description"
              placeholder={t("fields.description.ph", { defaultValue: "Describe your business and services" })}
              value={business.description} onChange={(e) => handleInputChange("description", e.target.value)} required
            />
            {validationErrors.description && <div className="error-message">⚠️ {validationErrors.description}</div>}
          </div>

          {/* Business Email */}
          <div className={`form-group ${validationErrors.businessEmail ? "error" : ""}`}>
            <label htmlFor="businessEmail">{t("fields.email.label", { defaultValue: "Business Email *" })}</label>
            <input
              id="businessEmail" name="businessEmail" type="text"
              placeholder={t("fields.email.ph", { defaultValue: "Enter your business email" })}
              value={business.businessEmail} onChange={e => handleInputChange("businessEmail", e.target.value)} required
            />
            {validationErrors.businessEmail && <div className="error-message">⚠️ {validationErrors.businessEmail}</div>}
          </div>

          {/* Phone Number */}
          <div className={`form-group ${validationErrors.businessPhoneNumber ? "error" : ""}`}>
            <label htmlFor="phone">{t("fields.phone.label", { defaultValue: "Phone Number *" })}</label>
            <input
              id="phone" name="businessPhoneNumber" type="tel"
              placeholder={t("fields.phone.ph", { defaultValue: "Enter your business phone number" })}
              value={business.businessPhoneNumber}
              onChange={(e) => handleInputChange("businessPhoneNumber", e.target.value)} required
            />
            {validationErrors.businessPhoneNumber && <div className="error-message">⚠️ {validationErrors.businessPhoneNumber}</div>}
          </div>

          {/* NIPT */}
          <div className="form-group">
            <label htmlFor="nipt">{t("fields.nipt.label", { defaultValue: "NIPT (Tax Number)" })}</label>
            <input
              id="nipt" name="nipt" type="text"
              placeholder={t("fields.nipt.ph", { defaultValue: "Enter your tax identification number" })}
              value={business.nipt} onChange={(e) => handleInputChange("nipt", e.target.value)}
            />
          </div>

          {/* Opening Hours */}
          <div className={`form-group ${validationErrors.openingHours ? "error" : ""}`}>
            <label>{t("fields.hours.label", { defaultValue: "Opening Hours" })}</label>
            <HoursPicker value={schedule} onChange={setSchedule} />
            {validationErrors.openingHours && (
              <div className="error-message">⚠️ {validationErrors.openingHours}</div>
            )}
          </div>

          {/* Location */}
          <div className={`form-group ${validationErrors.location ? "error" : ""}`}>
            <label htmlFor="location">{t("fields.location.label", { defaultValue: "Location *" })}</label>
            <div className="location-input-container" ref={locationInputRef}>
              <div className="location-input-wrapper">
                <div className="location-input-icon">📍</div>
                <input
                  id="location" type="text" className="location-input"
                  placeholder={t("fields.location.ph", { defaultValue: "Start typing to search for location..." })}
                  value={business.location} onChange={handleLocationChange}
                  onFocus={() => setShowSuggestions(suggestions.length > 0)} required
                />
                {business.location && (
                  <button
                    type="button"
                    className="location-clear-btn"
                    onClick={clearLocation}
                    title={t("fields.location.clear", { defaultValue: "Clear location" })}
                  >✕</button>
                )}
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <ul className="location-suggestions">
                  {suggestions.map((s) => (
                    <li key={s.place_id} onClick={() => selectSuggestion(s)}>
                      <div className="location-suggestion-text">
                        <div className="location-suggestion-main">{s.main}</div>
                        <div className="location-suggestion-sub">{s.sub}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {validationErrors.location && <div className="error-message">⚠️ {validationErrors.location}</div>}
          </div>

          {/* Map */}
          <div className="form-group">
            <label>{t("map.label", { defaultValue: "Select Location on Map" })}</label>
            <div className="map-container">
              <div className="map-overlay">
                <div className="map-overlay-content">
                  <div className="map-overlay-icon">🗺️</div>
                  <div className="map-overlay-text">
                    {t("map.help", { defaultValue: "Click on the map to place a marker at your business location" })}
                  </div>
                </div>
              </div>
              <div className="map-wrapper">
                <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
                <div className="map-controls">
                  <button type="button" className="map-control-btn" onClick={zoomIn} title={t("map.zoom_in", { defaultValue: "Zoom In" })}>+</button>
                  <button type="button" className="map-control-btn" onClick={zoomOut} title={t("map.zoom_out", { defaultValue: "Zoom Out" })}>−</button>
                  {coords && (
                    <button type="button" className="map-control-btn" onClick={centerMap} title={t("map.center", { defaultValue: "Center on Marker" })}>🎯</button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <br></br>

          {/* Profile Photo */}
          <div className={`form-group ${validationErrors.profilePicture ? "error" : ""}`}>
            <label htmlFor="profile">{t("fields.profile.label", { defaultValue: "Profile Photo *" })}</label>
            <div className="file-input-wrapper">
              <input id="profile" type="file" accept="image/*" onChange={(e) => handleFile(e, setProfileUrl, "profilePicture")} />
              <div className="file-input-label">
                <span className="file-input-icon">📷</span>
                <span>{t("fields.profile.pick", { defaultValue: "Choose Profile Photo" })}</span>
              </div>
            </div>
            {validationErrors.profilePicture && <div className="error-message">⚠️ {validationErrors.profilePicture}</div>}
            {profileUrl && (
              <div className="image-preview profile-preview">
                <img src={profileUrl} alt={t("fields.profile.alt", { defaultValue: "Profile preview" })} />
                <div
                  className="image-preview-overlay"
                  onClick={() => removeImage(setProfileUrl, "profilePicture")}
                  title={t("fields.profile.remove", { defaultValue: "Remove image" })}
                >✕</div>
              </div>
            )}
          </div>

          {/* Cover Photo */}
          <div className={`form-group ${validationErrors.coverPicture ? "error" : ""}`}>
            <label htmlFor="cover">{t("fields.cover.label", { defaultValue: "Cover Photo *" })}</label>
            <div className="file-input-wrapper">
              <input id="cover" type="file" accept="image/*" onChange={(e) => handleFile(e, setCoverUrl, "coverPicture")} />
              <div className="file-input-label">
                <span className="file-input-icon">🖼️</span>
                <span>{t("fields.cover.pick", { defaultValue: "Choose Cover Photo" })}</span>
              </div>
            </div>
            {validationErrors.coverPicture && <div className="error-message">⚠️ {validationErrors.coverPicture}</div>}
            {coverUrl && (
              <div className="image-preview cover-preview">
                <img src={coverUrl} alt={t("fields.cover.alt", { defaultValue: "Cover preview" })} />
                <div
                  className="image-preview-overlay"
                  onClick={() => removeImage(setCoverUrl, "coverPicture")}
                  title={t("fields.cover.remove", { defaultValue: "Remove image" })}
                >✕</div>
              </div>
            )}
          </div>

          {/* Submit */}
          <button type="submit" className={`submit-button ${loading ? "loading" : ""}`} disabled={loading}>
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                <span>{t("cta.registering", { defaultValue: "Registering Business..." })}</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>{t("cta.register", { defaultValue: "Register Business" })}</span>
              </>
            )}
          </button>

          {error && <div className="error-message" style={{ textAlign: "center" }}>⚠️ {error}</div>}
          {success && <div className="success-message" style={{ textAlign: "center" }}>✅ {success}</div>}
        </form>
      </div>
    </div>
  )
}
