import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import '../Styling/sd-shopdetail.css';

const ShopDetailsPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Retrieve token and log it for debugging
    const storedToken = localStorage.getItem('token');
    console.log("Raw token from localStorage:", storedToken);

    if (!storedToken) {
      setError("Unauthorized access. Please log in.");
      setLoading(false);
      return;
    }

    // Parse the token if it's stored as a JSON string
    let token;
    try {
      const parsedData = JSON.parse(storedToken);
      token = parsedData.token || parsedData; // Some apps store { token: "..." }
    } catch (error) {
      token = storedToken; // If parsing fails, assume it's stored as plain string
    }

    console.log("Final token used for request:", token);

    // Update the endpoint to use slug instead of name.
    const apiUrl = `https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/Business/name/${slug}`;
    console.log("Fetching shop from:", apiUrl);

    fetch(apiUrl, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(response => {
        console.log("API Response Status:", response.status);
        if (!response.ok) {
          return response.text().then(text => { 
            throw new Error(`Failed to fetch shop: ${response.status} - ${text}`);
          });
        }
        return response.json();
      })
      .then(data => {
        console.log("Fetched Shop Data:", data);
        setShop(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Fetch error:', error.message);
        setError(error.message);
        setLoading(false);
      });
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
          {shop.clothingItems?.length > 0 ? (
            <ul className="sd-product-list">
              {shop.clothingItems.map((item) => (
                <li key={item.clothingItemId} className="sd-product-card">
                  <img
                    src={item.pictureUrls[0] || '/default-product.jpg'}
                    alt={item.name}
                    className="sd-product-image"
                  />
                  <h3>{item.brand} - {item.model}</h3>
                  <p>{item.description}</p>
                  <p><strong>Price:</strong> ${item.price}</p>
                  <p><strong>Size:</strong> {item.sizes}</p>
                  <p><strong>Colors:</strong> {item.colors}</p>
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
