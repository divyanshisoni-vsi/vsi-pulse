"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  X,
  RefreshCw,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/dashboard";

  const domain = "@virtualsolutionsindia.com";

  // Login Form States (clean, empty baseline)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot Password States
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStep, setForgotStep] = useState<"email" | "code" | "success">("email");
  const [resetCode, setResetCode] = useState("");
  const [enteredCode, setEnteredCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const isInvalidDomain =
    email.includes("@") && !email.toLowerCase().endsWith(domain);

  useEffect(() => {
    // Pre-warm dashboard route in browser cache for instant navigation
    router.prefetch("/dashboard");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim().toLowerCase();

    // Domain validation check
    if (!trimmedEmail.endsWith(domain)) {
      setError(
        `Domain restricted: Access is permitted only for official ${domain} accounts.`
      );
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email: trimmedEmail,
        password,
        redirect: false,
      });

      setLoading(false);

      if (res?.error) {
        setError("Invalid credentials. Please verify your email and password.");
      } else {
        window.location.href = callbackUrl;
      }
    } catch {
      setLoading(false);
      setError("Unable to authenticate. Please check your credentials.");
    }
  }

  // Handle Forgot Password - Request Code
  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setForgotError("");
    setForgotMsg("");

    const targetEmail = forgotEmail.trim().toLowerCase();
    if (!targetEmail.endsWith(domain)) {
      setForgotError(`Only official ${domain} accounts can request a reset.`);
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request-code", email: targetEmail }),
      });
      const data = await res.json();
      setForgotLoading(false);

      if (!res.ok) {
        setForgotError(data.error || "Failed to generate security code.");
      } else {
        setForgotMsg(`A verification code was dispatched to ${targetEmail}`);
        setForgotStep("code");
      }
    } catch {
      setForgotLoading(false);
      setForgotError("Network error. Please try again.");
    }
  }

  // Handle Forgot Password - Verify and Reset
  async function handleVerifyReset(e: React.FormEvent) {
    e.preventDefault();
    setForgotError("");

    if (newPassword !== confirmPassword) {
      setForgotError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setForgotError("New password must be at least 6 characters.");
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify-reset",
          email: forgotEmail.trim().toLowerCase(),
          code: enteredCode.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      setForgotLoading(false);

      if (!res.ok) {
        setForgotError(data.error || "Failed to reset password.");
      } else {
        setForgotStep("success");
      }
    } catch {
      setForgotLoading(false);
      setForgotError("Network error. Please try again.");
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        {/* Brand Header */}
        <div className="login-brand">
          <div className="login-badge">
            <span className="dot"></span>
            VIRTUAL SOLUTIONS INDIA
          </div>
          <h1 className="login-title">
            VSI <span>Pulse</span>
          </h1>
          <p className="login-subtitle">
            Performance Management & Productivity Portal
          </p>
        </div>

        {/* Security / Domain Notice */}
        <div className="domain-banner">
          <ShieldCheck className="icon-shield" size={18} />
          <div>
            <strong>Authorized Domain Only</strong>
            <span>Restricted strictly to @virtualsolutionsindia.com</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Official VSI Email</label>
            <div className="input-wrap">
              <Mail className="input-icon" size={16} />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
                placeholder="yourname@virtualsolutionsindia.com"
                className={isInvalidDomain ? "input-warning" : ""}
              />
            </div>
            {isInvalidDomain && (
              <span className="domain-warning">
                Must end with @virtualsolutionsindia.com
              </span>
            )}
          </div>

          <div className="form-group">
            <div className="label-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label htmlFor="password">Password</label>
              <button
                type="button"
                className="forgot-link"
                onClick={() => {
                  setForgotEmail(email);
                  setForgotError("");
                  setForgotMsg("");
                  setForgotStep("email");
                  setShowForgot(true);
                }}
              >
                Forgot password?
              </button>
            </div>
            <div className="input-wrap">
              <Lock className="input-icon" size={16} />
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="login-error-msg">
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || isInvalidDomain}
            className="submit-btn"
          >
            {loading ? (
              <span>Authenticating…</span>
            ) : (
              <>
                <span>Sign in to VSI Pulse</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Role architecture note */}
        <div className="roles-info">
          <div className="role-chip">
            <span className="role-title">Admin</span>
            <span className="role-desc">Manager & Administrative control</span>
          </div>
          <div className="role-chip">
            <span className="role-title">Employee</span>
            <span className="role-desc">Personal targets & activity logs</span>
          </div>
        </div>

        <div className="login-footer">
          VSI Pulse &copy; {new Date().getFullYear()} Virtual Solutions India. All rights reserved.
        </div>
      </div>

      {/* =========================================================
          FORGOT PASSWORD MODAL
         ========================================================= */}
      {showForgot && (
        <div className="modal-overlay" onClick={() => setShowForgot(false)}>
          <div
            className="modal-dialog"
            style={{ maxWidth: "440px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <KeyRound size={17} style={{ color: "#2563eb" }} />
                <h2>Account Password Recovery</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setShowForgot(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-content">
              {/* Step 1: Request Code */}
              {forgotStep === "email" && (
                <form onSubmit={handleRequestCode} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748b", lineHeight: "1.5" }}>
                    Enter your registered <strong>@virtualsolutionsindia.com</strong> account email to receive a secure recovery code.
                  </p>

                  <div className="form-group">
                    <label>Official VSI Email</label>
                    <div className="input-wrap">
                      <Mail className="input-icon" size={16} />
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="yourname@virtualsolutionsindia.com"
                      />
                    </div>
                  </div>

                  {forgotError && (
                    <div className="login-error-msg">
                      <AlertCircle size={14} style={{ flexShrink: 0 }} />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowForgot(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={forgotLoading}
                    >
                      {forgotLoading ? "Verifying…" : "Get Recovery Code"}
                    </button>
                  </div>
                </form>
              )}

              {/* Step 2: Code Verification & New Password */}
              {forgotStep === "code" && (
                <form onSubmit={handleVerifyReset} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {/* Email Sent Notice */}
                  <div
                    style={{
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      borderRadius: "6px",
                      padding: "14px 16px",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#1e40af", fontWeight: 700, fontSize: "12px" }}>
                      <Mail size={16} />
                      <span>Verification Code Emailed</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#3b82f6", marginTop: "4px", lineHeight: "1.5" }}>
                      We have dispatched a 6-digit recovery code to <strong>{forgotEmail}</strong>. Please check your inbox (and spam folder) and enter it below.
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Enter 6-Digit Code from Your Email</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={enteredCode}
                      onChange={(e) => setEnteredCode(e.target.value)}
                      placeholder="123456"
                      style={{
                        textAlign: "center",
                        fontSize: "18px",
                        letterSpacing: "4px",
                        fontWeight: 700,
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label>New Password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                    />
                  </div>

                  <div className="form-group">
                    <label>Confirm New Password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                    />
                  </div>

                  {forgotError && (
                    <div className="login-error-msg">
                      <AlertCircle size={14} style={{ flexShrink: 0 }} />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => setForgotStep("email")}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={forgotLoading}
                    >
                      {forgotLoading ? "Updating…" : "Reset & Save Password"}
                    </button>
                  </div>
                </form>
              )}

              {/* Step 3: Success Confirmation */}
              {forgotStep === "success" && (
                <div style={{ textAlign: "center", padding: "16px 8px" }}>
                  <CheckCircle2 size={42} style={{ color: "#10b981", margin: "0 auto 12px" }} />
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "17px", fontWeight: 700, color: "#0f172a" }}>
                    Password Successfully Reset!
                  </h3>
                  <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "#64748b" }}>
                    Your official VSI account password has been updated. You can now log in immediately.
                  </p>
                  <button
                    className="btn-primary"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => {
                      setShowForgot(false);
                      setPassword("");
                      setEmail(forgotEmail);
                    }}
                  >
                    Return to Sign In
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
