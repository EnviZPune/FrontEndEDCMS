import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  return (
    <>
      <Navbar />
      <div className="page-wrapper" style={{ minHeight: "50vh", display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 560, padding: "24px" }}>
          <h1 style={{ marginBottom: 8 }}>Payment Successful 🎉</h1>
          <p style={{ opacity: 0.8 }}>
            Thank you for subscribing!{sessionId ? ` (Session: ${sessionId})` : ""}
          </p>
          <div style={{ marginTop: 20, display: "flex", gap: 12, justifyContent: "center" }}>
            <Link to="/my-profile" className="btn-primary" style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #e5e7eb", textDecoration: "none" }}>
              Go to Profile
            </Link>
            <Link to="/" className="btn-secondary" style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #e5e7eb", textDecoration: "none" }}>
              Home
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
