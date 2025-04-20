import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import '../Styling/shoplist.css';

const ShopList = () => {
    const [shops, setShops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const carouselRef = useRef(null);


    useEffect(() => {
        const fetchShops = async () => {
            const tokenData = localStorage.getItem('token');

            if (!tokenData) {
                setError("Unauthorized access. Please log in.");
                setLoading(false);
                return;
            }

            try {
                const parsedTokenData = JSON.parse(tokenData);
                const token = parsedTokenData.token || parsedTokenData;

                const response = await fetch(`http://77.242.26.150:8000/api/Business/ViewAllBusinesses`);
            

                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }

                const data = await response.json();
                console.log("Fetched Shops:", data);

                setShops(data);
            } catch (error) {
                console.error('Failed to fetch shops:', error);
                setError(`Failed to load data: ${error.message}`);
            } finally {
                setLoading(false);
            }
        };

        fetchShops();
    }, []);

    // Carousel scrolling logic
    const scrollLeft = () => {
        if (carouselRef.current) {
            carouselRef.current.scrollBy({ left: -250, behavior: "smooth" });
        }
    };

    const scrollRight = () => {
        if (carouselRef.current) {
            carouselRef.current.scrollBy({ left: 250, behavior: "smooth" });
        }
    };

    if (loading) {
        return (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading all shops</p>
          </div>
        );
      }

    if (error) {
        return <div className="shoplist-error">Error: {error}</div>;
    }

    return (
        <>
            <Navbar />
            <div className="shoplist-container">
                <h1 className="shoplist-title">Available Shops</h1>

                {/* ✅ Carousel Container */}
                <div className="shop-carousel-container">
                    <button className="carousel-arrow left-arrow" onClick={scrollLeft}>&#9664;</button>
                    
                    <div className="shop-carousel" ref={carouselRef}>
                        {shops.length > 0 ? (
                            shops.map(shop => (
                                <div key={shop.businessId} className="shop-card">
                                    <img
                                        src={shop.logoImage || '/default-shop.jpg'}
                                        alt={`${shop.name} Logo`}
                                        className="shoplist-logo"
                                    />
                                    <h2>{shop.name}</h2>
                                    <p>{shop.description || "No description available."}</p>
                                    <Link to={`/shops/${shop.name}`} className="view-details-link">
                                        View Details
                                    </Link>
                                </div>
                            ))
                        ) : (
                            <p className="shoplist-no-data">No shops available.</p>
                        )}
                    </div>

                    <button className="carousel-arrow right-arrow" onClick={scrollRight}>&#9654;</button>
                </div>

                {/* Pagination Dots */}
                <div className="pagination-dots">
                    {shops.map((_, index) => (
                        <span key={index} className="dot"></span>
                    ))}
                </div>
            </div>
            <Footer />
        </>
    );
};

export default ShopList;