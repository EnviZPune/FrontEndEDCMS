// src/Pages/BecomeOwner.js
import React, { useState, useMemo, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import '../Styling/BecomeOwner.css';
import Navbar from '../Components/Navbar';

function getToken() {
  const raw = localStorage.getItem('token');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : parsed.token;
  } catch {
    return raw;
  }
}

export default function BecomeOwner() {
  const [loading, setLoading] = useState(false);
  const [testResponse, setResponse] = useState(null);

  const publishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey]
  );

  const frontendBase = process.env.REACT_APP_CLIENT_BASE_URL || window.location.origin;
  const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://77.242.26.150:8000';

  useEffect(() => {
    const jwt = getToken();
    if (!jwt) {
      setResponse('No JWT; please log in.');
      return;
    }

    fetch(`${apiBase}/api/business/string`, {
      headers: { 'Authorization': `Bearer ${jwt}` }
    })
      .then(res => res.text())
      .then(txt => setResponse(txt))
      .catch(err => setResponse('Error: ' + err.message));
  }, [apiBase]);

  async function handleSubscribe() {
    const jwt = getToken();
    if (!jwt) {
      alert("You must be logged in to subscribe.");
      return;
    }

    setLoading(true);

    const successUrl = `${frontendBase}/create-shop`;
    const cancelUrl = `${frontendBase}/payment-cancel`;

    const endpoint = `${apiBase}/api/payment/create-session?` +
      `successUrl=${encodeURIComponent(successUrl)}` +
      `&cancelUrl=${encodeURIComponent(cancelUrl)}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      console.error("Failed to create checkout session:", await res.text());
      setLoading(false);
      return;
    }

    const { url: checkoutUrl } = await res.json();

    // ✅ Simple redirect to Stripe-hosted checkout page
    window.location.href = checkoutUrl;
  }

  return (
    <div>
      <Navbar />
      <div className="become-owner-page">
        <div className="owner-card">
          <h1 className="owner-title">Welcome Future Shop Owner</h1>
          <p className="owner-subtitle">
            You're just one step away from unlocking your business journey.
          </p>
          <p className="owner-description">
            Subscribing for <strong>$20/month</strong> gives you full access to your own shop, tools to manage inventory, employees, and customers.
          </p>
          <p className="owner-thankyou">
            We’re excited to have you on board. Let’s build something amazing together.
          </p>
          <button className="subscribe-button" onClick={handleSubscribe} disabled={loading}>
            {loading ? 'Redirecting…' : 'Subscribe Now'}
          </button>
          <p className="test-response">
            System Status: <strong>{testResponse ?? 'Loading...'}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
