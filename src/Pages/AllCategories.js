import React, { useEffect, useState } from 'react';
import { Link }                        from 'react-router-dom';
import Navbar                          from '../Components/Navbar';
import Footer                          from '../Components/Footer';
import Search                          from '../Components/SearchBar.js';
import Pagination                      from '../Components/Pagination.tsx';
import '../Styling/shoplist.css';

export default function AllCategories() {
  const [categories, setCategories]   = useState([]);
  const [totalCount, setTotalCount]   = useState(0);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [page, setPage]               = useState(1);

  const pageSize = 12;  // number of cards per page

  // 1) Helper: fetch/paginate all businesses then dedupe categories
  const fetchAllCategories = async () => {
    // fetch every business
    const bizRes = await fetch(
      'https://api.triwears.com/api/Business/paginated?pageNumber=1&pageSize=10000'
    );
    if (!bizRes.ok) throw new Error(await bizRes.text() || bizRes.statusText);
    const { items: allBiz } = await bizRes.json();

    // fetch each biz’s categories
    const arrays = await Promise.all(
      allBiz.map(b =>
        fetch(
          `https://api.triwears.com/api/ClothingCategory/business/${b.businessId}`
        ).then(r => (r.ok ? r.json() : []))
      )
    );
    const flat = arrays.flat();

    // dedupe
    const map = new Map();
    flat.forEach(cat => {
      if (!map.has(cat.clothingCategoryId)) {
        map.set(cat.clothingCategoryId, cat);
      }
    });
    return Array.from(map.values());
  };

  // 2) Load & set up pagination
  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const cats = await fetchAllCategories();
        if (canceled) return;
        setTotalCount(cats.length);
        setCategories(cats);
      } catch (err) {
        if (!canceled) setError(err.message);
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, []);

  // 3) Pagination slice
  const handlePageChange = newPage => setPage(newPage);
  const paged = categories.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <Navbar />

      {/* Hero Banner */}
      <div className="hero-banner">
        <div className="hero-overlay"/>
        <div className="hero-content">
          <h1>All Categories</h1>
          <p>Browse all available clothing categories</p>
          <Search/>
        </div>
      </div>

      <div className="shop-list-container">
        <div className="shop-list-header">
          <h2>Categories</h2>
        </div>

        {error && <p className="error-text">Error: {error}</p>}
        {loading && <div className="loading-spinner" />}

        {!loading && paged.length > 0 && (
          <div className="categories-grid">
            {paged.map(cat => (
              <Link
                key={cat.clothingCategoryId}
                to={`/category-filter?category=${cat.clothingCategoryId}`}
                className="all-category-card"
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
              </Link>
            ))}
          </div>
        )}

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
