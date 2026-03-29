"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { login as apiLogin, signup as apiSignup } from "@/utils/api";
import toast, { Toaster } from "react-hot-toast";

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: "#02030a" }}><div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>}>
      <AuthPageInner />
    </Suspense>
  );
}

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoggedIn, isAdmin } = useAuth();

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    email: searchParams.get("email") || "",
    password: "",
    isAdmin: false,
  });
  const [loading, setLoading] = useState(false);

  // If invited via email link, switch to signup mode
  useEffect(() => {
    if (searchParams.get("invite") === "true") {
      setIsLoginMode(false);
    }
  }, [searchParams]);

  // Redirect if already logged in
  useEffect(() => {
    if (isLoggedIn) {
      router.push(isAdmin ? "/admin" : "/verify");
    }
  }, [isLoggedIn, isAdmin, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLoginMode) {
        const data = await apiLogin(formData.email, formData.password);
        login(data.token, data.user);
        toast.success("Welcome back!");
        router.push(data.user.isAdmin ? "/admin" : "/verify");
      } else {
        const data = await apiSignup(
          formData.name,
          formData.email,
          formData.password,
          formData.isAdmin
        );
        login(data.token, data.user);
        toast.success("Account created!");
        router.push(data.user.isAdmin ? "/admin" : "/verify");
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #02030a 0%, #0d0d1f 50%, #02030a 100%)" }}>
      <Toaster position="top-right" />

      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #FF9933, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #138808, transparent 70%)", filter: "blur(80px)" }} />
      </div>

      {/* Auth Card */}
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1
            className="text-4xl font-bold cursor-pointer"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
            onClick={() => router.push("/")}
          >
            <span className="text-white">Sol</span>
            <span style={{ color: "#FF9933" }}>Vote</span>
            <span style={{ color: "#138808" }}>X</span>
          </h1>
          <p className="text-sm mt-2" style={{ color: "#9898b0", fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.15em" }}>
            DECENTRALIZED VOTING ON SOLANA
          </p>
          {/* Indian flag stripe */}
          <div className="flex mx-auto mt-4 rounded overflow-hidden" style={{ width: "200px", height: "4px" }}>
            <div className="flex-1" style={{ background: "#FF9933" }} />
            <div className="flex-1 bg-white" />
            <div className="flex-1" style={{ background: "#138808" }} />
          </div>
        </div>

        {/* Card */}
        <div className="card-cyber p-8">
          {/* Toggle */}
          <div className="flex mb-6 rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,153,51,0.15)" }}>
            <button
              className={`flex-1 py-3 text-sm font-semibold transition-all ${
                isLoginMode
                  ? "text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
              style={isLoginMode ? { background: "rgba(255,153,51,0.15)", color: "#FF9933" } : {}}
              onClick={() => setIsLoginMode(true)}
            >
              LOGIN
            </button>
            <button
              className={`flex-1 py-3 text-sm font-semibold transition-all ${
                !isLoginMode
                  ? "text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
              style={!isLoginMode ? { background: "rgba(19,136,8,0.15)", color: "#138808" } : {}}
              onClick={() => setIsLoginMode(false)}
            >
              SIGNUP
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLoginMode && (
              <div>
                <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: "#9898b0" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg text-white text-sm outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,153,51,0.2)",
                  }}
                  placeholder="Enter your name"
                  required={!isLoginMode}
                />
              </div>
            )}

            <div>
              <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: "#9898b0" }}>
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 rounded-lg text-white text-sm outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,153,51,0.2)",
                }}
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: "#9898b0" }}>
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 rounded-lg text-white text-sm outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,153,51,0.2)",
                }}
                placeholder="Min. 6 characters"
                required
              />
            </div>

            {/* Admin Checkbox — only shown on Signup (login auto-detects role from DB) */}
            {!isLoginMode && (
              <div className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id="isAdmin"
                  checked={formData.isAdmin}
                  onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                  className="w-4 h-4 rounded cursor-pointer accent-orange-500"
                />
                <label htmlFor="isAdmin" className="text-sm cursor-pointer" style={{ color: "#9898b0" }}>
                  Register as Poll Admin
                </label>
                {formData.isAdmin && (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(255,153,51,0.15)", color: "#FF9933" }}>
                    A Solana wallet will be generated for you
                  </span>
                )}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #FF9933, #e67e00)",
                color: "#fff",
                boxShadow: "0 4px 20px rgba(255,153,51,0.3)",
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </span>
              ) : isLoginMode ? (
                "⬡ LOGIN"
              ) : (
                "⬡ CREATE ACCOUNT"
              )}
            </button>
          </form>

          {/* Switch mode text */}
          <p className="text-center mt-6 text-sm" style={{ color: "#9898b0" }}>
            {isLoginMode ? "Don't have an account? " : "Already have an account? "}
            <button
              className="font-semibold hover:underline"
              style={{ color: "#FF9933" }}
              onClick={() => setIsLoginMode(!isLoginMode)}
            >
              {isLoginMode ? "Sign Up" : "Log In"}
            </button>
          </p>
        </div>

        {/* Back to home */}
        <p className="text-center mt-6 text-xs" style={{ color: "#9898b0" }}>
          <button className="hover:underline" style={{ color: "#4169e1" }} onClick={() => router.push("/")}>
            ← Back to SolVoteX Home
          </button>
        </p>
      </div>
    </div>
  );
}
