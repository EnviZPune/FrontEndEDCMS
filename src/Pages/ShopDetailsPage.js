import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import '../Styling/sd-shopdetail.css';

const ShopDetailsPage = () => {
  const { slug } = useParams();
  const [shop, setShop] = useState(null);
  const [clothingItems, setClothingItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const getImageUrl = (data, fallback) => {
    if (!data) return fallback;
  
    if (typeof data === 'string') {
      if (data.startsWith("https://storage.googleapis.com")) return data;
  
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed[0];
        }
      } catch {
        return data;
      }
    }
  
    if (Array.isArray(data) && data.length > 0) return data[0];
  
    return fallback;
  };
  
  

  const parseAndCheckOpenStatus = (openingHoursStr) => {
    if (!openingHoursStr || !openingHoursStr.includes('-')) return false;
    const [startStr, endStr] = openingHoursStr.split('-');
    const now = new Date();
    const [startHour, startMin] = startStr.split(':').map(Number);
    const [endHour, endMin] = endStr.split(':').map(Number);
    const start = new Date(now);
    start.setHours(startHour, startMin, 0, 0);
    const end = new Date(now);
    end.setHours(endHour, endMin, 0, 0);
    return now >= start && now <= end;
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      setError("Unauthorized access. Please log in.");
      setLoading(false);
      return;
    }

    let token;
    try {
      const parsedData = JSON.parse(storedToken);
      token = parsedData.token || parsedData;
    } catch {
      token = storedToken;
    }

    const fetchShopAndProducts = async () => {
      try {
        const shopRes = await fetch(
          `http://77.242.26.150:8000/api/Business/name/${slug}`,
          {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!shopRes.ok) throw new Error(`Failed to fetch shop.`);

        const shopData = await shopRes.json();
        setShop(shopData);
        setIsOpen(shopData.isManuallyOpen ?? parseAndCheckOpenStatus(shopData.openingHours));

        if (shopData.businessId) {
          const ciRes = await fetch(
            `http://77.242.26.150:8000/api/ClothingItem/business/${shopData.businessId}`,
            {
              headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          if (ciRes.ok) {
            const ciData = await ciRes.json();
            setClothingItems(ciData);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error("Fetch error:", err.message);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchShopAndProducts();
  }, [slug]);

  if (loading) return <div className="loading-container"><div className="loading-spinner"></div><p>Loading shop details...</p></div>;
  if (error) return <p className="sd-error-message">{error}</p>;
  if (!shop) return <p className="sd-error-message">Shop not found.</p>;

  return (
    <>
      <Navbar />
      <div className="sd-shop-details-page">
        <div
          className="sd-shop-hero"
          style={{ 
            backgroundImage: `url(${
              shop.coverPhoto 
                ? getImageUrl(shop.coverPhoto, '/default-cover.jpg')
                : (shop.coverPictureUrl || '/default-cover.jpg')
            })` 
          }}          
        >
          <div className="sd-shop-hero-content">
            <img
             src={
              shop.profilePhoto 
                ? getImageUrl(shop.profilePhoto, '/default-logo.jpg')
                : (shop.profilePictureUrl || '/default-logo.jpg')
            }            
              alt={`${shop.name} Logo`}
              className="sd-shop-logo"
            />
            <h1 className="sd-shop-name">{shop.name}</h1>
          </div>
        </div>

        <div className="sd-shop-info">
          <p><strong>Description:</strong> {shop.description}</p>
          <p><strong>Location:</strong> {shop.location}</p>
          <p><strong>Address:</strong> {shop.address}</p>
          <p><strong>Phone:</strong> {shop.businessPhoneNumber}</p>
          <p><strong>Opening Hours:</strong> {shop.openingHours}</p>
          <p>
            <strong>Shop is now : </strong>{' '}
            <span className={`shop-status ${isOpen ? 'open' : 'closed'}`}>
              {isOpen ? 'Open' : 'Closed'}
            </span>
          </p>
        </div>

        <div className="sd-products-section">
          <h2>Clothing Items</h2>
          {clothingItems.length > 0 ? (
            <ul className="sd-product-list">
              {clothingItems.map((product) => (
                <li key={product.clothingItemId} className="sd-product-card">
                  <Link to={`/product/${product.clothingItemId}`} className="sd-product-link">
                    <img
                      src={
                        product.pictureUrls
                          ? getImageUrl(product.pictureUrls, '/default-product.jpg')
                          : '/default-product.jpg'
                      }                      
                      alt={product.model}
                      className="sd-product-image"
                    />
                    <div className="sd-product-inline">
                      <span>{product.brand} - {product.model}</span>
                      <span>${product.price}</span>
                      <span>{product.description}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>No products available yet.</p>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ShopDetailsPage;
