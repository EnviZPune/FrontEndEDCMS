// src/Pages/PublicProfilePage.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import '../Styling/publicprofile.css';

const API_BASE = 'http://77.242.26.150:8000';

const PublicProfilePage = () => {
  const { userId } = useParams();
  const navigate    = useNavigate();
  const [profile, setProfile] = useState(null);
  const [status,  setStatus]  = useState({ loading: true, error: '' });

  useEffect(() => {
    async function loadProfile() {
      const token = localStorage.getItem('token');
      try {
        const res = await fetch(`${API_BASE}/api/User/${userId}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });
        if (res.status === 401) {
          return navigate('/login');
        }
        if (res.status === 404) {
          setStatus({ loading: false, error: 'User not found.' });
          return;
        }
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        const data = await res.json();
        setProfile(data);
        setStatus({ loading: false, error: '' });
      } catch (err) {
        setStatus({ loading: false, error: err.message || 'Failed to load.' });
      }
    }
    loadProfile();
  }, [userId, navigate]);

  if (status.loading) {
    return (
      <div className="profile-container">
        <p className="loading">Loading profile…</p>
      </div>
    );
  }
  if (status.error) {
    return (
      <div className="profile-container">
        <p className="error">{status.error}</p>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div className="profile-container">
        <div className="profile-card">
          <img
            src={profile.profilePictureUrl || '/default-avatar.png'}
            alt={profile.name}
            className="profile-picture"
          />
          <h2 className="profile-name">{profile.name}</h2>

          <p className="profile-email">
            <strong>Email:</strong> {profile.email}
          </p>

          {profile.telephoneNumber && (
            <p className="profile-phone">
              <strong>Phone:</strong> {profile.telephoneNumber}
            </p>
          )}


          {profile.businesses && profile.businesses.length > 0 && (
            <div className="profile-businesses">
              <h3>Owner of :</h3>
              <ul>
                {profile.businesses.map(b => (
                  <li key={b.businessId}>
                    {b.address}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
};

export default PublicProfilePage;
