// src/pages/MyMap.js
import React, { useState, useEffect } from 'react'
import { Map, Marker, Overlay } from 'pigeon-maps'
import '../Styling/map.css'
import { useNavigate } from 'react-router-dom'

export default function MyMap() {
  const [currentLocation, setCurrentLocation] = useState({ lat: 50.879, lng: 4.6997 })
  const [shops, setShops]                     = useState([])
  const [center, setCenter]                   = useState([50.879, 4.6997])
  const [zoom, setZoom]                       = useState(12)
  const [selected, setSelected]               = useState(null)
  const navigate = useNavigate()

  // 1️⃣ Grab browser geolocation
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const me = { lat: coords.latitude, lng: coords.longitude }
        setCurrentLocation(me)
        // Optionally re‑center on the user:
        // setCenter([me.lat, me.lng])
      },
      err => console.error('Geolocation error:', err)
    )
  }, [])

  // 2️⃣ Fetch your businesses
  useEffect(() => {
    // ▶️ Make sure this URL is correct for your backend!
    fetch('http://77.242.26.150:8000/api/Business')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        console.log('API returned businesses:', data)
        const parsed = data
          .map(b => {
            const [latS = '', lngS = ''] = (b.location || '').split(',')
            const lat = parseFloat(latS.trim())
            const lng = parseFloat(lngS.trim())
            return {
              id:       b.businessId,
              name:     b.name,
              slug:     b.slug,
              address:  b.address,
              lat,
              lng
            }
          })
          .filter(s => !isNaN(s.lat) && !isNaN(s.lng))

        console.log('Shops with valid coords:', parsed)
        setShops(parsed)

        // If you want to auto‑zoom/center to include those markers:
        if (parsed.length > 0) {
          const first = parsed[0]
          setCenter([ first.lat, first.lng ])
          setZoom(13)
        }
      })
      .catch(err => {
        console.error('Failed to load shops:', err)
      })
  }, [])

  // 3️⃣ Handlers
  const handleMarkerClick = shop => setSelected(shop)
  const handleClose      = ()   => setSelected(null)
  const goToShop         = slug  => navigate(`/shop/${slug}`)
  const getDirections    = (lat,lng) =>
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank')

  return (
    <div className="map-container">
      <Map
        height={500}
        center={center}
        defaultZoom={zoom}
        className="custom-map"
      >
        {/* You (blue) */}
        <Marker
          width={50}
          anchor={[currentLocation.lat, currentLocation.lng]}
          color="blue"
        />

        {/* Shops (red) */}
        {shops.map(shop => (
          <Marker
            key={shop.id}
            width={50}
            anchor={[shop.lat, shop.lng]}
            color="red"
            onClick={() => handleMarkerClick(shop)}
          />
        ))}

        {/* Info bubble */}
        {selected && (
          <Overlay
            anchor={[selected.lat, selected.lng]}
            offset={[12, 30]}
          >
            <div className="overlay-container">
              <button className="close-overlay" onClick={handleClose}>✕</button>
              <h4>{selected.name}</h4>
              <p><strong>Address:</strong> {selected.address}</p>
              <button onClick={() => goToShop(selected.slug)}>View Shop</button>
              <button onClick={() => getDirections(selected.lat, selected.lng)}>
                Get Directions
              </button>
            </div>
          </Overlay>
        )}
      </Map>
    </div>
  )
}
