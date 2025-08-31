// src/Components/Unauthorized.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../Components/Navbar";
import "../Styling/unauthorized.css";

const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <>
      <Navbar />
      <div className="unauthorized-page">
        <div className="shopcard unauthorized-card">
          {/* Optional icon from your ShopList header */}
          <div className="unauthorized-icon">🚫</div>

          <h2 className="unauthorized-title">403 — Unauthorized</h2>
          <p className="unauthorized-text">
            Sorry, you don’t have permission to view this page.
          </p>
          <button
            className="btn btn-primary unauthorized-btn"
            onClick={() => navigate("/")}
          >
            Back to Home
          </button>
        </div>
      </div>
    </>
  );
};

export default Unauthorized;
