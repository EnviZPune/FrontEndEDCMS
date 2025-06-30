import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {jwtDecode} from 'jwt-decode';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import '../Styling/myprofile.css';

const API_BASE = 'http://77.242.26.150:8000';

const getToken = () => {
  const raw = localStorage.getItem('token');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.token || parsed;
  } catch {
    return raw;
  }
};

export default function ProfilePage() {
  const { userId: paramUserId } = useParams();
  const navigate                = useNavigate();
  const token                   = getToken();

  const [profile, setProfile] = useState(null);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(true);

  // extract userId from JWT
  let tokenUserId = null;
  if (token) {
    try {
      const decoded = jwtDecode(token);
      tokenUserId =
        decoded.UserId ||
        decoded.sub ||
        decoded.nameid ||
        decoded.user_id ||
        decoded.id ||
        null;
    } catch (e) {
      console.error('JWT decode error:', e);
    }
  }
  const effectiveUserId = paramUserId || tokenUserId;

  useEffect(() => {
    if (!effectiveUserId) {
      setError('Invalid or missing user ID.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/User/${effectiveUserId}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });
        if (res.status === 401) {
          navigate('/login');
          return;
        }
        if (res.status === 404) {
          throw new Error('User not found.');
        }
        if (!res.ok) {
          throw new Error(`Server error (${res.status})`);
        }
        const data = await res.json();
        setProfile(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [effectiveUserId, navigate, token]);

  if (loading) {
    return (
      <div className="profile-page-container centered">
        <div className="loading-spinner" />
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-page-container centered">
        <p className="error-text">{error}</p>
        <button className="btn" onClick={() => navigate('/')}>
          Go Home
        </button>
      </div>
    );
  }

  return (
    <>
      <Navbar />

      <div className="profile-page-container">
        {/* <div className="profile-banner" />  -- removed */}

        <div className="profile-header">
          <img
            src={profile.profilePictureUrl || '/default-avatar.png'}
            alt={profile.name}
            className="profile-picture"
          />
          <div className="profile-info">
            <h1 className="profile-name">{profile.name}</h1>
            <p className="profile-email">{profile.email}</p>
            {profile.telephoneNumber && (
              <p className="profile-phone">{profile.telephoneNumber}</p>
            )}
          </div>
        </div>

        <button
          className="btn edit-btn"
          onClick={() => navigate('/settings/profile')}
        >
          Edit Profile
        </button>

        {profile.businesses && profile.businesses.length > 0 && (
          <section className="owned-businesses">
            <h2>My Businesses</h2>
            <div className="business-list">
              {profile.businesses.map((biz) => (
                <div key={biz.businessId} className="business-card">
                  <div
                    className="business-cover"
                    style={{ backgroundImage: `url(${biz.coverPictureUrl})` }}
                  />
                  <div className="business-content">
                    <p className="biz-address">{biz.address}</p>
                    {biz.businessPhoneNumber && (
                      <p className="biz-phone">📞 {biz.businessPhoneNumber}</p>
                    )}
                    {biz.openingHours && (
                      <p className="biz-hours">🕒 {biz.openingHours}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <Footer />
    </>
  );
}
