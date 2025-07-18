// src/pages/ShopDetailsPage.jsx
import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import Navbar from '../Components/Navbar'
import Footer from '../Components/Footer'
import '../Styling/sd-shopdetail.css'

const API_BASE  = 'http://77.242.26.150:8000'
const PAGE_SIZE = 8

export default function ShopDetailsPage() {
  const { slug } = useParams()

  // ── Shop info ─────────────────────────────────────────────
  const [shop, setShop]     = useState(null)
  const [isOpen, setIsOpen] = useState(false)

  // ── Categories + items ────────────────────────────────────
  const [categories, setCategories]                 = useState([])
  const [selectedCategoryId, setSelectedCategoryId] = useState(0)
  const [items, setItems]                           = useState([])

  // ── Pagination + UI ───────────────────────────────────────
  const [page, setPage]           = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  const token = (() => {
    const raw = localStorage.getItem('token') || localStorage.getItem('authToken')
    return raw ? raw.replace(/^"|"$/g, '') : null
  })()

  const parseAndCheckOpen = (oh) => {
    if (!oh?.includes('-')) return false
    const [start, end] = oh.split('-')
    const now = new Date()
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    const s = new Date(now); s.setHours(sh, sm, 0, 0)
    const e = new Date(now); e.setHours(eh, em, 0, 0)
    return now >= s && now <= e
  }

  // ── Fetch shop, categories & items via slug ────────────────
  useEffect(() => {
    if (!token) {
      setError('Please log in.')
      setLoading(false)
      return
    }
    const headers = { Authorization: `Bearer ${token}` }

    ;(async () => {
      try {
        // 1) fetch the business by slug
        const shopRes = await fetch(
          `${API_BASE}/api/Business/slug/${encodeURIComponent(slug)}`,
          { headers }
        )
        if (!shopRes.ok) {
          throw new Error(`Shop fetch failed: ${shopRes.status}`)
        }
        const shopData = await shopRes.json()
        setShop(shopData)
        setIsOpen(
          typeof shopData.isManuallyOpen === 'boolean'
            ? shopData.isManuallyOpen
            : parseAndCheckOpen(shopData.openingHours)
        )

        // 2) fetch categories & items using returned numeric businessId
        const bizId = shopData.businessId
        const [catsRes, itemsRes] = await Promise.all([
          fetch(
            `${API_BASE}/api/ClothingCategory/business/${bizId}`,
            { headers }
          ),
          fetch(
            `${API_BASE}/api/ClothingItem/business/${bizId}`,
            { headers }
          ),
        ])

        const catsData  = catsRes.ok   ? await catsRes.json()  : []
        const itemsData = itemsRes.ok  ? await itemsRes.json() : []

        setCategories([{ clothingCategoryId: 0, name: 'All' }, ...catsData])
        setItems(itemsData)
      } catch (err) {
        console.error(err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [slug, token])

  // ── Recompute pagination whenever items change ──────────────
  useEffect(() => {
    setTotalPages(Math.ceil(items.length / PAGE_SIZE))
    setPage(1)
  }, [items])

  if (loading) return <p>Loading…</p>
  if (error)   return <p className="sd-error">{error}</p>
  if (!shop)   return <p className="sd-error">Shop not found</p>

  // ── Prepare paginated “All” slice ─────────────────────────
  const startIdx     = (page - 1) * PAGE_SIZE
  const allPageItems = items.slice(startIdx, startIdx + PAGE_SIZE)

  // ── Full list for the selected category ───────────────────
  const categoryItems =
    selectedCategoryId === 0
      ? []
      : items.filter(item => item.clothingCategoryId === selectedCategoryId)

  return (
    <>
      <Navbar />

      <div className="sd-shop-details-page">
        {/* HERO */}
        <div
          className="sd-shop-hero"
          style={{
            backgroundImage: `url(${shop.coverPhoto || shop.coverPictureUrl || '/default-cover.jpg'})`
          }}
        >
          <div className="sd-shop-hero-content">
            <img
              className="sd-shop-logo"
              src={shop.profilePhoto || shop.profilePictureUrl || '/default-logo.jpg'}
              alt={`${shop.name} Logo`}
            />
            <h1 className="sd-shop-name">{shop.name}</h1>
          </div>
        </div>

        {/* INFO */}
        <div className="sd-shop-info">
          <p><strong>Description:</strong> {shop.description}</p>
          <p><strong>Location:</strong> {shop.location}</p>
          <p><strong>Address:</strong> {shop.address}</p>
          <p><strong>Phone:</strong> {shop.businessPhoneNumber}</p>
          <p><strong>Hours:</strong> {shop.openingHours}</p>
          <p>
            <strong>Status:</strong>{' '}
            <span className={`shop-status ${isOpen ? 'open' : 'closed'}`}>
              {isOpen ? 'Open' : 'Closed'}
            </span>
          </p>
        </div>

        {/* CATEGORY PILLS */}
        <div className="sd-category-bar">
          {categories.map(cat => (
            <button
              key={cat.clothingCategoryId}
              className={`sd-category-pill ${
                selectedCategoryId === cat.clothingCategoryId ? 'active' : ''
              }`}
              onClick={() => setSelectedCategoryId(cat.clothingCategoryId)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* PRODUCTS */}
        <div className="sd-products-section">
          <h2>
            {selectedCategoryId === 0
              ? 'All Items'
              : categories.find(c => c.clothingCategoryId === selectedCategoryId)?.name
            }
          </h2>

          {(selectedCategoryId === 0 ? allPageItems : categoryItems).length > 0 ? (
            <ul className="sd-product-list">
              {(selectedCategoryId === 0 ? allPageItems : categoryItems).map(p => (
                <li key={p.clothingItemId} className="sd-product-card">
                  <Link to={`/product/${p.clothingItemId}`} className="sd-product-link">
                    <img
                      src={Array.isArray(p.pictureUrls) ? p.pictureUrls[0] : '/default-product.jpg'}
                      alt={p.name}
                      className="sd-product-image"
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
          ) : (
            <p className="sd-no-items">
              {selectedCategoryId === 0
                ? 'No items available.'
                : 'No items in this category.'
              }
            </p>
          )}

          {/* PAGINATION FOR “ALL” ONLY */}
          {selectedCategoryId === 0 && totalPages > 1 && (
            <div className="sd-pagination">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(p - 1, 1))}
              >
                Prev
              </button>
              <span>Page {page} of {totalPages}</span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </>
  )
}
