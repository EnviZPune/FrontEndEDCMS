import { useEffect, useState, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import Navbar from "../Components/Navbar"
import Footer from "../Components/Footer"
import Search from "../Components/SearchBar"
import Pagination from "../Components/Pagination.tsx"
import "../Styling/shoplist.css"

const API_BASE = "http://77.242.26.150:8000/api"
const PAGE_SIZE = 9
const SPOTLIGHT_SIZE = 8

const toSlug = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")

export default function ShopList() {
  const [shops, setShops] = useState([])
  const [spotlightShops, setSpotlightShops] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [spotlightLoading, setSpotlightLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)
  const [categories, setCategories] = useState([])
  const [loadingCats, setLoadingCats] = useState(true)
  const [errorCats, setErrorCats] = useState("")
  const navigate = useNavigate()
  const carouselRef = useRef(null)
  const spotlightRef = useRef(null)
  const categoriesRef = useRef(null)

  // Load spotlight shops (new/latest shops)
  useEffect(() => {
    let canceled = false
    ;(async () => {
      setSpotlightLoading(true)
      try {
        const res = await fetch(`${API_BASE}/Business/paginated?pageNumber=1&pageSize=${SPOTLIGHT_SIZE}`)
        if (!res.ok) throw new Error((await res.text()) || res.statusText)
        const { items } = await res.json()
        const mapped = items.map((shop) => ({
          ...shop,
          slug: shop.slug || toSlug(shop.name),
        }))
        if (!canceled) {
          setSpotlightShops(mapped)
        }
      } catch (err) {
        console.error("Error loading new shops:", err.message)
      } finally {
        if (!canceled) setSpotlightLoading(false)
      }
    })()

    return () => {
      canceled = true
    }
  }, [])

  // Load paginated shops for browse section
  useEffect(() => {
    let canceled = false
    ;(async () => {
      setLoading(true)
      setError("")
      try {
        const res = await fetch(`${API_BASE}/Business/paginated?pageNumber=${page}&pageSize=${PAGE_SIZE}`)
        if (!res.ok) throw new Error((await res.text()) || res.statusText)
        const { items, totalCount: count } = await res.json()
        const mapped = items.map((shop) => ({
          ...shop,
          slug: shop.slug || toSlug(shop.name),
        }))
        if (!canceled) {
          setShops(mapped)
          setTotalCount(count)
        }
      } catch (err) {
        if (!canceled) setError(err.message)
      } finally {
        if (!canceled) setLoading(false)
      }
    })()

    return () => {
      canceled = true
    }
  }, [page])

  // Fetch all categories once
  useEffect(() => {
    let canceled = false
    ;(async () => {
      setLoadingCats(true)
      setErrorCats("")
      try {
        const res = await fetch(`${API_BASE}/ClothingCategory/all`)
        if (!res.ok) throw new Error((await res.text()) || res.statusText)
        const data = await res.json()
        if (!canceled) setCategories(data)
      } catch (err) {
        if (!canceled) setErrorCats(err.message)
      } finally {
        if (!canceled) setLoadingCats(false)
      }
    })()

    return () => {
      canceled = true
    }
  }, [])

  const handlePageChange = (newPage) => {
    setPage(newPage)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const onCategoryClick = (categoryName) => {
    navigate(`/category-filter?category=${encodeURIComponent(categoryName)}`)
  }

  useEffect(() => {
    const carousel = spotlightRef.current
    if (!carousel || spotlightShops.length === 0) return

    let scrollInterval
    let isUserScrolling = false
    let userScrollTimeout

    const startAutoScroll = () => {
      scrollInterval = setInterval(() => {
        if (!isUserScrolling && carousel) {
          const maxScroll = carousel.scrollWidth - carousel.clientWidth
          const currentScroll = carousel.scrollLeft
          if (currentScroll >= maxScroll) {
            carousel.scrollTo({ left: 0, behavior: "smooth" })
          } else {
            carousel.scrollBy({ left: 320, behavior: "smooth" })
          }
        }
      }, 4000)
    }

    const handleUserScroll = () => {
      isUserScrolling = true
      clearTimeout(userScrollTimeout)
      userScrollTimeout = setTimeout(() => {
        isUserScrolling = false
      }, 3000)
    }

    carousel.addEventListener("scroll", handleUserScroll)
    startAutoScroll()

    return () => {
      clearInterval(scrollInterval)
      clearTimeout(userScrollTimeout)
      carousel?.removeEventListener("scroll", handleUserScroll)
    }
  }, [spotlightShops])

  return (
    <>
      <Navbar />

      <section className="hero-section">
        <div className="hero-background">
          <div className="hero-gradient"></div>
          <div className="hero-pattern"></div>
          <div className="floating-elements">
            <div className="floating-element element-1"></div>
            <div className="floating-element element-2"></div>
            <div className="floating-element element-3"></div>
            <div className="floating-element element-4"></div>
            <div className="floating-element element-5"></div>
          </div>
        </div>

        <div className="hero-content">
          <h1 className="hero-title">
            Welcome, To <span className="hero-title-accent">EDCMS</span>
          </h1>

          <p className="hero-subtitle">
            Discover thousands of clothing brands and shops in one place. Search, explore, discover and find exactly what you're
            looking for.
          </p>

          <div className="hero-search">
            <Search />
          </div>

          <div className="hero-stats">
            <div className="stat-item">
              <span className="stat-number">{totalCount}+</span>
              <span className="stat-label">Shops</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">{categories.length}+</span>
              <span className="stat-label">Categories</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">24/7</span>
              <span className="stat-label">Support</span>
            </div>
          </div>
        </div>
      </section>

      <main className="main-container">
        <section className="featured-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="title-gradient">New Shops</span>
            </h2>
            <p className="section-subtitle">Discover the latest shops and newest brands in our marketplace</p>
          </div>

          <div className="featured-carousel" ref={spotlightRef}>
            {spotlightLoading ? (
              <div className="loading-carousel">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="brand-card-skeleton">
                    <div className="skeleton-image">
                      <div className="skeleton-shimmer"></div>
                    </div>
                    <div className="skeleton-content">
                      <div className="skeleton-line"></div>
                      <div className="skeleton-line short"></div>
                      <div className="skeleton-tags">
                        <div className="skeleton-tag"></div>
                        <div className="skeleton-tag"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : spotlightShops.length > 0 ? (
              spotlightShops.map((shop) => (
                <Link key={shop.businessId} to={`/shop/${shop.slug}`} className="brand-card featured">
                  <div className="brand-card-image">
                    {shop.profilePictureUrl ? (
                      <img src={shop.profilePictureUrl || "/placeholder.svg"} alt={shop.name} />
                    ) : (
                      <div className="brand-placeholder">
                        <div className="placeholder-glow"></div>
                        <div className="placeholder-icon">🏪</div>
                        <div className="placeholder-text">{shop.name.charAt(0)}</div>
                      </div>
                    )}
                    <div className="brand-overlay">
                      <div className="overlay-content">
                        <span className="view-brand">View Shop</span>
                        <svg className="overlay-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 8l4 4m0 0l-4 4m4-4H3"
                          />
                        </svg>
                      </div>
                    </div>
                    <div className="brand-badge">New</div>
                  </div>
                  <div className="brand-info">
                    <h3 className="brand-name">{shop.name}</h3>
                  </div>
                </Link>
              ))
            ) : (
              <div className="empty-state">
                <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <h3>No New Shops</h3>
                <p>Check back later for new shops and latest brands.</p>
              </div>
            )}
          </div>
        </section>

        {/* Browse All Shops Section */}
        <section className="browse-section">
          <div className="section-header">
            <h2 className="section-title">Browse Shops</h2>
            <p className="section-subtitle">Explore our complete collection of clothing shops and brands</p>
          </div>

          {error && (
            <div className="error-message">
              <svg className="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h4>Error Loading Shops</h4>
                <p>{error}</p>
              </div>
            </div>
          )}

          <div className="brands-grid">
            {loading ? (
              [...Array(8)].map((_, i) => (
                <div key={i} className="brand-card-skeleton">
                  <div className="skeleton-image">
                    <div className="skeleton-shimmer"></div>
                  </div>
                  <div className="skeleton-content">
                    <div className="skeleton-line"></div>
                    <div className="skeleton-line short"></div>
                    <div className="skeleton-tags">
                      <div className="skeleton-tag"></div>
                      <div className="skeleton-tag"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : shops.length > 0 ? (
              shops.map((shop) => (
                <Link key={shop.businessId} to={`/shop/${shop.slug}`} className="brand-card">
                  <div className="brand-card-image">
                    {shop.profilePictureUrl ? (
                      <img src={shop.profilePictureUrl || "/placeholder.svg"} alt={shop.name} />
                    ) : (
                      <div className="brand-placeholder">
                        <div className="placeholder-glow"></div>
                        <div className="placeholder-icon">🏪</div>
                        <div className="placeholder-text">{shop.name.charAt(0)}</div>
                      </div>
                    )}
                    <div className="brand-overlay">
                      <div className="overlay-content">
                        <span className="view-brand">View Shop</span>
                        <svg className="overlay-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 8l4 4m0 0l-4 4m4-4H3"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="brand-info">
                    <h3 className="brand-name">{shop.name}</h3>
                    <div className="brand-tags"></div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="empty-state">
                <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <h3>No Shops Found</h3>
                <p>Try adjusting your search or check back later for new shops.</p>
              </div>
            )}
          </div>

          <div className="pagination-wrapper">
            <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={handlePageChange} />
          </div>
        </section>

        {/* Categories Section */}
        <section className="categories-section">
          <div className="section-header">
            <h2 className="section-title">Shop by Category</h2>
            <p className="section-subtitle">Browse through our organized categories to find exactly what you need</p>
          </div>

          {errorCats && (
            <div className="error-message">
              <svg className="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h4>Error Loading Categories</h4>
                <p>{errorCats}</p>
              </div>
            </div>
          )}

          <div className="categories-grid">
            {loadingCats ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="category-card-skeleton">
                  <div className="skeleton-icon"></div>
                  <div className="category-content">
                    <div className="skeleton-line"></div>
                    <div className="skeleton-line short"></div>
                  </div>
                  <div className="skeleton-arrow"></div>
                </div>
              ))
            ) : categories.length > 0 ? (
              categories
                .filter((cat, idx, self) => self.findIndex((c) => c.name === cat.name) === idx)
                .map((cat) => (
                  <div key={cat.clothingCategoryId} className="category-card" onClick={() => onCategoryClick(cat.name)}>
                    <div className="category-hover-effect"></div>
                    <div className="category-icon">
                      {cat.iconUrl ? (
                        <img src={cat.iconUrl || "/placeholder.svg"} alt={cat.name} />
                      ) : (
                        <div className="category-placeholder">{cat.name.charAt(0)}</div>
                      )}
                    </div>
                    <div className="category-content">
                      <h3 className="category-name">{cat.name}</h3>
                      <p className="category-count">Click To See Featured Shops</p>
                    </div>
                    <svg className="category-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                ))
            ) : (
              <div className="empty-state">
                <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <h3>No Categories Available</h3>
                <p>Categories will appear here once they are added to the system.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
