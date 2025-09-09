import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SERVER = 'https://api.triwears.com';

export default function EmailConfirmation() {
  // ← remove the <>-generic here
  const [status, setStatus] = useState('loading');
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId');
    const token  = params.get('token');

    if (!userId || !token) {
      setStatus('error');
      return;
    }

    fetch(
      `${SERVER}/api/Auth/confirm-email?userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`,
      { method: 'GET' }
    )
      .then(res => {
        if (res.ok) {
          setStatus('success');
          setTimeout(() => navigate('/login'), 3000);
        } else {
          setStatus('error');
        }
      })
      .catch(() => setStatus('error'));
  }, [navigate]);

  return (
    <div className="confirmation-page">
      {status === 'loading' && <p>Verifying your email…</p>}
      {status === 'success' && (
        <div>
          <h2>Email confirmed!</h2>
          <p>You will be redirected to login shortly.</p>
        </div>
      )}
      {status === 'error' && (
        <div>
          <h2>Oops! Confirmation failed.</h2>
          <p>Please check your link or request another confirmation email.</p>
        </div>
      )}
    </div>
  );
}
