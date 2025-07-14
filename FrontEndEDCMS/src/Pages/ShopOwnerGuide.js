import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import '../Styling/ownerguide.css';

const getToken = () => {
  const raw = localStorage.getItem('token') || localStorage.getItem('authToken');
  if (!raw || raw.trim() === '') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.token || parsed;
  } catch {
    return raw;
  }
};

const decodeRoleFromToken = (token) => {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
  } catch (err) {
    return null;
  }
};

const ShopOwnerGuide = () => {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate('/unauthorized');
      return;
    }

    const role = decodeRoleFromToken(token);
    if (role === 'Owner') {
      setAllowed(true);
    } else {
      navigate('/unauthorized');
    }
  }, []);

  if (!allowed) return null;

  return (
    <>
      <Navbar />
      <div className="owner-guide-container">
        <h1>Shop Owner Guide</h1>
        <p className="slogan">
        Welcome to the Owner's Guide — where your vision meets possibility. You’re not just running a shop, you’re shaping the future of how people discover fashion. Let’s make it legendary. </p>

        <section>
          <h2>Registering Your Shop</h2>
          <p>
            Once you log in, go to the Settings page and click “Register a New Business.” Fill in
            your shop’s name, description, location, and upload a profile and cover photo. Hit save!
          </p>
        </section>

        <section>
          <h2>Accessing Your Dashboard</h2>
          <p>
            Use the sidebar to access business settings, add products, manage employees, and update your public profile.
          </p>
        </section>

        <section>
          <h2>Managing Products</h2>
          <p>
            Add items under “Add New Products.” Include photos, sizes, colors, and quantities.
            Update or delete them any time under “Edit Current Products.”
          </p>
        </section>

        <section>
          <h2>Employee Management</h2>
          <p>
            You can promote users to employees using their email. This allows them to help manage the business on your behalf.
          </p>
        </section>

        <section>
          <h2>Branding Your Shop</h2>
          <p>
            Upload logos and cover photos to make your shop stand out on the platform. These will be visible on the public shop page.
          </p>
        </section>

        <section>
          <h2>Pending Changes & Reviews</h2>
          <p>
            Track any pending updates or changes that need approval before going live.
          </p>
        </section>

        <section>
          <h2>Visibility Tips</h2>
          <ul>
            <li>Update your stock frequently</li>
            <li>Upload clear, appealing photos</li>
            <li>Use categories and sizes accurately</li>
            <li>Keep your business description detailed and up-to-date</li>
          </ul>
        </section>

        <section>
          <h2>Need Help?</h2>
          <p>
            Reach out to our support team through the Contact page or email us at support@ed.al
          </p>
        </section>
      </div>
    </>
  );
};

export default ShopOwnerGuide;
