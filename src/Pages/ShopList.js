import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import Pagination from '../Components/Pagination.tsx';
import '../Styling/shoplist.css';

export default function ShopList() {
  const [shops, setShops]           = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [page, setPage]             = useState(1);
  const pageSize                    = 4;

  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(
          `http://77.242.26.150:8000/api/Business/paginated` +
          `?pageNumber=${page}&pageSize=${pageSize}`
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || res.statusText);
        }
        const { items, totalCount } = await res.json();
        if (!canceled) {
          setShops(items);
          setTotalCount(totalCount);
        }
      } catch (err) {
        if (!canceled) setError(err.message);
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [page]);

  return (
    <>
      <Navbar />

      <div className="shop-list-container">
        <h2>Browse Shops</h2>
        <Link className="view-all-shops" to="/allshops">
          View All Shops
        </Link>

        {loading ? (
          <div className="loading-spinner" />
        ) : error ? (
          <p className="error-text">Error: {error}</p>
        ) : (
          <>
            <div className="shop-list">
              {shops.map((shop) => (
                <Link
                  key={shop.businessId}
                  to={`/shops/${shop.businessId}`}
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

            <Pagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <Footer />
    </>
  );
}
