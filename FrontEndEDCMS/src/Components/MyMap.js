// src/pages/MyMap.js
import React, { useState, useEffect } from 'react';
import { Map, Marker, Overlay } from 'pigeon-maps';
import { Link }                from 'react-router-dom';
import '../Styling/map.css';

export default function MyMap() {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [shops, setShops]                     = useState([]);
  const [center, setCenter]                   = useState([50.879, 4.6997]);
  const [zoom, setZoom]                       = useState(12);
  const [selected, setSelected]               = useState(null);
  const [hasLocation, setHasLocation]         = useState(false);

  // 1️⃣ Grab high‑accuracy browser geolocation, once and via watch
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return;
    }

    const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

    const success = ({ coords }) => {
      const me = { lat: coords.latitude, lng: coords.longitude };
      setCurrentLocation(me);
      setCenter([me.lat, me.lng]);
      setZoom(13);
      setHasLocation(true);
    };
    const error = err => {
      console.error('Geolocation error:', err);
      setHasLocation(false);
    };

    navigator.geolocation.getCurrentPosition(success, error, options);
    const watchId = navigator.geolocation.watchPosition(success, error, options);

    return () => { if (watchId != null) navigator.geolocation.clearWatch(watchId); };
  }, []);

  // 2️⃣ Fetch businesses (no longer recenter here!)
  useEffect(() => {
    fetch('http://77.242.26.150:8000/api/Business')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        const parsed = data
          .map(b => {
            const [latS = '', lngS = ''] = (b.location || '').split(',');
            const lat = parseFloat(latS.trim());
            const lng = parseFloat(lngS.trim());
            return {
              id:      b.businessId,
              name:    b.name,
              slug:    b.slug,
              address: b.address,
              lat,
              lng
            };
          })
          .filter(s => !isNaN(s.lat) && !isNaN(s.lng));

        setShops(parsed);
      })
      .catch(err => console.error('Failed to load shops:', err));
  }, []);

  // 3️⃣ If we DON’T have geolocation, center on first shop
  useEffect(() => {
    if (!hasLocation && shops.length > 0) {
      const first = shops[0];
      setCenter([first.lat, first.lng]);
      setZoom(13);
    }
  }, [hasLocation, shops]);

  // 4️⃣ Handlers
  const handleMarkerClick = shop => setSelected(shop);
  const handleClose       = ()   => setSelected(null);
  const getDirections     = (lat, lng) =>
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      '_blank'
    );

  return (
    <div className="map-container">
      <Map
        height="100%"
        center={center}
        defaultZoom={zoom}
        className="custom-map"
      >
        {/* You (blue) — only if we got it */}
        {currentLocation && (
          <Marker
            width={50}
            anchor={[currentLocation.lat, currentLocation.lng]}
            color="blue"
          />
        )}

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
              <Link to={`/shop/${selected.slug}`} className="overlay-button">
                View Shop
              </Link>
              <button onClick={() => getDirections(selected.lat, selected.lng)}>
                Get Directions
              </button>
            </div>
          </Overlay>
        )}
      </Map>
    </div>
  );
}
