// src/pages/AllShops.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import Pagination from '../Components/Pagination.tsx';
import '../Styling/AllShops.css';

const API_URL   = 'http://77.242.26.150:8000/api/Business';
const PAGE_SIZE = 6;

// Fallback slug generator
const slugify = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

export default function AllShops() {
  const [shops, setShops]           = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(
          `${API_URL}/paginated?pageNumber=${page}&pageSize=${PAGE_SIZE}`
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || res.statusText);
        }
        const data = await res.json();
        if (cancelled) return;

        // Ensure each shop has a slug
        const mapped = data.items.map(shop => ({
          ...shop,
          slug: shop.slug || slugify(shop.slug),
        }));

        setShops(mapped);
        setTotalCount(data.totalCount);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page]);

  if (loading) return <p>Loading shops…</p>;
  if (error)   return <p>Error loading shops: {error.message}</p>;

  return (
    <>
      <Navbar />

      <div className="shops-container">
        {shops.map((shop) => (
          <Link
            to={`/shop/${shop.slug}`}     
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
                    alt={`${shop.slug} logo`}
                    className="shop-logo"
                  />
                  <h3 className="shop-name">{shop.slug}</h3>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={totalCount}
        onPageChange={setPage}
      />

      <Footer />
    </>
  );
}
