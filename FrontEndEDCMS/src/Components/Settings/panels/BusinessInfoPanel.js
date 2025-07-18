// src/Components/Settings/panels/BusinessInfoPanel.js
import React, { useState, useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useApiClient } from '../../../Components/Settings/hooks/useApiClient'
import '../../../Styling/Settings/settings.css'
import '../../../Styling/Settings/businessinfopanel.css'

// fix Leaflet’s default icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl:       require('leaflet/dist/images/marker-icon.png'),
  shadowUrl:     require('leaflet/dist/images/marker-shadow.png'),
})

export default function BusinessInfoPanel({ business }) {
  const { get, put } = useApiClient()
  const [loading, setLoading]         = useState(true)
  const [detail, setDetail]           = useState(null)
  const [form, setForm]               = useState({
    name: '', description: '', nipt: '',
    address: '', location: '',
    openingHours: '', businessPhoneNumber: ''
  })
  const [coordinates, setCoordinates] = useState(null)
  const [suggestions, setSuggestions] = useState([])

  const mapContainerRef = useRef(null)
  const leafletMapRef   = useRef(null)
  const markerRef       = useRef(null)

  // 1) Fetch business details once when ID changes
  useEffect(() => {
    if (!business?.businessId) return
    let cancelled = false
    setLoading(true)

    get(`/api/Business/${business.businessId}`)
      .then(data => {
        if (cancelled) return
        setDetail(data)

        // parse saved "lat,lon"
        if (data.location?.includes(',')) {
          const [latS, lngS] = data.location.split(',')
          const lat = parseFloat(latS), lng = parseFloat(lngS)
          if (!isNaN(lat) && !isNaN(lng)) {
            setCoordinates([lat, lng])
            // reverse‑geocode for display name
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
              .then(r => r.json())
              .then(j => !cancelled && j.display_name && setForm(f => ({ ...f, location: j.display_name })))
              .catch(() => !cancelled && setForm(f => ({ ...f, location: data.location })))
          } else {
            setForm(f => ({ ...f, location: data.location }))
          }
        } else {
          setForm(f => ({ ...f, location: data.location || '' }))
        }

        // fill other fields
        setForm(f => ({
          ...f,
          name:                data.name || '',
          description:         data.description || '',
          nipt:                data.nipt || '',
          address:             data.address || '',
          openingHours:        data.openingHours || '',
          businessPhoneNumber: data.businessPhoneNumber || ''
        }))
      })
      .catch(err => {
        console.error('Failed to load business details:', err)
        if (!cancelled) setDetail(null)
      })
      .finally(() => !cancelled && setLoading(false))

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.businessId])

  // 2) Initialize the map once (after details load)
  useEffect(() => {
    if (loading || !detail) return
    if (!mapContainerRef.current || leafletMapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: coordinates || [0, 0],
      zoom: coordinates ? 13 : 2,
      layers: [
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        })
      ]
    })

    map.on('click', e => {
      const { lat, lng } = e.latlng
      setCoordinates([lat, lng])
      setForm(f => ({ ...f, location: `${lat},${lng}` }))
      setSuggestions([])
    })

    map.whenReady(() => map.invalidateSize())
    leafletMapRef.current = map

    return () => {
      map.remove()
      leafletMapRef.current = null
      markerRef.current?.remove()
      markerRef.current = null
    }
  }, [loading, detail, coordinates])

  // 3) Add/move draggable marker whenever coordinates update
  useEffect(() => {
    const map = leafletMapRef.current
    if (!map) return

    markerRef.current?.remove()
    markerRef.current = null

    if (!coordinates) return

    const m = L.marker(coordinates, { draggable: true }).addTo(map)
    m.on('dragend', e => {
      const { lat, lng } = e.target.getLatLng()
      setCoordinates([lat, lng])
      setForm(f => ({ ...f, location: `${lat},${lng}` }))
    })
    markerRef.current = m
    map.setView(coordinates, map.getZoom())
  }, [coordinates])

  // 4) Autocomplete search
  const handleLocationChange = useCallback(async e => {
    const q = e.target.value
    setForm(f => ({ ...f, location: q }))
    setCoordinates(null)
    if (q.length < 3) {
      setSuggestions([])
      return
    }
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`
      )
      const data = await res.json()
      setSuggestions(data)
    } catch {
      setSuggestions([])
    }
  }, [])

  const handleSelectSuggestion = useCallback(s => {
    const lat = parseFloat(s.lat), lon = parseFloat(s.lon)
    if (isNaN(lat) || isNaN(lon)) return
    setForm(f => ({ ...f, location: s.display_name }))
    setCoordinates([lat, lon])
    setSuggestions([])
  }, [])

  // 5) Save back to server as “lat,lon”
  const handleSave = useCallback(async () => {
    if (!coordinates) {
      alert('Please pick a location (map or suggestion).')
      return
    }
    const locStr = `${coordinates[0]},${coordinates[1]}`
    try {
      await put(`/api/Business/${detail.businessId}`, {
        ...detail,
        ...form,
        location: locStr
      })
      alert('Business info updated!')
    } catch (err) {
      console.error('Save failed:', err)
      alert('Failed to save business info.')
    }
  }, [coordinates, detail, form, put])

  if (loading) return <div className="panel business-info-panel"><p>Loading…</p></div>
  if (!detail)  return <div className="panel business-info-panel"><p>Error loading info.</p></div>

  return (
    <div className="panel business-info-panel">
      <h3>Edit Business Info</h3>

      <label><b>Business Name</b></label>
      <input
        type="text"
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
      />

      <label><b>Description</b></label>
      <textarea
        value={form.description}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
      />

      <label><b>NIPT</b></label>
      <input
        type="text"
        value={form.nipt}
        onChange={e => setForm(f => ({ ...f, nipt: e.target.value }))}
      />

      <label><b>Address</b></label>
      <input
        type="text"
        value={form.address}
        onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
      />

      <label><b>Location</b></label>
      <div style={{ position:'relative' }}>
        <input
          type="text"
          value={form.location}
          placeholder="Start typing…"
          onChange={handleLocationChange}
          style={{ width:'100%' }}
        />
        {suggestions.length > 0 && (
          <ul className="suggestions-list">
            {suggestions.map(s => (
              <li
                key={s.place_id}
                onClick={() => handleSelectSuggestion(s)}
              >
                {s.display_name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* map container */}
      <div
        ref={mapContainerRef}
        style={{ height:200, width:'100%', marginTop:16 }}
      />

      <label><b>Opening Hours</b></label>
      <input
        type="text"
        value={form.openingHours}
        onChange={e => setForm(f => ({ ...f, openingHours: e.target.value }))}
      />

      <label><b>Business Phone Number</b></label>
      <input
        type="tel"
        value={form.businessPhoneNumber}
        onChange={e => setForm(f => ({ ...f, businessPhoneNumber: e.target.value }))}
      />

      <button type="button" onClick={handleSave}>
        Save Changes
      </button>
    </div>
  )
}
