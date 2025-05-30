import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import Navbar from '../Components/Navbar';
import '../Styling/myprofile.css';

const getToken = () => {
  const raw = localStorage.getItem('token');
  if (!raw || raw.trim() === '') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.token || parsed;
  } catch {
    return raw;
  }
};

export default function ProfilePage() {
  const { userId: paramUserId } = useParams();
  const navigate = useNavigate();
  const token = getToken();

  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  let tokenUserId = null;
  if (token) {
    try {
      const decoded = jwtDecode(token);
      tokenUserId =
        decoded.UserId || decoded.sub || decoded.nameid || decoded.user_id || decoded.id || null;
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
        const res = await fetch(`http://77.242.26.150:8000/api/User/${effectiveUserId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) throw new Error(`User not found (${res.status})`);

        const data = await res.json();
        setProfile(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [effectiveUserId]);

  if (loading) {
    return (
      <div className="profile-page-container" style={{ textAlign: 'center' }}>
        <div className="loading-spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-page-container" style={{ textAlign: 'center' }}>
        <p style={{ color: 'red' }}>{error}</p>
        <button onClick={() => navigate('/preview')}>Go Back Home</button>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div className="profile-page-container">
      <div className="profile-banner" />
        <div className="profile-header">
          <img
            src={profile.profilePictureUrl || 'Assets/default-avatar.jpg'}
            alt="Profile"
            className="profile-picture"
          />
          <div className="profile-info">
            <h1>{profile.name}</h1>
            <p>{profile.email}</p>
          </div>
        </div>

        <button className="save-button" onClick={() => navigate('/profile-settings')}>
          Edit Profile
        </button>
      </div>
    </>
  );
}
