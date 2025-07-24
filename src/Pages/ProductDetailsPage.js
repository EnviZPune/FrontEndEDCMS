import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import '../Styling/productdetails.css';

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

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
});

const ProductDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [mainImage, setMainImage] = useState(null);
  const [shopSlug, setShopSlug] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`http://77.242.26.150:8000/api/ClothingItem/${id}`, {
          headers: getHeaders(),
        });
    
        if (!res.ok) {
          throw new Error(`Product fetch failed with status ${res.status}`);
        }
    
        const data = await res.json();
        setProduct(data);
    
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
    
        if (data.businessId) {
          const shopRes = await fetch(`http://77.242.26.150:8000/api/Business/${data.businessId}`, {
            headers: getHeaders(),
          });
    
          if (shopRes.ok) {
            const shopData = await shopRes.json();
            setShopSlug(shopData.slug);
          }
        }
    
      } catch (error) {
        console.error('Failed to load product:', error);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleThumbnailClick = (url) => setMainImage(url);

  const handleReserve = async () => {
    if (!product) return;
    const token = getToken();
    if (!token) {
      alert('Please log in to make a reservation.');
      return;
    }
    try {
      const res = await fetch('http://77.242.26.150:8000/api/Reservation', {
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
    } catch (e) {
      console.error('Reservation error:', e);
      alert('An error occurred while booking.');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!product) return <div>Product not found.</div>;

  let parsedImages = [];
  try {
    parsedImages = Array.isArray(product.pictureUrls)
      ? product.pictureUrls
      : JSON.parse(product.pictureUrls || '[]');
  } catch {
    parsedImages = [];
  }

  // Debug: log JWT claims to console
  (async () => {
    const token = getToken();
    if (!token) return;
    const res = await fetch('http://77.242.26.150:8000/api/Reservation/claims', {
      headers: getHeaders(),
    });
    if (res.ok) {
      console.log('Claims:', await res.json());
    }
  })();

  return (
    <>
      <Navbar />
      <div className="product-detail-container">
        <div className="top-back-button-wrapper">
          <button
            className="back-to-shop-button"
            onClick={() => navigate(shopSlug ? `/shop/${shopSlug}` : '/')}
          >
            ← Back to Shop
          </button>
        </div>

        <div className="product-main">
          <div className="product-images">
            {mainImage && (
              <img src={mainImage} alt="Main product" className="main-image" />
            )}
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
            <h1>{product.name} – {product.brand}</h1>
            <p><strong>Model:</strong> {product.model}</p>
            <p><strong>Description:</strong> {product.description}</p>
            <p><strong>Price:</strong> ${product.price}</p>
            <p><strong>Quantity:</strong> {product.quantity}</p>
            <p><strong>Material:</strong> {product.material}</p>
            <p><strong>Colors:</strong> {product.colors}</p>
            <p><strong>Sizes:</strong> {
              typeof product.sizes === 'number'
                ? ['XS','S','M','L','XL','XXL'][product.sizes]
                : product.sizes
            }</p>
            <button
              className="rezerve-button"
              onClick={handleReserve}
            >
              Book Product
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ProductDetailsPage;
