"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export function AuthPortal({ initialMode = "login" }: { initialMode?: "login" | "register" | "otp" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/dashboard/autodm";
  const urlMode = searchParams.get("mode") as "login" | "register" | "otp" | null;

  const [mode, setMode] = useState<"login" | "register" | "otp">(initialMode || urlMode || "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isDeliveredViaEmail, setIsDeliveredViaEmail] = useState(false);
  const [receivedOtp, setReceivedOtp] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (urlMode) setMode(urlMode);
    else if (initialMode) setMode(initialMode);
  }, [initialMode, urlMode]);

  function persistSessionToken(token?: string) {
    if (!token) return;
    try {
      const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
      document.cookie = `hp_session=${token}; path=/; max-age=2592000; SameSite=Lax${isHttps ? "; Secure" : ""}`;
      localStorage.setItem("hp_token", token);
    } catch {}
  }

  async function handlePasswordAuth(e: React.FormEvent) {
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

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { message: res.statusText || "Server response error. Please try again." };
      }

      if (!res.ok) {
        setError(data.message || "Authentication failed. Please verify your credentials.");
        return;
      }

      if (data.token) {
        persistSessionToken(data.token);
      }

      setSuccessMsg(
        mode === "login"
          ? "Welcome back! Launching your creator workspace…"
          : "Account created successfully! Launching your store…"
      );

      setTimeout(() => {
        window.location.href = nextUrl;
      }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/v1/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { message: "Server communication error." };
      }

      if (!res.ok) {
        setError(data.message || "Could not send verification code.");
        return;
      }

      const receivedCode = !data.isDeliveredViaEmail ? (data.code || data.debugOtp) : null;
      setOtpSent(true);
      setIsDeliveredViaEmail(Boolean(data.isDeliveredViaEmail));
      setPreviewUrl(data.previewUrl || null);
      if (receivedCode) {
        setReceivedOtp(receivedCode);
        setOtpCode(receivedCode);
      } else {
        setReceivedOtp(null);
        setOtpCode("");
      }
      if (data.isDeliveredViaEmail) {
        setSuccessMsg(
          data.provider === "ethereal"
            ? `✓ Email dispatched! Check preview webmail below or use code.`
            : `✓ Verification code sent to ${email}. Please check your inbox.`
        );
      } else {
        setSuccessMsg(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/v1/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, code: otpCode }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { message: "Server response error." };
      }

      if (!res.ok) {
        setError(data.message || "Invalid verification code.");
        return;
      }

      if (data.token) {
        persistSessionToken(data.token);
      }

      setSuccessMsg("Verification successful! Launching your creator workspace…");

      setTimeout(() => {
        window.location.href = nextUrl;
      }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleInstagramConnect() {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    window.location.href = `/v1/auth/instagram/start?return_origin=${encodeURIComponent(origin)}&return_to=${encodeURIComponent(origin + nextUrl)}`;
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
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
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
            Sign in to manage your storefront, payments, and Instagram AutoDM automations.
          </p>
        </div>

        {/* 1-Click Instagram Direct Sign-In */}
        <button
          type="button"
          onClick={handleInstagramConnect}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: "12px",
            border: "1px solid rgba(225, 48, 108, 0.2)",
            background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
            color: "#ffffff",
            fontSize: "0.92rem",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            marginBottom: "20px",
            boxShadow: "0 4px 14px rgba(220, 39, 67, 0.25)",
            transition: "transform 0.15s ease",
          }}
        >
          <span style={{ fontSize: "1.1rem" }}>📸</span>
          <span>Continue with Instagram (Meta OAuth)</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
          <span style={{ fontSize: "0.76rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            or use email
          </span>
          <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
        </div>

        {/* Tab Toggle */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            background: "#f1f5f9",
            borderRadius: "12px",
            padding: "4px",
            marginBottom: "20px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            style={{
              padding: "8px 0",
              borderRadius: "9px",
              border: "none",
              fontSize: "0.82rem",
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
              padding: "8px 0",
              borderRadius: "9px",
              border: "none",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              background: mode === "register" ? "#ffffff" : "transparent",
              color: mode === "register" ? "#0f172a" : "#64748b",
              boxShadow: mode === "register" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            Sign Up
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("otp");
              setError(null);
            }}
            style={{
              padding: "8px 0",
              borderRadius: "9px",
              border: "none",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              background: mode === "otp" ? "#ffffff" : "transparent",
              color: mode === "otp" ? "#0f172a" : "#64748b",
              boxShadow: mode === "otp" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            Email Code
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

        {/* Auth Forms */}
        {mode === "otp" ? (
          !otpSent ? (
            <form onSubmit={handleSendOtp} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
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
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "13px 20px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #0284c7 0%, #0066fe 100%)",
                  color: "#ffffff",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  border: "none",
                  cursor: loading ? "wait" : "pointer",
                  boxShadow: "0 4px 14px rgba(0, 102, 254, 0.35)",
                }}
              >
                {loading ? "Sending Code…" : "Send Verification Code →"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {!isDeliveredViaEmail && receivedOtp && (
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: "14px",
                    background: "rgba(2, 132, 199, 0.08)",
                    border: "1px solid rgba(2, 132, 199, 0.25)",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
                    Your Verification Code
                  </div>
                  <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0284c7", letterSpacing: "0.25em", fontFamily: "monospace" }}>
                    {receivedOtp}
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "#64748b", marginTop: "4px" }}>
                    Auto-filled below. Click below to verify and enter workspace.
                  </div>
                  {previewUrl && (
                    <div style={{ marginTop: "10px" }}>
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 12px",
                          borderRadius: "8px",
                          background: "#e0f2fe",
                          color: "#0369a1",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          textDecoration: "none",
                        }}
                      >
                        <span>📬 Open Test Webmail Preview →</span>
                      </a>
                    </div>
                  )}
                </div>
              )}
              {isDeliveredViaEmail && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                    color: "#059669",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    textAlign: "center",
                  }}
                >
                  <div>✉️ 6-digit verification code sent to <strong>{email}</strong>. Please check your inbox and enter the code below.</div>
                  {previewUrl && (
                    <div style={{ marginTop: "8px" }}>
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 12px",
                          borderRadius: "8px",
                          background: "#ecfdf5",
                          color: "#047857",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          textDecoration: "none",
                        }}
                      >
                        <span>📬 Open Test Webmail Inbox →</span>
                      </a>
                    </div>
                  )}
                </div>
              )}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155" }}>
                    Enter 6-Digit Code
                  </label>
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    style={{ fontSize: "0.78rem", color: "#0284c7", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                  >
                    Change Email
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  required
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    fontSize: "1.2rem",
                    letterSpacing: "0.2em",
                    textAlign: "center",
                    fontWeight: 700,
                    outline: "none",
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "13px 20px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #0284c7 0%, #0066fe 100%)",
                  color: "#ffffff",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  border: "none",
                  cursor: loading ? "wait" : "pointer",
                  boxShadow: "0 4px 14px rgba(0, 102, 254, 0.35)",
                }}
              >
                {loading ? "Verifying…" : "Verify & Launch Workspace →"}
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handlePasswordAuth} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
                  placeholder="e.g. Priya Sharma or Alex Rivera"
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
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  Min. 8 characters
                </span>
              </div>
              <div style={{ position: "relative", width: "100%" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "11px 44px 11px 14px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.92rem",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: showPassword ? "#0284c7" : "#94a3b8",
                    padding: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "6px",
                    transition: "color 0.15s ease",
                  }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

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
        )}

        {/* Footer Navigation */}
        <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #f1f5f9", textAlign: "center", display: "flex", flexDirection: "column", gap: "10px" }}>
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
