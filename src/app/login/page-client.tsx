"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("admin@virtualsolutionsindia.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      setLoading(false);

      if (res?.error) {
        setError("Invalid email or password.");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setLoading(false);
      setError("Invalid email or password.");
    }
  }

  return (
    <div className="login">
      <div className="loginbox">
        <div className="pill" style={{ display: "inline-block" }}>
          VIRTUAL SOLUTIONS INDIA
        </div>
        <h1>Welcome to VSI Pulse</h1>
        <p>Interactive performance management system</p>

        <form onSubmit={handleSubmit} style={{ marginTop: "16px" }}>
          <div className="field">
            <label>Official VSI email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@virtualsolutionsindia.com"
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn"
            style={{ width: "100%", marginTop: "10px" }}
          >
            {loading ? "Signing in…" : "Enter →"}
          </button>

          {error && (
            <p style={{ color: "var(--red)", marginTop: "10px", fontSize: "13px" }}>
              {error}
            </p>
          )}

          <p className="small" style={{ marginTop: "16px" }}>
            Official VSI performance system. Use your authorized account credentials.
          </p>
        </form>
      </div>
    </div>
  );
}
