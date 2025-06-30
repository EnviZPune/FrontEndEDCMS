import React, { useState, useEffect } from "react";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "../Styling/usersettings.css";

const API_BASE = "http://77.242.26.150:8000";

// GCS upload helper unchanged
const uploadImageToGCS = async (file) => {
  if (!file) return null;
  const timestamp = Date.now();
  const fileName  = `${timestamp}-${file.name}`;
  const uploadUrl = `https://storage.googleapis.com/edcms_bucket/${fileName}`;
  const txtUrl    = `${uploadUrl}.txt`;

  try {
    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    await fetch(txtUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: uploadUrl,
    });
    return uploadUrl;
  } catch (err) {
    console.error("Upload error:", err);
    return null;
  }
};

export default function UserSettings() {
  const [profile, setProfile] = useState({
    userId:            null,
    name:              "",
    email:             "",
    telephoneNumber:   "",
    profilePictureUrl: "",
  });
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError]                     = useState("");
  const [success, setSuccess]                 = useState("");

  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    Authorization:  `Bearer ${token}`,
  };

  // Load user
  useEffect(() => {
    fetch(`${API_BASE}/api/User/me`, { headers })
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(dto => {
        setProfile({
          userId:            dto.userId,
          name:              dto.name,
          email:             dto.email,
          telephoneNumber:   dto.telephoneNumber || "",
          profilePictureUrl: dto.profilePictureUrl || "",
        });
      })
      .catch(err => {
        console.error("Failed to load profile:", err);
        setError("Could not load profile.");
      });
  }, []);

  // Handlers
  const handleImageChange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await uploadImageToGCS(file);
    if (url) setProfile(p => ({ ...p, profilePictureUrl: url }));
    else    setError("Image upload failed.");
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(""); setSuccess("");

    if (newPassword && newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const payload = {
      userId:            profile.userId,
      name:              profile.name,
      email:             profile.email,
      telephoneNumber:   profile.telephoneNumber,
      profilePictureUrl: profile.profilePictureUrl,
      ...(newPassword ? { password: newPassword } : {}),
    };

    try {
      const res = await fetch(
        `${API_BASE}/api/User/${profile.userId}`,
        { method: "PUT", headers, body: JSON.stringify(payload) }
      );
      if (!res.ok) throw new Error();
      setSuccess("Profile updated!");
      setNewPassword(""); setConfirmPassword("");
    } catch {
      setError("Update failed.");
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Delete account?")) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/User/${profile.userId}`,
        { method: "DELETE", headers }
      );
      if (!res.ok) throw new Error();
      window.location.href = "/login";
    } catch {
      alert("Delete failed.");
    }
  };

  return (
    <>
      <Navbar />
      <div className="user-settings-panel">
        <h2>My Profile</h2>
        {error   && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}

        <form onSubmit={handleSubmit}>
          {/* Profile Picture */}
          <label>
            Profile Picture
            <div className="preview-container">
              {profile.profilePictureUrl && (
                <img
                  className="profile-preview"
                  src={profile.profilePictureUrl}
                  alt="Profile preview"
                />
              )}
            </div>
            <input type="file" accept="image/*" onChange={handleImageChange}/>
          </label>

          {/* Name */}
          <label>
            Name
            <input
              type="text"
              value={profile.name}
              onChange={e => setProfile({ ...profile, name: e.target.value })}
              required
            />
          </label>

          {/* Email */}
          <label>
            Email
            <input
              type="email"
              value={profile.email}
              onChange={e => setProfile({ ...profile, email: e.target.value })}
              required
            />
          </label>

          {/* Telephone */}
          <label>
            Telephone
            <input
              type="tel"
              value={profile.telephoneNumber}
              onChange={e => setProfile({ ...profile, telephoneNumber: e.target.value })}
            />
          </label>

          {/* Password */}
          <label>
            New Password
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </label>
          <label>
            Confirm Password
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </label>

          <button type="submit" className="save-button">
            Save Changes
          </button>
        </form>

        <div className="delete-account-section">
          <h3>Delete Account</h3>
          <button
            className="delete-account-button"
            onClick={handleDeleteAccount}
          >
            Delete My Account
          </button>
        </div>
      </div>
      <Footer />
    </>
  );
}
