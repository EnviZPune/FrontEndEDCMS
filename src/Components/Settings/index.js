import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SettingsLayout from "./SettingsLayout";
import BusinessInfoPanel from "./panels/BusinessInfoPanel";
import ProductPanel from "./panels/ProductPanel";
import SalesPanel from "./panels/SalesPanel";
import CategoryPanel from "./panels/CategoryPanel";
import PhotoPanel from "./panels/PhotoPanel";
import EmployeePanel from "./panels/EmployeePanel";
import PendingChangesPanel from "./panels/PendingChangesPanel";
import ReservationsPanel from "./panels/ReservationsPanel";
import NotificationHistoryPanel from "./panels/NotificationHistoryPanel";
import MyShopsPanel from "./panels/MyShopsPanel";
import DeleteBusinessPanel from "./panels/DeleteBusinessPanel";
import { useBusinesses } from "./hooks/useBusinesses";
import { useAuth } from "./hooks/useAuth";

const ALLOWED_ROLES = new Set(["owner", "employee"]);

const LOADING_GIF_LIGHT = "Assets/triwears-black-loading.gif"; // black logo for light mode
const LOADING_GIF_DARK = "Assets/triwears-white-loading.gif";  // white logo for dark mode

export default function Settings() {
  const navigate = useNavigate();
  const { t } = useTranslation("settings");

  // Detect system dark mode
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setIsDarkMode(e.matches);
    try {
      mql.addEventListener("change", onChange);
    } catch {
      mql.addListener(onChange);
    }
    return () => {
      try {
        mql.removeEventListener("change", onChange);
      } catch {
        mql.removeListener(onChange);
      }
    };
  }, []);

  const { businesses: rawBusinesses = [], loading, error } = useBusinesses();
  const { role, userInfo } = useAuth();

  const businesses = useMemo(
    () => (Array.isArray(rawBusinesses) ? rawBusinesses : []),
    [rawBusinesses]
  );

  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [selectedPanel, setSelectedPanel] = useState("BusinessInfo");

  // Redirect if the role is not allowed
  useEffect(() => {
    if (role != null && !ALLOWED_ROLES.has(role)) {
      navigate("/unauthorized", { replace: true });
    }
  }, [role, navigate]);

  // Auto-select first business when data loads
  useEffect(() => {
    if (!loading && businesses.length > 0 && !selectedBusiness) {
      setSelectedBusiness(businesses[0]);
    }
  }, [loading, businesses, selectedBusiness]);

  // If the currently selected business disappears from the list (deleted/changed),
  // pick the first available one.
  useEffect(() => {
    if (!selectedBusiness) return;
    const stillExists = businesses.some(
      (b) =>
        b?.businessId === selectedBusiness?.businessId ||
        b?.id === selectedBusiness?.id
    );
    if (!stillExists) {
      setSelectedBusiness(businesses[0] ?? null);
    }
  }, [businesses, selectedBusiness]);

  const handleSelectBusiness = useCallback((biz) => {
    setSelectedBusiness(biz);
  }, []);

  const handleSelectPanel = useCallback((panelKey) => {
    setSelectedPanel(panelKey);
  }, []);

  // Loading state: GIF + "Loading ..."
  if (loading) {
    return (
      <div className="loading-overlay" aria-live="polite" aria-busy="true">
        <img
          className="loading-gif"
          src={isDarkMode ? LOADING_GIF_DARK : LOADING_GIF_LIGHT}
          alt="Loading"
          width={140}
          height={140}
        />
        <p className="loading-text">Loading ...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="settings-component">
        <div className="settings-layout">
          <div className="settings-content">
            <div className="panel">
              <div className="error-state">
                <h3>
                  <span>⚠️</span> {t("states.error_title")}
                </h3>
                <p>{t("states.error_body")}</p>
                <button onClick={() => window.location.reload()}>
                  {t("actions.refresh")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state: no businesses for this user
  if (!loading && businesses.length === 0) {
    return (
      <div className="settings-component">
        <div className="settings-layout">
          <div className="settings-content">
            <div className="panel">
              <div className="empty-state">
                <h3>🏪 {t("states.no_business_title")}</h3>
                <p>{t("states.no_business_body")}</p>
                <button onClick={() => navigate("/become-owner")} className="btn-primary">
                  {t("actions.create_first_shop")}
                </button>
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => navigate("/")} className="btn-secondary">
                    {t("actions.back_home")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const panels = {
    BusinessInfo: <BusinessInfoPanel business={selectedBusiness} />,
    Products: <ProductPanel business={selectedBusiness} />,
    Sales: <SalesPanel business={selectedBusiness} />,
    Categories: <CategoryPanel business={selectedBusiness} />,
    Photos: <PhotoPanel business={selectedBusiness} />,
    Employees: <EmployeePanel business={selectedBusiness} />,
    PendingChanges: <PendingChangesPanel business={selectedBusiness} />,
    Reservations: <ReservationsPanel business={selectedBusiness} />,
    Notifications: <NotificationHistoryPanel business={selectedBusiness} />,
    MyShops: <MyShopsPanel businesses={businesses} />,
    DeleteBusiness: <DeleteBusinessPanel business={selectedBusiness} />
  };

  return (
    <SettingsLayout
      businesses={businesses}
      selectedBusiness={selectedBusiness}
      onSelectBusiness={handleSelectBusiness}
      selectedPanel={selectedPanel}
      onSelectPanel={handleSelectPanel}
      userRole={role}
      ownerName={userInfo?.firstName}
    >
      {panels[selectedPanel]}
    </SettingsLayout>
  );
}
