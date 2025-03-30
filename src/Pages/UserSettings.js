import React, { useState, useEffect } from 'react';
import "../Styling/usersettings.css";
import Navbar from '../Components/Navbar';
import {jwtDecode} from 'jwt-decode'; // Changed to default import

const SettingsPage = () => {
  const token = localStorage.getItem("token");
  let userId;
  if (token) {
    try {
      const decoded = jwtDecode(token);
      // Adjust this property if needed (e.g., decoded.id or decoded.sub)
      userId = decoded.UserId || decoded.id || decoded.sub;
    } catch (err) {
      console.error("Error decoding token:", err);
    }
  }

  // Local states for user fields
  const [userData, setUserData] = useState(null);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [password, setPassword] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [wordCount, setWordCount] = useState(0);

  // Fetch user data on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch(`https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/User/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) {
          throw new Error(`Error fetching user data: ${response.status}`);
        }
        const data = await response.json();
        setUserData(data);
        setUsername(data.name || '');
        setBio(data.bio || '');
        setEmail(data.email || '');
        setPassword(data.password || '');
        // Remove redundant call; use this line only:
        setBirthday(data.birthday ? data.birthday.split('T')[0] : '');
        setProfileImage(data.profileImage || '');
        setImagePreviewUrl(data.profileImage || '');
        setWordCount(data.bio ? data.bio.split(/\s+/).filter(Boolean).length : 0);
      } catch (error) {
        console.error(error);
      }
    };

    if (userId) {
      fetchUserData();
    }
  }, [userId, token]);

  // Handler for image selection
  const handleImageChange = (e) => {
    e.preventDefault();
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImage(file);
      setImagePreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Handler for bio change with word count enforcement
  const handleBioChange = (event) => {
    const words = event.target.value.split(/\s+/).filter(Boolean);
    if (words.length <= 100) {
      setBio(words.join(" "));
      setWordCount(words.length);
    } else {
      alert('Bio cannot exceed 100 words.');
    }
  };

  // Handler for form submission to update user data
  const handleSubmit = async (e) => {
    e.preventDefault();
    const updatedUser = {
      name: username,
      bio: bio,
      email: email,
      birthday: birthday,
      // Only include password if it was provided (for updating)
      ...(password && { password: password }),
      profileImage: imagePreviewUrl,
    };

    try {
      const response = await fetch(`https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/User/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updatedUser)
      });
      if (!response.ok) {
        throw new Error(`Error updating profile: ${response.status}`);
      }
      const data = await response.json();
      console.log('Updated User:', data);
      alert('Profile updated successfully!');
      setUserData(data);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile');
    }
  };

  // Handler for deleting the user account
const handleDeleteAccount = async () => {
  const confirmDelete = window.confirm("Are you sure you want to delete this account?");
  if (confirmDelete) {
    try {
      const parsedRes= await JSON.parse(token);
      console.log("Deleting account for userId:", userId);
      console.log("Using token:", parsedRes.token);
      
      const response = await fetch(`https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/User/${userId}`, {
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

  if (!userData) {
    return <div>Loading...</div>;
  }

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
          <label>
            Username:
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} />
          </label>
          <label>
            Password:
            <input
              type="password"
              placeholder="Leave blank if you don't want to change your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </label>
          <label>
            Bio:
            <textarea value={bio} onChange={handleBioChange} />
            <div className="word-count">
              {wordCount}/100
            </div>
          </label>
          <label>
            Email:
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label>
            Birthday:
            <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} />
          </label>
          <button type="submit">Update Profile</button>
        </form>
        <div className="delete-account">
          <label>
            Account Managment
          <button type="button" onClick={handleDeleteAccount}>Delete Account</button>
          </label>
         
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
