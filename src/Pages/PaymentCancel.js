import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";

export default function PaymentCancel() {
  return (
    <>
      <div className="page-wrapper" style={{ minHeight: "50vh", display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 560, padding: "24px" }}>
          <h1 style={{ marginBottom: 8 }}>Payment Canceled</h1>
          <p style={{ opacity: 0.8, marginBottom: 20 }}>
            Your subscription/payment was not completed.
          </p>
          <Link
            to="/become-owner"
            className="btn-primary"
            style={{
              display: "inline-block",
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              textDecoration: "none",
            }}
          >
            Subscribe Now
          </Link>
        </div>
      </div>
    </>
  );
}
