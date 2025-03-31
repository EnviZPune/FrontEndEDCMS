import React, { useState, useEffect, useRef } from "react";
import { FaUser, FaCaretDown } from "react-icons/fa";
import "../Styling/navbar.css";
// Using the named export from jwt-decode; adjust if necessary.
import { jwtDecode } from "jwt-decode";
import Notification from "../Components/NotificationDropdown";
import { Link } from "react-router-dom";

const Navbar = () => {
  const [loggedUser, setLoggedUser] = useState(null);
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [isSubmenuVisible, setIsSubmenuVisible] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  // On mount, retrieve the token from localStorage and decode it
  useEffect(() => {
    const token = localStorage.getItem("token");
    console.log("Token from localStorage in Navbar:", token);
    if (token) {
      try {
        const decoded = jwtDecode(token);
        console.log("Decoded token:", decoded);
        setLoggedUser(decoded);
      } catch (err) {
        console.error("Token decoding failed:", err);
        localStorage.removeItem("token");
      }
    } else {
      console.log("No token found in localStorage");
    }
  }, []);

  // Determine if the user is an owner (if token includes a "role" claim with value "Owner")
  const isOwner =
    loggedUser &&
    loggedUser.role &&
    loggedUser.role.toLowerCase() === "owner";

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setDropdownVisible(!isDropdownVisible);
    setIsSubmenuVisible(false);
  };

  const toggleSubmenu = (e) => {
    e.stopPropagation();
    setIsSubmenuVisible(!isSubmenuVisible);
  };

  const handleLogout = () => {
    localStorage.removeItem("token")
    window.location.href = "/preview";
  };

  // Close dropdown if clicking outside the user menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownVisible(false);
        setIsSubmenuVisible(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  return (
    <div className="navbar_container">
      <nav className="navbar">
        <div className="logo-container">
          <Link to="/preview">
            <img
              src={`${process.env.PUBLIC_URL}/Assets/edlogo.png`}
              alt="E & D Corporation Logo"
            />
          </Link>
          <h3>E & D Corporation</h3>
        </div>

        {/* Hamburger Menu */}
        <button
          className={`hamburger ${isMenuOpen ? "is-active" : ""}`}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* Navigation Links */}
        <ul className={`nav-links ${isMenuOpen ? "open" : ""}`}>
          <li>
            <Link to="/preview">Preview</Link>
          </li>
          <li>
            <Link to="/shops">Shops</Link>
          </li>
          <li>
            <Link to="/map">Map</Link>
          </li>
          <li>
            <Link to="/about">About</Link>
          </li>
          <li>
            <Link to="/contact">Contact</Link>
          </li>

          {loggedUser ? (
            <>
              <li>
                <Notification isLoggedIn={true} />
              </li>

              <li className="user-menu" ref={dropdownRef}>
                <button className="user-menu-button" onClick={toggleDropdown}>
                  <FaUser className="user-icon" />
                  {/* Display username from token (using the "sub" claim) */}
                  <span>{loggedUser.sub}</span>
                  <FaCaretDown
                    className={`caret-icon ${isDropdownVisible ? "rotate" : ""}`}
                  />
                </button>

                {isDropdownVisible && (
                  <div className="dropdown-menu">
                    {/* My Profile Submenu */}
                    <div className="dropdown-submenu">
                      <button className="dropdown-item-dropdown-toggle" onClick={toggleSubmenu}>
                        <span className="dropdown-icon-myprofile">👤</span>
                        My Profile
                        <FaCaretDown
                          className={`submenu-caret ${isSubmenuVisible ? "rotate" : ""}`}
                        />
                      </button>
                      {isSubmenuVisible && (
                        <div className="dropdown-submenu-content">
                          <Link to="/profile" className="dropdown-item">
                            - View Profile
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Role-based options */}
                    {!isOwner && (
                      <Link to="/create-shop" className="dropdown-item">
                        🏬 Create Your Shop
                      </Link>
                    )}
                    {isOwner && (
                      <Link to="/my-shops" className="dropdown-item">
                        📋 My Shops
                      </Link>
                    )}
                    <Link to="/settings" className="dropdown-item">
                      ⚙️ Bussiness Settings
                    </Link>
                    <button onClick={handleLogout} className="dropdown-item logout-button">
                      🚪 Logout
                    </button>
                  </div>
                )}
              </li>
            </>
          ) : (
            // If no token is found, show Login and Register buttons.
            <div className="auth-buttons">
              <button onClick={() => window.location.href = "/login"} className="login-button">
                Login
              </button>
              <button onClick={() => window.location.href = "/register"} className="register-button">
                Register
              </button>
            </div>
          )}
        </ul>
      </nav>
    </div>
  );
};

export default Navbar;