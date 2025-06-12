// src/Pages/ShopList.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import '../Styling/shoplist.css';

function ShopList() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 3;
  const carouselRef = useRef(null);

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    try {
      const res = await fetch('http://77.242.26.150:8000/api/Business');
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch shops: ${res.status} ${res.statusText}. Response: ${text}`);
      }
      const data = await res.json();
      setShops(data);
    } catch (err) {
      console.error('Failed to fetch shops:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const scrollToPage = (index) => {
    const scrollAmount = index * (carouselRef.current.clientWidth + 20);
    carouselRef.current.scrollTo({ left: scrollAmount, behavior: 'smooth' });
    setCurrentPage(index);
  };

  const scrollLeft = () => {
    if (currentPage > 0) scrollToPage(currentPage - 1);
  };

  const scrollRight = () => {
    if ((currentPage + 1) * itemsPerPage < shops.length) scrollToPage(currentPage + 1);
  };

  const totalPages = Math.ceil(shops.length / itemsPerPage);

  return (
    <>
      <Navbar />
      <div className="shop-carousel-container">
        <h2 style={{ textAlign: 'center', marginBottom: '16px' }}>Browse Shops</h2>
        <Link className="view-all-shops" to="/allshops">View All Shops</Link>

        {loading ? (
          <div className="loading-spinner"></div>
        ) : error ? (
          <p>Error loading shops: {error}</p>
        ) : (
          <>
            <div className="shop-carousel" ref={carouselRef}>
              {shops.map((shop) => (
                <Link
                  to={`/shops/${shop.businessId}`}
                  key={shop.businessId}
                  className="shop-card-link"
                >
                  <div className="shop-card">
                    {shop.profilePictureUrl ? (
                      <img
                        src={shop.profilePictureUrl}
                        alt={`${shop.name} Logo`}
                        className="shop-card-image"
                      />
                    ) : (
                      <div className="shop-card-placeholder" />
                    )}
                    <h2 className="shop-card-title">{shop.name}</h2>
                  </div>
                </Link>
              ))}
            </div>

            <div className="carousel-controls">
              <button
                className="carousel-arrow"
                onClick={scrollLeft}
                disabled={currentPage === 0}
              >
                &lt;
              </button>

              <div className="pagination-dots">
                {Array.from({ length: totalPages }, (_, i) => (
                  <span
                    key={i}
                    className={`dot ${i === currentPage ? 'active' : ''}`}
                    onClick={() => scrollToPage(i)}
                  />
                ))}
              </div>

              <button
                className="carousel-arrow"
                onClick={scrollRight}
                disabled={(currentPage + 1) * itemsPerPage >= shops.length}
              >
                &gt;
              </button>
            </div>
          </>
        )}
      </div>
      <Footer />
    </>
  );
}

export default ShopList;
