"use client";

import { useEffect } from "react";

export default function LogoutPage() {
  useEffect(() => {
    async function performLogout() {
      try {
        await fetch("/v1/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch {}

      try {
        document.cookie = "hp_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        localStorage.removeItem("hp_token");
      } catch {}

      window.location.href = "/login";
    }

    performLogout();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0a0e17",
        color: "#94a3b8",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "1.5rem", marginBottom: "12px" }}>Logging out…</div>
        <p style={{ margin: 0, fontSize: "0.85rem" }}>Clearing your workspace session securely.</p>
      </div>
    </div>
  );
}
