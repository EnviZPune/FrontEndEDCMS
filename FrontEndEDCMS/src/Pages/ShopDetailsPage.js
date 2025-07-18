// src/pages/ShopDetailsPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Map, Marker } from 'pigeon-maps';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import '../Styling/sd-shopdetail.css';

const API_BASE  = 'http://77.242.26.150:8000';
const PAGE_SIZE = 8;

export default function ShopDetailsPage() {
  const { slug } = useParams();
  const [shop, setShop] = useState(null);
  const [routeName, setRouteName] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(0);
  const [items, setItems] = useState([]);

  // pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // grab token cleanly
  const token = (() => {
    const raw = localStorage.getItem('token') || localStorage.getItem('authToken');
    return raw ? raw.replace(/^"|"$/g, '') : null;
  })();

  // helper to auto‑determine open vs closed
  const parseAndCheckOpen = (oh) => {
    if (!oh?.includes('-')) return false;
    const [start, end] = oh.split('-');
    const now = new Date();
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const s = new Date(now); s.setHours(sh, sm, 0, 0);
    const e = new Date(now); e.setHours(eh, em, 0, 0);
    return now >= s && now <= e;
  };

  // fetch shop + categories + items
  useEffect(() => {
    if (!token) {
      setError('Please log in.');
      setLoading(false);
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    (async () => {
      try {
        // shop
        const shopRes = await fetch(
          `${API_BASE}/api/Business/slug/${encodeURIComponent(slug)}`,
          { headers }
        );
        if (!shopRes.ok) throw new Error(`Shop fetch failed: ${shopRes.status}`);
        const shopData = await shopRes.json();
        setShop(shopData);

        // open/closed
        setIsOpen(
          typeof shopData.isManuallyOpen === 'boolean'
            ? shopData.isManuallyOpen
            : parseAndCheckOpen(shopData.openingHours)
        );

        // reverse‑geocode
        if (shopData.location?.includes(',')) {
          const [lat, lon] = shopData.location.split(',').map(Number);
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
            .then(r => r.json())
            .then(j => setRouteName(j.display_name || shopData.location))
            .catch(() => setRouteName(shopData.location));
        }

        // categories & items
        const bizId = shopData.businessId;
        const [catsRes, itemsRes] = await Promise.all([
          fetch(`${API_BASE}/api/ClothingCategory/business/${bizId}`, { headers }),
          fetch(`${API_BASE}/api/ClothingItem/business/${bizId}`,     { headers }),
        ]);
        const cats  = catsRes.ok   ? await catsRes.json()   : [];
        const allItems = itemsRes.ok  ? await itemsRes.json()  : [];

        setCategories([{ clothingCategoryId: 0, name: 'All' }, ...cats]);
        setItems(allItems);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, token]);

  // recompute pagination whenever items or category changes
  useEffect(() => {
    const filtered = selectedCategoryId === 0
      ? items
      : items.filter(i => i.clothingCategoryId === selectedCategoryId);

    setTotalPages(Math.ceil(filtered.length / PAGE_SIZE) || 1);
    setPage(1);
  }, [items, selectedCategoryId]);

  if (loading) return <p>Loading…</p>;
  if (error)   return <p className="sd-error">{error}</p>;
  if (!shop)   return <p className="sd-error">Shop not found</p>;

  // slice out current page of filtered items
  const filteredItems = selectedCategoryId === 0
    ? items
    : items.filter(i => i.clothingCategoryId === selectedCategoryId);

  const startIdx    = (page - 1) * PAGE_SIZE;
  const pageItems   = filteredItems.slice(startIdx, startIdx + PAGE_SIZE);

  // map coords
  let coords = null;
  if (shop.location?.includes(',')) {
    const [lat, lon] = shop.location.split(',').map(Number);
    if (!isNaN(lat) && !isNaN(lon)) coords = [lat, lon];
  }

  return (
    <>
      <Navbar />

      <div className="sd-page-wrapper">
        {/* HERO */}
        <div
          className="sd-shop-hero"
          style={{ backgroundImage: `url(${shop.coverPhoto || shop.coverPictureUrl})` }}
        >
          <div className="sd-shop-hero-content">
            <img
              className="sd-shop-logo"
              src={shop.profilePhoto || shop.profilePictureUrl}
              alt={`${shop.name} Logo`}
            />
            <h1 className="sd-shop-name">{shop.name}</h1>
          </div>
        </div>

        {/* BODY */}
        <div className="sd-body-wrapper">
          {/* MAIN */}
          <main className="sd-main-col">
            <nav className="sd-category-bar" aria-label="Item categories">
              {categories.map(cat => (
                <button
                  key={cat.clothingCategoryId}
                  className={`sd-category-pill ${selectedCategoryId === cat.clothingCategoryId ? 'active' : ''}`}
                  onClick={() => setSelectedCategoryId(cat.clothingCategoryId)}
                >
                  {cat.name}
                </button>
              ))}
            </nav>

            <section className="sd-products-section">
              <h2>
                {selectedCategoryId === 0
                  ? 'All Items'
                  : categories.find(c => c.clothingCategoryId === selectedCategoryId)?.name
                }
              </h2>

              <ul className="sd-product-list">
                {pageItems.map(p => (
                  <li key={p.clothingItemId} className="sd-product-card">
                    <Link to={`/product/${p.clothingItemId}`} className="sd-product-link">
                      <img
                        className="sd-product-image"
                        src={Array.isArray(p.pictureUrls) ? p.pictureUrls[0] : '/default-product.jpg'}
                        alt={p.name}
                      />
                      <div className="sd-product-inline">
                        <span>{p.name}</span>
                        <span>${p.price.toFixed(2)}</span>
                        <span>{p.description}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>

              {totalPages > 1 && (
                <div className="sd-pagination">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                    Prev
                  </button>
                  <span>Page {page} of {totalPages}</span>
                  <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                    Next
                  </button>
                </div>
              )}
            </section>
          </main>

          {/* ASIDE */}
          <aside className="sd-info-col">
            <div className="sd-shop-info">
              <p><strong>Description:</strong> {shop.description}</p>
              <p><strong>Address:</strong>     {shop.address}</p>
              <p><strong>Phone:</strong>       {shop.businessPhoneNumber}</p>
              <p><strong>Hours:</strong>       {shop.openingHours}</p>
              <p>
                <strong>Status:</strong>{' '}
                <span className={`shop-status ${isOpen ? 'open' : 'closed'}`}>
                  {isOpen ? 'Open' : 'Closed'}
                </span>
              </p>
            </div>

            {coords && (
              <div className="sd-shop-location">
                <h3>Location on Map</h3>
                <div className="sd-location-map">
                  <Map
                    height={160}
                    defaultCenter={coords}
                    defaultZoom={13}
                    metaWheel
                    mouseEvents
                  >
                    <Marker width={50} anchor={coords} />
                  </Map>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      <Footer />
    </>
  );
}
