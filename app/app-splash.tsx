"use client";

import { useEffect, useState } from "react";

export function AppSplash() {
  const [phase, setPhase] = useState<"visible" | "leaving" | "hidden">("visible");

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setPhase("leaving"), 1250);
    const hideTimer = window.setTimeout(() => setPhase("hidden"), 1650);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      className={`app-splash ${phase === "leaving" ? "app-splash--leaving" : ""}`}
      role="status"
      aria-label="Coppersmith AI uygulaması açılıyor"
    >
      <div className="app-splash__content">
        <img
          className="app-splash__icon"
          src="/coppersmith-ai-icon.png"
          alt=""
          width="112"
          height="112"
        />
        <p className="app-splash__brand">Coppersmith AI</p>
        <p className="app-splash__product">İş Takip Merkezi</p>
        <span className="app-splash__loader" aria-hidden="true"><span /></span>
      </div>
    </div>
  );
}
