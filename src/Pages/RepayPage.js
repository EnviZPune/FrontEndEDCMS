import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Set this to your API origin (or leave "" if you use a dev proxy on /api)
const API_BASE = 'http://77.242.26.150:8000';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

async function postJSON(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = null;
  try { data = await r.json(); } catch {}
  if (!r.ok) {
    const msg = data?.error || `${r.status} ${r.statusText}`;
    throw new Error(msg);
  }
  return data;
}

export default function RepayPage() {
  const query = useQuery();
  const navigate = useNavigate();

  const token = query.get('token') || '';
  const canceled = query.get('canceled') === '1';

  const [status, setStatus] = useState(token ? 'idle' : 'error'); // idle | starting | redirect | error
  const [error, setError] = useState(token ? '' : 'Missing token. Open the link from your email.');

  useEffect(() => {
    if (canceled) {
      setStatus('error');
      setError('Payment was canceled. You can try again.');
    }
  }, [canceled]);

  const startStripeCheckout = useCallback(async () => {
    if (!token) return;
    setError('');
    setStatus('starting');
    try {
      const { url } = await postJSON(`${API_BASE}/api/billing/create-checkout-session`, { token });
      setStatus('redirect');
      // Go to Stripe Checkout
      window.location.href = url;
    } catch (e) {
      setError(e?.message || 'Failed to start checkout. Please try again.');
      setStatus('error');
    }
  }, [token]);

  const goToDashboard = useCallback(() => {
    navigate('/profile'); // change to your dashboard route if different
  }, [navigate]);

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>Reactivate Shop Subscription</h1>
        <p style={styles.sub}>
          Pay your owner subscription to unsuspend your shop and extend access by 30 days.
        </p>

        <div style={styles.tokenRow}>
          <div style={styles.tokenText}>
            <strong>Token:</strong>{' '}
            <span style={styles.mono}>{token || '—'}</span>
          </div>
          <span
            style={{
              ...styles.badge,
              ...(status === 'error'
                ? styles.badgeErr
                : status === 'starting' || status === 'redirect'
                ? styles.badgeIdle
                : styles.badgeOk),
            }}
          >
            {status === 'idle' && 'Ready'}
            {status === 'starting' && 'Contacting Stripe…'}
            {status === 'redirect' && 'Opening Stripe…'}
            {status === 'error' && 'Error'}
          </span>
        </div>

        {status === 'error' && !!error && <div style={styles.alertErr}>{error}</div>}

        <div style={styles.actions}>
          <button
            onClick={startStripeCheckout}
            disabled={!token || status === 'starting' || status === 'redirect'}
            style={{ ...styles.btn, ...(token && status === 'idle' ? styles.btnPrimary : {}) }}
          >
            {status === 'idle' && 'Retry Payment'}
            {status === 'starting' && 'Starting…'}
            {status === 'redirect' && 'Redirecting…'}
            {status === 'error' && 'Try Again'}
          </button>

          <button onClick={goToDashboard} style={styles.btnOutline}>
            Go to Dashboard
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>
          After payment you’ll be redirected back to this app automatically.
        </div>
      </div>
    </div>
  );
}

// simple inline styles to avoid adding CSS files
const styles = {
  wrap: {
    minHeight: '70vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 16px',
    background: 'linear-gradient(to bottom, #f9fafb, #ffffff)',
  },
  card: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 16,
    boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
    border: '1px solid #e5e7eb',
    background: '#fff',
    padding: 24,
  },
  title: { fontSize: 24, margin: 0, color: '#111827' },
  sub: { marginTop: 8, fontSize: 14, color: '#6b7280' },
  tokenRow: {
    marginTop: 16,
    padding: '10px 12px',
    background: '#f9fafb',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tokenText: { fontSize: 13, color: '#374151' },
  mono: {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    wordBreak: 'break-all',
  },
  badge: { padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 },
  badgeOk: { background: '#dcfce7', color: '#166534' },
  badgeErr: { background: '#fee2e2', color: '#991b1b' },
  badgeIdle: { background: '#e5e7eb', color: '#374151' },
  alertErr: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#991b1b',
    fontSize: 14,
  },
  actions: { display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' },
  btn: {
    appearance: 'none',
    border: '1px solid #d1d5db',
    padding: '10px 14px',
    borderRadius: 12,
    background: '#111827',
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
  btnPrimary: { background: '#111827', color: '#fff' },
  btnOutline: {
    appearance: 'none',
    border: '1px solid #d1d5db',
    padding: '10px 14px',
    borderRadius: 12,
    background: '#fff',
    color: '#111827',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
};
