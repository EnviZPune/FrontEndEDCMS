import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import '../Styling/productdetails.css';

const API_BASE = 'http://77.242.26.150:8000/api';

const getToken = () => {
  const raw = localStorage.getItem('token') || localStorage.getItem('authToken');
  if (!raw || raw.trim() === '') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.token || parsed;
  } catch {
    return raw;
  }
};

const getHeaders = () => {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

// Safe slugify fallback if API doesn't return a slug
const slugify = (str) =>
  (str || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const ProductDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [mainImage, setMainImage] = useState(null);

  // Shop routing info
  const [shopId, setShopId] = useState(null);
  const [shopSlug, setShopSlug] = useState(null);
  const [shopName, setShopName] = useState(null);

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  // Load product + resolve businessId -> slug
  useEffect(() => {
    let alive = true;

    const fetchProductAndShop = async () => {
      setLoading(true);
      try {
        // 1) Product
        const res = await fetch(`${API_BASE}/ClothingItem/${id}`, { headers: getHeaders() });
        if (!res.ok) throw new Error(`Product fetch failed with status ${res.status}`);
        const data = await res.json();
        if (!alive) return;

        setProduct(data);

        // Images
        let parsedImages = [];
        if (Array.isArray(data.pictureUrls)) {
          parsedImages = data.pictureUrls;
        } else {
          try {
            parsedImages = JSON.parse(data.pictureUrls || '[]');
          } catch {
            parsedImages = [];
          }
        }
        if (parsedImages.length > 0) setMainImage(parsedImages[0]);

        // 2) Prefer businessIds[0], fallback to product.businessId if present
        const primaryBizId =
          (Array.isArray(data.businessIds) && data.businessIds.length > 0 && data.businessIds[0]) ||
          data.businessId ||
          null;

        if (primaryBizId) {
          setShopId(primaryBizId);
          // Fetch business to get slug & name
          try {
            const bizRes = await fetch(`${API_BASE}/Business/${primaryBizId}`, { headers: getHeaders() });
            if (bizRes.ok) {
              const biz = await bizRes.json();
              const resolvedSlug = (biz.slug && biz.slug.trim()) || slugify(biz.name);
              if (!alive) return;
              setShopSlug(resolvedSlug || null);
              setShopName(biz.name || null);
            }
          } catch {
            /* ignore; backToShop will retry if needed */
          }
        }
      } catch {
        if (alive) setProduct(null);
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchProductAndShop();
    return () => { alive = false; };
  }, [id]);

  const parsedImages = useMemo(() => {
    if (!product) return [];
    try {
      return Array.isArray(product.pictureUrls)
        ? product.pictureUrls
        : JSON.parse(product.pictureUrls || '[]');
    } catch {
      return [];
    }
  }, [product]);

  const handleThumbnailClick = (url) => setMainImage(url);

  const handleReserve = async () => {
    if (!product) return;
    const token = getToken();
    if (!token) {
      alert('Please log in to make a reservation.');
      return;
    }

    setBooking(true);
    try {
      const res = await fetch(`${API_BASE}/Reservation`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ clothingItemId: product.clothingItemId }),
      });
      if (res.ok) {
        alert('Product booked successfully!');
      } else {
        const errText = await res.text();
        alert('Booking error: ' + errText);
      }
    } catch {
      alert('An error occurred while booking.');
    } finally {
      setBooking(false);
    }
  };

  // Always send user to the product's shop:
  // 1) use known slug
  // 2) fallback: derive from known name
  // 3) fallback: fetch business by shopId now to resolve slug, then navigate
  // 4) final fallback: home
  const backToShop = async () => {
    if (shopSlug && shopSlug.trim()) {
      navigate(`/shop/${shopSlug.trim()}`);
      return;
    }

    if (shopName && slugify(shopName)) {
      navigate(`/shop/${slugify(shopName)}`);
      return;
    }

    if (shopId) {
      try {
        const shopRes = await fetch(`${API_BASE}/Business/${shopId}`, { headers: getHeaders() });
        if (shopRes.ok) {
          const shopData = await shopRes.json();
          const resolvedSlug =
            (shopData.slug && shopData.slug.trim()) || slugify(shopData.name);
          if (resolvedSlug) {
            setShopSlug(resolvedSlug);
            setShopName(shopData.name || null);
            navigate(`/shop/${resolvedSlug}`);
            return;
          }
        }
      } catch {
        // ignore and fall through
      }
    }

    navigate('/');
  };

  if (loading) return <div>Loading...</div>;
  if (!product) return <div>Product not found.</div>;

  return (
    <>
      <Navbar />
      <div className="product-detail-container">
        <div className="top-back-button-wrapper">
          <button
            type="button"
            className="back-to-shop-button"
            onClick={backToShop}
          >
            ← Back to Shop
          </button>
        </div>

        <div className="product-main">
          <div className="product-images">
            {mainImage && <img src={mainImage} alt="Main product" className="main-image" />}
            <div className="thumbnail-list">
              {parsedImages.slice(0, 10).map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`Thumbnail ${idx + 1}`}
                  className={`thumbnail ${mainImage === url ? 'active' : ''}`}
                  onClick={() => handleThumbnailClick(url)}
                />
              ))}
            </div>
          </div>

          <div className="product-info">
            <h1>
              {product.name} – {product.brand}
            </h1>
            <p>
              <strong>Model:</strong> {product.model}
            </p>
            <p>
              <strong>Description:</strong> {product.description}
            </p>
            <p>
              <strong>Price:</strong> {product.price} LEK
            </p>
            <p>
              <strong>Quantity:</strong> {product.quantity}
            </p>
            <p>
              <strong>Material:</strong> {product.material}
            </p>
            <p>
              <strong>Colors:</strong> {Array.isArray(product.colors) ? product.colors.join(', ') : product.colors}</p>
            <p>
              <strong>Size:</strong> {product.sizes}
            </p>

            <button
              className="rezerve-button"
              onClick={handleReserve}
              disabled={booking}
            >
              {booking ? 'Booking this product...' : 'Book Product'}
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ProductDetailsPage;
