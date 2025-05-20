import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Styling/registerbusiness.css';

const API_BASE = 'http://77.242.26.150:8000/api';
const GCS_BUCKET = 'https://storage.googleapis.com/ecdms_bucked';

const getToken = () => {
  const raw = localStorage.getItem("token");
  if (!raw || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.token || parsed;
  } catch {
    return raw;
  }
};

const uploadImageToGCS = async (file) => {
  if (!file) return null;
  const timestamp = Date.now();
  const fileName = `${timestamp}-${file.name}`;
  const uploadUrl = `${GCS_BUCKET}/${fileName}`;
  const txtUrl = `${uploadUrl}.txt`;

  const imageRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!imageRes.ok) return null;

  const textRes = await fetch(txtUrl, {
    method: "PUT",
    headers: { "Content-Type": "text/plain" },
    body: uploadUrl,
  });
  if (!textRes.ok) return null;

  return uploadUrl;
};

function RegisterFormBusiness() {
  const [business, setBusiness] = useState({
    name: '',
    description: '',
    address: '',
    location: '',
    businessPhoneNumber: '',
    nipt: ''
  });

  const [profilePhoto, setProfilePhoto] = useState('');
  const [coverPhoto, setCoverPhoto] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setBusiness({ ...business, [e.target.name]: e.target.value });
  };

  const handleFileUpload = async (e, setPhoto) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const url = await uploadImageToGCS(file);
    if (url) setPhoto(url);
    else setError("Image upload failed.");
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (!profilePhoto || !coverPhoto) {
      setError("Both profile and cover photos are required.");
      setLoading(false);
      return;
    }

    const payload = {
      name: business.name,
      description: business.description,
      address: business.address,
      location: business.location,
      businessPhoneNumber: business.businessPhoneNumber,
      nipt: business.nipt,
      profilePhoto: [profilePhoto],
      coverPhoto: [coverPhoto],
      profilePictureUrl: profilePhoto,
      coverPictureUrl: coverPhoto
    };    

    try {
      const res = await fetch(`${API_BASE}/Business`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify(payload)
      });      

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Business registration failed.");
      }

      const created = await res.json();

      setSuccess("Business registered successfully.");

      setBusiness({
        name: '',
        description: '',
        address: '',
        location: '',
        businessPhoneNumber: '',
        nipt: ''
      });
      setProfilePhoto('');
      setCoverPhoto('');

      if (created.businessId) {
        navigate(`/shops/${created.businessId}`);
      } else {
        console.warn("No businessId returned, cannot redirect.");
      }

    } catch (err) {
      console.error(err);
      setError(err.message || "Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="register-business-form" onSubmit={handleSubmit}>
      <h2>Register a New Business</h2>

      <input type="text" name="name" placeholder="Business Name" required value={business.name} onChange={handleChange} />
      <textarea name="description" placeholder="Description" required value={business.description} onChange={handleChange} />
      <input type="text" name="address" placeholder="Address" required value={business.address} onChange={handleChange} />
      <input type="text" name="location" placeholder="Location" required value={business.location} onChange={handleChange} />
      <input type="text" name="businessPhoneNumber" placeholder="Phone Number" required value={business.businessPhoneNumber} onChange={handleChange} />
      <input type="text" name="nipt" placeholder="NIPT" required value={business.nipt} onChange={handleChange} />

      <label>Upload Profile Photo</label>
      <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setProfilePhoto)} />
      {profilePhoto && <img src={profilePhoto} alt="Profile Preview" width={100} style={{ marginBottom: 10 }} />}

      <label>Upload Cover Photo</label>
      <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setCoverPhoto)} />
      {coverPhoto && <img src={coverPhoto} alt="Cover Preview" width={150} style={{ marginBottom: 10 }} />}

      <button type="submit" disabled={loading}>{loading ? "Submitting..." : "Register Business"}</button>

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
    </form>
  );
}

export default RegisterFormBusiness;
