import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams }      from 'react-router-dom';
import Navbar                         from '../Components/Navbar';
import Footer                         from '../Components/Footer';
import Search                         from '../Components/SearchBar.js';
import Pagination                     from '../Components/Pagination.tsx';
import '../Styling/categoryfilter.css'

export default function CategoryFilter() {
  const [searchParams] = useSearchParams();
  const categoryName   = searchParams.get('category'); // e.g., T-shirts

  const [shops, setShops]         = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  const pageSize    = 6;
  const cardsToShow = 5;
  const carouselRef = useRef(null);

  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(
          `https://api.triwears.com/api/Business/category-name/${encodeURIComponent(categoryName)}`
        );
        if (!res.ok) throw new Error(await res.text() || res.statusText);
        const data = await res.json();
        if (!canceled) {
          setShops(data.slice(0, pageSize));
          setTotalCount(data.length);
        }
      } catch (err) {
        if (!canceled) setError(err.message);
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [categoryName]);

  // infinite‐scroll logic
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const onScroll = () => {
      if (loading) return;
      if (el.scrollWidth - el.scrollLeft - el.clientWidth < 150 && shops.length < totalCount) {
        const nextPage = page + 1;
        setShops(shops.slice(0, nextPage * pageSize));
        setPage(nextPage);
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [shops, loading, totalCount, page]);

  const handlePageChange = newPage => {
    setShops(shops.slice(0, newPage * pageSize));
    setPage(newPage);
    carouselRef.current?.scrollTo({ left: 0, behavior: 'auto' });
  };


  return (
    <>
      <Navbar />

      <div className="hero-banner">
        <div className="hero-overlay" />
        <div className="hero-content">
          <h1>Category: {categoryName}</h1>
          <p>Showing all shops in this category</p>
          <Search />
        </div>
      </div>

      <div className="shop-list-container">
        <div className="shop-list-header">
          <h2>Filtered Shops</h2>
        </div>
        {error && <p className="error-text">Error: {error}</p>}
        {!loading && !error && shops.length === 0 && (
          <p className="no-shops-text">No Shops Yet In this Category</p>
        )}

        <div className="browse-shops-wrapper">
          <div className="browse-carousel" ref={carouselRef}>
            {shops.map((shop, i) => (
              <Link
                key={`${shop.slug}-${i}`}
                to={`/shop/${encodeURIComponent(shop.slug)}`}
                className="carousel-slide"
                style={{ flex: `0 0 ${100 / cardsToShow}%` }}
              >
                <div className="shop-card">
                  <div className="shop-card-media">
                    {shop.profilePictureUrl
                      ? <img src={shop.profilePictureUrl} alt={`${shop.slug} Logo`} />
                      : <div className="shop-card-placeholder" />
                    }
                  </div>
                  <h3 className="shop-card-title">{shop.slug}</h3>
                </div>
              </Link>
            ))}
            {loading && <div className="loading-spinner small" />}
            <div className="carousel-end-sentinel" />
          </div>
        </div>

        <Pagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={handlePageChange}
        />
      </div>

      <Footer />
    </>
  );
}
