import React from 'react';
import Navbar from '../Components/Navbar';
import '../Styling/policy.css'; // use the same styling for consistent layout

const PrivacyPolicy = () => {
  return (
    <>
      <Navbar />
      <div className="policy-container">
        <h1>Privacy Policy</h1>
        <p><strong>Last Updated: April 2025</strong></p>

        <p>
          At <strong>E & D</strong>, your privacy is important to us. This Privacy Policy explains
          how we collect, use, and protect your personal information when you use our platform.
        </p>

        <h2>Information We Collect</h2>
        <ul>
          <li><strong>Account Information:</strong> Name, email address, password, and profile picture.</li>
          <li><strong>Business Information:</strong> Shop name, location, inventory, and contact details.</li>
          <li><strong>Usage Data:</strong> Pages visited, search queries, and interactions with the site.</li>
        </ul>

        <h2>How We Use Your Information</h2>
        <ul>
          <li>To display accurate product availability in nearby stores.</li>
          <li>To improve user experience through analytics and personalization.</li>
          <li>To communicate updates, changes, or promotions.</li>
        </ul>

        <h2>Data Protection</h2>
        <p>
          All personal data is stored securely and only accessed by authorized personnel. We do not sell or
          share your information with third parties unless required by law.
        </p>

        <h2>Your Rights</h2>
        <ul>
          <li>You can request to view, update, or delete your personal data at any time.</li>
          <li>You can opt-out of marketing communications via your profile settings.</li>
        </ul>

        <h2>Contact Us</h2>
        <p>
          If you have any questions about this policy or our practices, feel free to reach out at: 
          <strong> contact@edshopping.al</strong>
        </p>

        <p>By using E & D, you agree to this Privacy Policy.</p>
      </div>
    </>
  );
};

export default PrivacyPolicy;
