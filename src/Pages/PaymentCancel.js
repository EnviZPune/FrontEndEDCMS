// src/Pages/PaymentCancel.js
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import { Link, useSearchParams } from "react-router-dom";

export default function PaymentCancel() {
  const [params] = useSearchParams();
  const reason = params.get("reason");

  return (
    <>
      <Navbar />
      <div className="container" style={{ minHeight: "50vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48 }}>❌</div>
          <h1>Payment Canceled</h1>
          {reason && <p>Reason: {reason}</p>}
          <p>You weren’t charged. You can try again any time.</p>
          <p><Link to="/">Back to Home</Link></p>
        </div>
      </div>
      <Footer />
    </>
  );
}
