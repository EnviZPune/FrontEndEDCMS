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
        setProduct(null); // explicitly mark it as not found
      } finally {
        setLoading(false);
      }
    };    

    fetchProduct();
  }, [id]);

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

  const handleThumbnailClick = (url) => setMainImage(url);

  return (
    <>
      <Navbar />
      <div className="product-detail-container">
        <div className="top-back-button-wrapper">
          <button
            className="back-to-shop-button"
            onClick={() => navigate(shopSlug ? `/shops/${shopSlug}` : '/')}
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
              {parsedImages.slice(0, 10).map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`Thumbnail ${index}`}
                  className={`thumbnail ${mainImage === url ? 'active' : ''}`}
                  onClick={() => handleThumbnailClick(url)}
                />
              ))}
            </div>
          </div>

          <div className="product-info">
            <h1>{product.name} - {product.brand}</h1>
            <p><strong>Model: </strong>{product.model}</p>
            <p><strong>Description:</strong> {product.description}</p>
            <p><strong>Price:</strong> ${product.price}</p>
            <p><strong>Quantity:</strong> {product.quantity}</p>
            <p><strong>Category:</strong> {product.category}</p>
            <p><strong>Material:</strong> {product.material}</p>
            <p><strong>Colors:</strong> {product.colors}</p>
            <p><strong>Sizes:</strong> {
              typeof product.sizes === 'number'
                ? ['XS', 'S', 'M', 'L', 'XL', 'XXL'][product.sizes]
                : product.sizes
            }</p>
            <button className="rezerve-button">Rezervë</button>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ProductDetailsPage;
