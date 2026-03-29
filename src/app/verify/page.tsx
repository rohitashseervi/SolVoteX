"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { submitVerification, getMyVerifications, getPoll } from "@/utils/api";
import toast, { Toaster } from "react-hot-toast";

interface MyVerification {
  pollId: string;
  wallet: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
}

export default function VerifyPage() {
  const router = useRouter();
  const { user, isLoggedIn, loading: authLoading, logout } = useAuth();

  const [wallet, setWallet] = useState("");
  const [pollId, setPollId] = useState("");
  const [voterIdImage, setVoterIdImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Poll validation
  const [pollValid, setPollValid] = useState<null | true | false>(null);
  const [pollName, setPollName] = useState("");
  const [checkingPoll, setCheckingPoll] = useState(false);
  const pollCheckTimer = useRef<NodeJS.Timeout | null>(null);

  // Existing verifications
  const [myVerifications, setMyVerifications] = useState<MyVerification[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      router.push("/auth");
    }
  }, [authLoading, isLoggedIn, router]);

  // Fetch existing verifications on load
  const fetchMyVerifications = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const data = await getMyVerifications();
      setMyVerifications(data.verifications || []);
    } catch {
      // Not critical — just means we don't know status yet
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn && !authLoading) {
      fetchMyVerifications();
    }
  }, [isLoggedIn, authLoading, fetchMyVerifications]);

  // Validate poll ID with debounce
  const handlePollIdChange = (value: string) => {
    setPollId(value);
    setPollValid(null);
    setPollName("");

    if (pollCheckTimer.current) clearTimeout(pollCheckTimer.current);

    if (!value.trim()) return;

    setCheckingPoll(true);
    pollCheckTimer.current = setTimeout(async () => {
      try {
        const data = await getPoll(value.trim());
        if (data.success && data.poll) {
          setPollValid(true);
          setPollName(data.poll.name);
        } else {
          setPollValid(false);
        }
      } catch {
        setPollValid(false);
      } finally {
        setCheckingPoll(false);
      }
    }, 500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVoterIdImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!wallet || !pollId || !voterIdImage) {
      toast.error("All fields are required");
      return;
    }

    if (wallet.length < 32 || wallet.length > 44) {
      toast.error("Invalid Solana wallet address");
      return;
    }

    if (pollValid === false) {
      toast.error("This Poll ID does not exist. Please check and try again.");
      return;
    }

    // Check if already submitted for this poll
    if (myVerifications.some((v) => v.pollId === pollId)) {
      toast.error("You have already submitted verification for this poll");
      return;
    }

    setSubmitting(true);
    try {
      await submitVerification(wallet, pollId, voterIdImage);
      toast.success("Verification submitted! Awaiting admin approval.");
      // Add to local state immediately
      setMyVerifications((prev) => [
        ...prev,
        { pollId, wallet, status: "pending", submittedAt: new Date().toISOString() },
      ]);
      // Clear the form
      setWallet("");
      setPollId("");
      setVoterIdImage(null);
      setPreviewUrl(null);
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (authLoading || loadingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#02030a" }}>
        <div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const statusColor = (s: string) =>
    s === "approved" ? "#138808" : s === "rejected" ? "#dc2626" : "#FF9933";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{ background: "linear-gradient(135deg, #02030a 0%, #0d0d1f 50%, #02030a 100%)" }}
    >
      <Toaster position="top-right" />

      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-20 right-1/4 w-80 h-80 rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, #4169e1, transparent 70%)", filter: "blur(100px)" }}
        />
        <div
          className="absolute bottom-20 left-1/4 w-80 h-80 rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, #FF9933, transparent 70%)", filter: "blur(100px)" }}
        />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            <span style={{ color: "#4169e1" }}>Voter</span>{" "}
            <span style={{ color: "#FF9933" }}>Verification</span>
          </h1>
          <p className="text-sm mt-2" style={{ color: "#9898b0" }}>
            Hello <span style={{ color: "#FF9933" }}>{user?.name}</span> — complete your verification to vote
          </p>
          <div className="flex mx-auto mt-3 rounded overflow-hidden" style={{ width: "150px", height: "3px" }}>
            <div className="flex-1" style={{ background: "#FF9933" }} />
            <div className="flex-1 bg-white" />
            <div className="flex-1" style={{ background: "#138808" }} />
          </div>
        </div>

        {/* ═══ Show existing verifications if any ═══ */}
        {myVerifications.length > 0 && (
          <div className="mb-6 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#9898b0" }}>
              Your Verification Requests
            </h3>
            {myVerifications.map((v, i) => (
              <div
                key={`${v.pollId}-${i}`}
                className="card-cyber p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold" style={{ color: "#FF9933" }}>
                      Poll #{v.pollId}
                    </p>
                    <p className="text-xs" style={{ color: "#9898b0" }}>
                      Wallet: {v.wallet.slice(0, 6)}...{v.wallet.slice(-4)}
                    </p>
                    <p className="text-xs" style={{ color: "#666" }}>
                      Submitted: {new Date(v.submittedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className="text-xs px-3 py-1.5 rounded-full uppercase font-semibold"
                      style={{
                        background: `${statusColor(v.status)}22`,
                        color: statusColor(v.status),
                        border: `1px solid ${statusColor(v.status)}44`,
                      }}
                    >
                      {v.status === "pending" && "Pending Review"}
                      {v.status === "approved" && "Approved"}
                      {v.status === "rejected" && "Rejected"}
                    </span>
                    {v.status === "approved" && (
                      <p className="text-xs mt-2" style={{ color: "#138808" }}>
                        1 vote token sent to your wallet
                      </p>
                    )}
                    {v.status === "pending" && (
                      <p className="text-xs mt-2" style={{ color: "#9898b0" }}>
                        Awaiting admin approval
                      </p>
                    )}
                    {v.status === "rejected" && (
                      <p className="text-xs mt-2" style={{ color: "#dc2626" }}>
                        Re-submit with valid ID
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Refresh button */}
            <button
              onClick={fetchMyVerifications}
              className="text-xs hover:underline"
              style={{ color: "#4169e1" }}
            >
              Refresh status
            </button>
          </div>
        )}

        {/* ═══ Form Card — always available for new poll submissions ═══ */}
        <div className="card-cyber p-8">
          {myVerifications.length > 0 && (
            <p className="text-xs mb-4" style={{ color: "#9898b0" }}>
              Submit verification for another poll:
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Wallet Address */}
            <div>
              <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: "#9898b0" }}>
                Solana Wallet Address
              </label>
              <input
                type="text"
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                className="w-full px-4 py-3 rounded-lg text-white text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(65,105,225,0.3)" }}
                placeholder="e.g. 5xK3mQ...9mPqR2"
                required
              />
              <p className="text-xs mt-1" style={{ color: "#666" }}>
                Your Phantom/Solflare wallet public key
              </p>
            </div>

            {/* Poll ID */}
            <div>
              <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: "#9898b0" }}>
                Poll ID
              </label>
              <input
                type="text"
                value={pollId}
                onChange={(e) => handlePollIdChange(e.target.value)}
                className="w-full px-4 py-3 rounded-lg text-white text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${
                    pollValid === true
                      ? "rgba(19,136,8,0.6)"
                      : pollValid === false
                      ? "rgba(220,38,38,0.6)"
                      : "rgba(255,153,51,0.3)"
                  }`,
                }}
                placeholder="Enter the Poll ID provided by admin"
                required
              />
              {/* Poll validation feedback */}
              {checkingPoll && (
                <p className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: "#9898b0" }}>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Checking poll...
                </p>
              )}
              {!checkingPoll && pollValid === true && (
                <p className="text-xs mt-1.5" style={{ color: "#138808" }}>
                  &#10003; Poll found: <span style={{ fontWeight: 600 }}>{pollName}</span>
                </p>
              )}
              {!checkingPoll && pollValid === false && pollId.trim() && (
                <p className="text-xs mt-1.5" style={{ color: "#dc2626" }}>
                  &#10007; No poll found with this ID. Please verify with admin.
                </p>
              )}
            </div>

            {/* Voter ID Image */}
            <div>
              <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: "#9898b0" }}>
                Voter ID / Government ID Image
              </label>
              <div
                className="relative rounded-lg p-6 text-center cursor-pointer transition-all hover:border-orange-500"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "2px dashed rgba(255,153,51,0.3)",
                }}
                onClick={() => document.getElementById("fileInput")?.click()}
              >
                {previewUrl ? (
                  <div>
                    <img
                      src={previewUrl}
                      alt="ID Preview"
                      className="max-h-40 mx-auto rounded-lg mb-3 object-contain"
                    />
                    <p className="text-xs" style={{ color: "#138808" }}>
                      {voterIdImage?.name}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "#666" }}>
                      Click to change
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="text-4xl mb-2">&#128196;</div>
                    <p className="text-sm" style={{ color: "#9898b0" }}>
                      Click to upload your ID
                    </p>
                    <p className="text-xs mt-1" style={{ color: "#666" }}>
                      JPG, PNG, or PDF — Max 5MB
                    </p>
                  </div>
                )}
                <input
                  id="fileInput"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || pollValid === false || checkingPoll}
              className="w-full py-3.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #4169e1, #2a4ecb)",
                color: "#fff",
                boxShadow: "0 4px 20px rgba(65,105,225,0.3)",
              }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting...
                </span>
              ) : (
                "SUBMIT VERIFICATION"
              )}
            </button>
          </form>

          {/* Info box */}
          <div className="mt-6 p-4 rounded-lg" style={{ background: "rgba(255,153,51,0.06)", border: "1px solid rgba(255,153,51,0.15)" }}>
            <p className="text-xs" style={{ color: "#FF9933", fontWeight: 600 }}>
              What happens next?
            </p>
            <p className="text-xs mt-1" style={{ color: "#9898b0" }}>
              Admin will review your identity. Once approved, 1 SPL voting token will be sent to your wallet. You can then cast your vote in the specified poll.
            </p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-6 px-2">
          <button className="text-xs hover:underline" style={{ color: "#4169e1" }} onClick={() => router.push("/")}>
            &larr; Home
          </button>
          <button
            className="text-xs px-4 py-2 rounded-lg hover:opacity-80"
            style={{ color: "#dc2626", border: "1px solid rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.08)" }}
            onClick={handleLogout}
          >
            Logout
          </button>
          <button className="text-xs hover:underline" style={{ color: "#FF9933" }} onClick={() => router.push("/vote/check")}>
            Already verified? Go to Vote &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
