// src/pages/ShopList.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import Search from '../Components/SearchBar';
import Pagination from '../Components/Pagination.tsx';
import '../Styling/shoplist.css';

const API_BASE = 'http://77.242.26.150:8000/api';
const PAGE_SIZE = 6;

const toSlug = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

export default function ShopList() {
  const [shops, setShops]         = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [page, setPage]           = useState(1);

  const [categories, setCategories]   = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [errorCats, setErrorCats]     = useState('');

  const navigate    = useNavigate();
  const carouselRef = useRef(null);
  const categoriesRef = useRef(null);

  console.log(shops);

  // Load paginated shops
  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(
          `${API_BASE}/Business/paginated?pageNumber=${page}&pageSize=${PAGE_SIZE}`
        );
        if (!res.ok) throw new Error(await res.text() || res.statusText);
        const { items, totalCount: count } = await res.json();

        // Map in slug (either from item.slug or generate from name)
        const mapped = items.map(shop => ({
          ...shop,
          slug: shop.slug || toSlug(shop.name),
        }));

        if (!canceled) {
          setShops(mapped);
          setTotalCount(count);
        }
      } catch (err) {
        if (!canceled) setError(err.message);
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [page]);

  // Fetch all categories once
  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoadingCats(true);
      setErrorCats('');
      try {
        const res = await fetch(`${API_BASE}/ClothingCategory/all`);
        if (!res.ok) throw new Error(await res.text() || res.statusText);
        const data = await res.json();
        if (!canceled) setCategories(data);
      } catch (err) {
        if (!canceled) setErrorCats(err.message);
      } finally {
        if (!canceled) setLoadingCats(false);
      }
    })();
    return () => { canceled = true; };
  }, []);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    carouselRef.current?.scrollTo({ left: 0, behavior: 'auto' });
  };

  const onCategoryClick = (categoryName) => {
    navigate(`/category-filter?category=${encodeURIComponent(categoryName)}`);
  };

  return (
    <>
      <Navbar />
      <div className="hero-banner">
        <div className="hero-overlay" />
        <div className="hero-content">
          <h1>Welcome to EDCMS</h1>
          <p>The all-in-one Clothing Business Management System</p>
          <Search />
        </div>
      </div>

      <div className="shop-list-container">
        <div className="shop-list-header">
          <h2>Browse Shops</h2>
        </div>

        {error && <p className="error-text">{error}</p>}


        {loading ? (
          <div className="loading-spinner" />
        ) : shops.length > 0 ? (
          <div className="shop-grid">
            {shops.map((shop) => (
              <Link
                key={shop.businessId}
                to={`/shop/${shop.slug}`}
                className="shop-card"
              >
                {shop.profilePictureUrl ? (
                  <img src={shop.profilePictureUrl} alt={shop.name} />
                ) : (
                  <div className="shop-placeholder" />
                )}
                <h3>{shop.name}</h3>
              </Link>
            ))}
          </div>
        ) : (
          <p className="no-results">No shops found.</p>
        )}

        <div className="categories-container">
          <h2>Categories</h2>
          {errorCats && <p className="error-text">{errorCats}</p>}
          {loadingCats ? (
            <div className="loading-spinner small" />
          ) : (
            <div className="categories-list" ref={categoriesRef}>
              {categories
                .filter((cat, idx, self) =>
                  self.findIndex(c => c.name === cat.name) === idx
                )
                .map(cat => (
                  <div
                    key={cat.clothingCategoryId}
                    className="category-card"
                    onClick={() => onCategoryClick(cat.name)}
                  >
                    {cat.iconUrl ? (
                      <img
                        src={cat.iconUrl}
                        alt={cat.name}
                        className="category-card-icon"
                      />
                    ) : (
                      <div className="category-card-placeholder" />
                    )}
                    <p className="category-card-title">{cat.name}</p>
                  </div>
                ))}
            </div>
          )}
        </div>

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={totalCount}
          onPageChange={handlePageChange}
        />
      </div>

      <Footer />
    </>
  );
}
