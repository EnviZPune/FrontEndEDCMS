import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useApiClient } from '../hooks/useApiClient'
import '../../../Styling/Settings/myshopspanel.css'

export default function MyShopsPanel({ businesses = [] }) {
  const { get } = useApiClient()
  const SHOPS_PER_PAGE = 12

  const [page, setPage]     = useState(1)
  const [images, setImages] = useState({}) // map of businessId → coverUrl

  const totalPages = Math.max(1, Math.ceil(businesses.length / SHOPS_PER_PAGE))
  const startIdx   = (page - 1) * SHOPS_PER_PAGE
  const pageShops  = businesses.slice(startIdx, startIdx + SHOPS_PER_PAGE)

  // Fetch cover images for shops on the current page
  useEffect(() => {
    let cancelled = false

    pageShops.forEach(shop => {
      if (shop.businessId in images) return

      get(`/api/Business/${shop.businessId}`)
        .then(detail => {
          if (cancelled) return
          const url = detail.coverPictureUrl || detail.coverPhotoUrl || ''
          setImages(prev => ({ ...prev, [shop.businessId]: url }))
        })
        .catch(err => {
          console.error(`Failed to load business ${shop.businessId}:`, err)
          if (!cancelled) {
            setImages(prev => ({ ...prev, [shop.businessId]: '' }))
          }
        })
    })

    return () => { cancelled = true }
  }, [pageShops, get, images])

  const handlePrev = () => setPage(p => Math.max(p - 1, 1))
  const handleNext = () => setPage(p => Math.min(p + 1, totalPages))

  return (
    <div className="panel my-shops-panel">
      <h3>My Shops</h3>

      <div className="shop-grid">
        {pageShops.map(shop => {
          const imageUrl = images[shop.businessId] ||
            'https://via.placeholder.com/400x225?text=No+Image'

          return (
            <Link
              key={shop.slug ?? shop.businessId}
              to={`/shop/${shop.slug ?? shop.businessId}`}
              className="shop-card"
            >
              <div className="shop-card-image">
                <img
                  src={imageUrl}
                  alt={`${shop.name} cover`}
                />
                <div className="shop-card-image-overlay">
                  {shop.name}
                </div>
              </div>
              {shop.description && (
                <div className="shop-card-content">
                  <p className="shop-card-desc">{shop.description}</p>
                </div>
              )}
            </Link>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={handlePrev} disabled={page === 1}>
            Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i + 1}
              className={page === i + 1 ? 'active' : ''}
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          <button onClick={handleNext} disabled={page === totalPages}>
            Next
          </button>
        </div>
      )}
    </div>
  )
}
