import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "../Styling/payment-success.css";

function Safe({ children }) {
  try {
    return children;
  } catch {
    return null;
  }
}

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    const id = params.get("session_id") || "";
    setSessionId(id);

    // Never stay in loading
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, [params]);

  return (
    <>
      <Safe><Navbar /></Safe>

      <main className="pay-result-page" data-page="payment-success">
        <section className="pay-card" role="status" aria-live="polite">
          {loading ? (
            <div className="pay-loading">
              <div className="pay-spinner" />
              <p>Finalizing your payment…</p>
            </div>
          ) : (
            <>
              <div className="pay-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>

              <h1>Payment Successful</h1>
              <p><strong>Welcome aboard</strong> — Your subscription is active and you’re officially part of the team.</p>
              <p>Please <strong>check your Email</strong> to complete your <strong>Business Registration !</strong></p>
              <p>Hit <strong>Continue</strong> to open the Owner Guide—your step-by-step playbook for setting up, launching, and getting value fast.</p>
              <p>Have questions? Our Support team is one click away and ready to help.</p>
              <p>Thank You, and enjoy <strong>Triwears</strong></p>

              <div className="pay-actions">
                <Link to="/owner-guide" className="btn btn-primary">Continue</Link>
                <Link to="/my-profile" className="btn">Profile</Link>
                <Link to="/" className="btn">Home</Link>
              </div>
            </>
          )}
        </section>

        {!loading && (
          <div className="confetti" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
        )}
      </main>

      <Safe><Footer /></Safe>
    </>
  );
}
