import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Styling/registerbusiness.css';
import Navbar from '../Components/Navbar';
import { parseToken } from '../utils/parseToken';

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

    const textRes = await fetch(txtUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "text/plain",
      },
      body: uploadUrl,
    });

    if (!textRes.ok) throw new Error("Text file upload failed");

    return uploadUrl;
  } catch (err) {
    console.error("Upload error:", err);
    return null;
  }
};

const RegisterBusinessForm = () => {
  const [businessData, setBusinessData] = useState({
    name: '',
    description: '',
    nipt: '',
    address: '',
    location: '',
    openingHours: '',
    businessPhoneNumber: ''
  });
  const [coverPicture, setCoverPicture] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setBusinessData({ ...businessData, [e.target.name]: e.target.value });
  };

  const handleFileUpload = async (e, setter) => {
    const file = e.target.files[0];
    if (file) {
      const url = await uploadImageToGCS(file);
      if (url) setter(url);
      else alert('Failed to upload image.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const token = localStorage.getItem('token');
    if (!token) {
      setError("You must be logged in to create a business.");
      return;
    }

    const tokenParsed = parseToken(token);

    try {
      const response = await fetch('http://77.242.26.150:8000/api/Business', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenParsed}`
        },
        body: JSON.stringify({
          name: businessData.name,
          description: businessData.description,
          NIPT: businessData.nipt,
          Address: businessData.address,
          Location: businessData.location,
          OpeningHours: businessData.openingHours,
          BusinessPhoneNumber: businessData.businessPhoneNumber,
          CoverPictureUrl: coverPicture,
          ProfilePictureUrl: profilePicture
        })
      });

      if (response.status === 401) {
        setError("Your session has expired or you are unauthorized. Please log in again.");
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Server returned status ${response.status}`);
      }

      const data = await response.json();
      navigate(`/shops/name/${data.businessId}`);
    } catch (error) {
      console.error('Error creating shop:', error);
      setError(error.message);
    }
  };

  return (
    <div>
      <Navbar />
      <div className="register-business-form-container">
        <h2>Create Your Shop</h2>
        <form onSubmit={handleSubmit} className="register-business-form">
          <input type="text" name="name" placeholder="Shop Name" value={businessData.name} onChange={handleChange} required />
          <textarea name="description" placeholder="Shop Description" value={businessData.description} onChange={handleChange} required></textarea>
          <input type="text" name="nipt" placeholder="NIPT" value={businessData.nipt} onChange={handleChange} required />
          <input type="text" name="address" placeholder="Address" value={businessData.address} onChange={handleChange} required />
          <input type="text" name="location" placeholder="Location" value={businessData.location} onChange={handleChange} required />
          <input type="text" name="openingHours" placeholder="Opening Hours" value={businessData.openingHours} onChange={handleChange} required />

          <label htmlFor="cover-picture">Upload A Cover Picture</label>
          <input type="file" id="cover-picture" accept="image/*" onChange={(e) => handleFileUpload(e, setCoverPicture)} required />

          <label htmlFor="profile-picture">Upload A Profile Picture</label>
          <input type="file" id="profile-picture" accept="image/*" onChange={(e) => handleFileUpload(e, setProfilePicture)} required />

          <input type="text" name="businessPhoneNumber" placeholder="Business Phone Number" value={businessData.businessPhoneNumber} onChange={handleChange} required />
          <button type="submit" className="submit-button">Create Shop</button>
          {error && <p className="error-message">{error}</p>}
        </form>
      </div>
    </div>
  );
};

export default RegisterBusinessForm;
