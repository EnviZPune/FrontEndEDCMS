import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import '../Styling/ownerguide.css';

export default function ShopOwnerGuide() {
  return (
    <div className="owner-guide page-wrapper">
      <Navbar />
      <main className="owner-guide-content">
        <h1>Shop Owner Guide</h1>

        <section>
          <h2>1. Getting Started</h2>
          <p>
            To become a shop owner, subscribe to the $20/month plan on the <Link to="/become-owner">Become Owner</Link> page.
            After a successful payment, you’ll be redirected to fill out the Owner Form with your shop details.
          </p>
        </section>

        <section>
          <h2>2. Accessing Your Dashboard</h2>
          <p>
            Once your shop is created, use the Navbar to navigate to <Link to="/settings">Settings</Link>.
            This will open the Shop Owner Dashboard where you can manage every aspect of your business.
          </p>
        </section>

        <section>
          <h2>3. Dashboard Layout</h2>
          <p>
            The Settings page is split into two columns:
          </p>
          <ul>
            <li><strong>Sidebar:</strong> Lists panels for Business Info, Products, Categories, Photos, Employees, Pending Changes, Reservations, Notifications, My Shops, and Delete Business.</li>
            <li><strong>Content Area:</strong> Displays the selected panel’s interface for CRUD operations and data views.</li>
          </ul>
        </section>

        <section>
          <h2>4. Business Info</h2>
          <p>
            In the <em>Business Info</em> panel, update your shop name, description, address, phone number, and opening hours.
            Click <strong>Save</strong> to apply changes immediately.
          </p>
        </section>

        <section>
          <h2>5. Product Management</h2>
          <p>
            The <em>Products</em> panel lets you add, edit, or delete clothing items.
            You can upload up to 10 photos per product, preview them, and remove individual images before saving.
          </p>
        </section>

        <section>
          <h2>6. Categories</h2>
          <p>
            Under <em>Categories</em>, create and manage product categories (e.g., T-shirts, Boots).
            You can either use Premade Categories made by us or you can add your own unique categpry.
            It will be displayed as a category for everyone to see
          </p>
        </section>

        <section>
          <h2>7. Photos</h2>
          <p>
            In the <em>Photos</em> panel, upload or update your shop’s cover image and logo.
            Images are stored in Google Cloud Storage; once uploaded, they appear instantly on your public Shop page.
          </p>
        </section>

        <section>
          <h2>8. Employees</h2>
          <p>
            The <em>Employees</em> panel allows you to search users by email and promote them to employee role.
            Employees can propose product additions or edits, which you’ll then review under Pending Changes.
          </p>
        </section>

        <section>
          <h2>9. Pending Changes</h2>
          <p>
            Review all product changes proposed by employees in <em>Pending Changes</em>. Approve or reject each change.
            Approved changes go live immediately; rejected ones remain editable by employees.
          </p>
        </section>

        <section>
          <h2>10. Reservations</h2>
          <p>
            View customer reservation requests in the <em>Reservations</em> panel.
            Accept or decline reservations and manage availability directly from your dashboard.
          </p>
        </section>

        <section>
          <h2>11. Notifications</h2>
          <p>
            All system notifications (e.g., payment receipts, reservation updates) are logged under <em>Notifications</em>.
            Use this panel to review your notification history and resend any needed alerts.
          </p>
        </section>

        <section>
          <h2>12. My Shops</h2>
          <p>
            If you own multiple shops, switch between them easily in <em>My Shops</em>.
            Selecting a different shop reloads the dashboard panels with that shop’s data.
          </p>
        </section>

        <section>
          <h2>13. Deleting Your Shop</h2>
          <p>
            To permanently remove a shop, go to the <em>Delete Business</em> panel.
            This action is irreversible—make sure you have backups of any important data.
          </p>
        </section>

        <section>
          <h2>14. Support</h2>
          <p>
            For technical support or feature requests, contact our team via the email edjcms2025@gmail.com.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
