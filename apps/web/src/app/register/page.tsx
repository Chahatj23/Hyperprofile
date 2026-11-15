"use client";

import { Suspense } from "react";
import { AuthPortal } from "@/components/auth/AuthPortal";

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0a0e17", color: "#ffffff" }}>
          Loading registration portal…
        </div>
      }
    >
      <AuthPortal initialMode="register" />
    </Suspense>
  );
}
