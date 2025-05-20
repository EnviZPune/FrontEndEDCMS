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
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!imageRes.ok) throw new Error("Image upload failed");

    const txtRes = await fetch(txtUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
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
  let userId = null;
  if (token) {
    try {
      const decoded = jwtDecode(token);
      userId = decoded.UserId || decoded.id || decoded.sub;
    } catch (err) {
      console.error("JWT decode error:", err);
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
        const res = await fetch(`http://77.242.26.150:8000/api/User/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("User not found.");
        const data = await res.json();

        setUserData(data);
        setUsername(data.name || '');
        setEmail(data.email || '');
        setBio(data.bio || '');
        setBirthday(data.birthday ? data.birthday.split('T')[0] : '');
        setProfileImage(data.profileImage || '');
        setImagePreviewUrl(data.profileImage || '');
        setWordCount(data.bio ? data.bio.split(/\s+/).filter(Boolean).length : 0);
      } catch (err) {
        console.error("Fetch error:", err);
      }
    };

    if (userId) fetchUserData();
  }, [userId, token]);

  const handleBioChange = (e) => {
    const words = e.target.value.split(/\s+/).filter(Boolean);
    if (words.length <= 100) {
      setBio(words.join(" "));
      setWordCount(words.length);
    } else {
      alert("Bio cannot exceed 100 words.");
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await uploadImageToGCS(file);
    if (url) {
      setProfileImage(url);
      setImagePreviewUrl(url);
    } else {
      alert("Image upload failed.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const updatedUser = {
      name: username,
      email,
      bio,
      birthday,
      profileImage,
      ...(password && { password })
    };

    try {
      const res = await fetch(`http://77.242.26.150:8000/api/User/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updatedUser)
      });
      if (!res.ok) throw new Error("Update failed");
      alert("Profile updated successfully!");
    } catch (err) {
      console.error("Update error:", err);
      alert("Update failed.");
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm("Are you sure you want to delete your account?");
    if (!confirmed) return;
    try {
      const res = await fetch(`http://77.242.26.150:8000/api/User/${userId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Delete failed");
      localStorage.removeItem("token");
      window.location.href = "/preview";
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete account.");
    }
  };

  if (!userData) return <div>Loading...</div>;

  return (
    <div>
      <Navbar />
      <div className="settings-container">
        <form onSubmit={handleSubmit}>
          <label>Profile Image:
            <input type="file" onChange={handleImageChange} />
            {imagePreviewUrl && (
              <img src={imagePreviewUrl} alt="Preview" style={{
                width: "100px",
                height: "100px",
                position: "relative",
                left: "460px",
                bottom: "90px"
              }} />
            )}
          </label>
          <label>Username:
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} />
          </label>
          <label>Password:
            <input type="password" placeholder="Leave blank to keep current password" value={password} onChange={e => setPassword(e.target.value)} />
          </label>
          <label>Email:
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label>Birthday:
            <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} />
          </label>
          <label>Bio:
            <textarea value={bio} onChange={handleBioChange} />
            <div className="word-count">{wordCount}/100</div>
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
