"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/dashboard/autodm";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("chahat@jinbandhan.com");
  const [password, setPassword] = useState("Jinbandhan@123");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/v1/auth/login" : "/v1/auth/register";
      const payload =
        mode === "login"
          ? { email, password }
          : { email, password, displayName: displayName || email.split("@")[0] };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Authentication failed. Please check your credentials.");
        return;
      }

      setSuccessMsg(
        mode === "login"
          ? "Welcome back! Launching your creator workspace…"
          : "Account created successfully! Setting up your store…"
      );

      setTimeout(() => {
        router.push(nextUrl);
        router.refresh();
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "radial-gradient(1000px 600px at 50% 0%, rgba(2, 132, 199, 0.08), transparent 70%), #0a0e17",
        padding: "24px 16px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "min(460px, 100%)",
          background: "#ffffff",
          borderRadius: "24px",
          padding: "36px 32px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #0284c7 0%, #0066fe 100%)",
              color: "#ffffff",
              display: "grid",
              placeItems: "center",
              fontSize: "1.5rem",
              fontWeight: 800,
              margin: "0 auto 14px",
              boxShadow: "0 6px 20px rgba(0, 102, 254, 0.35)",
            }}
          >
            ✦
          </div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              color: "#0f172a",
              margin: "0 0 6px",
              letterSpacing: "-0.02em",
            }}
          >
            Creator Workspace
          </h1>
          <p style={{ fontSize: "0.88rem", color: "#64748b", margin: 0, lineHeight: 1.45 }}>
            Sign in to manage your storefront, UPI payments, and Instagram AutoDM automations.
          </p>
        </div>

        {/* Tab Toggle */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            background: "#f1f5f9",
            borderRadius: "12px",
            padding: "4px",
            marginBottom: "24px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            style={{
              padding: "9px 0",
              borderRadius: "9px",
              border: "none",
              fontSize: "0.88rem",
              fontWeight: 700,
              cursor: "pointer",
              background: mode === "login" ? "#ffffff" : "transparent",
              color: mode === "login" ? "#0f172a" : "#64748b",
              boxShadow: mode === "login" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            style={{
              padding: "9px 0",
              borderRadius: "9px",
              border: "none",
              fontSize: "0.88rem",
              fontWeight: 700,
              cursor: "pointer",
              background: mode === "register" ? "#ffffff" : "transparent",
              color: mode === "register" ? "#0f172a" : "#64748b",
              boxShadow: mode === "register" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "10px",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              color: "#dc2626",
              fontSize: "0.84rem",
              fontWeight: 600,
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "10px",
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              color: "#059669",
              fontSize: "0.84rem",
              fontWeight: 600,
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>✓</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {mode === "register" && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#334155",
                  marginBottom: "6px",
                }}
              >
                Creator or Brand Name
              </label>
              <input
                type="text"
                placeholder="e.g. Jinbandhan or Chahat Jain"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required={mode === "register"}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "11px 14px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.92rem",
                  outline: "none",
                }}
              />
            </div>
          )}

          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.82rem",
                fontWeight: 700,
                color: "#334155",
                marginBottom: "6px",
              }}
            >
              Email Address
            </label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "11px 14px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                fontSize: "0.92rem",
                outline: "none",
              }}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#334155",
                }}
              >
                Password
              </label>
              {mode === "login" && (
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  Min. 6 characters
                </span>
              )}
            </div>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "11px 14px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                fontSize: "0.92rem",
                outline: "none",
              }}
            />
          </div>

          {/* Quick Demo Hint */}
          {mode === "login" && (
            <div
              style={{
                padding: "10px 12px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.76rem",
                color: "#475569",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>Demo Account: <strong>chahat@jinbandhan.com</strong></span>
              <button
                type="button"
                onClick={() => {
                  setEmail("chahat@jinbandhan.com");
                  setPassword("Jinbandhan@123");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#0284c7",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Fill credentials
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "4px",
              padding: "13px 20px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #0284c7 0%, #0066fe 100%)",
              color: "#ffffff",
              fontSize: "0.95rem",
              fontWeight: 700,
              border: "none",
              cursor: loading ? "wait" : "pointer",
              boxShadow: "0 4px 14px rgba(0, 102, 254, 0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {loading ? "Authenticating…" : mode === "login" ? "Sign In to Workspace →" : "Create Creator Account →"}
          </button>
        </form>

        {/* Footer Navigation */}
        <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #f1f5f9", textAlign: "center", display: "flex", flexDirection: "column", gap: "10px" }}>
          <Link
            href="/jinbandhan"
            style={{
              fontSize: "0.85rem",
              color: "#0284c7",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            View Public Creator Store (hyperprofile.bio/jinbandhan) ↗
          </Link>

          <Link
            href="/"
            style={{
              fontSize: "0.82rem",
              color: "#64748b",
              textDecoration: "none",
            }}
          >
            ← Back to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0a0e17", color: "#ffffff" }}>
          Loading authentication portal…
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
