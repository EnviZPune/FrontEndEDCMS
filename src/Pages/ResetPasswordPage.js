import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import '../Styling/auth-forms.css';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const queryToken = searchParams.get('token');
    if (queryToken) {
      setToken(queryToken);
    } else {
      setStatus('Invalid or missing reset token.');
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      setStatus('Missing reset token.');
      return;
    }

    if (password !== confirmPassword) {
      setStatus('Passwords do not match.');
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch('http://77.242.26.150:8000/api/PasswordReset/reset-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      });

      if (res.ok) {
        setStatus('Password has been restored successfully.');
        setTimeout(() => navigate('/login'), 3000);
      } else {
        const error = await res.text();
        setStatus(`Failed: ${error}`);
      }
    } catch (err) {
      console.error(err);
      setStatus('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="auth-form-container">
        <h2>Reset Your Password</h2>
        {status && <p className="status-message">{status}</p>}
        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="password"
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
      <Footer />
    </>
  );
};

export default ResetPasswordPage;
