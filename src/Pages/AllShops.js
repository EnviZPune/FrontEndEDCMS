// src/Components/AllShops.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import '../Styling/AllShops.css';

const API_URL = 'http://77.242.26.150:8000/api/Business';
const ITEMS_PER_PAGE = 50;

export default function AllShops() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetch(API_URL)
      .then(res => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(data => setShops(data))
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading shops…</p>;
  if (error)   return <p>Error loading shops: {error.message}</p>;

  const totalPages = Math.ceil(shops.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentShops = shops.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const goToPage = page => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
    <div>
        <Navbar />
      <div className="shops-container">
        {currentShops.map(shop => (
          <Link
            to={`/shops/${shop.businessId}`}
            key={shop.businessId}
            className="shop-card-link"
          >
            <div
              className="shop-card"
              style={{ backgroundImage: `url(${shop.coverPictureUrl})` }}
            >
              <div className="shop-card-overlay" />
              <div className="shop-card-content">
                <div className="shop-header">
                  <img
                    src={shop.profilePictureUrl}
                    className="shop-logo"
                  />
                  <h3 className="shop-name">{shop.name}</h3>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="pagination">
        <button
          className="page-button"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Prev
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
          <button
            key={page}
            className={`page-button${page === currentPage ? ' active' : ''}`}
            onClick={() => goToPage(page)}
          >
            {page}
          </button>
        ))}

        <button
          className="page-button"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
        </button>
      </div>
      </div>
    </>
  );
}
