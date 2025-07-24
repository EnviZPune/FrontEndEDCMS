import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import '../Styling/termsandconditions.css';

const TermsAndConditions = () => {
  return (
    <>
      <Navbar />
      <div className="policy-container">
        <h1>Terms & Conditions</h1>

        <p>
          Welcome to <strong>E &amp; D</strong> ("we", "us", "our"). By accessing or using our website at <em>edshopping.al</em> and related services, you agree to be bound by these Terms &amp; Conditions.
        </p>

        <h2>1. Acceptance of Terms</h2>
        <p>
          By registering, browsing, or using our platform, you acknowledge that you have read, understood, and agree to comply with these Terms &amp; Conditions and all applicable laws and regulations.
        </p>

        <h2>2. Service Overview</h2>
        <p>
          E &amp; D provides a real-time listing and search interface for physical clothing shop inventories. We do not sell or ship products ourselves; instead, we connect customers with verified shop owners via features such as search, maps, and category filters.
        </p>

        <h2>3. User Accounts</h2>
        <ul>
          <li>You must be at least 18 years old to register.</li>
          <li>Registration requires a valid email. You are responsible for maintaining the security of your account and password.</li>
          <li>Notify us immediately of any unauthorized use or security breach.</li>
        </ul>

        <h2>4. Subscription &amp; Payments</h2>
        <p>
          Shop owners subscribe via our sandbox payment system at <Link to="/become-owner">Become Owner</Link> for a recurring fee of $20/month. Payments are handled through Stripe. Subscriptions renew automatically until canceled. You may cancel anytime via the <Link to="/settings">Settings</Link> dashboard under <em>Delete Business</em>. No refunds for partial periods.
        </p>

        <h2>5. Owner Dashboard</h2>
        <p>
          Once subscribed, owners access the <em>Settings</em> dashboard to manage:
        </p>
        <ul>
          <li><strong>Business Info:</strong> Name, description, address, phone, hours.</li>
          <li><strong>Products:</strong> Add/edit/delete items with up to 10 images each.</li>
          <li><strong>Categories:</strong> Create, assign colors/icons, filter products.</li>
          <li><strong>Photos:</strong> Upload cover images and logos (via Google Cloud Storage).</li>
          <li><strong>Employees:</strong> Promote users to employees who can propose changes.</li>
          <li><strong>Pending Changes:</strong> Approve or reject employee submissions.</li>
          <li><strong>Reservations:</strong> View and manage customer reservation requests.</li>
          <li><strong>Notifications:</strong> Review all system notifications and alerts.</li>
          <li><strong>My Shops:</strong> Switch between multiple shop profiles.</li>
          <li><strong>Delete Business:</strong> Permanently remove your shop (irreversible).</li>
        </ul>

        <h2>6. User Responsibilities</h2>
        <ul>
          <li>Use the platform lawfully and respectfully.</li>
          <li>Ensure accuracy of all information you submit.</li>
          <li>Do not impersonate others or misuse any feature.</li>
        </ul>

        <h2>7. Intellectual Property</h2>
        <p>
          All content, design, trademarks, and code on E &amp; D are our property. You may not reproduce or use our assets without express written permission.
        </p>

        <h2>8. Disclaimers &amp; Limitation of Liability</h2>
        <p>
          We provide the site "as is" without warranties, and disclaim all implied warranties. We are not liable for any direct, indirect, or consequential damages arising from your use of the platform, including disputes between customers and shop owners.
        </p>

        <h2>9. Termination</h2>
        <p>
          We may suspend or terminate your access to the platform at any time, without notice, for violations of these terms.
        </p>

        <h2>10. Changes to Terms</h2>
        <p>
          We reserve the right to modify these Terms &amp; Conditions at any time. Continued use after changes constitutes acceptance of the updated terms.
        </p>

        <h2>11. Governing Law</h2>
        <p>
          These terms are governed by the laws of Albania. Any dispute will be resolved in the courts of Tirana.
        </p>

        <h2>12. Contact Us</h2>
        <p>
          For questions about these terms, please contact us at <strong>edjcms2025@gmail.com</strong>
        </p>
      </div>
      <Footer />
    </>
  );
};

export default TermsAndConditions;
