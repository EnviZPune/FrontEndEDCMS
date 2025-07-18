// src/pages/ResetPasswordPage.jsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import '../Styling/auth-forms.css';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';

const API_BASE = 'http://77.242.26.150:8000/api/PasswordReset';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate        = useNavigate();

  const [token, setToken]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirm]   = useState('');
  const [status, setStatus]             = useState('');
  const [loading, setLoading]           = useState(false);

  // Extract token from ?token=... on mount
  useEffect(() => {
    const t = searchParams.get('token');
    if (t) {
      setToken(t);
    } else {
      setStatus('Invalid or missing reset token.');
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('');

    if (!token) {
      setStatus('Missing reset token.');
      return;
    }
    if (password !== confirmPassword) {
      setStatus('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,                // matches dto.Token
          newPassword: password // matches dto.NewPassword
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus(data.Message || 'Password has been reset successfully.');
        // Redirect to login after 3s
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setStatus(data.Message || 'Failed to reset password. Please try again.');
      }
    } catch (err) {
      console.error('Network error:', err);
      setStatus('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="auth-container">
        <h2>Reset Your Password</h2>
        {status && <p className="status-message">{status}</p>}
        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="password"
            placeholder="New Password"
            required
            disabled={loading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="Confirm New Password"
            required
            disabled={loading}
            value={confirmPassword}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button type="submit" disabled={loading || !token}>
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>
      </div>
      <Footer />
    </>
  );
}
