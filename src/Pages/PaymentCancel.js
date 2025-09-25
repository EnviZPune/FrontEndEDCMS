import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "../Styling/payment-success.css";

/** Guard so Navbar/Footer can’t crash this page */
function Safe({ children }) {
  try {
    return children;
  } catch {
    return null;
  }
}

export default function PaymentCancel() {
  const [params] = useSearchParams();
  const reason = params.get("reason") || "";

  return (
    <>
      <Safe><Navbar /></Safe>

      <main className="pay-result-page" data-page="payment-cancel">
        <section className="pay-card" role="status" aria-live="polite">
          <div className="pay-icon" aria-hidden="true" style={{
            /* simple red variant without needing extra CSS rules */
            background: "radial-gradient(70% 70% at 30% 30%, #f87171, #dc2626)"
          }}>
            <svg viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </div>

          <h1>Payment canceled</h1>
          {reason && <p>Reason: {reason}</p>}
          <p>No charge has been applied. You can try again any time.</p>

          <div className="pay-actions">
            <Link to="/become-owner" className="btn btn-primary">Try again</Link>
            <Link to="/" className="btn">Home</Link>
          </div>
        </section>
      </main>

      <Safe><Footer /></Safe>
    </>
  );
}
