import React, { useState, useEffect } from 'react'
import { Map, Marker, Overlay } from 'pigeon-maps'
import '../Styling/map.css'
import { useNavigate } from 'react-router-dom'

function MyMap() {
  const [currentLocation, setCurrentLocation] = useState({ lat: 50.879, lng: 4.6997 })
  const [shopLocations, setShopLocations]     = useState([])
  const [selectedShop, setSelectedShop]       = useState(null)
  const navigate = useNavigate()

  // 1. Grab user’s location
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCurrentLocation({ lat: coords.latitude, lng: coords.longitude })
      },
      (err) => console.error('Geolocation error:', err)
    )
  }, [])

  // 2. Fetch shops from your API
  useEffect(() => {
    fetch('/api/Business')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load shops')
        return res.json()
      })
      .then((shops) => {
        // Map your API’s shape to what the map needs:
        const locs = shops.map((b) => ({
          id:       b.id,
          name:     b.name,
          category: b.categoryName,    // adjust to your DTO
          address:  b.address,
          slug:     b.slug,
          lat:      b.latitude,
          lng:      b.longitude,
        }))
        setShopLocations(locs)
      })
      .catch((err) => console.error(err))
  }, [])

  // 3. Handlers
  const handleMarkerClick = (shop) => setSelectedShop(shop)
  const handleCloseOverlay = () => setSelectedShop(null)
  const handleViewShop = (slug) => navigate(`/shop/${slug}`)
  const handleGetDirections = (lat, lng) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank')
  }

  return (
    <div className="map-container">
      <Map
        height={500}
        center={[currentLocation.lat, currentLocation.lng]}
        defaultZoom={12}
        className="custom-map"
      >
        {/* User’s location */}
        <Marker
          width={50}
          anchor={[currentLocation.lat, currentLocation.lng]}
          color="blue"
        />

        {/* All shop markers */}
        {shopLocations.map((shop) => (
          <Marker
            key={shop.id}
            width={50}
            anchor={[shop.lat, shop.lng]}
            color="red"
            onClick={() => handleMarkerClick(shop)}
          />
        ))}

        {/* Details overlay */}
        {selectedShop && (
          <Overlay
            anchor={[selectedShop.lat, selectedShop.lng]}
            offset={[12, 30]}
          >
            <div className="overlay-container">
              <button
                className="close-overlay"
                onClick={handleCloseOverlay}
              >
                ✕
              </button>
              <h4>{selectedShop.name}</h4>
              <p><strong>Category:</strong> {selectedShop.category}</p>
              <p><strong>Address:</strong> {selectedShop.address}</p>

              <button
                id="button-map-viewshop"
                onClick={() => handleViewShop(selectedShop.slug)}
              >
                View Shop
              </button>
              <button
                id="button-map-directions"
                onClick={() =>
                  handleGetDirections(selectedShop.lat, selectedShop.lng)
                }
              >
                Get Directions
              </button>
            </div>
          </Overlay>
        )}
      </Map>
    </div>
  )
}

export default MyMap
