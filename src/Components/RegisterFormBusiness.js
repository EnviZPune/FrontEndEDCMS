import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../Styling/registerbusiness.css';
import Navbar from '../Components/Navbar';

const API_BASE   = 'http://77.242.26.150:8000/api';
const GCS_BUCKET = 'https://storage.googleapis.com/edcms_bucket';

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
    nipt: '',
    openingHours: '',
  });
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [coverPictureUrl, setCoverPictureUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenChecked, setTokenChecked] = useState(false); // control render after validation

  const navigate = useNavigate();
  const { search } = useLocation();
  const token = new URLSearchParams(search).get('token');

  useEffect(() => {
    if (!token) {
      setError('Missing access token. You must pay first.');
      setTokenValid(false);
      setTokenChecked(true);
      return;
    }

    fetch(`${API_BASE}/payment/validate-token?token=${token}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setTokenValid(data.valid);
      })
      .catch(() => {
        setError('Token expired or invalid.');
        setTokenValid(false);
      })
      .finally(() => setTokenChecked(true));
  }, [token]);

  const handleChange = (e) => {
    setBusiness((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleFileUpload = async (e, setter) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const url = await uploadImageToGCS(file);
      if (!url) throw new Error();
      setter(url);
    } catch {
      setError('Image upload failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!profilePictureUrl || !coverPictureUrl) {
      setError('Both profile and cover photos are required.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...business,
        profilePictureUrl,
        coverPictureUrl,
      };

      const url = `${API_BASE}/Business?token=${encodeURIComponent(token)}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
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
        nipt: '',
        openingHours: '',
      });
      setProfilePictureUrl('');
      setCoverPictureUrl('');

      setTimeout(() => {
        navigate(`/shops/${created.businessId}`);
      }, 1000);
    } catch (err) {
      setError(err.message || 'Unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Navbar />
      <div className="register-business-form-container">
        {!tokenChecked ? (
          <p>Validating token...</p>
        ) : tokenValid ? (
          <form className="register-business-form" onSubmit={handleSubmit}>
            <h2>Register a New Business</h2>

            {[
              ['name', true, 'Business Name'],
              ['description', false, 'Description'],
              ['address', true, 'Address'],
              ['location', false, 'Location'],
              ['businessPhoneNumber', false, 'Phone Number'],
              ['nipt', false, 'NIPT'],
              ['openingHours', false, 'Opening Hours'],
            ].map(([field, req, placeholder]) => (
              <input
                key={field}
                name={field}
                type="text"
                placeholder={placeholder}
                required={!!req}
                value={business[field]}
                onChange={handleChange}
              />
            ))}

            <label>Profile Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e, setProfilePictureUrl)}
            />

            <label>Cover Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e, setCoverPictureUrl)}
            />

            <button type="submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Register Business'}
            </button>

            {error && <p className="error">{error}</p>}
            {success && <p className="success">{success}</p>}
          </form>
        ) : (
          <div>
            <p className="error">{error || 'Access denied.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default RegisterFormBusiness;
