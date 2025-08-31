// src/Pages/ProductDetailsPage.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "../Styling/productdetails.css";

const API_BASE = "http://77.242.26.150:8000/api";

const getToken = () => {
  const raw = localStorage.getItem("token") || localStorage.getItem("authToken");
  if (!raw || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.token || parsed;
  } catch {
    return raw;
  }
};

const getHeaders = () => {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

// Safe slugify fallback if API doesn't return a slug
const slugify = (str) =>
  (str || "")
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const ProductDetailsPage = () => {
  const { t, ready } = useTranslation("productdetail", { useSuspense: false });
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [shopId, setShopId] = useState(null);
  const [shopSlug, setShopSlug] = useState(null);
  const [shopName, setShopName] = useState(null);
  const [loading, setLoading] = useState(true);

  const [booking, setBooking] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // --- My bookings count for this product ---
  const [myBookingCount, setMyBookingCount] = useState(0);
  const [checkingBookings, setCheckingBookings] = useState(false);

  // ------- Lightbox viewer state -------
  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoom, setZoom] = useState(1); // 1 = fit, 2 = zoomed
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // px offset while zoomed
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });

  // -------- Load "my bookings" count (client-side filter) --------
  const loadMyBookingCount = useCallback(async (clothingItemId) => {
    const token = getToken();
    if (!token || !clothingItemId) {
      setMyBookingCount(0);
      return;
    }

    setCheckingBookings(true);
    try {
      const res = await fetch(`${API_BASE}/Reservation/my-bookings`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`Bookings fetch failed: ${res.status}`);
      const list = await res.json();

      const count = Array.isArray(list)
        ? list.filter((b) => String(b?.clothingItemId) === String(clothingItemId)).length
        : 0;

      setMyBookingCount(count);
      try {
        localStorage.setItem(`reservations:${clothingItemId}`, String(count));
      } catch {}
    } catch {
      try {
        const saved = localStorage.getItem(`reservations:${clothingItemId}`);
        setMyBookingCount(saved ? parseInt(saved, 10) || 0 : 0);
      } catch {
        setMyBookingCount(0);
      }
    } finally {
      setCheckingBookings(false);
    }
  }, []);

  // Fetch product and resolve its shop
  useEffect(() => {
    let alive = true;

    const fetchAll = async () => {
      setLoading(true);
      try {
        // 1) Product
        const res = await fetch(`${API_BASE}/ClothingItem/${id}`, {
          headers: getHeaders(),
        });
        if (!res.ok) throw new Error(`Product fetch failed: ${res.status}`);
        const data = await res.json();
        if (!alive) return;

        setProduct(data);

        // init carousel index
        try {
          const imgs = Array.isArray(data.pictureUrls)
            ? data.pictureUrls
            : JSON.parse(data.pictureUrls || "[]");
          if (imgs.length > 0) setCurrentIndex(0);
        } catch {}

        // Load "my bookings" count for this item
        setMyBookingCount(0);
        loadMyBookingCount(data.clothingItemId);

        // 2) Resolve business -> slug
        const primaryBizId =
          (Array.isArray(data.businessIds) && data.businessIds[0]) ||
          data.businessId ||
          null;

        if (primaryBizId) {
          setShopId(primaryBizId);
          try {
            const bizRes = await fetch(`${API_BASE}/Business/${primaryBizId}`, {
              headers: getHeaders(),
            });
            if (bizRes.ok) {
              const biz = await bizRes.json();
              const resolvedSlug =
                (biz.slug && biz.slug.trim()) || slugify(biz.name);
              if (!alive) return;
              setShopSlug(resolvedSlug || null);
              setShopName(biz.name || null);
            }
          } catch {}
        }
      } catch {
        if (alive) setProduct(null);
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchAll();
    return () => {
      alive = false;
    };
  }, [id, loadMyBookingCount]);

  // Normalize images (supports array or JSON string)
  const parsedImages = useMemo(() => {
    if (!product) return [];
    try {
      if (Array.isArray(product.pictureUrls)) {
        return product.pictureUrls.filter(Boolean);
      }
      if (typeof product.pictureUrls === "string" && product.pictureUrls.trim() !== "") {
        try {
          const arr = JSON.parse(product.pictureUrls);
          return Array.isArray(arr) ? arr.filter(Boolean) : [product.pictureUrls];
        } catch {
          return [product.pictureUrls];
        }
      }
      return [];
    } catch {
      return [];
    }
  }, [product]);

  // Keep index valid if images change
  useEffect(() => {
    if (parsedImages.length === 0) setCurrentIndex(0);
    else if (currentIndex >= parsedImages.length) setCurrentIndex(0);
  }, [parsedImages, currentIndex]);

  const currentMainImage = parsedImages.length > 0 ? parsedImages[currentIndex] : null;

  const handleThumbnailClick = (_url, idx) => setCurrentIndex(idx);

  const handlePrev = () => {
    if (parsedImages.length === 0) return;
    setCurrentIndex((i) => (i - 1 + parsedImages.length) % parsedImages.length);
  };

  const handleNext = () => {
    if (parsedImages.length === 0) return;
    setCurrentIndex((i) => (i + 1) % parsedImages.length);
  };

  // Keyboard support for ← / →
  useEffect(() => {
    const onKey = (e) => {
      if (viewerOpen) {
        if (e.key === "Escape") {
          setViewerOpen(false);
          return;
        }
        if (e.key === "ArrowLeft") {
          handlePrev();
          return;
        }
        if (e.key === "ArrowRight") {
          handleNext();
          return;
        }
      } else {
        if (e.key === "ArrowLeft") handlePrev();
        if (e.key === "ArrowRight") handleNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerOpen, parsedImages.length]);

  const openViewer = () => {
    setViewerOpen(true);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };
  const closeViewer = () => {
    setViewerOpen(false);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setDragging(false);
  };

  const toggleZoom = () => {
    if (zoom === 1) {
      setZoom(2);
    } else {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    }
  };

  // Drag-to-pan when zoomed in
  const onMouseDownImg = (e) => {
    if (zoom === 1) return;
    e.preventDefault();
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    offsetStartRef.current = { ...offset };
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({ x: offsetStartRef.current.x + dx, y: offsetStartRef.current.y + dy });
  };
  const onMouseUp = () => setDragging(false);

  useEffect(() => {
    if (!viewerOpen || !dragging) return;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [viewerOpen, dragging]);

  const handleReserve = async () => {
    if (!product) return;
    const token = getToken();
    if (!token) {
      alert(t("booking.login_required", { defaultValue: "Please log in to make a reservation." }));
      return;
    }

    setBooking(true);
    try {
      const res = await fetch(`${API_BASE}/Reservation`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ clothingItemId: product.clothingItemId }),
      });

      if (res.status === 401) {
        navigate("/login");
        return;
      }

      if (res.ok) {
        alert(t("booking.success", { defaultValue: "Product booked successfully!" }));

        // Optimistic local increment for snappy UI
        setMyBookingCount((prev) => {
          const next = (prev || 0) + 1;
          try {
            localStorage.setItem(`reservations:${product.clothingItemId}`, String(next));
          } catch {}
          return next;
        });

        // Authoritative refresh from server, then notify other tabs/pages
        await loadMyBookingCount(product.clothingItemId);
        try {
          localStorage.setItem("reservationUpdated", Date.now().toString());
        } catch {}
      } else {
        const errText = await res.text();
        alert(t("errors.booking_api", { message: errText, defaultValue: `Booking error: ${errText}` }));
      }
    } catch {
      alert(t("errors.booking_failed", { defaultValue: "An error occurred while booking." }));
    } finally {
      setBooking(false);
    }
  };

  // Back to the product's shop
  const backToShop = async () => {
    if (shopSlug && shopSlug.trim()) {
      navigate(`/shop/${shopSlug.trim()}`);
      return;
    }
    if (shopName && slugify(shopName)) {
      navigate(`/shop/${slugify(shopName)}`);
      return;
    }
    if (shopId) {
      try {
        const shopRes = await fetch(`${API_BASE}/Business/${shopId}`, {
          headers: getHeaders(),
        });
        if (shopRes.ok) {
          const shop = await shopRes.json();
          const resolvedSlug = (shop.slug && shop.slug.trim()) || slugify(shop.name);
          if (resolvedSlug) {
            setShopSlug(resolvedSlug);
            setShopName(shop.name || null);
            navigate(`/shop/${resolvedSlug}`);
            return;
          }
        }
      } catch {}
    }
    navigate("/");
  };

  // while translations load (and to avoid showing raw keys)
  if (!ready) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="loading-text">
          {t("loading", { defaultValue: "Loading product details..." })}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="loading-text">{t("loading", { defaultValue: "Loading product details..." })}</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="error-container">
        <div className="error-message">{t("errors.not_found", { defaultValue: "Product not found." })}</div>
      </div>
    );
  }

  const arrowsDisabled = parsedImages.length <= 1;

  // Inline fallback so arrows always render even if CSS is cached
  const arrowBaseStyle = {
    position: "absolute",
    top: "40%",
    transform: "translateY(-50%)",
    border: "none",
    background: "rgba(0,0,0,0.45)",
    color: "#fff",
    width: 56,
    height: 56,
    borderRadius: 9999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    lineHeight: 1,
    cursor: "pointer",
    zIndex: 50,
    userSelect: "none",
  };

  // Price formatting via i18n
  const priceNumber = Number(product.price);
  const priceLabel = !isNaN(priceNumber)
    ? t("price_fmt", { value: priceNumber.toFixed(2), defaultValue: `${priceNumber.toFixed(2)} LEK` })
    : t("price_fmt", { value: product.price, defaultValue: `${product.price} LEK` });

  return (
    <>
      <Navbar />
      <div className="product-detail-container">
        <div className="top-back-button-wrapper">
          <button
            type="button"
            onClick={backToShop}
            className="back-to-shop-button"
          >
            {t("nav.back_to_shop", { defaultValue: "← Back to Shop" })}
          </button>
        </div>

        <div className="product-main">
          <div
            className="product-images"
            style={{ position: "relative", isolation: "isolate" }}
          >
            {/* Main image + arrows */}
            {currentMainImage && (
              <>
                <button
                  type="button"
                  aria-label={t("carousel.prev", { defaultValue: "Previous image" })}
                  onClick={handlePrev}
                  disabled={arrowsDisabled}
                  className="carousel-arrow left"
                  style={{
                    ...arrowBaseStyle,
                    left: 8,
                    opacity: arrowsDisabled ? 0.35 : 1,
                  }}
                >
                  ‹
                </button>

                <img
                  src={currentMainImage}
                  alt={t("carousel.main_alt", { defaultValue: "Main product" })}
                  className="main-image"
                  style={{ display: "block", width: "100%", cursor: "zoom-in" }}
                  onClick={openViewer}
                />

                <button
                  type="button"
                  aria-label={t("carousel.next", { defaultValue: "Next image" })}
                  onClick={handleNext}
                  disabled={arrowsDisabled}
                  className="carousel-arrow right"
                  style={{
                    ...arrowBaseStyle,
                    right: 8,
                    opacity: arrowsDisabled ? 0.35 : 1,
                  }}
                >
                  ›
                </button>
              </>
            )}

            {/* Thumbnails */}
            <div className="thumbnail-list">
              {parsedImages.slice(0, 10).map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={t("carousel.thumb_alt", { index: idx + 1, defaultValue: `Thumbnail ${idx + 1}` })}
                  onClick={() => handleThumbnailClick(url, idx)}
                  className={`thumbnail ${currentIndex === idx ? "active" : ""}`}
                />
              ))}
            </div>
          </div>

          <div className="product-info">
            <h1>
              {product.name} – {product.brand}
            </h1>

            <div className="product-info-grid">
              {/* inside the product-info-grid */}
              <div className="info-card">
                <p>
                  <strong>{t("fields.model", { defaultValue: "Model" })}:</strong> {product.model}
                </p>
              </div>
              <div className="info-card">
                <p>
                  <strong>{t("fields.description", { defaultValue: "Description" })}:</strong> {product.description}
                </p>
              </div>
              <div className="info-card price-card">
                <p>
                  <strong>{t("fields.price", { defaultValue: "Price" })}:</strong> {priceLabel}
                </p>
              </div>
              <div className="info-card">
                <p>
                  <strong>{t("fields.quantity", { defaultValue: "Quantity" })}:</strong> {product.quantity}
                </p>
              </div>
              <div className="info-card">
                <p>
                  <strong>{t("fields.material", { defaultValue: "Material" })}:</strong> {product.material}
                </p>
              </div>
              <div className="info-card">
                <p>
                  <strong>{t("fields.colors", { defaultValue: "Colors" })}:</strong>{" "}
                  {Array.isArray(product.colors) ? product.colors.join(", ") : product.colors}
                </p>
              </div>
              <div className="info-card">
                <p>
                  <strong>{t("fields.size", { defaultValue: "Size" })}:</strong> {product.sizes}
                </p>
              </div>
            </div>

            {/* Booking controls */}
            <button
              onClick={handleReserve}
              disabled={booking}
              className="rezerve-button"
            >
              {booking
                ? t("booking.reserving", { defaultValue: "Booking this product..." })
                : myBookingCount > 0
                ? t("booking.reserve_another", { defaultValue: "Book Another" })
                : t("booking.reserve", { defaultValue: "Book Product" })}
            </button>

            {myBookingCount > 0 && (
              <div className="info-card" style={{ marginTop: 8 }}>
                <p>
                  <strong>{t("booking.count_label", { defaultValue: "Booked" })}:</strong>{" "}
                  {checkingBookings ? "…" : myBookingCount}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------- LIGHTBOX VIEWER ---------- */}
      {viewerOpen && (
        <div
          className="lightbox-overlay"
          role="dialog"
          aria-modal="true"
          onClick={closeViewer}
        >
          <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
            {/* Close */}
            <button
              className="lightbox-close"
              aria-label={t("lightbox.close", { defaultValue: "Close" })}
              onClick={closeViewer}
              title={t("lightbox.close", { defaultValue: "Close" })}
            >
              ×
            </button>

            {/* Prev / Next */}
            <button
              className="lightbox-arrow left"
              onClick={handlePrev}
              aria-label={t("carousel.prev", { defaultValue: "Previous image" })}
            >
              ‹
            </button>
            <button
              className="lightbox-arrow right"
              onClick={handleNext}
              aria-label={t("carousel.next", { defaultValue: "Next image" })}
            >
              ›
            </button>

            {/* Image viewport */}
            <div className="lightbox-viewport">
              <img
                src={currentMainImage}
                alt={t("carousel.main_alt", { defaultValue: "Main product" })}
                className="lightbox-image"
                onMouseDown={onMouseDownImg}
                onClick={toggleZoom}
                style={{
                  cursor: zoom === 1 ? "zoom-in" : dragging ? "grabbing" : "grab",
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
                }}
                draggable={false}
              />
            </div>

            {/* Toolbar */}
            <div className="lightbox-toolbar">
              <button
                className="lightbox-tool"
                onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
                disabled={zoom <= 1}
                title={t("lightbox.zoom_out", { defaultValue: "Zoom out" })}
              >
                −
              </button>
              <span className="lightbox-zoom-label">{Math.round(zoom * 100)}%</span>
              <button
                className="lightbox-tool"
                onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                title={t("lightbox.zoom_in", { defaultValue: "Zoom in" })}
              >
                +
              </button>
              <button
                className="lightbox-tool"
                onClick={() => {
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
                title={t("lightbox.reset", { defaultValue: "Reset" })}
              >
                100%
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
};

export default ProductDetailsPage;
