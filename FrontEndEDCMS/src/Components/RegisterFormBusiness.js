// src/pages/RegisterFormBusiness.js
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../Styling/registerbusiness.css'
import Navbar from '../Components/Navbar'

// fix default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl:       require('leaflet/dist/images/marker-icon.png'),
  shadowUrl:     require('leaflet/dist/images/marker-shadow.png'),
})

const API_BASE   = 'http://77.242.26.150:8000/api'
const GCS_BUCKET = 'https://storage.googleapis.com/edcms_bucket'

function getToken() {
  const raw = localStorage.getItem('token')
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
  const paymentToken = new URLSearchParams(search).get('token')

  const [business, setBusiness]   = useState({
    name: '', description: '', address: '',
    location: '', businessPhoneNumber: '',
    nipt: '', openingHours: ''
  })
  const [profileUrl, setProfileUrl] = useState('')
  const [coverUrl,   setCoverUrl]   = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [coords,      setCoords]      = useState(null) // [lat, lng]
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [success,     setSuccess]     = useState(null)
  const [tokenChecked,setTokenChecked]= useState(false)
  const [tokenValid, setTokenValid]   = useState(false)

  // refs for the map + marker
  const mapRef       = useRef(null)
  const markerRef    = useRef(null)
  const containerRef = useRef(null)

  // 1) validate payment token
  useEffect(() => {
    if (!paymentToken) {
      setError('Missing access token')
      setTokenChecked(true)
      return
    }
    fetch(`${API_BASE}/payment/validate-token?token=${paymentToken}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setTokenValid(d.valid))
      .catch(() => setError('Invalid or expired token'))
      .finally(() => setTokenChecked(true))
  }, [paymentToken])

  // 2) init Leaflet map once form is rendered (after token check & valid)
  useEffect(() => {
    if (!tokenChecked || !tokenValid) return
    if (!containerRef.current) return

    // tear down any existing map
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
      markerRef.current?.remove()
      markerRef.current = null
    }

    const map = L.map(containerRef.current, {
      center: [0, 0],
      zoom: 2,
      layers: [
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        })
      ]
    })

    // click on map to place pin
    map.on('click', e => {
      const { lat, lng } = e.latlng
      setCoords([lat, lng])
      setBusiness(b => ({ ...b, location: `${lat},${lng}` }))
      setSuggestions([])
    })

    map.whenReady(() => map.invalidateSize())
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [tokenChecked, tokenValid])

  // 3) whenever coords change, move or add a draggable marker
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // remove existing
    if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
    if (!coords) return

    const m = L.marker(coords, { draggable: true }).addTo(map)
    m.on('dragend', e => {
      const { lat, lng } = e.target.getLatLng()
      setCoords([lat, lng])
      setBusiness(b => ({ ...b, location: `${lat},${lng}` }))
    })
    markerRef.current = m

    // re-center on pin
    map.setView(coords, 13)
  }, [coords])

  // 4) autocomplete
  const handleLocationChange = useCallback(async e => {
    const q = e.target.value
    setBusiness(b => ({ ...b, location: q }))
    setCoords(null)
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

  const selectSuggestion = s => {
    setBusiness(b => ({ ...b, location: s.display_name }))
    setCoords([parseFloat(s.lat), parseFloat(s.lon)])
    setSuggestions([])
  }

  // 5) image uploads
  const uploadImageToGCS = async file => {
    const ts   = Date.now()
    const name = `${ts}-${file.name}`
    const url  = `${GCS_BUCKET}/${name}`
    const txt  = `${url}.txt`
    try {
      let r = await fetch(url, {
        method:'PUT',
        headers:{ 'Content-Type': file.type },
        body: file
      })
      if (!r.ok) throw new Error('Upload failed')
      r = await fetch(txt, {
        method:'PUT',
        headers:{ 'Content-Type':'text/plain' },
        body: url
      })
      if (!r.ok) throw new Error('TXT write failed')
      return url
    } catch (err) {
      console.error(err)
      return null
    }
  }

  const handleFile = (e, setter) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    uploadImageToGCS(file)
      .then(url => {
        if (url) setter(url)
        else     setError('Image upload failed')
      })
      .finally(() => setLoading(false))
  }

  // 6) submit form
  const handleSubmit = async e => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!profileUrl || !coverUrl) {
      setError('Profile & cover photos required')
      return
    }
    if (!coords) {
      setError('Please select a location (suggestion or map)')
      return
    }

    setLoading(true)
    try {
      const payload = {
        ...business,
        profilePictureUrl: profileUrl,
        coverPictureUrl:   coverUrl,
        location:          `${coords[0]},${coords[1]}`,
        name: business.name
          .toLowerCase().trim()
          .replace(/\s+/g,'-')
          .replace(/[^a-z0-9-]/g,'')
      }
      const res = await fetch(
        `${API_BASE}/Business?token=${encodeURIComponent(paymentToken)}`,
        {
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            Authorization:`Bearer ${getToken()}`
          },
          body: JSON.stringify(payload)
        }
      )
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg||'Registration failed')
      }
      await res.json()
      setSuccess('Business registered!')
      // reset
      setBusiness({
        name:'',description:'',address:'',
        location:'',businessPhoneNumber:'',
        nipt:'',openingHours:''
      })
      setProfileUrl('')
      setCoverUrl('')
      setCoords(null)
      setSuggestions([])
      setTimeout(() => navigate(`/shop/${payload.name}`), 500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // early returns
  if (!tokenChecked)    return <p>Validating token…</p>
  if (!tokenValid)      return <p className="error">{error||'Access denied.'}</p>

  return (
    <div>
      <Navbar />
      <div className="register-business-form-container">
        <form className="register-business-form" onSubmit={handleSubmit}>
          <h2>Register a New Business</h2>

          {[
            ['name', true,  'Business Name'],
            ['description',false,'Description'],
            ['address', true,'Address'],
            ['businessPhoneNumber',false,'Phone Number'],
            ['nipt', false, 'NIPT'],
            ['openingHours',false,'Opening Hours']
          ].map(([f, req, ph]) => (
            <input
              key={f}
              name={f}
              type="text"
              placeholder={ph}
              required={req}
              value={business[f]}
              onChange={e => setBusiness(b=>({...b,[f]:e.target.value}))}
            />
          ))}

          <label>Location</label>
          <div style={{ position:'relative', width:'100%' }}>
            <input
              type="text"
              placeholder="Start typing…"
              value={business.location}
              onChange={handleLocationChange}
              style={{ width:'100%' }}
            />
            {suggestions.length > 0 && (
              <ul style={{
                position:'absolute',
                top:'100%', left:0, right:0,
                background:'#fff', border:'1px solid #ccc',
                margin:0, padding:0, listStyle:'none',
                maxHeight:150, overflowY:'auto', zIndex:1000
              }}>
                {suggestions.map(s=>(
                  <li
                    key={s.place_id}
                    onClick={()=>selectSuggestion(s)}
                    style={{ padding:8, cursor:'pointer' }}
                  >
                    {s.display_name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* the map */}
          <div
            ref={containerRef}
            style={{ height:200, width:'100%', marginTop:16 }}
          />

          <label>Profile Photo</label>
          <input type="file" accept="image/*" onChange={e=>handleFile(e,setProfileUrl)} />
          {profileUrl && <img src={profileUrl} alt="" style={{ width:120, height:120, objectFit:'cover', margin:'10px 0' }} />}

          <label>Cover Photo</label>
          <input type="file" accept="image/*" onChange={e=>handleFile(e,setCoverUrl)} />
          {coverUrl   && <img src={coverUrl}   alt="" style={{ width:'100%', maxHeight:180, objectFit:'cover', margin:'10px 0' }} />}

          <button type="submit" disabled={loading}>
            {loading ? 'Submitting…' : 'Register Business'}
          </button>

          {error   && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
        </form>
      </div>
    </div>
  )
}
