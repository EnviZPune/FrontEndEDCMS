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
const SPOTLIGHT_SIZE = 7; // Number of shops to show in spotlight

const toSlug = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

export default function ShopList() {
  const [shops, setShops] = useState([]);
  const [spotlightShops, setSpotlightShops] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [spotlightLoading, setSpotlightLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [errorCats, setErrorCats] = useState('');
  
  const navigate = useNavigate();
  const carouselRef = useRef(null);
  const spotlightRef = useRef(null);
  const categoriesRef = useRef(null);

  console.log(shops);

  // Load spotlight shops (featured/top shops)
  useEffect(() => {
    let canceled = false;
    
    (async () => {
      setSpotlightLoading(true);
      try {
        const res = await fetch(`${API_BASE}/Business/paginated?pageNumber=1&pageSize=${SPOTLIGHT_SIZE}`);
        if (!res.ok) throw new Error(await res.text() || res.statusText);
        const { items } = await res.json();
        
        const mapped = items.map(shop => ({
          ...shop,
          slug: shop.slug || toSlug(shop.name),
        }));
        
        if (!canceled) {
          setSpotlightShops(mapped);
        }
      } catch (err) {
        console.error('Error loading spotlight shops:', err.message);
      } finally {
        if (!canceled) setSpotlightLoading(false);
      }
    })();
    
    return () => { canceled = true; };
  }, []);

  // Load paginated shops for browse section
  useEffect(() => {
    let canceled = false;
    
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE}/Business/paginated?pageNumber=${page}&pageSize=${PAGE_SIZE}`);
        if (!res.ok) throw new Error(await res.text() || res.statusText);
        const { items, totalCount: count } = await res.json();
        
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

  // Auto-scroll functionality for spotlight carousel
  useEffect(() => {
    const carousel = spotlightRef.current;
    if (!carousel || spotlightShops.length === 0) return;

    let scrollInterval;
    let isUserScrolling = false;
    let userScrollTimeout;

    const startAutoScroll = () => {
      scrollInterval = setInterval(() => {
        if (!isUserScrolling && carousel) {
          const maxScroll = carousel.scrollWidth - carousel.clientWidth;
          const currentScroll = carousel.scrollLeft;
          
          if (currentScroll >= maxScroll) {
            carousel.scrollTo({ left: 0, behavior: 'smooth' });
          } else {
            carousel.scrollBy({ left: 300, behavior: 'smooth' });
          }
        }
      }, 3000);
    };

    const handleUserScroll = () => {
      isUserScrolling = true;
      clearTimeout(userScrollTimeout);
      userScrollTimeout = setTimeout(() => {
        isUserScrolling = false;
      }, 2000);
    };

    carousel.addEventListener('scroll', handleUserScroll);
    startAutoScroll();

    return () => {
      clearInterval(scrollInterval);
      clearTimeout(userScrollTimeout);
      carousel?.removeEventListener('scroll', handleUserScroll);
    };
  }, [spotlightShops]);

  return (
    <>
      <Navbar />
      
      {/* Hero Banner */}
      <div className="hero-banner">
        <div className="hero-overlay" />
        <div className="hero-content">
          <h1>Welcome to EDCMS</h1>
          <p>The all-in-one Clothing Business Management System</p>
          <Search />
        </div>
      </div>

      <div className="shop-list-container">
        {/* Spotlight Section */}
        <div className="spotlight-wrapper">
          <div className="spotlight-illustration">
            <img 
              src="/placeholder.svg?height=260&width=260" 
              alt="Shopping illustration" 
            />
          </div>
          
          <div className="spotlight-carousel" ref={spotlightRef}>
            {spotlightLoading ? (
              <div className="loading-spinner small" />
            ) : (
              spotlightShops.map((shop, index) => (
                <div key={shop.businessId} className="spotlight-slide" style={{ flex: `0 0 calc((100% - ${(SPOTLIGHT_SIZE - 1)}rem) / ${SPOTLIGHT_SIZE})` }}>
                  <Link to={`/shop/${shop.name}`} className="shop-card spotlight-card">
                    <div className="shop-card-media">
                      {shop.profilePictureUrl ? (
                        <img src={shop.profilePictureUrl || "/placeholder.svg"} alt={shop.name} />
                      ) : (
                        <div className="shop-card-placeholder" />
                      )}
                    </div>
                    <div className="shop-card-title">{shop.name}</div>
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Browse Shops Section */}
        <div className="browse-shops-wrapper">
          <div className="shop-list-header">
            <h2>Browse All Shops</h2>
          </div>

          {error && <p className="error-text">{error}</p>}
          
          <div className="browse-carousel" ref={carouselRef}>
            {loading ? (
              <div className="loading-spinner" />
            ) : shops.length > 0 ? (
              <>
                {shops.map((shop) => (
                  <div key={shop.businessId} className="carousel-slide" style={{ flex: '0 0 280px' }}>
                    <Link to={`/shop/${shop.name}`} className="shop-card">
                      <div className="shop-card-media">
                        {shop.profilePictureUrl ? (
                          <img src={shop.profilePictureUrl || "/placeholder.svg"} alt={shop.name} />
                        ) : (
                          <div className="shop-card-placeholder" />
                        )}
                      </div>
                      <div className="shop-card-title">{shop.name}</div>
                    </Link>
                  </div>
                ))}
                <div className="carousel-end-sentinel" />
              </>
            ) : (
              <p className="no-results">No shops found.</p>
            )}
          </div>

          <div className="browse-illustration">
            <img 
              src="/placeholder.svg?height=200&width=200" 
              alt="Shopper illustration" 
            />
          </div>
        </div>

        {/* Categories Section */}
        <div className="categories-container">
          <h2>Shop by Categories</h2>
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
                        src={cat.iconUrl || "/placeholder.svg"}
                        alt={cat.name}
                        className="category-card-icon"
                      />
                    ) : (
                      <div className="category-card-placeholder" />
                    )}
                    <p className="category-card-title">{cat.name}</p>
                  </div>
                ))}
              
              {/* Add loading spinner for infinite scroll if needed */}
              {loadingCats && <div className="loading-spinner small" />}
              <div className="carousel-end-sentinel" />
            </div>
          )}
        </div>

        {/* Pagination */}
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