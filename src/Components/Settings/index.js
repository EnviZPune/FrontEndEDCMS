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

const LOADING_GIF_LIGHT = "Assets/triwears-black-loading.gif"; 
const LOADING_GIF_DARK = "Assets/triwears-white-loading.gif"; 

function collectEmployeeBusinessIds(userInfo) {
  const ids = new Set();

  // common single-value fields
  if (userInfo?.employeeOfBusinessId != null) ids.add(Number(userInfo.employeeOfBusinessId));
  if (userInfo?.businessId != null && (userInfo?.role === "employee" || userInfo?.role === "Employee"))
    ids.add(Number(userInfo.businessId));

  // arrays of ids
  (userInfo?.employeeBusinessIds || userInfo?.businessIds || []).forEach((id) => {
    if (id != null) ids.add(Number(id));
  });

  // arrays of objects
  (userInfo?.employeeBusinesses || userInfo?.businesses || []).forEach((b) => {
    const bid = b?.businessId ?? b?.id;
    if (bid != null) ids.add(Number(bid));
  });

  // role assignments like [{ businessId, role }]
  (userInfo?.roleAssignments || []).forEach((ra) => {
    if (!ra) return;
    const r = String(ra.role || "").toLowerCase();
    const bid = ra.businessId ?? ra.id;
    if (r === "employee" && bid != null) ids.add(Number(bid));
  });

  return ids;
}

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
  const roleLc = (role || "").toLowerCase();

  // Restrict visible businesses for employees
  const businesses = useMemo(() => {
    const list = Array.isArray(rawBusinesses) ? rawBusinesses : [];
    if (roleLc !== "employee") return list;

    const allowedIds = collectEmployeeBusinessIds(userInfo);
    // If we discovered explicit allowed IDs, filter; otherwise assume API already scoped
    if (allowedIds.size > 0) {
      return list.filter((b) => {
        const id = b?.businessId ?? b?.id;
        return id != null && allowedIds.has(Number(id));
      });
    }
    return list;
  }, [rawBusinesses, roleLc, userInfo]);

  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [selectedPanel, setSelectedPanel] = useState("BusinessInfo");

  // Redirect if the role is not allowed
  useEffect(() => {
    if (role != null && !ALLOWED_ROLES.has(roleLc)) {
      navigate("/unauthorized", { replace: true });
    }
  }, [role, roleLc, navigate]);

  // Auto-select first business when data loads (owner and employee)
  useEffect(() => {
    if (!loading && businesses.length > 0 && !selectedBusiness) {
      setSelectedBusiness(businesses[0]);
    }
  }, [loading, businesses, selectedBusiness]);

  // If current selected business disappears (deleted / permissions changed), pick first
  useEffect(() => {
    if (!selectedBusiness) return;
    const sbId = selectedBusiness?.businessId ?? selectedBusiness?.id;
    const stillExists = businesses.some((b) => {
      const id = b?.businessId ?? b?.id;
      return id === sbId;
    });
    if (!stillExists) setSelectedBusiness(businesses[0] ?? null);
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
    );
  }

  // Empty state: no businesses for this user (after employee scoping)
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
