import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Styling/registerbusiness.css';

const API_BASE = 'http://77.242.26.150:8000/api';
const GCS_BUCKET = 'https://storage.googleapis.com/ecdms_bucked';

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

const uploadImageToGCS = async (file) => {
  if (!file) return null;
  const timestamp = Date.now();
  const fileName = `${timestamp}-${file.name}`;
  const uploadUrl = `${GCS_BUCKET}/${fileName}`;
  const txtUrl = `${uploadUrl}.txt`;

  const imageRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!imageRes.ok) return null;

  await fetch(txtUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: uploadUrl,
  });

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
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [coverPictureUrl, setCoverPictureUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setBusiness({ ...business, [e.target.name]: e.target.value });
  };

  const handleFileUpload = async (e, setUrl) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const url = await uploadImageToGCS(file);
    if (url) setUrl(url);
    else setError('Image upload failed.');
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (!profilePictureUrl || !coverPictureUrl) {
      setError('Both profile and cover photos are required.');
      setLoading(false);
      return;
    }

    const payload = {
      ...business,
      profilePictureUrl,
      coverPictureUrl
    };

    try {
      const res = await fetch(`${API_BASE}/Business`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Business registration failed.');
      }

      const created = await res.json();
      setSuccess('Business registered successfully.');

      setBusiness({
        name: '',
        description: '',
        address: '',
        location: '',
        businessPhoneNumber: '',
        nipt: ''
      });
      setProfilePictureUrl('');
      setCoverPictureUrl('');

      if (created.businessId) {
        navigate(`/shops/${created.businessId}`);
      } else {
        console.warn('No businessId returned, cannot redirect.');
      }

    } catch (err) {
      setError(err.message || 'Unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-business-form-container">
      <form className="register-business-form" onSubmit={handleSubmit}>
        <h2>Register a New Business</h2>
        {['name', 'description', 'address', 'location', 'businessPhoneNumber', 'nipt'].map(field => (
          <input
            key={field}
            type="text"
            name={field}
            placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
            required
            value={business[field]}
            onChange={handleChange}
          />
        ))}
        <label>Profile Photo</label>
        <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setProfilePictureUrl)} />
        <label>Cover Photo</label>
        <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setCoverPictureUrl)} />
        <button type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Register Business'}</button>
        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}
      </form>
    </div>
  );
}

export default RegisterFormBusiness;