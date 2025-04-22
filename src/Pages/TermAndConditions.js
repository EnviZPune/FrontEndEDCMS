import React from 'react';
import Navbar from '../Components/Navbar';
import '../Styling/policy.css';

const TermsAndConditions = () => {
  return (
    <>
      <Navbar />
      <div className="policy-container">
        <h1>Terms & Conditions</h1>

        <p>
          Welcome to <strong>E & D</strong>. By accessing or using our website and services, you agree to be bound
          by the following terms and conditions. Please read them carefully.
        </p>

        <h2>1. Acceptance of Terms</h2>
        <p>
          By registering, browsing, or using our platform in any way, you acknowledge that you have read, understood,
          and agreed to comply with these Terms of Use and all applicable laws and regulations.
        </p>

        <h2>2. Service Description</h2>
        <p>
          E & D provides a real-time listing of physical clothing shop inventories. We do not sell or ship products
          ourselves — we serve as an informational platform that connects customers with verified clothing businesses.
        </p>

        <h2>3. User Responsibilities</h2>
        <ul>
          <li>You agree to use the platform only for lawful purposes.</li>
          <li>You are responsible for the accuracy of any data you submit.</li>
          <li>You may not impersonate others or misuse the platform in any way.</li>
        </ul>

        <h2>4. Business Registration</h2>
        <p>
          All businesses displayed on E & D are registered independently by their owners. E & D reserves the right to
          verify, approve, suspend, or remove any business profile at our discretion.
        </p>

        <h2>5. Intellectual Property</h2>
        <p>
          All content on this platform, including logos, text, design, and layout, is the intellectual property of E & D
          and may not be used without written permission.
        </p>

        <h2>6. Limitation of Liability</h2>
        <p>
          E & D is not liable for any direct or indirect damages arising from your use of the platform. We are not
          responsible for any product issues, transactions, or disputes between customers and shop owners.
        </p>

        <h2>7. Modifications</h2>
        <p>
          We reserve the right to modify these terms at any time. Continued use of the site after changes constitutes
          your acceptance of the new terms.
        </p>

        <h2>8. Termination</h2>
        <p>
          E & D may suspend or terminate your access to the platform at any time, without notice, for any violation of
          these terms.
        </p>

        <h2>9. Contact Us</h2>
        <p>
          For any questions regarding these Terms & Conditions, please contact our team at{' '}
          <strong>support@edshopping.al</strong>.
        </p>
      </div>
    </>
  );
};

export default TermsAndConditions;
