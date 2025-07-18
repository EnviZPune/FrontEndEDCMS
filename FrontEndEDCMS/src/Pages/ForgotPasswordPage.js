// src/pages/ForgotPasswordPage.jsx
import React, { useState } from 'react';
import '../Styling/auth-forms.css';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';

const API_BASE = 'http://77.242.26.150:8000/api/PasswordReset';

const ForgotPasswordPage = () => {
  const [email, setEmail]     = useState('');
  const [status, setStatus]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          ClientUrl: window.location.origin  // ← include this or your actual reset‑page URL
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus(data.Message || 'Succesfully sent. Please check your email to continue with the restoration process.');
        setEmail('');
      } else {
        setStatus(data.Message || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('Network error:', err);
      setStatus('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="auth-container">
        <h2>Forgot Password</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Enter your email:</label>
          <input
            id="email"
            type="email"
            value={email}
            placeholder="you@example.com"
            required
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>
        {status && <p className="status-message">{status}</p>}
      </div>
      <Footer />
    </>
  );
};

export default ForgotPasswordPage;
