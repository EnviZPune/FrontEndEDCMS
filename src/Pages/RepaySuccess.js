import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_BASE = "https://api.triwears.com/api";

export default function RepaySuccess() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const sessionId = new URLSearchParams(search).get("session_id");

  const [msg, setMsg] = useState("Finalizing your activation…");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      if (!sessionId) {
        setError("Missing session id.");
        setMsg("");
        return;
      }
      try {
        const r = await fetch(
          `${API_BASE}/api/billing/confirm?session_id=${encodeURIComponent(sessionId)}`
        );
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "Failed to confirm payment.");

        const when = data?.newExpiryUtc ? new Date(data.newExpiryUtc).toUTCString() : "updated";
        setMsg(`Shop reactivated. New expiry (UTC): ${when}`);
        setError("");
      } catch (e) {
        setError(e?.message || "Payment completed, finishing activation…");
        setMsg("");
      }
    })();
  }, [sessionId]);

  return (
    <div style={wrap}>
      <div style={card}>
        <h1 style={title}>Payment Success</h1>
        {msg && <div style={ok}>{msg}</div>}
        {error && <div style={err}>{error}</div>}
        <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
          <button style={btnPrimary} onClick={() => navigate("/profile")}>
            Go to Dashboard
          </button>
          <button style={btn} onClick={() => navigate("/")}>Home</button>
        </div>
      </div>
    </div>
  );
}

const wrap = {
  minHeight: "70vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px 16px",
  background: "linear-gradient(to bottom, #f9fafb, #ffffff)",
};
const card = {
  width: "100%",
  maxWidth: 560,
  borderRadius: 16,
  boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
  border: "1px solid #e5e7eb",
  background: "#fff",
  padding: 24,
};
const title = { fontSize: 24, margin: 0, color: "#111827" };
const ok = {
  marginTop: 16,
  padding: 12,
  borderRadius: 12,
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#14532d",
  fontSize: 14,
};
const err = {
  marginTop: 16,
  padding: 12,
  borderRadius: 12,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  fontSize: 14,
};
const btn = {
  appearance: "none",
  border: "1px solid #d1d5db",
  padding: "10px 14px",
  borderRadius: 12,
  background: "#fff",
  color: "#111827",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};
const btnPrimary = { ...btn, background: "#111827", color: "#fff" };
