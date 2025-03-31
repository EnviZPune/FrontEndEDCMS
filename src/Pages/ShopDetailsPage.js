import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import '../Styling/sd-shopdetail.css';

const ShopDetailsPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [shop, setShop] = useState(null);
  const [clothingItems, setClothingItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    } catch (err) {
      token = storedToken;
    }

    const fetchShopAndProducts = async () => {
      try {
        const shopRes = await fetch(
          `https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/Business/name/${slug}`,
          {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!shopRes.ok) {
          const text = await shopRes.text();
          throw new Error(`Failed to fetch shop: ${shopRes.status} - ${text}`);
        }

        const shopData = await shopRes.json();
        setShop(shopData);

        if (shopData.businessId) {
          const ciRes = await fetch(
            `https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/ClothingItem/business/${shopData.businessId}`,
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
          } else {
            console.error("Failed to fetch clothing items");
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

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading shop details...</p>
      </div>
    );
  }

  if (error) return <p className="sd-error-message">{error}</p>;
  if (!shop) return <p className="sd-error-message">Shop not found.</p>;

  return (
    <div>
      <Navbar />
      <div className="sd-shop-details-page">
        <div
          className="sd-shop-hero"
          style={{ backgroundImage: `url(${shop.coverPictureUrl || '/default-cover.jpg'})` }}
        >
          <div className="sd-shop-hero-content">
            <img
              src={shop.profilePictureUrl || '/default-logo.jpg'}
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
        </div>

        <div className="sd-products-section">
          <h2>Clothing Items</h2>
          {clothingItems.length > 0 ? (
            <ul className="sd-product-list">
              {clothingItems.map((item) => (
                <li key={item.clothingItemId} className="sd-product-card">
                  <img
                    src={
                      item.pictureUrls
                        ? JSON.parse(item.pictureUrls)[0] || '/default-product.jpg'
                        : '/default-product.jpg'
                    }
                    alt={item.model}
                    className="sd-product-image"
                  />
                  <h3>{item.brand} - {item.model}</h3>
                  <p>{item.description}</p>
                  <p><strong>Price:</strong> ${item.price}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No products available yet.</p>
          )}
        </div>

        <Footer />
      </div>
    </div>
  );
};

export default ShopDetailsPage;
