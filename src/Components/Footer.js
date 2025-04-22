import React from 'react';
import '../Styling/footer.css';

const Footer = () => {
  return (
    <footer className="custom-footer">
      <div className="footer-content">
        <div className="footer-logo-section">
          <img
            src={`${process.env.PUBLIC_URL}/Assets/edlogo.png`}
            alt="E & D Logo"
            className="footer-logo"
          />
          <p className="footer-slogan">E & D — Albania’s First Real-Time Online Shopping Mall. Connecting real shops with real people.</p>
        </div>

        <div className="footer-links">
          <div className="footer-column">
            <h4>Company</h4>
            <a href="/about">About Us</a>
            <a href="/terms">Terms & Conditions</a>
            <a href="/privacy">Privacy Policy</a>
          </div>

          <div className="footer-column">
            <h4>Explore</h4>
            <a href="/shops">Find Shops</a>
            <a href="/map">Map</a>
          </div>

          <div className="footer-column">
            <h4>Contact</h4>
            <p>Email: support@edmall.al</p>
            <p>Phone: +355 69 123 4567</p>
            <p>Location: Tirana, Albania</p>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} E & D. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
