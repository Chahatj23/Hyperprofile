"use client";

import { Suspense } from "react";
import { AuthPortal } from "@/components/auth/AuthPortal";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0a0e17", color: "#ffffff" }}>
          Loading authentication portal…
        </div>
      }
    >
      <AuthPortal initialMode="login" />
    </Suspense>
  );
}
