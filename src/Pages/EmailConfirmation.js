import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Prefer env, fall back to prod API
const API_BASE =
  (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) ||
  (typeof process !== 'undefined' && process.env.REACT_APP_API_BASE) ||
  'https://api.triwears.com/api';

export default function EmailConfirmation() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [errorText, setErrorText] = useState('');

  // Read params once and memoize
  const { userId, token } = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      userId: p.get('userId') || '',
      token: p.get('token') || '',
    };
  }, []);

  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!userId || !token) {
      setStatus('error');
      setErrorText('Missing userId or token.');
      return;
    }

    const ac = new AbortController();
    setStatus('loading');
    setErrorText('');

    const url = `${API_BASE}/Auth/confirm-email?userId=${encodeURIComponent(
      userId
    )}&token=${encodeURIComponent(token)}`;

    fetch(url, { method: 'GET', signal: ac.signal })
      .then(async (res) => {
        if (res.ok) {
          setStatus('success');
          // prevent multiple navigations if effect re-runs
          if (!redirectedRef.current) {
            redirectedRef.current = true;
            setTimeout(() => navigate('/login'), 3000);
          }
          return;
        }
        // Try to surface API error message (if any)
        let msg = '';
        try {
          const text = await res.text();
          msg = text || res.statusText;
        } catch {
          msg = res.statusText || 'Unknown error.';
        }
        setErrorText(msg);
        setStatus('error');
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        setErrorText(err?.message || 'Network error.');
        setStatus('error');
      });

    return () => ac.abort();
  }, [navigate, userId, token]);

  return (
    <div className="confirmation-page" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      {status === 'loading' && (
        <div>
          <h2>Verifying your email…</h2>
          <p>Please wait a moment.</p>
        </div>
      )}

      {status === 'success' && (
        <div>
          <h2>Email confirmed Successfully !</h2>
          <p>You’ll be redirected to the login page shortly.</p>
          <p>
            If nothing happens, <a href="/login">click here</a>.
          </p>
        </div>
      )}

      {status === 'error' && (
        <div>
          <h2>Oops! Confirmation failed.</h2>
          <p>Please check your link or request another confirmation email.</p>
          {errorText && (
            <p style={{ color: '#c00', marginTop: 8 }}>
              Details: {errorText}
            </p>
          )}
          <p style={{ marginTop: 12 }}>
            <a href="/resend-confirmation">Resend confirmation</a> &nbsp;|&nbsp; <a href="/help">Help</a>
          </p>
        </div>
      )}
    </div>
  );
}
