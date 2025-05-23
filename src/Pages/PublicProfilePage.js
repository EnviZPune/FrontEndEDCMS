import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import '../Styling/publicprofile.css'

const PublicProfilePage = () => {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`http://77.242.26.150:8000/api/User/${userId}`);
        if (!res.ok) throw new Error('User not found');
        const data = await res.json();
        setProfile(data);
      } catch (err) {
        setError(err.message || 'Failed to load profile.');
      }
    };

    fetchProfile();
  }, [userId]);

  if (error) return <div className="profile-error">⚠ {error}</div>;
  if (!profile) return <div className="profile-error">Loading profile...</div>;

  return (
    <div>
      <Navbar />
    <div className="profile-container">
      <div className="profile-card">
        <img
          src={profile.profilePictureUrl || '/Assets/default-profile.png'}
          alt={`${profile.name}'s profile`}
          className="profile-picture"
        />
        <h2 className="profile-name">{profile.name}</h2>
        <p className="profile-username">@{profile.username}</p>
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        {profile.birthday && (
          <p className="profile-birthday">
            🎂 Birthday: {new Date(profile.birthday).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
    <Footer />
    </div>
  );
};

export default PublicProfilePage;
