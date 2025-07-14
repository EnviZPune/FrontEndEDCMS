// src/Pages/CategoryFilter.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams }       from 'react-router-dom';
import Navbar                          from '../Components/Navbar';
import Footer                          from '../Components/Footer';
import Search                          from '../Components/SearchBar.js';
import Pagination                      from '../Components/Pagination.tsx';
import '../Styling/shoplist.css';

export default function CategoryFilter() {
  const [searchParams] = useSearchParams();
  const categoryId     = searchParams.get('category');

  // shops & pagination state
  const [shops, setShops]           = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  // category name for the banner
  const [categoryName, setCategoryName] = useState('');

  const pageSize    = 6;
  const cardsToShow = 5;
  const carouselRef = useRef(null);

  // fetch category definitions for a business
  const fetchBizCategories = async businessId => {
    const r = await fetch(
      `http://77.242.26.150:8000/api/ClothingCategory/business/${businessId}`
    );
    if (!r.ok) return [];
    return r.json();
  };

  // 1) On mount or categoryId change: do a full‐list fetch once to get totalCount & name
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch(
          `http://77.242.26.150:8000/api/Business/paginated?pageNumber=1&pageSize=10000`
        );
        if (!res.ok) throw new Error(await res.text() || res.statusText);
        const { items: allBiz } = await res.json();

        // filter and capture name
        const matches   = [];
        let   foundName = '';
        await Promise.all(
          allBiz.map(async biz => {
            const defs = await fetchBizCategories(biz.businessId);
            const hit  = defs.find(d => d.clothingCategoryId.toString() === categoryId);
            if (hit) {
              matches.push(biz);
              if (!foundName) foundName = hit.name;
            }
          })
        );
        if (!canceled) {
          setTotalCount(matches.length);
          setCategoryName(foundName || `(ID: ${categoryId})`);
        }
      } catch (err) {
        // we don’t abort on this error path, but you could set an error state here if you like
      }
    })();
    return () => { canceled = true; };
  }, [categoryId]);

  // 2) Fetch each paginated page as page changes (infinite‐scroll or manual)
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
        if (!res.ok) throw new Error(await res.text() || res.statusText);
        const { items } = await res.json();

        // filter these items for our category
        const pageMatches = [];
        await Promise.all(
          items.map(async biz => {
            const defs = await fetchBizCategories(biz.businessId);
            if (defs.some(d => d.clothingCategoryId.toString() === categoryId)) {
              pageMatches.push(biz);
            }
          })
        );

        if (!canceled) {
          setShops(prev =>
            page === 1 ? pageMatches : [...prev, ...pageMatches]
          );
        }
      } catch (err) {
        if (!canceled) setError(err.message);
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [page, categoryId]);

  // 3) Infinite‐scroll: watch the carousel’s scroll event
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;

    const onScroll = () => {
      if (loading) return;
      // if we're within 150px of the right edge AND we haven't loaded all matches yet
      if (
        el.scrollWidth - el.scrollLeft - el.clientWidth < 150 &&
        shops.length < totalCount
      ) {
        setPage(p => p + 1);
      }
    };

    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [shops, loading, totalCount]);

  // 4) Carousel auto‐animate (optional, you can remove if undesired)
  useEffect(() => {
    const el = carouselRef.current;
    if (!el || shops.length === 0) return;

    const slideW = el.clientWidth / cardsToShow;
    let idx = 0;
    const iv = setInterval(() => {
      idx = (idx + 1) % shops.length;
      el.scrollTo({ left: idx * slideW, behavior: 'smooth' });
    }, 3000);
    return () => clearInterval(iv);
  }, [shops]);

  // 5) Manual pagination handler (resets carousel and shops)
  const handlePageChange = newPage => {
    setPage(newPage);
    setShops([]); // clear out old pages
    carouselRef.current?.scrollTo({ left: 0, behavior: 'auto' });
  };

  return (
    <>
      <Navbar/>

      {/* Hero */}
      <div className="hero-banner">
        <div className="hero-overlay"/>
        <div className="hero-content">
          <h1>Category: {categoryName}</h1>
          <p>Showing all shops in this category</p>
          <Search/>
        </div>
      </div>

      {/* Filtered Shops */}
      <div className="shop-list-container">
        <div className="shop-list-header">
          <h2>Filtered Shops</h2>
        </div>
        {error && <p className="error-text">Error: {error}</p>}
        <div className="browse-shops-wrapper">
          <div className="browse-carousel" ref={carouselRef}>
            {shops.map((shop, i) => (
              <Link
                key={`${shop.businessId}-${i}`}
                to={`/shops/${shop.businessId}`}
                className="carousel-slide"
                style={{ flex: `0 0 ${100/cardsToShow}%` }}
              >
                <div className="shop-card">
                  <div className="shop-card-media">
                    {shop.profilePictureUrl
                      ? <img src={shop.profilePictureUrl}
                             alt={`${shop.name} Logo`} />
                      : <div className="shop-card-placeholder" />}
                  </div>
                  <h3 className="shop-card-title">{shop.name}</h3>
                </div>
              </Link>
            ))}
            {loading && <div className="loading-spinner small"/>}
            <div className="carousel-end-sentinel"/>
          </div>
        </div>

        {/* Manual Pagination */}
        <Pagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={handlePageChange}
        />
      </div>

      <Footer/>
    </>
  );
}
