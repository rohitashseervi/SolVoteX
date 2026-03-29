"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getVerificationStatus } from "@/utils/api";
import toast, { Toaster } from "react-hot-toast";

export default function VoteCheckPage() {
  const router = useRouter();
  const { isLoggedIn, user } = useAuth();

  const [pollId, setPollId] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{
    status: "success" | "error" | null;
    message: string;
  }>({ status: null, message: "" });

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pollId.trim()) {
      toast.error("Please enter a Poll ID");
      return;
    }

    if (!isLoggedIn) {
      toast.error("Please login first");
      router.push("/auth");
      return;
    }

    setChecking(true);
    setResult({ status: null, message: "" });

    try {
      // Check 1: Verify voter is verified for this poll
      const verification = await getVerificationStatus(pollId);

      if (verification.status === "not_submitted") {
        setResult({
          status: "error",
          message: "You haven't submitted verification for this poll. Please verify first.",
        });
        return;
      }

      if (verification.status === "pending") {
        setResult({
          status: "error",
          message: "Your verification is still pending admin approval. Please wait.",
        });
        return;
      }

      if (verification.status === "rejected") {
        setResult({
          status: "error",
          message: "Your verification was rejected. Contact the admin for details.",
        });
        return;
      }

      if (verification.status === "approved") {
        setResult({
          status: "success",
          message: "You are verified! Redirecting to voting page...",
        });
        toast.success("Verification confirmed!");
        setTimeout(() => router.push(`/vote/${pollId}`), 1500);
      }
    } catch (err: any) {
      setResult({
        status: "error",
        message: err.message || "Failed to check eligibility",
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative"
      style={{ background: "linear-gradient(135deg, #02030a 0%, #0d0d1f 50%, #02030a 100%)" }}>
      <Toaster position="top-right" />

      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, #138808, transparent 70%)", filter: "blur(100px)" }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            <span style={{ color: "#138808" }}>Voting</span>{" "}
            <span style={{ color: "#FF9933" }}>Check</span>
          </h1>
          <p className="text-sm mt-2" style={{ color: "#9898b0" }}>
            Enter your Poll ID to verify eligibility
          </p>
          <div className="flex mx-auto mt-3 rounded overflow-hidden" style={{ width: "120px", height: "3px" }}>
            <div className="flex-1" style={{ background: "#FF9933" }} />
            <div className="flex-1 bg-white" />
            <div className="flex-1" style={{ background: "#138808" }} />
          </div>
        </div>

        {/* Card */}
        <div className="card-cyber p-8">
          <form onSubmit={handleCheck} className="space-y-5">
            {/* Poll ID */}
            <div>
              <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: "#9898b0" }}>
                Poll ID
              </label>
              <input
                type="text"
                value={pollId}
                onChange={(e) => setPollId(e.target.value)}
                className="w-full px-4 py-3 rounded-lg text-white text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(19,136,8,0.3)" }}
                placeholder="Enter Poll ID"
                required
              />
            </div>

            {/* Checks indicator */}
            <div className="p-4 rounded-lg space-y-2" style={{ background: "rgba(255,255,255,0.02)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#9898b0" }}>
                Eligibility Checks:
              </p>
              <div className="flex items-center gap-2 text-xs" style={{ color: "#9898b0" }}>
                <span>☐</span> Poll exists and is active
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: "#9898b0" }}>
                <span>☐</span> Voter is verified for this poll
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: "#9898b0" }}>
                <span>☐</span> Voter has not already voted
              </div>
            </div>

            {/* Result */}
            {result.status && (
              <div
                className="p-4 rounded-lg text-sm"
                style={{
                  background:
                    result.status === "success"
                      ? "rgba(19,136,8,0.1)"
                      : "rgba(220,38,38,0.1)",
                  border: `1px solid ${
                    result.status === "success"
                      ? "rgba(19,136,8,0.3)"
                      : "rgba(220,38,38,0.3)"
                  }`,
                  color: result.status === "success" ? "#138808" : "#dc2626",
                }}
              >
                {result.message}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={checking}
              className="w-full py-3.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #138808, #0a6404)",
                color: "#fff",
                boxShadow: "0 4px 20px rgba(19,136,8,0.3)",
              }}
            >
              {checking ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Checking...
                </span>
              ) : (
                "⬡ CHECK ELIGIBILITY"
              )}
            </button>
          </form>
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6 px-2">
          <button className="text-xs hover:underline" style={{ color: "#4169e1" }} onClick={() => router.push("/")}>
            ← Home
          </button>
          {!isLoggedIn && (
            <button className="text-xs hover:underline" style={{ color: "#FF9933" }} onClick={() => router.push("/auth")}>
              Login / Signup →
            </button>
          )}
          {isLoggedIn && (
            <button className="text-xs hover:underline" style={{ color: "#FF9933" }} onClick={() => router.push("/verify")}>
              Need to verify? →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
