import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "../Styling/termsandconditions.css";

const BRAND = "Triwears";
const SITE = "triwears.com";

export default function TermsAndConditions() {
  return (
    <>
      <Navbar />
      <main className="policy-page">
        {/* page anchor for back-to-top */}
        <div id="top" />

        <div className="policy-shell">
          <div className="policy-grid">
            {/* ===== Left: Content ===== */}
            <article className="policy-content" aria-labelledby="policy-title">
              {/* Hero */}
              <header className="policy-hero">
                <span className="policy-eyebrow">Legal • Terms &amp; Conditions</span>
                <h1 id="policy-title" className="policy-title">Terms &amp; Conditions</h1>
                <p className="policy-sub">
                  Welcome to {BRAND}. By using <strong>{SITE}</strong> you agree to these terms.
                </p>
                <div className="hero-divider" />
              </header>

              {/* Sections */}
              <section id="acceptance" className="policy-section">
                <h2>
                  <span className="sec-icon">1</span> Acceptance of terms
                </h2>
                <p>
                  By accessing or using {SITE} and related services, you confirm that you’ve read,
                  understood, and agree to be bound by these Terms &amp; Conditions and our Privacy
                  Policy. If you do not agree, you must stop using the Service.
                </p>
              </section>

              <section id="service" className="policy-section">
                <h2>
                  <span className="sec-icon">2</span> Service overview
                </h2>
                <p>
                  {BRAND} is a marketplace directory and discovery platform for clothing shops and
                  brands. Shoppers can browse shops, view products, and place{" "}
                  <strong>reservations</strong> with shops. Product purchases and final sales are
                  fulfilled by the shop offline or via their own channels, not by {BRAND}.
                </p>
                <ul className="policy-list">
                  <li>
                    We surface shops, categories, “near me” discovery, and pinned items supplied by
                    shop owners.
                  </li>
                  <li>
                    We provide notifications and reservation workflows; payment for products occurs
                    with the shop directly.
                  </li>
                  <li>
                    {BRAND} is not a party to the sale between a shopper and a shop; we do not hold
                    inventory.
                  </li>
                </ul>
              </section>

              <section id="accounts" className="policy-section">
                <h2>
                  <span className="sec-icon">3</span> User accounts
                </h2>
                <ul className="policy-list">
                  <li>You must be at least 16 years old (or the age of digital consent in your country).</li>
                  <li>Keep your credentials confidential; you are responsible for activity on your account.</li>
                  <li>Provide accurate information and promptly update changes.</li>
                  <li>We may suspend or terminate accounts that violate these terms.</li>
                </ul>
              </section>

              <section id="subscriptions" className="policy-section">
                <h2>
                  <span className="sec-icon">4</span> Owner subscriptions &amp; billing
                </h2>
                <p>
                  Shop owners can create and manage a shop profile, products, categories, employees,
                  photos, and receive reservations. Access to owner features is provided via a
                  recurring subscription.
                </p>
                <ul className="policy-list">
                  <li>
                    <strong>Pricing:</strong> $20/month (Powered By Stripe). See{" "}
                    <Link to="/become-owner">Become Owner</Link>.
                  </li>
                  <li>
                    <strong>Renewal &amp; cancellation:</strong> Subscriptions renew automatically
                    until canceled. Cancel anytime from <Link to="/settings">Settings</Link> (Delete
                    Business).
                  </li>
                  <li>
                    <strong>Refunds:</strong> No refunds for partial billing periods unless required
                    by law.
                  </li>
                </ul>
                <p style={{ marginTop: 8 }}>
                  <small>
                    Billing is processed by Stripe or equivalent PSP. Fees and taxes may apply
                    depending on your region.
                  </small>
                </p>
              </section>

              <section id="listings" className="policy-section">
                <h2>
                  <span className="sec-icon">5</span> Listings, reservations &amp; accuracy
                </h2>
                <ul className="policy-list">
                  <li>
                    <strong>Owner responsibility:</strong> Shop owners are responsible for the
                    accuracy of their shop info, product details, prices, stock, images, and
                    availability.
                  </li>
                  <li>
                    <strong>Reservations:</strong> A reservation placed on {SITE} is a request to
                    hold an item. The shop confirms, modifies (e.g., size/color), or declines based
                    on availability.
                  </li>
                  <li>
                    <strong>No guarantee:</strong> We do not guarantee stock, pricing, or that a
                    reservation will be fulfilled; the final transaction occurs with the shop.
                  </li>
                  <li>
                    <strong>Prohibited items:</strong> Owners must not list illegal or restricted goods.
                  </li>
                </ul>
              </section>

              <section id="content" className="policy-section">
                <h2>
                  <span className="sec-icon">6</span> Content &amp; intellectual property
                </h2>
                <p>
                  {BRAND} and its licensors own the platform, code, and design assets. Shops retain
                  ownership of their logos, photos, and product content but license {BRAND} to
                  display them on the Service.
                </p>
                <ul className="policy-list">
                  <li>You may not copy, scrape, or redistribute substantial parts of the Service without permission.</li>
                  <li>Do not upload content you do not have rights to. Report IP concerns via the contact below.</li>
                </ul>
              </section>

              <section id="acceptable" className="policy-section">
                <h2>
                  <span className="sec-icon">7</span> Acceptable use
                </h2>
                <ul className="policy-list">
                  <li>No unlawful, deceptive, or harmful conduct.</li>
                  <li>No attempts to breach security, abuse APIs, or interfere with normal operation.</li>
                  <li>No spam, scraping at scale, or misuse of reservations.</li>
                </ul>
              </section>

              <section id="disclaimers" className="policy-section">
                <h2>
                  <span className="sec-icon">8</span> Disclaimers &amp; limitation of liability
                </h2>
                <p>
                  The Service is provided “as is” and “as available.” To the maximum extent permitted
                  by law, {BRAND} disclaims all warranties, and is not liable for indirect, incidental,
                  or consequential damages. {BRAND} is not responsible for the quality, safety, legality,
                  pricing, or availability of products offered by shops.
                </p>
              </section>

              <section id="termination" className="policy-section">
                <h2>
                  <span className="sec-icon">9</span> Termination
                </h2>
                <p>
                  We may suspend or terminate access for violations, fraud, or risk to the Service.
                  You may stop using {SITE} at any time. Subscription owners can cancel from Settings
                  as described above.
                </p>
              </section>

              <section id="changes" className="policy-section">
                <h2>
                  <span className="sec-icon">10</span> Changes to these terms
                </h2>
                <p>
                  We may update these terms to reflect changes in features, law, or business needs.
                  When we do, we’ll update the “Last updated” date below. Continued use constitutes
                  acceptance of the revised terms.
                </p>
              </section>

              <section id="law" className="policy-section">
                <h2>
                  <span className="sec-icon">11</span> Governing law
                </h2>
                <p>
                  These terms are governed by applicable local law where {BRAND} is established,
                  without regard to conflict-of-law principles. Venue and jurisdiction lie with the
                  competent courts of that venue.
                </p>
              </section>

              <section id="contact" className="policy-section">
                <h2>
                  <span className="sec-icon">12</span> Contact us
                </h2>
                <p>
                  Questions about these terms? Email <strong>edjcms2025@gmail.com</strong>. For
                  account or billing questions, visit <Link to="/settings">Settings</Link> or see{" "}
                  <Link to="/become-owner">Become Owner</Link>.
                </p>
              </section>

              <div className="policy-meta">Last updated: {new Date().toLocaleDateString()}</div>
            </article>

            {/* ===== Right: Rail with ToC ===== */}
            <aside className="policy-rail" aria-label="On this page">
              <nav className="toc-card">
                <p className="toc-title">On this page</p>
                <ul className="toc-list">
                  <li><a href="#acceptance">Acceptance of terms</a></li>
                  <li><a href="#service">Service overview</a></li>
                  <li><a href="#accounts">User accounts</a></li>
                  <li><a href="#subscriptions">Owner subscriptions &amp; billing</a></li>
                  <li><a href="#listings">Listings, reservations &amp; accuracy</a></li>
                  <li><a href="#content">Content &amp; intellectual property</a></li>
                  <li><a href="#acceptable">Acceptable use</a></li>
                  <li><a href="#disclaimers">Disclaimers &amp; liability</a></li>
                  <li><a href="#termination">Termination</a></li>
                  <li><a href="#changes">Changes to these terms</a></li>
                  <li><a href="#law">Governing law</a></li>
                  <li><a href="#contact">Contact us</a></li>
                </ul>
              </nav>
            </aside>
          </div>
        </div>

        {/* Back to top FAB */}
        <a className="back-to-top" href="#top" aria-label="Back to top">↑</a>
      </main>
      <Footer />
    </>
  );
}
