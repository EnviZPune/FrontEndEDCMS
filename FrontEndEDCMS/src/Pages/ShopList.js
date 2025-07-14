// src/Pages/ShopList.js
import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation }   from 'react-router-dom';
import Navbar                                from '../Components/Navbar';
import Footer                                from '../Components/Footer';
import Search                                from '../Components/SearchBar.js';
import Pagination                            from '../Components/Pagination.tsx';
import '../Styling/shoplist.css';

export default function ShopList() {
  // Shops
  const [shops, setShops]           = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [page, setPage]             = useState(1);

  // Categories
  const [categories, setCategories]   = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [errorCats, setErrorCats]     = useState('');

  const pageSize    = 6;
  const cardsToShow = 5;

  const carouselRef   = useRef(null);
  const categoriesRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();

  // fetch a single biz's categories
  const fetchBizCategories = async businessId => {
    const r = await fetch(
      `http://77.242.26.150:8000/api/ClothingCategory/business/${businessId}`
    );
    if (!r.ok) return [];
    return r.json();
  };

  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true); setError('');
      try {
        const res = await fetch(
          `http://77.242.26.150:8000/api/Business/paginated?pageNumber=${page}&pageSize=${pageSize}`
        );
        if (!res.ok) throw new Error(await res.text() || res.statusText);
        const { items, totalCount: count } = await res.json();
        if (!canceled) {
          setShops(items);
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

  // 2️⃣ aggregate all categories once
  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoadingCats(true); setErrorCats('');
      try {
        const bizRes = await fetch(
          `http://77.242.26.150:8000/api/Business/paginated?pageNumber=1&pageSize=10000`
        );
        if (!bizRes.ok) throw new Error(await bizRes.text() || bizRes.statusText);
        const { items: allBiz } = await bizRes.json();

        const arrays = await Promise.all(
          allBiz.map(b => fetchBizCategories(b.businessId))
        );
        const flat = arrays.flat();
        const map  = new Map();
        flat.forEach(cat => {
          if (!map.has(cat.clothingCategoryId)) map.set(cat.clothingCategoryId, cat);
        });
        if (!canceled) setCategories(Array.from(map.values()));
      } catch (err) {
        if (!canceled) setErrorCats(err.message);
      } finally {
        if (!canceled) setLoadingCats(false);
      }
    })();
    return () => { canceled = true; };
  }, []);

  // 3️⃣ auto-scroll shops carousel
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

  // 4️⃣ auto-scroll categories carousel
  useEffect(() => {
    const el = categoriesRef.current;
    if (!el || categories.length <= cardsToShow) return;

    // measure one card + gap
    const card = el.querySelector('.category-card');
    const cardW = (card?.offsetWidth ?? 120);
    const gap   = parseInt(getComputedStyle(el).gap) || 16;
    const step  = cardW + gap;
    const max   = el.scrollWidth - el.clientWidth;

    let pos = 0;
    const iv = setInterval(() => {
      pos += step;
      if (pos > max) pos = 0;
      el.scrollTo({ left: pos, behavior: 'smooth' });
    }, 3000);
    return () => clearInterval(iv);
  }, [categories]);

  // pagination
  const handlePageChange = newPage => {
    setPage(newPage);
    carouselRef.current?.scrollTo({ left: 0, behavior: 'auto' });
  };

  // category click
  const onCategoryClick = catId => {
    navigate(`/category-filter?category=${catId}`);
  };

  return (
    <>
      <Navbar/>

      {/* Hero */}
      <div className="hero-banner">
        <div className="hero-overlay"/>
        <div className="hero-content">
          <h1>Welcome to EDCMS</h1>
          <p>The all-in-one Clothing Business Management System</p>
          <Search/>
        </div>
      </div>

      <div className="shop-list-container">
        {/* Shops */}
        <div className="shop-list-header"><h2>Browse Shops</h2></div>
        {error && <p className="error-text">{error}</p>}
        {loading && <div className="loading-spinner"/>}
        {!loading && shops.length > 0 && (
          <div className="browse-shops-wrapper">
            <div className="browse-carousel" ref={carouselRef}>
              {[...shops, ...shops].map((shop,i) => (
                <Link
                  key={`${shop.businessId}-${i}`}
                  to={`/shops/${shop.businessId}`}
                  className="carousel-slide"
                  style={{ flex: `0 0 ${100/cardsToShow}%` }}
                >
                  <div className="shop-card">
                    <div className="shop-card-media">
                      {shop.profilePictureUrl
                        ? <img src={shop.profilePictureUrl} alt={`${shop.name} Logo`} />
                        : <div className="shop-card-placeholder"/>}
                    </div>
                    <h3 className="shop-card-title">{shop.name}</h3>
                  </div>
                </Link>
              ))}
              <div className="carousel-end-sentinel"/>
            </div>
            <div className="browse-illustration">
              <img src="/Assets/shopper.png" alt="Shopper" />
            </div>
          </div>
        )}

        {/* Categories */}
        <div className="categories-container">
          <h2>Categories</h2>
          {errorCats && <p className="error-text">{errorCats}</p>}
          {loadingCats
            ? <div className="loading-spinner small"/>
            : (
              <div className="categories-list" ref={categoriesRef}>
                {categories.map(cat => (
                  <div
                    key={cat.clothingCategoryId}
                    className="category-card"
                    onClick={() => onCategoryClick(cat.clothingCategoryId)}
                  >
                    {cat.iconUrl
                      ? <img src={cat.iconUrl} alt={cat.name} className="category-card-icon"/>
                      : <div className="category-card-placeholder"/>}
                    <p className="category-card-title">{cat.name}</p>
                  </div>
                ))}
                <div className="carousel-end-sentinel"/>
              </div>
            )
          }
        </div>

        {/* Pagination */}
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
