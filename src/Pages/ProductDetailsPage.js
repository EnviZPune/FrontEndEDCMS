// ProductDetailsPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [shopId, setShopId] = useState(null);
  const [shopSlug, setShopSlug] = useState(null);
  const [shopName, setShopName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // ------- Lightbox viewer state -------
  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoom, setZoom] = useState(1); // 1 = fit, 2 = zoomed
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // px offset while zoomed
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });

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
        } catch {
          /* ignore */
        }

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
          } catch {
            /* ignore; backToShop can retry */
          }
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
  }, [id]);

  // Normalize images (supports array or JSON string)
  const parsedImages = useMemo(() => {
    if (!product) return [];
    try {
      if (Array.isArray(product.pictureUrls)) {
        return product.pictureUrls.filter(Boolean);
      }
      if (
        typeof product.pictureUrls === "string" &&
        product.pictureUrls.trim() !== ""
      ) {
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

  const currentMainImage =
    parsedImages.length > 0 ? parsedImages[currentIndex] : null;

  const handleThumbnailClick = (_url, idx) => setCurrentIndex(idx);

  const handlePrev = () => {
    if (parsedImages.length === 0) return;
    setCurrentIndex(
      (i) => (i - 1 + parsedImages.length) % parsedImages.length
    );
  };

  const handleNext = () => {
    if (parsedImages.length === 0) return;
    setCurrentIndex((i) => (i + 1) % parsedImages.length);
  };

  // Keyboard support for ← / →
  useEffect(() => {
    const onKey = (e) => {
      if (viewerOpen) {
        if (e.key === "Escape") { setViewerOpen(false); return; }
        if (e.key === "ArrowLeft") { handlePrev(); return; }
        if (e.key === "ArrowRight") { handleNext(); return; }
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
      alert("Please log in to make a reservation.");
      return;
    }

    setBooking(true);
    try {
      const res = await fetch(`${API_BASE}/Reservation`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ clothingItemId: product.clothingItemId }),
      });
      if (res.ok) {
        alert("Product booked successfully!");
      } else {
        const errText = await res.text();
        alert("Booking error: " + errText);
      }
    } catch {
      alert("An error occurred while booking.");
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
          const resolvedSlug =
            (shop.slug && shop.slug.trim()) || slugify(shop.name);
          if (resolvedSlug) {
            setShopSlug(resolvedSlug);
            setShopName(shop.name || null);
            navigate(`/shop/${resolvedSlug}`);
            return;
          }
        }
      } catch {
        /* ignore */
      }
    }
    navigate("/");
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="loading-text">Loading product details...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="error-container">
        <div className="error-message">Product not found.</div>
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
            ← Back to Shop
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
                  aria-label="Previous image"
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
                  alt="Main product"
                  className="main-image"
                  style={{ display: "block", width: "100%", cursor: "zoom-in" }}
                  onClick={openViewer}
                />

                <button
                  type="button"
                  aria-label="Next image"
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
                  alt={`Thumbnail ${idx + 1}`}
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
              <div className="info-card">
                <p>
                  <strong>Model:</strong> {product.model}
                </p>
              </div>
              <div className="info-card">
                <p>
                  <strong>Description:</strong> {product.description}
                </p>
              </div>
              <div className="info-card price-card">
                <p>
                  <strong>Price:</strong> {product.price} LEK
                </p>
              </div>
              <div className="info-card">
                <p>
                  <strong>Quantity:</strong> {product.quantity}
                </p>
              </div>
              <div className="info-card">
                <p>
                  <strong>Material:</strong> {product.material}
                </p>
              </div>
              <div className="info-card">
                <p>
                  <strong>Colors:</strong>{" "}
                  {Array.isArray(product.colors)
                    ? product.colors.join(", ")
                    : product.colors}
                </p>
              </div>
              <div className="info-card">
                <p>
                  <strong>Size:</strong> {product.sizes}
                </p>
              </div>
            </div>

            <button
              onClick={handleReserve}
              disabled={booking}
              className="rezerve-button"
            >
              {booking ? "Booking this product..." : "Book Product"}
            </button>
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
              aria-label="Close"
              onClick={closeViewer}
              title="Close (Esc)"
            >
              ×
            </button>

            {/* Prev / Next */}
            <button
              className="lightbox-arrow left"
              onClick={handlePrev}
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              className="lightbox-arrow right"
              onClick={handleNext}
              aria-label="Next image"
            >
              ›
            </button>

            {/* Image viewport */}
            <div className="lightbox-viewport">
              <img
                src={currentMainImage}
                alt="Zoomed product"
                className="lightbox-image"
                onMouseDown={onMouseDownImg}
                onClick={toggleZoom}
                style={{
                  cursor:
                    zoom === 1
                      ? "zoom-in"
                      : dragging
                      ? "grabbing"
                      : "grab",
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
                title="Zoom out"
              >
                −
              </button>
              <span className="lightbox-zoom-label">{Math.round(zoom * 100)}%</span>
              <button
                className="lightbox-tool"
                onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                title="Zoom in"
              >
                +
              </button>
              <button
                className="lightbox-tool"
                onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
                title="Reset"
              >
                100%
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ---------- /LIGHTBOX VIEWER ---------- */}

      <Footer />
    </>
  );
};

export default ProductDetailsPage;
