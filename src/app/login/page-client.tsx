"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("admin@virtualsolutionsindia.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const domain = "@virtualsolutionsindia.com";
  const isInvalidDomain =
    email.includes("@") && !email.toLowerCase().endsWith(domain);

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
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setLoading(false);
      setError("Unable to authenticate. Please check your credentials.");
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
                placeholder="name@virtualsolutionsindia.com"
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
            <div className="label-row">
              <label htmlFor="password">Password</label>
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
    </div>
  );
}
