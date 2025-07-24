import React, { useEffect, useState } from 'react'
import Navbar from '../Components/Navbar'
import '../Styling/about.css'

const API_BASE = 'http://77.242.26.150:8000'

const About = () => {
  const [storesCount, setStoresCount] = useState(null)
  const [productsCount, setProductsCount] = useState(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch all businesses
        const storesRes = await fetch(`${API_BASE}/api/Business`)
        if (!storesRes.ok) {
          console.error('Failed to fetch stores:', storesRes.status)
          setStoresCount(0)
          setProductsCount(0)
          return
        }
        const stores = await storesRes.json()
        const storeList = Array.isArray(stores) ? stores : []
        setStoresCount(storeList.length)

        // Tally total products across all stores
        const counts = await Promise.all(
          storeList.map(async (store) => {
            const businessId = store.id ?? store.businessId
            if (businessId == null) {
              console.warn('Missing business ID for store:', store)
              return 0
            }
            try {
              const res = await fetch(
                `${API_BASE}/api/ClothingItem/business/${businessId}`
              )
              if (!res.ok) {
                console.warn(
                  `Failed to fetch items for business ${businessId}:`,
                  res.status
                )
                return 0
              }
              const items = await res.json()
              return Array.isArray(items) ? items.length : 0
            } catch (err) {
              console.error(
                `Error fetching items for business ${businessId}:`,
                err
              )
              return 0
            }
          })
        )
        const totalItems = counts.reduce((sum, c) => sum + c, 0)
        setProductsCount(totalItems)
      } catch (err) {
        console.error('Error fetching stats:', err)
        setStoresCount(0)
        setProductsCount(0)
      }
    }

    fetchStats()
  }, [])

  return (
    <>
      <Navbar />
      <div className="about-container">
        {/* Hero Section */}
        <div className="about-hero">
          <div className="about-hero-content">
            <h1 className="about-title">About E & D</h1>
            <p className="about-subtitle">Albania's First Online Shopping Mall</p>
            <div className="about-logo-section">
              <img
                src="Assets/logo.png"
                alt="E & D Logo"
                className="about-logo"
              />
              <p className="about-slogan">
                Search smart. Shop faster. Powered by real-time stores.
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="about-content">
          <div className="about-section">
            <h2 className="about-section-title">Welcome to E & D</h2>
            <p className="about-paragraph">
              At E & D, we're not just another e-commerce site. We're something
              completely different — a{' '}
              <span className="about-highlight">
                real-time digital directory
              </span>{' '}
              of physical clothing stores from all around the country. Our goal?
              To show you{' '}
              <span className="about-highlight">
                what's in stock, right now
              </span>
              , without you having to leave your home.
            </p>
          </div>

          <div className="about-section">
            <h2 className="about-section-title">How It Works</h2>
            <p className="about-paragraph">
              Whether you're on your laptop or just lying in bed with your phone,
              E & D lets you search for any clothing item you're looking for.
              Our system scans all registered shops across Albania and shows you{' '}
              <span className="about-highlight">
                exactly which stores have that product available today.
              </span>{' '}
              No more calling around. No more walking shop to shop. Just search,
              and you'll know where to go.
            </p>
          </div>

          <div className="about-section">
            <h2 className="about-section-title">Real Shops, Real People</h2>
            <p className="about-paragraph">
              We connect real shops with real people. Every business that joins
              E & D manages their own shop profile and uploads their current
              inventory — not just generic catalog items, but{' '}
              <span className="about-highlight">
                what's physically available in-store today.
              </span>
            </p>
            <p className="about-paragraph">
              Each shop is verified, and their owners and employees help maintain
              updated listings to make your shopping experience smooth, secure,
              and simple.
            </p>
          </div>

          <div className="about-section">
            <h2 className="about-section-title">Our Promise</h2>
            <p className="about-paragraph">
              If someone around the country has what you're looking for,{' '}
              <span className="about-highlight">E & D will find it</span>.
            </p>
            <p className="about-paragraph">
              Because smart shopping shouldn't take effort — it should just take
              E & D.
            </p>
          </div>
        </div>

        {/* Features Section */}
        <div className="about-features">
          <div className="about-feature">
            <div className="about-feature-icon">🔍</div>
            <h3 className="about-feature-title">Real-Time Search</h3>
            <p className="about-feature-description">
              Search across all registered stores and see what's available right
              now, not what might be in stock.
            </p>
          </div>

          <div className="about-feature">
            <div className="about-feature-icon">🏪</div>
            <h3 className="about-feature-title">Verified Stores</h3>
            <p className="about-feature-description">
              Every shop is verified and managed by real business owners who
              update their inventory daily.
            </p>
          </div>

          <div className="about-feature">
            <div className="about-feature-icon">📱</div>
            <h3 className="about-feature-title">Mobile First</h3>
            <p className="about-feature-description">
              Shop from anywhere, anytime. Our platform works perfectly on all
              devices.
            </p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="about-stats">
          <div className="about-stat">
            <div className="about-stat-value">{storesCount !== null ? storesCount : '...'}</div>
            <div className="about-stat-label">Registered Stores</div>
          </div>

          <div className="about-stat">
            <div className="about-stat-value">{productsCount !== null ? productsCount : '...'}</div>
            <div className="about-stat-label">Products Listed</div>
          </div>

          <div className="about-stat">
            <div className="about-stat-value">50+</div>
            <div className="about-stat-label">Cities Covered</div>
          </div>

          <div className="about-stat">
            <div className="about-stat-value">24/7</div>
            <div className="about-stat-label">Real-Time Updates</div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="about-cta">
          <div className="about-cta-content">
            <h2 className="about-cta-title">Ready to Start Shopping?</h2>
            <p className="about-cta-text">
              Join thousands of smart shoppers who use E & D to find exactly what
              they're looking for.
            </p>
            <a href="/allshops" className="about-cta-button">
              Explore Stores <span>→</span>
            </a>
          </div>
        </div>
      </div>
    </>
  )
}

export default About