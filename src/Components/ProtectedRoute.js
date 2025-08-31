// src/Pages/Panel.js
import React, { useState } from "react";
import SupportDashboard from "../Pages/SupportDashboard"

const tabs = [{ key: "support", label: "Home" }];

export default function Panel() {
  const [active, setActive] = useState("support");
  return (
    <div className="panel-root">
      <div className="panel-header">
        <h1>Control Panel</h1>
        <div className="panel-tabs">
          {tabs.map((t) => (
            <a href="/"><button
              key={t.key}
              className={`panel-tab ${active === t.key ? "active" : ""}`}
              onClick={() => setActive(t.key)}
            >
              {t.label}
            </button></a>
          ))}
        </div>
      </div>
      <div className="panel-body">
        {active === "support" && <SupportDashboard />}
      </div>
    </div>
  );
}
