import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "../Styling/policy.css";

const BRAND = "Triwears";
const SITE = "triwears.com";

export default function PrivacyPolicy() {
  return (
    <>
      <Navbar />
      <main className="policy-page">
        <div id="top" />
        <div className="policy-shell">
          <div className="policy-grid">
            {/* ===== Left: Content ===== */}
            <article className="policy-content" aria-labelledby="privacy-title">
              {/* Hero */}
              <header className="policy-hero">
                <span className="policy-eyebrow">Legal • Privacy Policy</span>
                <h1 id="privacy-title" className="policy-title">
                  Privacy Policy
                </h1>
                <p className="policy-sub">
                  This policy explains what we collect, why we collect it, and how you can control it when you use{" "}
                  <strong>{SITE}</strong> and related services by {BRAND}.
                </p>
                <div className="hero-divider" />
              </header>

              {/* Sections */}
              <section id="summary" className="policy-section">
                <h2><span className="sec-icon">1</span> Summary</h2>
                <p>
                  {BRAND} helps people discover clothing shops and lets shoppers place <strong>reservations</strong> with those shops.
                  We don’t sell products ourselves; final purchases happen directly with the shop. Shop owners can subscribe to
                  owner features (billing via Stripe). We keep only the data needed to run the platform and never sell personal data.
                </p>
              </section>

              <section id="data-we-collect" className="policy-section">
                <h2><span className="sec-icon">2</span> Data we collect</h2>
                <ul className="policy-list">
                  <li>
                    <strong>Account data (shoppers &amp; owners):</strong> name, email, password hash, profile image, basic preferences.
                  </li>
                  <li>
                    <strong>Shop/owner data:</strong> shop name, slug, description, contact details, address or coordinates you provide,
                    photos/logos/covers, categories, product listings, prices, stock/quantity and pin order.
                  </li>
                  <li>
                    <strong>Reservations:</strong> items reserved, sizes/colors if selected, timestamps and status (e.g., Pending/Confirmed).
                  </li>
                  <li>
                    <strong>Favorites &amp; interactions:</strong> shops you favorite, items pinned by owners, simple share clicks.
                  </li>
                  <li>
                    <strong>Device &amp; usage:</strong> basic logs for security and performance (IP city-level, user-agent, pages/actions).
                  </li>
                  <li>
                    <strong>Approximate location (optional):</strong> if you grant permission, we use your browser location to show “near me”.
                    We do not store precise user location by default; owners’ shop coordinates are stored when they save them.
                  </li>
                </ul>
              </section>

              <section id="how-we-use" className="policy-section">
                <h2><span className="sec-icon">3</span> How we use data</h2>
                <ul className="policy-list">
                  <li>Operate the platform: accounts, shop pages, search, categories, reservations and notifications.</li>
                  <li>Show relevant content (e.g., nearby shops) and keep the service secure and reliable.</li>
                  <li>Handle owner subscriptions and invoices via our payment processor (Stripe).</li>
                  <li>Communicate about reservations, account activity, service updates or policy changes.</li>
                  <li>Improve performance and fix bugs through aggregate analytics and error logs.</li>
                </ul>
              </section>

              <section id="legal-bases" className="policy-section">
                <h2><span className="sec-icon">4</span> Legal bases (where applicable)</h2>
                <ul className="policy-list">
                  <li><strong>Contract:</strong> to provide you the service (accounts, reservations, owner tools).</li>
                  <li><strong>Legitimate interests:</strong> service security, anti-abuse, product improvement.</li>
                  <li><strong>Consent:</strong> optional things like “near me” location and certain marketing emails.</li>
                  <li><strong>Legal obligations:</strong> compliance with applicable law and requests from authorities.</li>
                </ul>
              </section>

              <section id="cookies" className="policy-section">
                <h2><span className="sec-icon">5</span> Cookies, localStorage &amp; tokens</h2>
                <ul className="policy-list">
                  <li>We use minimal cookies and localStorage to keep you signed in and remember preferences.</li>
                  <li>Authentication uses a token (JWT) stored in localStorage; logging out invalidates future use.</li>
                  <li>No third-party ad trackers. Social share buttons only open the target site when clicked.</li>
                </ul>
              </section>

              <section id="sharing" className="policy-section">
                <h2><span className="sec-icon">6</span> Sharing &amp; service providers</h2>
                <ul className="policy-list">
                  <li>
                    <strong>Stripe (subscriptions):</strong> owners pay via Stripe. We don’t store full card details.
                    Stripe acts as payment processor and may keep billing identifiers for compliance.
                  </li>
                  <li>
                    <strong>OpenStreetMap/Nominatim (maps):</strong> we use reverse-geocoding to render addresses from coordinates you save.
                  </li>
                  <li>
                    <strong>Email/notifications:</strong> we use standard email delivery to send confirmations and updates.
                  </li>
                  <li>
                    <strong>Compliance &amp; safety:</strong> we may disclose information if required by law or to prevent harm.
                  </li>
                </ul>
              </section>

              <section id="retention" className="policy-section">
                <h2><span className="sec-icon">7</span> Data retention</h2>
                <p>
                  We keep personal data only as long as needed for the purposes above. You can delete your account or shop,
                  which removes or anonymizes associated personal data except where we must keep limited records for legal,
                  fraud-prevention or accounting reasons.
                </p>
              </section>

              <section id="security" className="policy-section">
                <h2><span className="sec-icon">8</span> Security</h2>
                <p>
                  We use industry-standard measures (TLS in transit, hashed passwords, access controls). No method is 100% secure;
                  please use a strong, unique password and keep it confidential.
                </p>
              </section>

              <section id="your-rights" className="policy-section">
                <h2><span className="sec-icon">9</span> Your privacy choices &amp; rights</h2>
                <ul className="policy-list">
                  <li>Access, update, or delete your account data in <Link to="/settings">Settings</Link>.</li>
                  <li>Withdraw location permission in your browser or OS at any time.</li>
                  <li>Unsubscribe from non-essential emails via the link in the message.</li>
                  <li>Contact us to exercise rights available in your region (e.g., access, portability).</li>
                </ul>
              </section>

              <section id="children" className="policy-section">
                <h2><span className="sec-icon">10</span> Children</h2>
                <p>
                  {BRAND} isn’t directed to children under the age of digital consent. If you believe a child provided personal
                  data, contact us and we’ll take appropriate steps to remove it.
                </p>
              </section>

              <section id="intl" className="policy-section">
                <h2><span className="sec-icon">11</span> International transfers</h2>
                <p>
                  We may process data on servers or with providers located outside your country. Where required, we use appropriate
                  safeguards (e.g., contractual clauses) for such transfers.
                </p>
              </section>

              <section id="changes" className="policy-section">
                <h2><span className="sec-icon">12</span> Changes to this policy</h2>
                <p>
                  We’ll update this policy when needed and revise the date below. Continued use of the Service after changes means
                  you accept the updated policy.
                </p>
              </section>

              <section id="contact" className="policy-section">
                <h2><span className="sec-icon">13</span> Contact</h2>
                <p>
                  Questions or requests? Email <strong>edjcms2025@gmail.com</strong>. For account and billing help visit{" "}
                  <Link to="/settings">Settings</Link> or see <Link to="/become-owner">Become Owner</Link>.
                </p>
              </section>

              <div className="policy-meta">Last updated: {new Date().toLocaleDateString()}</div>
            </article>

            {/* ===== Right: Sticky ToC ===== */}
            <aside className="policy-rail" aria-label="On this page">
              <nav className="toc-card">
                <p className="toc-title">On this page</p>
                <ul className="toc-list">
                  <li><a href="#summary">Summary</a></li>
                  <li><a href="#data-we-collect">Data we collect</a></li>
                  <li><a href="#how-we-use">How we use data</a></li>
                  <li><a href="#legal-bases">Legal bases</a></li>
                  <li><a href="#cookies">Cookies &amp; tokens</a></li>
                  <li><a href="#sharing">Sharing &amp; processors</a></li>
                  <li><a href="#retention">Retention</a></li>
                  <li><a href="#security">Security</a></li>
                  <li><a href="#your-rights">Your rights</a></li>
                  <li><a href="#children">Children</a></li>
                  <li><a href="#intl">International transfers</a></li>
                  <li><a href="#changes">Changes</a></li>
                  <li><a href="#contact">Contact</a></li>
                </ul>
              </nav>
            </aside>
          </div>
        </div>

        {/* Back to top */}
        <a className="back-to-top" href="#top" aria-label="Back to top">↑</a>
      </main>
      <Footer />
    </>
  );
}
