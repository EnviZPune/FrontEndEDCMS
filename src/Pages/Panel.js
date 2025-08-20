import React, { useState } from "react";
import SupportDashboard from "./SupportDashboard";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "../Styling/panel.css"

const tabs = [{ key: "support", label: "Support Dashboard" }];

export default function Panel() {
  const [active, setActive] = useState("support");
  return (
    <div>
      <Navbar />
    <div className="panel-root">
      <div className="panel-header">
        <h1>Control Panel</h1>
        <div className="panel-tabs">
          {tabs.map(t => (
            <button key={t.key} className={`panel-tab ${active === t.key ? "active" : ""}`} onClick={() => setActive(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-body">
        {active === "support" && <SupportDashboard />}
      </div>
    </div>
    <Footer />
    </div>
  );
}
