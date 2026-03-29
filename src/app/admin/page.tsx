"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPendingVerifications,
  getCompletedVerifications,
  approveVerification,
  rejectVerification,
  inviteVoter,
  inviteVotersBulk,
  getVoterList,
  getMintStats,
  requestAirdrop,
  getAdminWalletInfo,
  createPoll,
  getPolls,
} from "@/utils/api";
import {
  truncateWallet,
  getExplorerAccountUrl,
  getExplorerTxUrl,
  API_BASE_URL,
} from "@/utils/constants";
import toast, { Toaster } from "react-hot-toast";

// ─── Types ──────────────────────────────────────────────
interface Verification {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  pollId: string;
  wallet: string;
  imageUrl: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  reviewedAt?: string;
}

interface VoterInfo {
  _id: string;
  name: string;
  email: string;
  verifications: {
    pollId: string;
    wallet: string;
    status: string;
    submittedAt: string;
  }[];
}

interface MintStatsData {
  totalInvited: number;
  totalVerified: number;
  totalPending: number;
  totalUnverified: number;
  totalMintSupply: number;
  adminTokenBalance: number;
  tokensDistributed: number;
  tokensNeeded: number;
}

interface WalletInfo {
  walletAddress: string;
  solBalance: number;
  createdAt: string;
}

interface PollData {
  pollId: string;
  name: string;
  description: string;
  candidates: { name: string; party: string }[];
  startTime: string;
  endTime: string;
  status: "upcoming" | "live" | "ended";
  adminWallet: string;
  mintAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  estimatedVoters?: number;
  tokensMinted?: number;
  mintStatus?: "pending" | "minting" | "ready" | "failed";
  mintError?: string;
  createdAt: string;
}

// ─── Tabs ───────────────────────────────────────────────
type AdminTab =
  | "overview"
  | "invite"
  | "verifications"
  | "voters"
  | "myPolls"
  | "createPoll"
  | "mintTokens";

export default function AdminDashboard() {
  const router = useRouter();
  const { user, isLoggedIn, isAdmin, loading: authLoading, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  // ─── Wallet state ───
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [airdropping, setAirdropping] = useState(false);

  // ─── Invite state ───
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePollId, setInvitePollId] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [inviting, setInviting] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  // ─── Verification state ───
  const [pendingList, setPendingList] = useState<Verification[]>([]);
  const [completedList, setCompletedList] = useState<Verification[]>([]);
  const [loadingVerifications, setLoadingVerifications] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [mintAddressForApproval, setMintAddressForApproval] = useState("");

  // ─── Voter list state ───
  const [voters, setVoters] = useState<{
    verified: VoterInfo[];
    pending: VoterInfo[];
    unverified: VoterInfo[];
    stats: { total: number; verified: number; pending: number; unverified: number };
  }>({ verified: [], pending: [], unverified: [], stats: { total: 0, verified: 0, pending: 0, unverified: 0 } });
  const [loadingVoters, setLoadingVoters] = useState(false);

  // ─── Mint/Token state (read-only, auto-managed) ───
  const [mintStats, setMintStats] = useState<MintStatsData | null>(null);
  const [loadingMintStats, setLoadingMintStats] = useState(false);

  // ─── Create Poll state ───
  const [pollName, setPollName] = useState("");
  const [pollDescription, setPollDescription] = useState("");
  const [pollCandidates, setPollCandidates] = useState([
    { name: "", party: "" },
    { name: "", party: "" },
  ]);
  const [pollStart, setPollStart] = useState("");
  const [pollEnd, setPollEnd] = useState("");
  const [pollEstimatedVoters, setPollEstimatedVoters] = useState("");
  const [pollTokenName, setPollTokenName] = useState("");
  const [pollTokenSymbol, setPollTokenSymbol] = useState("");
  const [creatingPoll, setCreatingPoll] = useState(false);

  // ─── My Polls state ───
  const [myPolls, setMyPolls] = useState<PollData[]>([]);
  const [loadingPolls, setLoadingPolls] = useState(false);

  // ─── Auth guard ───
  useEffect(() => {
    if (!authLoading && (!isLoggedIn || !isAdmin)) {
      router.push("/auth");
    }
  }, [authLoading, isLoggedIn, isAdmin, router]);

  // ─── Fetch admin wallet info on load ───
  const fetchWalletInfo = useCallback(async () => {
    setLoadingWallet(true);
    try {
      const data = await getAdminWalletInfo();
      setWalletInfo(data);
    } catch (err: any) {
      console.error("Wallet fetch error:", err.message);
    } finally {
      setLoadingWallet(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin && isLoggedIn) {
      fetchWalletInfo();
    }
  }, [isAdmin, isLoggedIn, fetchWalletInfo]);

  // ─── Data fetchers ───
  const fetchVerifications = useCallback(async () => {
    setLoadingVerifications(true);
    try {
      const [pending, completed] = await Promise.all([
        getPendingVerifications(),
        getCompletedVerifications(),
      ]);
      setPendingList(pending.pending || pending);
      setCompletedList(completed.completed || completed);
    } catch (err: any) {
      toast.error(err.message || "Failed to load verifications");
    } finally {
      setLoadingVerifications(false);
    }
  }, []);

  const fetchVoters = useCallback(async () => {
    setLoadingVoters(true);
    try {
      const data = await getVoterList();
      setVoters(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load voters");
    } finally {
      setLoadingVoters(false);
    }
  }, []);

  const fetchMintStats = useCallback(async () => {
    setLoadingMintStats(true);
    try {
      const data = await getMintStats();
      setMintStats(data.stats || data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load mint stats");
    } finally {
      setLoadingMintStats(false);
    }
  }, []);

  const fetchPolls = useCallback(async () => {
    setLoadingPolls(true);
    try {
      const data = await getPolls();
      setMyPolls(data.polls || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load polls");
    } finally {
      setLoadingPolls(false);
    }
  }, []);

  // Load data on tab change
  useEffect(() => {
    if (activeTab === "verifications") { fetchVerifications(); fetchPolls(); }
    if (activeTab === "voters") fetchVoters();
    if (activeTab === "mintTokens") { fetchMintStats(); fetchPolls(); }
    if (activeTab === "myPolls") fetchPolls();
    if (activeTab === "overview") {
      fetchVoters();
      fetchMintStats();
      fetchPolls();
    }
  }, [activeTab, fetchVerifications, fetchVoters, fetchMintStats, fetchPolls]);

  // ─── Handlers ───

  const [showFaucetHelper, setShowFaucetHelper] = useState(false);

  const handleAirdrop = async () => {
    setAirdropping(true);
    try {
      const result = await requestAirdrop(2);
      toast.success(`Airdropped SOL! Balance: ${result.solBalance} SOL`);
      setShowFaucetHelper(false);
      fetchWalletInfo();
    } catch (err: any) {
      const msg = err.message || "Airdrop failed";
      if (msg.includes("429") || msg.includes("rate") || msg.includes("limit") || msg.includes("faucet")) {
        setShowFaucetHelper(true);
        toast.error("Airdrop rate-limited — use the web faucet instead");
      } else {
        toast.error(msg);
      }
    } finally {
      setAirdropping(false);
    }
  };

  const copyWalletAddress = () => {
    if (walletInfo?.walletAddress) {
      navigator.clipboard.writeText(walletInfo.walletAddress);
      toast.success("Wallet address copied!");
    }
  };

  const handleInviteSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName || !inviteEmail || !invitePollId) {
      toast.error("Name, email, and Poll ID are all required");
      return;
    }
    setInviting(true);
    try {
      await inviteVoter(inviteName, inviteEmail, invitePollId || undefined);
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteName("");
      setInviteEmail("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  const handleInviteBulk = async () => {
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const votersList = lines.map((l) => {
      const [name, email] = l.split(",").map((s) => s.trim());
      return { name, email };
    });

    if (votersList.length === 0 || votersList.some((v) => !v.name || !v.email)) {
      toast.error("Each line must be: Name, Email");
      return;
    }

    setInviting(true);
    try {
      const result = await inviteVotersBulk(votersList, invitePollId || undefined);
      toast.success(`Sent ${result.sent || votersList.length} invitations`);
      setBulkText("");
    } catch (err: any) {
      toast.error(err.message || "Bulk invite failed");
    } finally {
      setInviting(false);
    }
  };

  const handleApprove = async (v: Verification) => {
    setActioningId(v._id || v.userId);
    try {
      // Auto-lookup mint address from the poll
      const poll = myPolls.find((p) => p.pollId === v.pollId);
      let mint = mintAddressForApproval; // manual override if entered

      if (!mint && poll?.mintAddress) {
        mint = poll.mintAddress;
      }

      if (!mint) {
        // Try fetching polls if not loaded yet
        const pollsData = await getPolls();
        const freshPoll = (pollsData.polls || []).find((p: PollData) => p.pollId === v.pollId);
        if (freshPoll?.mintAddress) {
          mint = freshPoll.mintAddress;
          setMyPolls(pollsData.polls);
        }
      }

      if (!mint) {
        toast.error(`No mint address found for Poll #${v.pollId}. Tokens may still be minting — check My Polls tab.`);
        setActioningId(null);
        return;
      }

      await approveVerification(v.userId, v.pollId, mint);
      toast.success(`Approved ${v.userName} — token sent automatically`);
      fetchVerifications();
    } catch (err: any) {
      toast.error(err.message || "Approval failed");
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (v: Verification) => {
    setActioningId(v._id || v.userId);
    try {
      await rejectVerification(v.userId, v.pollId);
      toast.success(`Rejected ${v.userName}`);
      fetchVerifications();
    } catch (err: any) {
      toast.error(err.message || "Rejection failed");
    } finally {
      setActioningId(null);
    }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pollName || !pollStart || !pollEnd) {
      toast.error("Poll name, start & end time are required");
      return;
    }
    if (pollCandidates.some((c) => !c.name)) {
      toast.error("All candidates need a name");
      return;
    }
    if (!pollEstimatedVoters || Number(pollEstimatedVoters) < 1) {
      toast.error("Estimated voter count is required");
      return;
    }
    setCreatingPoll(true);
    try {
      const result = await createPoll({
        name: pollName,
        description: pollDescription,
        candidates: pollCandidates.filter((c) => c.name),
        startTime: new Date(pollStart).toISOString(),
        endTime: new Date(pollEnd).toISOString(),
        estimatedVoters: Number(pollEstimatedVoters),
        tokenName: pollTokenName || undefined,
        tokenSymbol: pollTokenSymbol || undefined,
      });
      toast.success(`Poll "${result.poll.name}" created! ID: ${result.poll.pollId}. Tokens are being minted automatically...`);
      setPollName("");
      setPollDescription("");
      setPollCandidates([{ name: "", party: "" }, { name: "", party: "" }]);
      setPollStart("");
      setPollEnd("");
      setPollEstimatedVoters("");
      setPollTokenName("");
      setPollTokenSymbol("");
      // Switch to My Polls tab to show the new poll
      fetchPolls();
      setActiveTab("myPolls");
    } catch (err: any) {
      toast.error(err.message || "Failed to create poll");
    } finally {
      setCreatingPoll(false);
    }
  };

  // ─── Loading / Auth check ───
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#02030a" }}>
        <div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // ─── Tab config ───
  const tabs: { id: AdminTab; label: string; color: string }[] = [
    { id: "overview", label: "Overview", color: "#FF9933" },
    { id: "invite", label: "Invite Voters", color: "#138808" },
    { id: "verifications", label: "Verifications", color: "#4169e1" },
    { id: "voters", label: "Voter List", color: "#FF9933" },
    { id: "myPolls", label: "My Polls", color: "#FF9933" },
    { id: "createPoll", label: "Create Poll", color: "#138808" },
    { id: "mintTokens", label: "Wallet & Tokens", color: "#4169e1" },
  ];

  return (
    <div
      className="min-h-screen p-4 relative"
      style={{ background: "linear-gradient(135deg, #02030a 0%, #0d0d1f 50%, #02030a 100%)" }}
    >
      <Toaster position="top-right" />

      <div className="max-w-6xl mx-auto pt-6">
        {/* ═══════════ HEADER ═══════════ */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="text-3xl font-bold"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              <span style={{ color: "#FF9933" }}>Admin</span>{" "}
              <span style={{ color: "#138808" }}>Dashboard</span>
            </h1>
            <p className="text-xs mt-1" style={{ color: "#9898b0" }}>
              Welcome, {user?.name} · Wallet: {walletInfo ? truncateWallet(walletInfo.walletAddress) : "Loading..."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* SOL Balance badge */}
            {walletInfo && (
              <span
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(19,136,8,0.1)", color: "#138808", border: "1px solid rgba(19,136,8,0.3)" }}
              >
                {walletInfo.solBalance.toFixed(2)} SOL
              </span>
            )}
            <button
              className="text-xs px-4 py-2 rounded-lg hover:opacity-80"
              style={{ color: "#9898b0", border: "1px solid rgba(255,255,255,0.1)" }}
              onClick={() => router.push("/")}
            >
              ← Home
            </button>
            <button
              className="text-xs px-4 py-2 rounded-lg hover:opacity-80"
              style={{ color: "#dc2626", border: "1px solid rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.08)" }}
              onClick={() => { logout(); router.push("/"); }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* ═══════════ TABS ═══════════ */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap"
              style={{
                background: activeTab === tab.id ? `${tab.color}22` : "rgba(255,255,255,0.03)",
                color: activeTab === tab.id ? tab.color : "#9898b0",
                border: `1px solid ${activeTab === tab.id ? `${tab.color}55` : "rgba(255,255,255,0.06)"}`,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══════════ TAB CONTENT ═══════════ */}

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Admin Wallet Card */}
            <div className="card-cyber p-6">
              <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: "#4169e1" }}>
                Your Admin Wallet (Auto-Generated)
              </h3>
              {walletInfo ? (
                <div className="space-y-2">
                  <p className="text-xs break-all" style={{ color: "#FF9933" }}>
                    {walletInfo.walletAddress}
                  </p>
                  <div className="flex items-center gap-4">
                    <span className="text-xs" style={{ color: "#138808" }}>
                      Balance: {walletInfo.solBalance.toFixed(4)} SOL
                    </span>
                    <a
                      href={getExplorerAccountUrl(walletInfo.walletAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs hover:underline"
                      style={{ color: "#4169e1" }}
                    >
                      View on Explorer →
                    </a>
                    <button
                      onClick={handleAirdrop}
                      disabled={airdropping}
                      className="text-xs px-3 py-1 rounded-lg transition-all disabled:opacity-50"
                      style={{ background: "rgba(19,136,8,0.1)", color: "#138808", border: "1px solid rgba(19,136,8,0.3)" }}
                    >
                      {airdropping ? "Requesting..." : "+ Airdrop 2 SOL"}
                    </button>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "#666" }}>
                    This wallet was created automatically when you signed up as admin.
                    It handles all on-chain operations (mint creation, token distribution).
                    No Phantom or external wallet needed.
                  </p>

                  {/* Faucet helper - shows when airdrop is rate-limited */}
                  {showFaucetHelper && (
                    <div
                      className="mt-4 p-4 rounded-lg"
                      style={{ background: "rgba(255,153,51,0.08)", border: "1px solid rgba(255,153,51,0.3)" }}
                    >
                      <p className="text-xs font-semibold mb-2" style={{ color: "#FF9933" }}>
                        Airdrop Rate Limited — Use Web Faucet Instead
                      </p>
                      <p className="text-xs mb-3" style={{ color: "#9898b0" }}>
                        The devnet faucet limits how many airdrops you can request per hour.
                        Use the Solana web faucet to send free SOL to your admin wallet:
                      </p>
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="text"
                          readOnly
                          value={walletInfo.walletAddress}
                          className="flex-1 px-3 py-2 rounded-lg text-white text-xs outline-none"
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                        />
                        <button
                          onClick={copyWalletAddress}
                          className="px-3 py-2 rounded-lg text-xs font-semibold shrink-0"
                          style={{ background: "rgba(65,105,225,0.15)", color: "#4169e1", border: "1px solid rgba(65,105,225,0.3)" }}
                        >
                          Copy
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <a
                          href={`https://faucet.solana.com/?wallet=${walletInfo.walletAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 rounded-lg text-xs font-semibold"
                          style={{ background: "linear-gradient(135deg, #FF9933, #e68a2e)", color: "#fff" }}
                        >
                          Open Solana Faucet
                        </a>
                        <button
                          onClick={() => { fetchWalletInfo(); setShowFaucetHelper(false); }}
                          className="px-4 py-2 rounded-lg text-xs"
                          style={{ color: "#138808", border: "1px solid rgba(19,136,8,0.3)" }}
                        >
                          I sent SOL — Refresh Balance
                        </button>
                      </div>
                      <p className="text-xs mt-2" style={{ color: "#666" }}>
                        Steps: 1) Copy your wallet address above → 2) Open Solana Faucet → 3) Paste address → 4) Request SOL → 5) Click "Refresh Balance"
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs" style={{ color: "#9898b0" }}>Loading wallet info...</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="Total Voters" value={voters.stats.total || "—"} color="#FF9933" />
              <StatCard label="Verified" value={voters.stats.verified || "—"} color="#138808" />
              <StatCard label="Pending Approval" value={voters.stats.pending || "—"} color="#4169e1" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard label="Unverified" value={voters.stats.unverified || "—"} color="#dc2626" />
              <StatCard label="Total Polls" value={myPolls.length || "—"} color="#4169e1" />
              <StatCard label="Mint Supply" value={mintStats?.totalMintSupply ?? "—"} color="#FF9933" />
              <StatCard label="Tokens Distributed" value={mintStats?.tokensDistributed ?? "—"} color="#138808" />
            </div>

            <div className="card-cyber p-6">
              <h3 className="text-sm font-semibold mb-3" style={{ color: "#FF9933" }}>
                Quick Actions
              </h3>
              <div className="flex flex-wrap gap-3">
                <QuickBtn label="My Polls" onClick={() => setActiveTab("myPolls")} color="#FF9933" />
                <QuickBtn label="Invite Voters" onClick={() => setActiveTab("invite")} color="#138808" />
                <QuickBtn label="Review Verifications" onClick={() => setActiveTab("verifications")} color="#4169e1" />
                <QuickBtn label="Create Poll" onClick={() => setActiveTab("createPoll")} color="#FF9933" />
                <QuickBtn label="Wallet & Tokens" onClick={() => setActiveTab("mintTokens")} color="#4169e1" />
              </div>
            </div>
          </div>
        )}

        {/* ── INVITE VOTERS ── */}
        {activeTab === "invite" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="card-cyber p-6">
              <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: "#138808" }}>
                Invite a Voter
              </h3>
              <form onSubmit={handleInviteSingle} className="space-y-4">
                <InputField label="Voter Name" value={inviteName} onChange={setInviteName} placeholder="John Doe" color="#138808" />
                <InputField label="Email" value={inviteEmail} onChange={setInviteEmail} placeholder="voter@email.com" type="email" color="#138808" />
                <InputField label="Poll ID" value={invitePollId} onChange={setInvitePollId} placeholder="Enter the Poll ID to invite voter for" color="#FF9933" />
                <SubmitButton loading={inviting} label="SEND INVITATION" color="#138808" />
              </form>
            </div>

            <div className="card-cyber p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#4169e1" }}>
                  Bulk Invite
                </h3>
                <button
                  className="text-xs hover:underline"
                  style={{ color: "#4169e1" }}
                  onClick={() => setShowBulk(!showBulk)}
                >
                  {showBulk ? "Hide" : "Expand"}
                </button>
              </div>
              {showBulk && (
                <div className="space-y-4">
                  <p className="text-xs" style={{ color: "#9898b0" }}>
                    One voter per line: <span style={{ color: "#FF9933" }}>Name, Email</span>
                  </p>
                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    rows={6}
                    className="w-full px-4 py-3 rounded-lg text-white text-sm outline-none resize-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(65,105,225,0.3)" }}
                    placeholder={"Alice, alice@example.com\nBob, bob@example.com"}
                  />
                  <SubmitButton loading={inviting} label="SEND ALL INVITATIONS" color="#4169e1" onClick={handleInviteBulk} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── VERIFICATIONS ── */}
        {activeTab === "verifications" && (
          <div className="space-y-6">
            <div className="card-cyber p-4 flex items-center justify-between">
              <p className="text-xs" style={{ color: "#9898b0" }}>
                When you approve a voter, 1 SPL token is automatically transferred from your admin wallet to their wallet.
                The mint address is auto-fetched from the poll — no manual entry needed.
              </p>
              <button
                className="text-xs px-4 py-2 rounded-lg shrink-0 ml-4"
                style={{ background: "rgba(65,105,225,0.15)", color: "#4169e1", border: "1px solid rgba(65,105,225,0.3)" }}
                onClick={() => { fetchVerifications(); fetchPolls(); }}
              >
                Refresh
              </button>
            </div>

            {loadingVerifications ? (
              <LoadingSpinner />
            ) : (
              <>
                <div>
                  <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: "#FF9933" }}>
                    Pending ({pendingList.length})
                  </h3>
                  {pendingList.length === 0 ? (
                    <p className="text-xs card-cyber p-4" style={{ color: "#9898b0" }}>No pending verifications</p>
                  ) : (
                    <div className="space-y-3">
                      {pendingList.map((v, i) => (
                        <VerificationCard
                          key={v._id || `pending-${i}`}
                          v={v}
                          onApprove={() => handleApprove(v)}
                          onReject={() => handleReject(v)}
                          loading={actioningId === (v._id || v.userId)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: "#138808" }}>
                    Completed ({completedList.length})
                  </h3>
                  {completedList.length === 0 ? (
                    <p className="text-xs card-cyber p-4" style={{ color: "#9898b0" }}>No completed verifications yet</p>
                  ) : (
                    <div className="space-y-3">
                      {completedList.map((v, i) => (
                        <VerificationCard key={v._id || `completed-${i}`} v={v} readOnly />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── VOTER LIST ── */}
        {activeTab === "voters" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <span className="text-xs px-3 py-1 rounded-full" style={{ background: "rgba(19,136,8,0.15)", color: "#138808" }}>
                  Verified: {voters.stats.verified}
                </span>
                <span className="text-xs px-3 py-1 rounded-full" style={{ background: "rgba(65,105,225,0.15)", color: "#4169e1" }}>
                  Pending: {voters.stats.pending}
                </span>
                <span className="text-xs px-3 py-1 rounded-full" style={{ background: "rgba(220,38,38,0.15)", color: "#dc2626" }}>
                  Unverified: {voters.stats.unverified}
                </span>
              </div>
              <button
                className="text-xs px-4 py-2 rounded-lg"
                style={{ background: "rgba(65,105,225,0.15)", color: "#4169e1", border: "1px solid rgba(65,105,225,0.3)" }}
                onClick={fetchVoters}
              >
                Refresh
              </button>
            </div>

            {loadingVoters ? (
              <LoadingSpinner />
            ) : (
              <>
                <VoterSection title="Verified Voters" list={voters.verified} color="#138808" />
                <VoterSection title="Pending Voters" list={voters.pending} color="#4169e1" />
                <VoterSection title="Unverified Voters" list={voters.unverified} color="#dc2626" />
              </>
            )}
          </div>
        )}

        {/* ── MY POLLS ── */}
        {activeTab === "myPolls" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#FF9933" }}>
                My Polls ({myPolls.length})
              </h3>
              <div className="flex gap-3">
                <button
                  className="text-xs px-4 py-2 rounded-lg transition-all hover:opacity-80"
                  style={{ background: "rgba(19,136,8,0.15)", color: "#138808", border: "1px solid rgba(19,136,8,0.3)" }}
                  onClick={() => setActiveTab("createPoll")}
                >
                  + Create New Poll
                </button>
                <button
                  className="text-xs px-4 py-2 rounded-lg"
                  style={{ background: "rgba(65,105,225,0.15)", color: "#4169e1", border: "1px solid rgba(65,105,225,0.3)" }}
                  onClick={fetchPolls}
                >
                  Refresh
                </button>
              </div>
            </div>

            {loadingPolls ? (
              <LoadingSpinner />
            ) : myPolls.length === 0 ? (
              <div className="card-cyber p-8 text-center">
                <p className="text-sm" style={{ color: "#9898b0" }}>No polls created yet.</p>
                <button
                  className="mt-4 text-xs px-6 py-2 rounded-lg"
                  style={{ background: "rgba(255,153,51,0.15)", color: "#FF9933", border: "1px solid rgba(255,153,51,0.3)" }}
                  onClick={() => setActiveTab("createPoll")}
                >
                  Create Your First Poll
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Filter by status */}
                {(["live", "upcoming", "ended"] as const).map((statusFilter) => {
                  const filtered = myPolls.filter((p) => p.status === statusFilter);
                  if (filtered.length === 0) return null;

                  const statusConfig = {
                    live: { icon: "🟢", color: "#138808", label: "Live Polls" },
                    upcoming: { icon: "🟡", color: "#FF9933", label: "Upcoming Polls" },
                    ended: { icon: "🔴", color: "#dc2626", label: "Ended Polls" },
                  };
                  const cfg = statusConfig[statusFilter];

                  return (
                    <div key={statusFilter}>
                      <h4 className="text-xs font-semibold mb-3 uppercase tracking-wider flex items-center gap-2" style={{ color: cfg.color }}>
                        <span>{cfg.icon}</span> {cfg.label} ({filtered.length})
                      </h4>
                      <div className="space-y-3">
                        {filtered.map((poll) => (
                          <div key={poll.pollId} className="card-cyber p-5">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div>
                                <div className="flex items-center gap-3">
                                  <h4 className="text-base font-bold" style={{ color: "#FF9933" }}>
                                    {poll.name}
                                  </h4>
                                  <span
                                    className="text-xs px-2.5 py-0.5 rounded-full uppercase font-semibold"
                                    style={{
                                      background: `${cfg.color}22`,
                                      color: cfg.color,
                                      border: `1px solid ${cfg.color}44`,
                                    }}
                                  >
                                    {poll.status}
                                  </span>
                                </div>
                                <p className="text-xs mt-1" style={{ color: "#9898b0" }}>
                                  Poll ID: <span style={{ color: "#4169e1" }}>{poll.pollId}</span>
                                  {poll.description && ` · ${poll.description}`}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs" style={{ color: "#9898b0" }}>
                                  {new Date(poll.startTime).toLocaleDateString()} → {new Date(poll.endTime).toLocaleDateString()}
                                </p>
                                {poll.mintAddress && (
                                  <p className="text-xs mt-1" style={{ color: "#138808" }}>
                                    Token: {poll.tokenName || "SPL"} ({poll.tokenSymbol || "—"})
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Candidates */}
                            <div className="mt-3">
                              <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "#9898b0" }}>
                                Candidates ({poll.candidates.length})
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {poll.candidates.map((c, i) => (
                                  <span
                                    key={i}
                                    className="text-xs px-3 py-1.5 rounded-lg"
                                    style={{
                                      background: "rgba(255,255,255,0.04)",
                                      border: "1px solid rgba(255,255,255,0.08)",
                                      color: "#e0e0e0",
                                    }}
                                  >
                                    <span style={{ color: "#FF9933" }}>{c.name}</span>
                                    {c.party && (
                                      <span style={{ color: "#666" }}> · {c.party}</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Token Status */}
                            <div className="flex flex-wrap items-center gap-3 mt-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                              {/* Mint status badge */}
                              {poll.mintStatus === "ready" && (
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(19,136,8,0.15)", color: "#138808" }}>
                                  Tokens Ready ({poll.tokensMinted} minted)
                                </span>
                              )}
                              {poll.mintStatus === "minting" && (
                                <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "rgba(255,153,51,0.15)", color: "#FF9933" }}>
                                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                  Minting tokens...
                                </span>
                              )}
                              {poll.mintStatus === "pending" && (
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(65,105,225,0.15)", color: "#4169e1" }}>
                                  Token setup pending...
                                </span>
                              )}
                              {poll.mintStatus === "failed" && (
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>
                                  Mint failed: {poll.mintError || "Unknown error"}
                                </span>
                              )}
                              {poll.mintAddress && (
                                <span className="text-xs" style={{ color: "#666" }}>
                                  Mint: {poll.mintAddress.slice(0, 8)}...{poll.mintAddress.slice(-6)}
                                </span>
                              )}
                              {poll.estimatedVoters && (
                                <span className="text-xs" style={{ color: "#9898b0" }}>
                                  Est. voters: {poll.estimatedVoters}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── CREATE POLL ── */}
        {activeTab === "createPoll" && (
          <div className="max-w-2xl mx-auto">
            <div className="card-cyber p-8">
              <h3 className="text-sm font-semibold mb-6 uppercase tracking-wider" style={{ color: "#FF9933" }}>
                Create New Poll (On-Chain)
              </h3>
              <p className="text-xs mb-6" style={{ color: "#9898b0" }}>
                Fill in the details below and we handle everything automatically —
                SPL token creation, minting, and vault setup. No manual steps required.
                Fees are paid from your admin wallet&apos;s SOL balance.
              </p>

              <form onSubmit={handleCreatePoll} className="space-y-5">
                <InputField label="Poll Name" value={pollName} onChange={setPollName} placeholder="e.g. Student Council Election 2026" color="#FF9933" />
                <div>
                  <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: "#9898b0" }}>
                    Description
                  </label>
                  <textarea
                    value={pollDescription}
                    onChange={(e) => setPollDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg text-white text-sm outline-none resize-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,153,51,0.3)" }}
                    placeholder="Brief description of the poll"
                  />
                </div>

                <div>
                  <label className="block text-xs mb-2 uppercase tracking-wider" style={{ color: "#9898b0" }}>
                    Candidates
                  </label>
                  <div className="space-y-3">
                    {pollCandidates.map((c, i) => (
                      <div key={i} className="flex gap-3 items-center">
                        <span className="text-xs shrink-0 w-5" style={{ color: "#FF9933" }}>{i + 1}.</span>
                        <input
                          type="text"
                          value={c.name}
                          onChange={(e) => {
                            const updated = [...pollCandidates];
                            updated[i].name = e.target.value;
                            setPollCandidates(updated);
                          }}
                          className="flex-1 px-3 py-2 rounded-lg text-white text-sm outline-none"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,153,51,0.2)" }}
                          placeholder="Candidate name"
                          required
                        />
                        <input
                          type="text"
                          value={c.party}
                          onChange={(e) => {
                            const updated = [...pollCandidates];
                            updated[i].party = e.target.value;
                            setPollCandidates(updated);
                          }}
                          className="flex-1 px-3 py-2 rounded-lg text-white text-sm outline-none"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,153,51,0.2)" }}
                          placeholder="Party (optional)"
                        />
                        {pollCandidates.length > 2 && (
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded"
                            style={{ color: "#dc2626" }}
                            onClick={() => setPollCandidates(pollCandidates.filter((_, j) => j !== i))}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-3 text-xs hover:underline"
                    style={{ color: "#138808" }}
                    onClick={() => setPollCandidates([...pollCandidates, { name: "", party: "" }])}
                  >
                    + Add Candidate
                  </button>
                </div>

                {/* ─── Voter & Token Section ─── */}
                <div
                  className="p-4 rounded-lg space-y-4"
                  style={{ background: "rgba(19,136,8,0.04)", border: "1px solid rgba(19,136,8,0.15)" }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#138808" }}>
                    Token Configuration (Auto-Handled)
                  </p>
                  <InputField
                    label="Estimated Voter Count"
                    value={pollEstimatedVoters}
                    onChange={setPollEstimatedVoters}
                    placeholder="e.g. 100 (tokens = count + 10% buffer)"
                    type="number"
                    color="#138808"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <InputField
                      label="Token Name (optional)"
                      value={pollTokenName}
                      onChange={setPollTokenName}
                      placeholder="e.g. VotingIndia2026"
                      color="#138808"
                    />
                    <InputField
                      label="Token Symbol (optional)"
                      value={pollTokenSymbol}
                      onChange={setPollTokenSymbol}
                      placeholder="e.g. VOTE"
                      color="#138808"
                    />
                  </div>
                  <p className="text-xs" style={{ color: "#666" }}>
                    We automatically create an SPL token and mint tokens to your admin wallet.
                    Tokens are distributed to voters when you approve their verification.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: "#9898b0" }}>Start Time</label>
                    <input
                      type="datetime-local"
                      value={pollStart}
                      onChange={(e) => setPollStart(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(19,136,8,0.3)", colorScheme: "dark" }}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: "#9898b0" }}>End Time</label>
                    <input
                      type="datetime-local"
                      value={pollEnd}
                      onChange={(e) => setPollEnd(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(19,136,8,0.3)", colorScheme: "dark" }}
                      required
                    />
                  </div>
                </div>

                <SubmitButton loading={creatingPoll} label="CREATE POLL ON-CHAIN" color="#FF9933" />
              </form>
            </div>
          </div>
        )}

        {/* ── WALLET & TOKENS ── */}
        {activeTab === "mintTokens" && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Wallet Info */}
            <div className="card-cyber p-6">
              <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: "#4169e1" }}>
                Admin Wallet
              </h3>
              <div className="space-y-2">
                <p className="text-xs" style={{ color: "#9898b0" }}>
                  Wallet Address: <span className="break-all" style={{ color: "#FF9933" }}>{walletInfo?.walletAddress || "Loading..."}</span>
                </p>
                <div className="flex items-center gap-4">
                  <span className="text-xs" style={{ color: "#138808" }}>
                    SOL Balance: {walletInfo?.solBalance?.toFixed(4) || "0"} SOL
                  </span>
                  <button
                    onClick={handleAirdrop}
                    disabled={airdropping}
                    className="text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                    style={{ background: "rgba(19,136,8,0.1)", color: "#138808", border: "1px solid rgba(19,136,8,0.3)" }}
                  >
                    {airdropping ? "Requesting..." : "+ Airdrop SOL"}
                  </button>
                  <button
                    onClick={fetchWalletInfo}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ color: "#4169e1", border: "1px solid rgba(65,105,225,0.3)" }}
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {/* Faucet fallback */}
              {showFaucetHelper && walletInfo && (
                <div className="mt-4 p-3 rounded-lg" style={{ background: "rgba(255,153,51,0.06)", border: "1px solid rgba(255,153,51,0.2)" }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: "#FF9933" }}>Rate Limited — Use the Web Faucet</p>
                  <div className="flex items-center gap-2 mb-2">
                    <input type="text" readOnly value={walletInfo.walletAddress} className="flex-1 px-3 py-1.5 rounded-lg text-white text-xs outline-none" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                    <button onClick={copyWalletAddress} className="text-xs px-2 py-1.5 rounded-lg" style={{ color: "#4169e1" }}>Copy</button>
                  </div>
                  <div className="flex gap-3">
                    <a href={`https://faucet.solana.com/?wallet=${walletInfo.walletAddress}`} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: "linear-gradient(135deg, #FF9933, #e68a2e)", color: "#fff" }}>Open Faucet</a>
                    <button onClick={() => { fetchWalletInfo(); setShowFaucetHelper(false); }} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: "#138808", border: "1px solid rgba(19,136,8,0.3)" }}>I sent SOL — Refresh</button>
                  </div>
                </div>
              )}
            </div>

            {/* Per-poll token status */}
            <div className="card-cyber p-6">
              <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: "#138808" }}>
                Token Status Per Poll
              </h3>
              <p className="text-xs mb-4" style={{ color: "#9898b0" }}>
                Tokens are created and minted automatically when you create a poll. No manual steps needed.
              </p>
              {loadingPolls ? (
                <LoadingSpinner />
              ) : myPolls.length === 0 ? (
                <p className="text-xs" style={{ color: "#666" }}>No polls yet. Create a poll to auto-mint tokens.</p>
              ) : (
                <div className="space-y-3">
                  {myPolls.map((poll) => {
                    const mintColor = poll.mintStatus === "ready" ? "#138808" : poll.mintStatus === "failed" ? "#dc2626" : "#FF9933";
                    return (
                      <div key={poll.pollId} className="p-4 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-sm font-semibold" style={{ color: "#FF9933" }}>{poll.name}</span>
                            <span className="text-xs ml-2" style={{ color: "#9898b0" }}>ID: {poll.pollId}</span>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${mintColor}22`, color: mintColor, border: `1px solid ${mintColor}44` }}>
                            {poll.mintStatus === "ready" ? `${poll.tokensMinted} tokens ready` : poll.mintStatus === "minting" ? "Minting..." : poll.mintStatus === "failed" ? "Failed" : "Pending..."}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs" style={{ color: "#9898b0" }}>
                          <span>Token: {poll.tokenName || "—"} ({poll.tokenSymbol || "—"})</span>
                          <span>Est. voters: {poll.estimatedVoters || "—"}</span>
                          {poll.mintAddress && <span>Mint: {poll.mintAddress.slice(0, 8)}...{poll.mintAddress.slice(-6)}</span>}
                        </div>
                        {poll.mintStatus === "failed" && poll.mintError && (
                          <p className="text-xs mt-2" style={{ color: "#dc2626" }}>{poll.mintError}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stats if available */}
            {mintStats && (
              <div className="card-cyber p-6">
                <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: "#FF9933" }}>
                  Overall Stats
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MiniStat label="Invited" value={mintStats.totalInvited} color="#FF9933" />
                  <MiniStat label="Verified" value={mintStats.totalVerified} color="#138808" />
                  <MiniStat label="Pending" value={mintStats.totalPending} color="#4169e1" />
                  <MiniStat label="Distributed" value={mintStats.tokensDistributed} color="#138808" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════ SUB-COMPONENTS ═══════════════════════

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="card-cyber p-5">
      <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "#9898b0" }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color, fontFamily: "'Orbitron', sans-serif" }}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card-cyber p-3 text-center">
      <p className="text-xs" style={{ color: "#9898b0" }}>{label}</p>
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

function QuickBtn({ label, onClick, color }: { label: string; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
      style={{ background: `${color}15`, color, border: `1px solid ${color}44` }}
    >
      {label}
    </button>
  );
}

function InputField({
  label, value, onChange, placeholder, type = "text", color,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string; color: string;
}) {
  return (
    <div>
      <label className="block text-xs mb-1.5 uppercase tracking-wider" style={{ color: "#9898b0" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-lg text-white text-sm outline-none"
        style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${color}55` }}
        placeholder={placeholder}
      />
    </div>
  );
}

function SubmitButton({
  loading, label, color, onClick, type = "submit",
}: {
  loading: boolean; label: string; color: string; onClick?: () => void; type?: "submit" | "button";
}) {
  return (
    <button
      type={onClick ? "button" : type}
      onClick={onClick}
      disabled={loading}
      className="w-full py-3.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-50"
      style={{
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        color: "#fff",
        boxShadow: `0 4px 20px ${color}44`,
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
      ) : (
        label
      )}
    </button>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full" />
    </div>
  );
}

function VerificationCard({
  v, onApprove, onReject, loading, readOnly,
}: {
  v: Verification; onApprove?: () => void; onReject?: () => void; loading?: boolean; readOnly?: boolean;
}) {
  const statusColor =
    v.status === "approved" ? "#138808" : v.status === "rejected" ? "#dc2626" : "#FF9933";

  return (
    <div className="card-cyber p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm" style={{ color: "#FF9933" }}>{v.userName}</span>
            {v.status && (
              <span
                className="text-xs px-2 py-0.5 rounded-full uppercase"
                style={{ background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}
              >
                {v.status}
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color: "#9898b0" }}>{v.userEmail} · Poll: {v.pollId}</p>
          <p className="text-xs" style={{ color: "#4169e1" }}>Wallet: {truncateWallet(v.wallet, 6)}</p>
          <p className="text-xs" style={{ color: "#666" }}>Submitted: {new Date(v.submittedAt).toLocaleString()}</p>
        </div>

        {v.imageUrl && (
          <a
            href={`${API_BASE_URL.replace("/api", "")}/${v.imageUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <div className="w-16 h-16 rounded-lg overflow-hidden border" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <img
                src={`${API_BASE_URL.replace("/api", "")}/${v.imageUrl}`}
                alt="Voter ID"
                className="w-full h-full object-cover"
              />
            </div>
          </a>
        )}

        {!readOnly && onApprove && onReject && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onApprove}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              style={{ background: "rgba(19,136,8,0.15)", color: "#138808", border: "1px solid rgba(19,136,8,0.3)" }}
            >
              {loading ? "..." : "Approve"}
            </button>
            <button
              onClick={onReject}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.3)" }}
            >
              {loading ? "..." : "Reject"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function VoterSection({
  title, list, color,
}: {
  title: string; list: VoterInfo[]; color: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color }}>
        {title} ({list.length})
      </h3>
      {list.length === 0 ? (
        <p className="text-xs card-cyber p-4" style={{ color: "#9898b0" }}>No voters in this category</p>
      ) : (
        <div className="space-y-2">
          {list.map((v) => (
            <div key={v._id} className="card-cyber p-3 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold" style={{ color: "#FF9933" }}>{v.name}</span>
                <span className="text-xs ml-3" style={{ color: "#9898b0" }}>{v.email}</span>
              </div>
              <div className="flex gap-2">
                {v.verifications?.map((ver, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background:
                        ver.status === "approved" ? "rgba(19,136,8,0.15)"
                        : ver.status === "rejected" ? "rgba(220,38,38,0.1)"
                        : "rgba(65,105,225,0.15)",
                      color:
                        ver.status === "approved" ? "#138808"
                        : ver.status === "rejected" ? "#dc2626"
                        : "#4169e1",
                    }}
                  >
                    Poll {ver.pollId}: {ver.status}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
