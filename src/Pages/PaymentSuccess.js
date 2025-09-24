// src/Pages/PaymentSuccess.js
import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";

const API_BASE = "https://api.triwears.com/api"; // backend api root

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, ok: false, msg: "" });

  useEffect(() => {
    let alive = true;

    const run = async () => {
      const sessionId = searchParams.get("session_id");
      if (!sessionId) {
        if (alive) setState({ loading: false, ok: false, msg: "Missing session_id." });
        return;
      }

      // Optional: call your backend to verify session and finalize order.
      // If you don't have such endpoint yet, just mark ok=true and show success.
      try {
        // Example: GET /Stripe/checkout/confirm?sessionId=...
        const res = await fetch(`${API_BASE}/Stripe/checkout/confirm?sessionId=${encodeURIComponent(sessionId)}`, {
          headers: { Accept: "application/json" },
          credentials: "include"
        });

        if (res.ok) {
          if (alive) setState({ loading: false, ok: true, msg: "Payment confirmed. Thank you!" });
        } else {
          const text = await res.text();
          if (alive) setState({ loading: false, ok: true, msg: "Payment completed. (Confirmation pending)" });
          console.warn("Confirm endpoint returned:", res.status, text);
        }
      } catch (e) {
        console.warn("Confirm call failed:", e);
        if (alive) setState({ loading: false, ok: true, msg: "Payment completed. (Network confirm skipped)" });
      }
    };

    run();
    return () => { alive = false; };
  }, [searchParams]);

  return (
    <>
      <Navbar />
      <div className="container" style={{ minHeight: "50vh", display: "grid", placeItems: "center", padding: 24 }}>
        {state.loading ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48 }}>⏳</div>
            <p>Finalizing your payment…</p>
          </div>
        ) : state.ok ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <h1>Payment Successful</h1>
            {state.msg && <p>{state.msg}</p>}
            <p><Link to="/">Back to Home</Link></p>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48 }}>⚠️</div>
            <h1>We couldn’t verify your payment</h1>
            <p>{state.msg || "Please contact support if funds were captured."}</p>
            <p><Link to="/">Back to Home</Link></p>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
