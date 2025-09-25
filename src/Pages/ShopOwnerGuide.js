import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import '../Styling/ownerguide.css';

/** Robust role check: tries common storage keys and decodes JWT if available */
function hasOwnerRole() {
  // 1) Direct 'role' key
  try {
    const directRole = localStorage.getItem('role');
    if (directRole && directRole.toLowerCase() === 'owner') return true;
  } catch {}

  // 2) Common user containers
  const candidates = ['user', 'currentUser', 'profile', 'auth', 'session'];
  for (const key of candidates) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const obj = JSON.parse(raw);
      const single = obj?.role || obj?.Role || obj?.userRole;
      if (typeof single === 'string' && single.toLowerCase() === 'owner') return true;

      const list = obj?.roles || obj?.Roles || obj?.claims || obj?.permissions;
      if (Array.isArray(list) && list.some(r => String(r).toLowerCase() === 'owner')) return true;
    } catch {}
  }

  // 3) Token/JWT (commonly stored as 'token' | 'accessToken' | in an object)
  try {
    const rawToken = localStorage.getItem('token');
    let jwt = rawToken;
    if (jwt) {
      try {
        const maybeObj = JSON.parse(jwt);
        jwt = maybeObj?.accessToken || maybeObj?.token || maybeObj; // handle both string and object
      } catch {
        // jwt is already a string
      }
    }
    if (jwt && typeof jwt === 'string' && jwt.includes('.')) {
      const base64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      const roleClaim =
        payload?.role ||
        payload?.roles ||
        payload?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
      if (typeof roleClaim === 'string' && roleClaim.toLowerCase() === 'owner') return true;
      if (Array.isArray(roleClaim) && roleClaim.some(r => String(r).toLowerCase() === 'owner')) return true;
    }
  } catch {}

  return false;
}

export default function ShopOwnerGuide() {
  const navigate = useNavigate();
  const location = useLocation();
  const [allowed, setAllowed] = useState(null); // null=checking, true=ok

  // Guard: only Owners may proceed
  useEffect(() => {
    const ok = hasOwnerRole();
    if (!ok) {
      navigate('/unauthorized', {
        replace: true,
        state: { from: location.pathname + location.search },
      });
      return;
    }
    setAllowed(true);
  }, [navigate, location.pathname, location.search]);

  // While checking / redirecting, render nothing to avoid flash
  if (allowed !== true) return null;

  return (
    <div className="owner-guide page-wrapper">
      <Navbar />

      <div className="og-container">
        {/* LEFT: Quick Links (like Settings) */}
        <aside className="og-sidebar">
          <h2 className="og-sidebar-title">Panels</h2>
          <nav className="og-nav">
            <a href="#business-info">Business Info</a>
            <a href="#photos">Photos</a>
            <a href="#categories">Categories</a>
            <a href="#products">Products</a>
            <a href="#sales">Sales</a>
            <a href="#employees">Employees</a>
            <a href="#pending">Pending Changes</a>
            <a href="#reservations">Reservations</a>
            <a href="#notifications">Notifications</a>
            <a href="#my-shops">My Shops</a>
            <a href="#delete">Delete Business</a>
          </nav>
          <div className="og-sidebar-footer">
            <Link to="/settings" className="og-btn">Open Settings</Link>
          </div>
        </aside>

        {/* RIGHT: Content */}
        <main className="og-content">
          {/* Mobile quick links (chips) */}
          <nav className="og-mobile-nav">
            <a href="#business-info">Business Info</a>
            <a href="#photos">Photos</a>
            <a href="#categories">Categories</a>
            <a href="#products">Products</a>
            <a href="#sales">Sales</a>
            <a href="#employees">Employees</a>
            <a href="#pending">Pending</a>
            <a href="#reservations">Reservations</a>
            <a href="#notifications">Notifications</a>
            <a href="#my-shops">My Shops</a>
            <a href="#delete">Delete</a>
          </nav>

          <header className="og-hero card">
            <h1>Shop Owner Guide</h1>
            <p className="og-sub">
              A concise reference to every panel in <Link to="/settings">Settings</Link>. After a successful purchase—congratulations—you can publish your shop and make it visible to everyone. From here on, keep your catalog accurate and up to date: every item you list should be available (or clearly marked otherwise). Inaccurate listings confuse customers, erode trust, and generate avoidable support requests. Use the <strong>Products</strong> and <strong>Categories</strong> panels to curate inventory, retire out-of-stock items, and keep pricing consistent. When in doubt, update in Settings first—your public shop reflects changes immediately. For anything unclear, our Support team is here to help at any time.
            </p>
          </header>

          <section id="business-info" className="card">
            <h2>Business Info</h2>
            <p>
              Manage your public profile: name, description, address, phone, and opening hours.
              Changes appear on your shop page after <strong>Save</strong>.
            </p>
          </section>

          <section id="photos" className="card">
            <h2>Photos</h2>
            <p>
              Upload or replace your cover image and logo. Images are stored in Cloud Storage and update your public page instantly.
              Recommended: Cover ≥ <code>1600×900</code>, Logo ≥ <code>512×512</code> (PNG).
            </p>
          </section>

          <section id="categories" className="card">
            <h2>Categories</h2>
            <p>
              Create or select categories (e.g., T-Shirts, Boots). Categories power browsing and filters and are used when adding products.
            </p>
          </section>

          <section id="products" className="card">
            <h2>Products</h2>
            <p>
              Add, edit, pin or remove items. Each product supports details, price, stock, categories, and up to 10 photos.
              Hit “Sale” for every item you sell to keep quantity in sync. Save to publish immediately.
            </p>
          </section>

          <section id="sales" className="card card-accent">
            <h2>Sales</h2>
            <p>
              Track revenue and orders, filter by date/status, view order details, issue refunds (full/partial),
              and export CSV for accounting.
            </p>
          </section>

          <section id="employees" className="card">
            <h2>Employees</h2>
            <p>
              Add teammates by email. Employees can propose product changes; you retain final control via approvals in Pending Changes.
            </p>
          </section>

          <section id="pending" className="card">
            <h2>Pending Changes</h2>
            <p>
              Review employee proposals before they go live. Open an item to compare and <strong>Approve</strong> or <strong>Reject</strong>.
            </p>
          </section>

          <section id="reservations" className="card">
            <h2>Reservations</h2>
            <p>
              See customer requests, accept or decline, and manage availability. Use notes to keep context per request.
            </p>
          </section>

          <section id="notifications" className="card">
            <h2>Notifications</h2>
            <p>
              System messages (receipts, reservation updates, etc.). Use as an audit trail and to resend important alerts if needed.
            </p>
          </section>

          <section id="my-shops" className="card">
            <h2>My Shops</h2>
            <p>
              Switch between multiple shops you own. The dashboard reloads with the selected shop’s data and panels.
            </p>
          </section>

          <section id="delete" className="card">
            <h2>Delete Business</h2>
            <p>
              Permanently remove a shop and its data. This action is irreversible—export anything important before continuing.
            </p>
          </section>
        </main>
      </div>

      <Footer />
    </div>
  );
}
