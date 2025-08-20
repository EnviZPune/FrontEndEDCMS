// src/Pages/ShopDetailsPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Map, Marker } from 'pigeon-maps';
import { FaClock, FaPhoneAlt, FaInfoCircle, FaHeart } from 'react-icons/fa';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import '../Styling/sd-shopdetail.css';

const API_BASE = 'http://77.242.26.150:8000';
const PAGE_SIZE = 8;

/* ====================== THEME-AWARE DEFAULT IMAGES ====================== */
const DEFAULT_LOGO_LIGHT  = '/Assets/default-shop-logo-light.png';
const DEFAULT_LOGO_DARK   = '/Assets/default-shop-logo-dark.png';
const DEFAULT_COVER_LIGHT = '/Assets/default-shop-cover-light.png';
const DEFAULT_COVER_DARK  = '/Assets/default-shop-cover-dark.png';
/* ======================================================================= */

/* ---------- Opening hours helpers (robust to JSON or compact strings) ---------- */
const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const ABBR_SHORT = ['Mo','Tu','We','Th','Fr','Sa','Su'];
const DAY_LABELS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const getDefaultSchedule = () => ({
  monday:    { open: '09:00', close: '18:00', closed: false },
  tuesday:   { open: '09:00', close: '18:00', closed: false },
  wednesday: { open: '09:00', close: '18:00', closed: false },
  thursday:  { open: '09:00', close: '18:00', closed: false },
  friday:    { open: '09:00', close: '18:00', closed: false },
  saturday:  { open: '10:00', close: '14:00', closed: true },
  sunday:    { open: '10:00', close: '14:00', closed: true },
});

const toHHMM = (s) => {
  if (typeof s !== 'string') return '00:00';
  const [hRaw, mRaw] = s.split(':');
  const h = Math.max(0, Math.min(23, parseInt(hRaw, 10) || 0));
  const m = Math.max(0, Math.min(59, parseInt(mRaw ?? '0', 10) || 0));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const fmtTime = (t) => toHHMM(t);

const sameTime = (a, b) =>
  a && b && a.open === b.open && a.close === b.close && !a.closed && !b.closed;

const normalizeSchedule = (obj) => {
  const base = getDefaultSchedule();
  try {
    for (const k of DAY_KEYS) {
      const d = obj?.[k] ?? {};
      base[k] = {
        open: toHHMM(d.open ?? base[k].open),
        close: toHHMM(d.close ?? base[k].close),
        closed: Boolean(d.closed),
      };
    }
  } catch { return getDefaultSchedule(); }
  return base;
};

const parseCompact = (str) => {
  const base = getDefaultSchedule();
  for (const k of DAY_KEYS) base[k].closed = true;

  const lower = String(str || '').trim().toLowerCase();
  if (!lower) return getDefaultSchedule();
  if (lower === 'closed') return base;

  const daily = lower.match(/^daily\s+(\d{1,2}(?::\d{2})?)\-(\d{1,2}(?::\d{2})?)$/i);
  if (daily) {
    const open = toHHMM(daily[1]), close = toHHMM(daily[2]);
    for (const k of DAY_KEYS) base[k] = { open, close, closed: false };
    return base;
  }

  const re = /([A-Z][a-z]?(?:\-[A-Z][a-z]?)?)\s+(\d{1,2}(?::\d{2})?)\-(\d{1,2}(?::\d{2})?)/gi;
  const idxOf = (a) => ABBR_SHORT.indexOf(a);
  let m, matched = false;
  while ((m = re.exec(str)) !== null) {
    matched = true;
    const dayPart = m[1];
    const open = toHHMM(m[2]);
    const close = toHHMM(m[3]);

    if (dayPart.includes('-')) {
      const [a,b] = dayPart.split('-');
      const s = idxOf(a), e = idxOf(b);
      if (s !== -1 && e !== -1 && s <= e) {
        for (let i = s; i <= e; i++) base[DAY_KEYS[i]] = { open, close, closed: false };
      }
    } else {
      const i = idxOf(dayPart);
      if (i !== -1) base[DAY_KEYS[i]] = { open, close, closed: false };
    }
  }
  return matched ? base : getDefaultSchedule();
};

const parseIncomingOpeningHours = (incoming) => {
  if (!incoming) return getDefaultSchedule();
  if (typeof incoming === 'object') return normalizeSchedule(incoming);
  if (typeof incoming === 'string') {
    const trimmed = incoming.trim();
    if (!trimmed) return getDefaultSchedule();
    if (trimmed.toLowerCase() === 'closed') {
      const all = getDefaultSchedule();
      for (const k of DAY_KEYS) all[k].closed = true;
      return all;
    }
    try {
      const obj = JSON.parse(trimmed);
      if (obj && typeof obj === 'object') return normalizeSchedule(obj);
    } catch {}
    return parseCompact(trimmed);
  }
  return getDefaultSchedule();
};

const compactSchedule = (schedule, maxLen = 60) => {
  const days = DAY_KEYS.map((k) => schedule[k]);
  const openMask = days.map((d) => !d.closed);
  if (openMask.every(v => !v)) return 'Closed';

  const firstOpenIdx = openMask.findIndex(Boolean);
  const firstOpen = days[firstOpenIdx];
  const allSame = openMask.every(v => v === openMask[firstOpenIdx])
    ? days.every(d => sameTime(d, firstOpen))
    : false;

  if (allSame && !firstOpen.closed) {
    const token = `Daily ${fmtTime(firstOpen.open)} - ${fmtTime(firstOpen.close)}`;
    return token.length <= maxLen ? token : 'Varies by day';
  }

  const groups = [];
  let i = 0;
  while (i < 7) {
    if (!openMask[i]) { i++; continue; }
    const start = i;
    const ref = days[i];
    while (i + 1 < 7 && openMask[i + 1] && sameTime(days[i + 1], ref)) i++;
    const end = i;
    groups.push({ start, end, open: fmtTime(ref.open), close: fmtTime(ref.close) });
    i++;
  }

  const tokens = groups.map(g => {
    const dayPart = g.start === g.end ? DAY_LABELS[g.start] : `${DAY_LABELS[g.start]}-${DAY_LABELS[g.end]}`;
    return `${dayPart} ${g.open} - ${g.close}`;
  });

  let out = '';
  for (const t of tokens) {
    const candidate = out ? `${out} ${t}` : t;
    if (candidate.length <= maxLen) out = candidate; else break;
  }
  if (!out) out = tokens[0] || 'Varies by day';
  if (out.length > maxLen) out = 'Varies by day';
  return out;
};

const isOpenNow = (schedule, now = new Date()) => {
  const idx = (now.getDay() + 6) % 7;
  const d = schedule[DAY_KEYS[idx]];
  if (!d || d.closed) return false;
  const [oh, om] = d.open.split(':').map(Number);
  const [ch, cm] = d.close.split(':').map(Number);
  const s = new Date(now); s.setHours(oh, om, 0, 0);
  const e = new Date(now); e.setHours(ch, cm, 0, 0);
  return now >= s && now <= e;
};

const todaysRangeText = (schedule, now = new Date()) => {
  const idx = (now.getDay() + 6) % 7;
  const d = schedule[DAY_KEYS[idx]];
  if (!d || d.closed) return 'Closed today';
  return `${fmtTime(d.open)} - ${fmtTime(d.close)}`;
};

const nextTransitionInfo = (schedule, now = new Date()) => {
  const todayIdx = (now.getDay() + 6) % 7;
  const today = schedule[DAY_KEYS[todayIdx]];
  const makeResult = (type, timeStr, dayIdx, isToday) =>
    ({ type, timeStr: fmtTime(timeStr), dayIdx, isToday });

  if (today && !today.closed) {
    const [oh, om] = today.open.split(':').map(Number);
    const [ch, cm] = today.close.split(':').map(Number);
    const openAt = new Date(now);  openAt.setHours(oh, om, 0, 0);
    const closeAt = new Date(now); closeAt.setHours(ch, cm, 0, 0);
    if (now < openAt) return makeResult('opens', today.open, todayIdx, true);
    if (now >= openAt && now < closeAt) return makeResult('closes', today.close, todayIdx, true);
  }

  for (let offset = 1; offset <= 7; offset++) {
    const idx = (todayIdx + offset) % 7;
    const d = schedule[DAY_KEYS[idx]];
    if (d && !d.closed) return makeResult('opens', d.open, idx, false);
  }
  return { type: 'none' };
};
/* ------------------------------------------------------------------- */

export default function ShopDetailsPage() {
  const { slug } = useParams();
  const [shop, setShop] = useState(null);
  const [routeName, setRouteName] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [openingText, setOpeningText] = useState('');
  const [todayText, setTodayText] = useState('');
  const [transitionText, setTransitionText] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(0);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Favorite state
  const [isFavorited, setIsFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  // Theme state (light/dark) via prefers-color-scheme
  const [isDarkMode, setIsDarkMode] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setIsDarkMode(e.matches);
    if (mql.addEventListener) mql.addEventListener('change', handler);
    else if (mql.addListener) mql.addListener(handler); // Safari < 14
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler);
      else if (mql.removeListener) mql.removeListener(handler);
    };
  }, []);

  const token = (() => {
    const raw = localStorage.getItem('token') || localStorage.getItem('authToken');
    return raw ? raw.replace(/^"|"$/g, '') : null;
  })();

  const onClick = () => {
    const button = document.getElementsByClassName("sd-share-btn");
    const copyExpire = () => {
      if (!button[0]) return;
      button[0].innerHTML = "Link Copied To Clipboard";
      setTimeout(() => { if (button[0]) button[0].innerHTML = "Copy Link"; }, 3000);
    };
    copyExpire();
  };

  useEffect(() => {
    if (!token) {
      setError('Please log in.');
      setLoading(false);
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    (async () => {
      try {
        const shopRes = await fetch(
          `${API_BASE}/api/Business/slug/${encodeURIComponent(slug)}`,
          { headers }
        );
        if (!shopRes.ok) throw new Error(`Shop fetch failed: ${shopRes.status}`);
        const shopData = await shopRes.json();

        setShop(shopData);
        document.title = shopData.name;

        // Parse schedule and compute displays
        const schedule = parseIncomingOpeningHours(shopData.openingHours);
        setOpeningText(compactSchedule(schedule, 80));
        setTodayText(todaysRangeText(schedule));

        const computedOpen = isOpenNow(schedule);
        const manual =
          (typeof shopData.isManuallyOpen === 'boolean') ? shopData.isManuallyOpen : null;
        const finalOpen = manual ?? computedOpen;
        setIsOpen(finalOpen);

        // Opening / Closing (next transition)
        const next = nextTransitionInfo(schedule, new Date());
        if (next.type === 'closes') {
          setTransitionText(`Closes at ${next.timeStr}`);
        } else if (next.type === 'opens') {
          setTransitionText(next.isToday
            ? `Opens at ${next.timeStr}`
            : `Opens ${DAY_LABELS[next.dayIdx]} at ${next.timeStr}`);
        } else {
          setTransitionText('—');
        }

        // Reverse geocode for address display
        if (shopData.location?.includes(',')) {
          const [lat, lon] = shopData.location.split(',').map(Number);
          fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
          )
            .then(r => r.json())
            .then(j => setRouteName(j.display_name || shopData.location))
            .catch(() => setRouteName(shopData.location));
        }

        // categories & items
        const bizId = shopData.businessId;
        const [catsRes, itemsRes] = await Promise.all([
          fetch(`${API_BASE}/api/ClothingCategory/business/${bizId}`, { headers }),
          fetch(`${API_BASE}/api/ClothingItem/business/${bizId}`,   { headers }),
        ]);

        const cats     = catsRes.ok   ? await catsRes.json()   : [];
        const allItems = itemsRes.ok  ? await itemsRes.json()  : [];

        setCategories([{ clothingCategoryId: 0, name: 'All' }, ...cats]);
        setItems(allItems);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, token]);

  // fetch initial favorite state
  useEffect(() => {
    if (!token || !shop?.businessId) return;
    const headers = { Authorization: `Bearer ${token}` };
    fetch(`${API_BASE}/api/favorites/${shop.businessId}/is-favorited`, { headers })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (j && typeof j.isFavorited !== 'undefined') setIsFavorited(!!j.isFavorited);
      })
      .catch(() => {});
  }, [token, shop?.businessId]);

  async function toggleFavorite() {
    if (!token || !shop?.businessId || favLoading) return;
    setFavLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    try {
      if (isFavorited) {
        const r = await fetch(`${API_BASE}/api/favorites/${shop.businessId}`, {
          method: 'DELETE',
          headers
        });
        if (r.ok) setIsFavorited(false);
      } else {
        const r = await fetch(`${API_BASE}/api/favorites/${shop.businessId}`, {
          method: 'POST',
          headers
        });
        if (r.ok) setIsFavorited(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFavLoading(false);
    }
  }

  useEffect(() => {
    const filtered = selectedCategoryId === 0
      ? items
      : items.filter(i => i.clothingCategoryId === selectedCategoryId);
    setTotalPages(Math.ceil(filtered.length / PAGE_SIZE) || 1);
    setPage(1);
  }, [items, selectedCategoryId]);

  if (loading) return <div className="loading-spinner"></div>;
  if (error)   return <p className="sd-error">{error}</p>;
  if (!shop)   return <p className="sd-error">Shop not found</p>;

  const filteredItems = selectedCategoryId === 0
    ? items
    : items.filter(i => i.clothingCategoryId === selectedCategoryId);
  const startIdx = (page - 1) * PAGE_SIZE;
  const pageItems = filteredItems.slice(startIdx, startIdx + PAGE_SIZE);

  let coords = null;
  if (shop.location?.includes(',')) {
    const [lat, lon] = shop.location.split(',').map(Number);
    if (!isNaN(lat) && !isNaN(lon)) coords = [lat, lon];
  }

  // Theme-aware fallbacks
  const logoSrc =
    (shop?.profilePictureUrl && shop.profilePictureUrl.trim())
      ? shop.profilePictureUrl
      : (isDarkMode ? DEFAULT_LOGO_DARK : DEFAULT_LOGO_LIGHT);

  const coverSrc =
    (shop?.coverPictureUrl && shop.coverPictureUrl.trim())
      ? shop.coverPictureUrl
      : (isDarkMode ? DEFAULT_COVER_DARK : DEFAULT_COVER_LIGHT);

  return (
    <>
      <Navbar />
      <div className="sd-page-wrapper">
        <div
          className="sd-shop-hero"
          style={{ backgroundImage: `url(${coverSrc})` }}
        >
          <div className="sd-shop-hero-content">
            <img
              className="sd-shop-logo"
              src={logoSrc}
              alt={`${shop.name} Logo`}
            />
            <h1 className="sd-shop-name">
              {shop.name}
            </h1>
          </div>
        </div>

        <div className="sd-body-wrapper">
          <main className="sd-main-col">
            <nav className="sd-category-bar" aria-label="Item categories">
              {categories.map(cat => (
                <button
                  key={cat.clothingCategoryId}
                  className={`sd-category-pill ${
                    selectedCategoryId === cat.clothingCategoryId ? 'active' : ''
                  }`}
                  onClick={() => setSelectedCategoryId(cat.clothingCategoryId)}
                >
                  {cat.name}
                </button>
              ))}
            </nav>

            <section className="sd-products-section">
              <h2>
                {selectedCategoryId === 0
                  ? 'All Items'
                  : categories.find(c => c.clothingCategoryId === selectedCategoryId)?.name
                }
              </h2>

              {filteredItems.length === 0 ? (
                <p className="sd-no-items">
                  Sorry, there is no items inside this category yet .
                </p>
              ) : (
                <>
                  <ul className="sd-product-list">
                    {pageItems.map(p => (
                      <li key={p.clothingItemId} className="sd-product-card">
                        <Link
                          to={`/product/${p.clothingItemId}`}
                          className="sd-product-link"
                        >
                          <img
                            className="sd-product-image"
                            src={Array.isArray(p.pictureUrls) ? p.pictureUrls[0] : '/default-product.jpg'}
                            alt={`${shop.name} product`}
                          />
                          <div className="sd-product-inline">
                            <span className="product-name">
                              {p.brand ? `${p.name} - ${p.brand}` : p.model}
                            </span>
                            <span className="product-price"> {p.price.toFixed(2)} LEK</span>
                            <span className="product-desc">{p.description}</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>

                  {totalPages > 1 && (
                    <div className="sd-pagination">
                      <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                        Prev
                      </button>
                      <span>Page {page} of {totalPages}</span>
                      <button
                        disabled={page === totalPages}
                        onClick={() => setPage(p => p + 1)}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </main>

          <aside className="sd-info-col">
            <div className="sd-shop-info">
              <div className="sd-shop-info-section">
                <h4><FaInfoCircle /> Description</h4>
                <p>{shop.description}</p>
              </div>
              <div className="sd-shop-info-section">
                <h4><FaPhoneAlt /> Contact</h4>
                <p><strong>Phone:</strong> {shop.businessPhoneNumber}</p>
                <p><strong>Business Email:</strong> {shop.businessEmailAddress}</p>
              </div>
              <div className="sd-shop-info-section">
                <h4><FaClock /> Hours</h4>
                <p><strong>Weekly:</strong> {openingText || '—'}</p>
                <p><strong>Today:</strong> {todayText || '—'}</p>
                <p>
                  <strong>Status:</strong>{' '}
                  <span className={`shop-status ${isOpen ? 'open' : 'closed'}`}>
                    {isOpen ? 'Open' : 'Closed'}
                  </span>
                </p>

                <div className="sd-shop-favorite" role="region" aria-labelledby="fav-heading">
                  <h4 id="fav-heading"><FaHeart /> Favorite</h4>
                  <div className="sd-fav-row">
                    <strong>Make this shop your favourite:</strong>
                    <button
                      onClick={toggleFavorite}
                      disabled={favLoading}
                      aria-pressed={isFavorited}
                      aria-label={isFavorited ? 'Unfavorite this shop' : 'Favorite this shop'}
                      className="sd-favorite-btn"
                      data-tip
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        borderRadius: '999px',
                        border: `1px solid ${isFavorited ? '#ff1616f3' : '#e5e7eb'}`,
                        background: isFavorited ? '#fa9097ff' : '#fff',
                        color: isFavorited ? '#e11d48' : '#111',
                        cursor: favLoading ? 'not-allowed' : 'pointer',
                      }}
                      type="button"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                        {isFavorited ? (
                          <path d="M12 21s-6.716-4.315-9.428-7.027A6.5 6.5 0 1 1 12 5.07a6.5 6.5 0 1 1 9.428 8.903C18.716 16.685 12 21 12 21z"></path>
                        ) : (
                          <path fill="none" stroke="currentColor" strokeWidth="1.8" d="M20.84 4.61a5.5 5.5 0 0 1 .11 7.78L12 21l-8.95-8.61a5.5 5.5 0 0 1 7.78-7.78L12 5.5l1.17-1.17a5.5 5.5 0 0 1 7.67-.28z"></path>
                        )}
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {coords && (
              <div className="sd-shop-location">
                <h3>Location on Map</h3>
                <small>{routeName}</small>
                <div className="sd-location-map">
                  <Map
                    height={300}
                    defaultCenter={coords}
                    defaultZoom={13}
                    metaWheel
                    mouseEvents
                  >
                    <Marker width={40} anchor={coords} />
                  </Map>
                </div>
                <a
                  href={`https://www.google.com/maps?q=${coords[0]},${coords[1]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="map-link"
                >
                  Open in Google Maps
                </a>
              </div>
            )}

            <div className="sd-shop-share">
              <h3>Share "{shop.name}"</h3>
              <br />
              <input
                type="text"
                readOnly
                value={window.location.href}
                onClick={e => e.target.select()}
                className="sd-share-input"
              />
              <button
                onClick={() => {navigator.clipboard.writeText(window.location.href); onClick && onClick();}}
                className="sd-share-btn"
              >
                Copy Link
              </button>

              <div className="sd-social-buttons">
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sd-social facebook"
                >
                  Share on Facebook
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=Check%20out%20${encodeURIComponent(shop.name)}!`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sd-social twitter"
                >
                  Share on X
                </a>
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out ${shop.name}: ${window.location.href}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sd-social whatsapp"
                >
                  Share on WhatsApp
                </a>
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=Check%20out%20${encodeURIComponent(shop.name)}!`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sd-social telegram"
                >
                  Share on Telegram
                </a>
              </div>
            </div>
          </aside>
        </div>
      </div>
      <Footer />
    </>
  );
}
