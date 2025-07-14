import React, { useState } from 'react';
import '../Styling/auth-forms.css';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Submit clicked');
    setStatus(null);
    setLoading(true);

    try {
      const res = await fetch('http://77.242.26.150:8000/api/PasswordReset/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setStatus('Sent Succesfully. Check your email for the reset link.');
      } else {
        const data = await res.json();
        setStatus(`${data.error || 'Something went wrong.'}`);
      }
    } catch (err) {
      console.error('Network error:', err);
      setStatus('Network error. Check your connection or CORS settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Navbar />
      <div className="auth-container">
        <h2>Forgot Password</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Enter your email:
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        {status && <p>{status}</p>}
      </div>
      <Footer />
    </div>
  );
};

export default ForgotPasswordPage;
