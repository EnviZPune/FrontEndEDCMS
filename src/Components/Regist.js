import React, { useState } from 'react';
import '../Styling/regist.css';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

function RegisterFormUser() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    username: '',
    phoneNumber: '',
    email: '',
    createPassword: '',
    confirmPassword: '',
    profilePictureUrl: '',
    role: '2' // Default to Owner
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;
    const uploadUrl = `https://storage.googleapis.com/ecdms_bucked/${fileName}`;
    const txtUrl = `https://storage.googleapis.com/ecdms_bucked/${fileName}.txt`;

    try {
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!res.ok) throw new Error('Image upload failed');

      await fetch(txtUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: uploadUrl,
      });

      setFormData((prev) => ({ ...prev, profilePictureUrl: uploadUrl }));
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Failed to upload image.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const requiredFields = [
      'firstName', 'lastName', 'dateOfBirth', 'username',
      'phoneNumber', 'email', 'createPassword', 'confirmPassword'
    ];
    for (let field of requiredFields) {
      if (!formData[field]) {
        setError(`Please fill in all fields. Missing: ${field}`);
        setLoading(false);
        return;
      }
    }

    if (formData.createPassword !== formData.confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const roleMap = {
      '0': 0, // BusinessOwner
      '1': 1, // Employee
      '2': 2  // User
    };

    const requestBody = {
      name: `${formData.firstName} ${formData.lastName}`,
      username: formData.username,
      email: formData.email,
      password: formData.createPassword,
      role: roleMap[formData.role],
      telephoneNumber: formData.phoneNumber,
      profilePictureUrl: formData.profilePictureUrl
    };

    try {
      const response = await fetch('http://77.242.26.150:8000/api/Register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "An error occurred while registering.");
      }

      // Send email confirmation
      const confirmRes = await fetch('http://77.242.26.150:8000/api/Auth/send-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: formData.email })
      });

      if (!confirmRes.ok) {
        const errorText = await confirmRes.text();
        console.warn("Email confirmation request failed:", errorText);
      }

      setSuccess("User registered successfully! Please check your email to verify your account.");
      setFormData({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        username: '',
        phoneNumber: '',
        email: '',
        createPassword: '',
        confirmPassword: '',
        profilePictureUrl: '',
        role: '2'
      });

      window.location.href = "http://localhost:3000/login";
    } catch (err) {
      setError(err.message || "An error occurred while registering.");
      setLoading(false);
    }
  };

  const handleGoogleRegisterSuccess = async (credentialResponse) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://77.242.26.150:8000/api/GoogleRegister', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential })
      });

      if (!response.ok) {
        throw new Error("Google registration failed on the server.");
      }

      const data = await response.json();
      const decoded = jwtDecode(data.token || data);
      console.log("Decoded token:", decoded);

      localStorage.setItem('token', JSON.stringify(data));
      window.location.href = 'http://localhost:3000/preview';
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleGoogleRegisterError = () => {
    setError("Google registration failed. Please try again.");
  };

  return (
    <form onSubmit={handleSubmit} className="register_main_div">
      <div className="register_user">
        <a href="http://localhost:3000">
          <img src="Assets/logo.png" id="logo_ed" alt="logo" />
        </a>
        <h5 id="h_register">- Establish a New Profile -</h5>
        <div id='underline_regist1'></div>
        <p id="regist_b_u">Please fill the registration form!</p>

        <div className="form-section">
          <input type="text" name="firstName" placeholder="Firstname" required value={formData.firstName} onChange={handleInputChange} />
          <input type="text" name="lastName" placeholder="Lastname" required value={formData.lastName} onChange={handleInputChange} />
          <input type="date" name="dateOfBirth" required value={formData.dateOfBirth} onChange={handleInputChange} />
          <input type="text" name="username" placeholder="Set Username" required value={formData.username} onChange={handleInputChange} />
          <input type="tel" name="phoneNumber" placeholder='Phone Number (e.g. 0691234567)' pattern="^\d{10}$" required value={formData.phoneNumber} onChange={handleInputChange} />
          <input type="email" name="email" placeholder="Email" required value={formData.email} onChange={handleInputChange} />
          <input type="password" name="createPassword" placeholder="Create a Password" required value={formData.createPassword} onChange={handleInputChange} />
          <input type="password" name="confirmPassword" placeholder="Confirm Password" required value={formData.confirmPassword} onChange={handleInputChange} />
          <label htmlFor="profilePicture" style={{ marginTop: '10px', fontWeight: 'bold' }}>
          </label>
          <input
            type="file"
            accept="image/*"
            id="profilePicture"
            onChange={handleImageUpload}
            style={{ marginBottom: '10px' }}
          />
          {formData.profilePictureUrl && (
            <div style={{ marginBottom: '10px' }}>
              <p style={{ fontSize: '14px' }}>Preview:</p>
              <img
                src={formData.profilePictureUrl}
                alt="Profile Preview"
                style={{
                  width: '100px',
                  height: '100px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: '1px solid #ccc'
                }}
              />
            </div>
          )}
        </div>

        <button id="button_register" type="submit" disabled={loading}>
          {loading ? 'Registering...' : 'Done'}
        </button>

        <div className="google-login-container">
          <GoogleLogin
            onSuccess={handleGoogleRegisterSuccess}
            onError={handleGoogleRegisterError}
          />
        </div>

        {error && <p id="error">{error}</p>}
        {success && <p id="success">{success}</p>}
      </div>
    </form>
  );
}

export default RegisterFormUser;
