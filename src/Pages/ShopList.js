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

        {loading ? (
          <div className="loading-spinner"></div>
        ) : error ? (
          <p>Error loading shops: {error}</p>
        ) : (
          <>
            <div className="shop-carousel" ref={carouselRef}>
              {shops.map((shop) => (
                <div className="shop-card" key={shop.businessId}>
                  {shop.profilePictureUrl ? (
                    <img
                      src={shop.profilePictureUrl}
                      alt={`${shop.name} Logo`}
                      style={{
                        width: '100%',
                        height: '140px',
                        objectFit: 'cover',
                        borderRadius: '6px',
                        marginBottom: '10px',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        height: '140px',
                        backgroundColor: '#eee',
                        marginBottom: '10px',
                        borderRadius: '6px',
                      }}
                    ></div>
                  )}
                  <h2>{shop.name}</h2>
                  <p>{shop.description}</p>

                  <Link className="view-details-link" to={`/shops/${shop.businessId}`}>
                  View Details
                  </Link>
                </div>
              ))}
            </div>

            <div className="carousel-controls">
              <button className="carousel-arrow" onClick={scrollLeft} disabled={currentPage === 0}>
                &lt;
              </button>

              <div className="pagination-dots">
                {Array.from({ length: totalPages }, (_, i) => (
                  <span
                    key={i}
                    className={`dot ${i === currentPage ? 'active' : ''}`}
                    onClick={() => scrollToPage(i)}
                  ></span>
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
