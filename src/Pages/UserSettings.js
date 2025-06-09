// src/pages/SettingsPage.jsx
import React, { useState, useEffect } from 'react';
import '../Styling/usersettings.css';
import Navbar from '../Components/Navbar';
import { jwtDecode } from 'jwt-decode';

const API_BASE   = 'http://77.242.26.150:8000';
const GCS_BUCKET = 'https://storage.googleapis.com/edcms_bucket';

const getToken = () => {
  const raw = localStorage.getItem('token') || localStorage.getItem('authToken');
  if (!raw || raw.trim() === '') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.token || parsed;
  } catch {
    return raw;
  }
};

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization:  `Bearer ${getToken()}`,
});

const uploadImageToGCS = async (file) => {
  const timestamp = Date.now();
  const fileName  = `${timestamp}-${file.name}`;
  const uploadUrl = `${GCS_BUCKET}/${fileName}`;
  const txtUrl    = `${uploadUrl}.txt`;

  let res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error('Image upload failed');

  res = await fetch(txtUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: uploadUrl,
  });
  if (!res.ok) throw new Error('Text file upload failed');

  return uploadUrl;
};

export default function SettingsPage() {
  const token = getToken();
  let userId = null;
  if (token) {
    try {
      const decoded = jwtDecode(token);
      userId = decoded.UserId || decoded.id || decoded.sub;
    } catch {
      console.error('JWT decode error');
    }
  }

  const [userData, setUserData]             = useState(null);
  const [username, setUsername]             = useState('');
  const [email, setEmail]                   = useState('');
  const [bio, setBio]                       = useState('');
  const [birthday, setBirthday]             = useState('');
  const [password, setPassword]             = useState('');

  // this must match the DTO property your backend uses:
  const [profilePictureUrl, setProfilePictureUrl]   = useState('');
  const [imagePreviewUrl, setImagePreviewUrl]       = useState('');
  const [uploading, setUploading]                   = useState(false);
  const [uploadError, setUploadError]               = useState(null);

  const [wordCount, setWordCount] = useState(0);

  // 1️⃣ Load existing user data
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const res = await fetch(`${API_BASE}/api/User/${userId}`, {
        headers: getHeaders()
      });
      if (!res.ok) {
        console.error('User fetch failed', res.status);
        return;
      }
      const data = await res.json();
      setUserData(data);
      setUsername(data.name || '');
      setEmail(data.email || '');
      setBio(data.bio || '');
      setBirthday(data.birthday?.split('T')[0] || '');
      setProfilePictureUrl(data.profilePictureUrl || '');
      setImagePreviewUrl(data.profilePictureUrl || '');
      setWordCount((data.bio || '').split(/\s+/).filter(Boolean).length);
    })();
  }, [userId]);

  const handleBioChange = e => {
    const words = e.target.value.split(/\s+/).filter(Boolean);
    if (words.length <= 100) {
      setBio(words.join(' '));
      setWordCount(words.length);
    } else {
      alert('Bio cannot exceed 100 words.');
    }
  };

  const handleFileUpload = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadImageToGCS(file);
      setProfilePictureUrl(url);
      setImagePreviewUrl(url);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError('Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  // 4️⃣ Remove picture
  const handleRemoveImage = () => {
    setProfilePictureUrl('');
    setImagePreviewUrl('');
  };

  // 5️⃣ Submit full payload matching your UserDTO
  const handleSubmit = async e => {
    e.preventDefault();
    const payload = {
      name:              username,
      email,
      bio,
      birthday,
      profilePictureUrl,      // ◀ important: must match DTO
      // add any other required fields here, e.g.:
      // phoneNumber:        userData.phoneNumber,
      // address:            userData.address,
      ...(password && { password })
    };

    const res = await fetch(`${API_BASE}/api/User/${userId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      alert('Update failed');
    } else {
      alert('Profile updated successfully!');
    }
  };

  if (!userData) return <div>Loading…</div>;

  return (
    <div>
      <Navbar />
      <div className="settings-container">
        <form onSubmit={handleSubmit}>
          <label>
            Profile Image:
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
            />
          </label>
          {uploading && <div>Uploading…</div>}
          {uploadError && <div className="error">{uploadError}</div>}
          {imagePreviewUrl && (
            <div className="image-preview">
              <img
                src={imagePreviewUrl}
                alt="Preview"
                width={100}
                height={100}
              />
              <button type="button" onClick={handleRemoveImage}>
                Delete Picture
              </button>
            </div>
          )}

          <label>
            Username:
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </label>

          <label>
            Email:
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </label>

          <label>
            Birthday:
            <input
              type="date"
              value={birthday}
              onChange={e => setBirthday(e.target.value)}
            />
          </label>

          <label>
            Bio:
            <textarea
              value={bio}
              onChange={handleBioChange}
            />
            <div className="word-count">{wordCount}/100</div>
          </label>

          <label>
            New Password:
            <input
              type="password"
              placeholder="Leave blank to keep current"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </label>

          {/* ↓ If your backend requires additional fields, uncomment and bind them: */}
          {/* <label>
            Phone Number:
            <input
              type="tel"
              value={userData.phoneNumber || ''}
              onChange={e => setPhoneNumber(e.target.value)}
            />
          </label> */}
          {/* <label>
            Address:
            <input
              type="text"
              value={userData.address || ''}
              onChange={e => setAddress(e.target.value)}
            />
          </label> */}

          <button type="submit">Update Profile</button>
        </form>

        <div className="delete-account">
          <label>Account Management</label>
          <button
            onClick={() => {
              if (window.confirm('Delete your account?')) {
                fetch(`${API_BASE}/api/User/${userId}`, {
                  method: 'DELETE',
                  headers: getHeaders()
                }).then(r => {
                  if (r.ok) {
                    localStorage.removeItem('token');
                    window.location.href = '/preview';
                  } else {
                    alert('Delete failed.');
                  }
                });
              }
            }}
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
