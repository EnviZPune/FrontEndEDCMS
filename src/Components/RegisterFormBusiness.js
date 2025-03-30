import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Styling/registerbusiness.css';
import Navbar from '../Components/Navbar';
import { parseToken } from '../utils/parseToken';

const RegisterBusinessForm = () => {
    const [businessData, setBusinessData] = useState({
        name: '',
        description: '',
        nipt: '',
        address: '',
        location: '',
        openingHours: '',
        coverPictureUrl: '',
        profilePictureUrl: '',
        businessPhoneNumber: ''
    });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleChange = (e) => {
        setBusinessData({ ...businessData, [e.target.name]: e.target.value });
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
          const response = await fetch('https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/Business', {
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
              CoverPictureUrl: businessData.coverPictureUrl,
              ProfilePictureUrl: businessData.profilePictureUrl,
              BusinessPhoneNumber: businessData.businessPhoneNumber
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
                    <input
                        type="text"
                        name="name"
                        placeholder="Shop Name"
                        value={businessData.name}
                        onChange={handleChange}
                        required
                    />
                    <textarea
                        name="description"
                        placeholder="Shop Description"
                        value={businessData.description}
                        onChange={handleChange}
                        required
                    ></textarea>
                    <input
                        type="text"
                        name="nipt"
                        placeholder="NIPT"
                        value={businessData.nipt}
                        onChange={handleChange}
                        required
                    />
                    <input
                        type="text"
                        name="address"
                        placeholder="Address"
                        value={businessData.address}
                        onChange={handleChange}
                        required
                    />
                    <input
                        type="text"
                        name="location"
                        placeholder="Location"
                        value={businessData.location}
                        onChange={handleChange}
                        required
                    />
                    <input
                        type="text"
                        name="openingHours"
                        placeholder="Opening Hours"
                        value={businessData.openingHours}
                        onChange={handleChange}
                        required
                    />
                    <label for="cover-picture">Upload A Cover Picture</label>
                    <input
                        type="file"
                        name="coverPictureUrl"
                        placeholder="Cover Picture"
                        value={businessData.coverPictureUrl}
                        onChange={handleChange}
                        id='cover-picture'
                        required
                    />
                    <label for="profile-picture">Upload A Profile Picture</label>
                    <input
                        type="file"
                        name="profilePictureUrl"
                        placeholder="Profile Picture"
                        value={businessData.profilePictureUrl}
                        onChange={handleChange}
                        id='profile-picture'
                        required
                    />
                    <input
                        type="text"
                        name="businessPhoneNumber"
                        placeholder="Business Phone Number"
                        value={businessData.businessPhoneNumber}
                        onChange={handleChange}
                        required
                    />
                    <button type="submit" className="submit-button">
                        Create Shop
                    </button>
                    {error && <p className="error-message">{error}</p>}
                </form>
            </div>
        </div>
    );
};

export default RegisterBusinessForm;
