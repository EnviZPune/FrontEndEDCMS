import React, { useState, useEffect } from 'react';
import "../Styling/usersettings.css";
import Navbar from '../Components/Navbar';
import { jwtDecode } from 'jwt-decode';

const uploadImageToGCS = async (file) => {
  if (!file) return null;
  const timestamp = Date.now();
  const fileName = `${timestamp}-${file.name}`;
  const uploadUrl = `https://storage.googleapis.com/ecdms_bucked/${fileName}`;
  const txtUrl = `${uploadUrl}.txt`;

  try {
    const imageRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
      },
      body: file,
    });

    if (!imageRes.ok) throw new Error("Image upload failed");

    const txtRes = await fetch(txtUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "text/plain",
      },
      body: uploadUrl,
    });

    if (!txtRes.ok) throw new Error("Text file upload failed");

    return uploadUrl;
  } catch (err) {
    console.error("Upload error:", err);
    return null;
  }
};

const SettingsPage = () => {
  const token = localStorage.getItem("token");
  let userId;
  if (token) {
    try {
      const decoded = jwtDecode(token);
      userId = decoded.UserId || decoded.id || decoded.sub;
    } catch (err) {
      console.error("Error decoding token:", err);
    }
  }

  const [userData, setUserData] = useState(null);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [password, setPassword] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch(`http://77.242.26.150:8000/api/User/${userId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error(`Error fetching user data: ${response.status}`);
        const data = await response.json();
        setUserData(data);
        setUsername(data.name || '');
        setBio(data.bio || '');
        setEmail(data.email || '');
        setPassword(data.password || '');
        setBirthday(data.birthday ? data.birthday.split('T')[0] : '');
        setProfileImage(data.profileImage || '');
        setImagePreviewUrl(data.profileImage || '');
        setWordCount(data.bio ? data.bio.split(/\s+/).filter(Boolean).length : 0);
      } catch (error) {
        console.error(error);
      }
    };
    if (userId) fetchUserData();
  }, [userId, token]);

  const handleImageChange = async (e) => {
    e.preventDefault();
    const file = e.target.files[0];
    if (!file) return;

    const url = await uploadImageToGCS(file);
    if (url) {
      setProfileImage(url);
      setImagePreviewUrl(url);
    } else {
      alert("Failed to upload image.");
    }
  };

  const handleBioChange = (event) => {
    const words = event.target.value.split(/\s+/).filter(Boolean);
    if (words.length <= 100) {
      setBio(words.join(" "));
      setWordCount(words.length);
    } else {
      alert('Bio cannot exceed 100 words.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const updatedUser = {
      name: username,
      bio,
      email,
      birthday,
      ...(password && { password }),
      profileImage
    };

    try {
      const response = await fetch(`http://77.242.26.150:8000/api/User/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updatedUser)
      });
      if (!response.ok) throw new Error(`Error updating profile: ${response.status}`);
      const data = await response.json();
      alert('Profile updated successfully!');
      setUserData(data);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile');
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm("Are you sure you want to delete this account?");
    if (confirmDelete) {
      try {
        const parsedRes = JSON.parse(token);
        await fetch(`http://77.242.26.150:8000/api/User/${userId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${parsedRes.token}`,
          }
        });
        localStorage.removeItem("token");
        alert('Your account has been deleted.');
        window.location.href = '/preview';
      } catch (error) {
        console.error('Error deleting account:', error);
        alert(`Error deleting account: ${error.message}`);
      }
    }
  };

  if (!userData) return <div>Loading...</div>;

  return (
    <div>
      <Navbar />
      <div className="settings-container">
        <form onSubmit={handleSubmit}>
          <label id="label-profile-picture">
            Profile Image:
            <input type="file" id="profile-picture-input" onChange={handleImageChange} />
            {imagePreviewUrl && (
              <img
                src={imagePreviewUrl}
                alt="Profile Preview"
                style={{
                  width: '100px',
                  height: '100px',
                  position: "relative",
                  left: "460px",
                  bottom: "90px"
                }}
              />
            )}
          </label>
          <label>Username:
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} />
          </label>
          <label>Password:
            <input
              type="password"
              placeholder="Leave blank if you don't want to change your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </label>
          <label>Bio:
            <textarea value={bio} onChange={handleBioChange} />
            <div className="word-count">{wordCount}/100</div>
          </label>
          <label>Email:
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label>Birthday:
            <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} />
          </label>
          <button type="submit">Update Profile</button>
        </form>
        <div className="delete-account">
          <label>Account Management</label>
          <button type="button" onClick={handleDeleteAccount}>Delete Account</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
