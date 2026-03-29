"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  truncateWallet,
  getExplorerAccountUrl,
  getExplorerTxUrl,
  CLUSTER,
} from "@/utils/constants";
import { getVoteResults, checkVoteStatus, getVoteLedger } from "@/utils/api";
import toast, { Toaster } from "react-hot-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart,
} from "recharts";

// ── Types ───────────────────────────────────────────
interface Candidate {
  name: string;
  party: string;
  votes: number;
  color: string;
}

interface VoteLedgerEntry {
  voterWallet: string;
  candidateName: string;
  txSignature: string;
  timestamp: string;
  memoVerified: boolean;
}

interface PollData {
  pollId: string;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  status: "upcoming" | "live" | "ended";
  adminWallet: string;
  mintAddress: string;
}

// ── Color palette ───────────────────────────────────
const COLORS = ["#FF9933", "#138808", "#4169e1", "#e54d66", "#9b59b6", "#1abc9c", "#f1c40f", "#e67e22"];

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const pollId = params.pollId as string;
  const { publicKey, connected } = useWallet();

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [poll, setPoll] = useState<PollData | null>(null);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"bar" | "pie">("bar");
  const [myVote, setMyVote] = useState<{ candidateName: string; txSignature: string } | null>(null);
  const [ledger, setLedger] = useState<VoteLedgerEntry[]>([]);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Fetch real poll data + candidates from backend
  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getVoteResults(pollId);
      setPoll(data.poll);
      setCandidates(data.candidates || []);
      setTotalVotes(data.totalVotes || 0);
    } catch (err: any) {
      setError(err.message || "Failed to load results");
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  useEffect(() => {
    fetchResults();
    // Auto-refresh every 15 seconds for live polls
    const interval = setInterval(fetchResults, 15000);
    return () => clearInterval(interval);
  }, [fetchResults]);

  // Check if connected wallet has voted
  useEffect(() => {
    if (!connected || !publicKey || !pollId) return;
    const checkMyVote = async () => {
      try {
        const data = await checkVoteStatus(pollId, publicKey.toBase58());
        if (data.hasVoted && data.vote) {
          setMyVote({ candidateName: data.vote.candidateName, txSignature: data.vote.txSignature });
        }
      } catch { /* not critical */ }
    };
    checkMyVote();
  }, [connected, publicKey, pollId]);

  // Fetch vote ledger (individual vote records)
  const fetchLedger = useCallback(async (page: number = 1) => {
    try {
      setLedgerLoading(true);
      const data = await getVoteLedger(pollId, page, 12);
      setLedger(data.ledger || []);
      setLedgerTotal(data.pagination?.totalRecords || 0);
      setLedgerTotalPages(data.pagination?.totalPages || 1);
      setLedgerPage(page);
    } catch { /* non-critical */ }
    finally { setLedgerLoading(false); }
  }, [pollId]);

  useEffect(() => {
    fetchLedger(1);
  }, [fetchLedger, totalVotes]);

  // Helper: get candidate color from the candidates array
  const getCandidateColor = useCallback((name: string) => {
    const c = candidates.find((c) => c.name === name);
    return c?.color || "#FF9933";
  }, [candidates]);

  // Generate a deterministic "block hash" from tx signature
  const blockHash = (tx: string) => {
    if (!tx) return "0x000...000";
    return `0x${tx.slice(0, 8)}...${tx.slice(-6)}`;
  };

  // Format timestamp for block display
  const formatBlockTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  // ── Computed values ───
  const leader = useMemo(() => {
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => b.votes - a.votes)[0];
  }, [candidates]);

  const barData = useMemo(
    () => candidates.map((c) => ({ name: c.name, votes: c.votes, fill: c.color })),
    [candidates]
  );

  const pieData = useMemo(
    () => candidates.map((c) => ({ name: c.name, value: c.votes })),
    [candidates]
  );

  // ── Custom tooltip ───
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const pct = totalVotes > 0 ? ((data.votes / totalVotes) * 100).toFixed(1) : 0;
      return (
        <div className="p-3 rounded-lg" style={{ background: "#0d0d1f", border: "1px solid rgba(255,255,255,0.1)" }}>
          <p className="text-sm font-semibold" style={{ color: data.fill || "#FF9933" }}>
            {data.name}
          </p>
          <p className="text-xs" style={{ color: "#9898b0" }}>
            {data.votes} votes ({pct}%)
          </p>
        </div>
      );
    }
    return null;
  };

  // ─── Loading state ───
  if (loading && candidates.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#02030a" }}>
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm" style={{ color: "#9898b0" }}>Loading results...</p>
        </div>
      </div>
    );
  }

  // ─── Error state ───
  if (error && !poll) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#02030a" }}>
        <div className="text-center card-cyber p-8 max-w-md">
          <div className="text-4xl mb-4">&#9888;</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: "#dc2626" }}>Poll Not Found</h2>
          <p className="text-sm mb-6" style={{ color: "#9898b0" }}>{error}</p>
          <button
            className="px-6 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "rgba(65,105,225,0.15)", color: "#4169e1", border: "1px solid rgba(65,105,225,0.3)" }}
            onClick={() => router.push("/")}
          >
            &larr; Back to Home
          </button>
        </div>
      </div>
    );
  }

  const isLive = poll?.status === "live";
  const statusColor = poll?.status === "live" ? "#138808" : poll?.status === "upcoming" ? "#FF9933" : "#dc2626";
  const statusLabel = poll?.status === "live" ? "LIVE" : poll?.status === "upcoming" ? "UPCOMING" : "ENDED";

  return (
    <div
      className="min-h-screen p-4 relative"
      style={{ background: "linear-gradient(135deg, #02030a 0%, #0d0d1f 50%, #02030a 100%)" }}
    >
      <Toaster position="top-right" />

      <div className="max-w-6xl mx-auto pt-6">
        {/* ═══════════ HEADER ═══════════ */}
        <div className="flex items-center justify-between mb-6">
          <button
            className="text-sm hover:underline"
            style={{ color: "#4169e1" }}
            onClick={() => router.push("/")}
          >
            &larr; Back
          </button>
          <div className="flex items-center gap-3">
            <span
              className="text-xs px-3 py-1 rounded-full flex items-center gap-2 font-semibold"
              style={{
                background: `${statusColor}22`,
                color: statusColor,
                border: `1px solid ${statusColor}44`,
              }}
            >
              {isLive && <span className="live-dot" />}
              {statusLabel}
            </span>
            <WalletMultiButton />
          </div>
        </div>

        {/* ═══════════ POLL INFO ═══════════ */}
        <div className="text-center mb-8">
          <h1
            className="text-3xl font-bold"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            <span style={{ color: "#FF9933" }}>{poll?.name || `Poll #${pollId}`}</span>
          </h1>
          {poll?.description && (
            <p className="text-sm mt-2 max-w-lg mx-auto" style={{ color: "#9898b0" }}>
              {poll.description}
            </p>
          )}
          <p className="text-xs mt-2" style={{ color: "#666" }}>
            Live Results Dashboard &middot; Poll ID: {pollId}
            {isLive && " &middot; Auto-refreshing every 15s"}
          </p>
          <div className="flex mx-auto mt-3 rounded overflow-hidden" style={{ width: "120px", height: "3px" }}>
            <div className="flex-1" style={{ background: "#FF9933" }} />
            <div className="flex-1 bg-white" />
            <div className="flex-1" style={{ background: "#138808" }} />
          </div>
        </div>

        {/* ═══════════ STAT CARDS ═══════════ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card-cyber p-4 text-center">
            <p className="text-xs uppercase tracking-wider" style={{ color: "#9898b0" }}>Total Votes</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "#FF9933", fontFamily: "'Orbitron', sans-serif" }}>
              {totalVotes}
            </p>
          </div>
          <div className="card-cyber p-4 text-center">
            <p className="text-xs uppercase tracking-wider" style={{ color: "#9898b0" }}>Candidates</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "#4169e1", fontFamily: "'Orbitron', sans-serif" }}>
              {candidates.length}
            </p>
          </div>
          <div className="card-cyber p-4 text-center">
            <p className="text-xs uppercase tracking-wider" style={{ color: "#9898b0" }}>Status</p>
            <p className="text-lg font-bold mt-1" style={{ color: statusColor, fontFamily: "'Orbitron', sans-serif" }}>
              {statusLabel}
            </p>
          </div>
          <div className="card-cyber p-4 text-center">
            <p className="text-xs uppercase tracking-wider" style={{ color: "#9898b0" }}>Leading</p>
            <p className="text-lg font-bold mt-1" style={{ color: leader?.color || "#FF9933", fontFamily: "'Orbitron', sans-serif" }}>
              {leader?.name || "---"}
            </p>
          </div>
        </div>

        {/* ═══════════ CHART TOGGLE ═══════════ */}
        <div className="flex gap-2 mb-6 justify-center">
          {(["bar", "pie"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className="px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all"
              style={{
                background: activeView === v ? "rgba(255,153,51,0.15)" : "rgba(255,255,255,0.03)",
                color: activeView === v ? "#FF9933" : "#9898b0",
                border: `1px solid ${activeView === v ? "rgba(255,153,51,0.4)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              {v === "bar" ? "Bar Chart" : "Pie Chart"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* ═══════════ MAIN CHART ═══════════ */}
          <div className="lg:col-span-2 card-cyber p-6">
            <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: "#FF9933" }}>
              {activeView === "bar" ? "Vote Distribution" : "Vote Share"}
            </h3>

            <div style={{ height: 350 }}>
              {activeView === "bar" && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} barSize={50}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fill: "#9898b0", fontSize: 12 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
                    <YAxis tick={{ fill: "#9898b0", fontSize: 12 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
                      {barData.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}

              {activeView === "pie" && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      innerRadius={60}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={{ stroke: "#9898b0" }}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#0d0d1f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                      itemStyle={{ color: "#9898b0" }}
                    />
                    <Legend wrapperStyle={{ color: "#9898b0", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ═══════════ CANDIDATE STANDINGS ═══════════ */}
          <div className="card-cyber p-6">
            <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: "#138808" }}>
              Standings
            </h3>
            <div className="space-y-4">
              {[...candidates]
                .sort((a, b) => b.votes - a.votes)
                .map((c, i) => {
                  const pct = totalVotes > 0 ? ((c.votes / totalVotes) * 100).toFixed(1) : "0";
                  return (
                    <div key={c.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                            style={{
                              background: i === 0 ? c.color : "rgba(255,255,255,0.05)",
                              color: i === 0 ? "#fff" : "#9898b0",
                            }}
                          >
                            {i + 1}
                          </span>
                          <span className="text-sm font-semibold" style={{ color: c.color }}>
                            {c.name}
                          </span>
                        </div>
                        <span className="text-sm font-bold" style={{ color: c.color }}>
                          {pct}%
                        </span>
                      </div>
                      <p className="text-xs mb-1 ml-7" style={{ color: "#9898b0" }}>
                        {c.party} &middot; {c.votes} votes
                      </p>
                      <div className="vote-bar-container ml-7">
                        <div
                          className="vote-bar-fill"
                          style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${c.color}, ${c.color}88)`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Refresh button */}
            <button
              onClick={fetchResults}
              className="w-full mt-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all"
              style={{ background: "rgba(255,153,51,0.1)", color: "#FF9933", border: "1px solid rgba(255,153,51,0.2)" }}
            >
              Refresh Results
            </button>
          </div>
        </div>

        {/* ═══════════ YOUR VOTE + TRANSPARENCY ═══════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Your Vote Receipt */}
          <div className="card-cyber p-6">
            <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: "#4169e1" }}>
              Your Vote Receipt
            </h3>
            {connected && publicKey ? (
              myVote ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-lg" style={{ background: "rgba(19,136,8,0.06)", border: "1px solid rgba(19,136,8,0.15)" }}>
                    <p className="text-xs" style={{ color: "#9898b0" }}>You voted for:</p>
                    <p className="text-lg font-bold" style={{ color: "#138808" }}>{myVote.candidateName}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <p className="text-xs mb-1" style={{ color: "#9898b0" }}>Transaction signature:</p>
                    <a
                      href={getExplorerTxUrl(myVote.txSignature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs break-all hover:underline"
                      style={{ color: "#4169e1" }}
                    >
                      {myVote.txSignature}
                    </a>
                  </div>
                  <p className="text-xs" style={{ color: "#9898b0" }}>
                    Wallet:{" "}
                    <a
                      href={getExplorerAccountUrl(publicKey.toBase58())}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                      style={{ color: "#4169e1" }}
                    >
                      {truncateWallet(publicKey.toBase58(), 6)}
                    </a>
                  </p>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm" style={{ color: "#9898b0" }}>You haven't voted in this poll yet.</p>
                  <button
                    className="mt-3 px-6 py-2 rounded-lg text-sm font-semibold"
                    style={{ background: "rgba(255,153,51,0.15)", color: "#FF9933", border: "1px solid rgba(255,153,51,0.3)" }}
                    onClick={() => router.push(`/vote/${pollId}`)}
                  >
                    Cast Your Vote &rarr;
                  </button>
                </div>
              )
            ) : (
              <div className="text-center py-6">
                <p className="text-sm mb-3" style={{ color: "#9898b0" }}>Connect your wallet to view your vote receipt.</p>
                <WalletMultiButton />
              </div>
            )}
          </div>

          {/* Transparency Panel */}
          <div className="card-cyber p-6">
            <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: "#138808" }}>
              Transparency &amp; Verification
            </h3>
            <div className="space-y-4">
              <div className="p-4 rounded-lg" style={{ background: "rgba(19,136,8,0.06)", border: "1px solid rgba(19,136,8,0.15)" }}>
                <p className="text-xs font-semibold mb-1" style={{ color: "#138808" }}>
                  On-Chain Voting
                </p>
                <p className="text-xs" style={{ color: "#9898b0" }}>
                  Every vote requires a real SPL token transfer signed by the voter's Phantom wallet. Each transaction is recorded on Solana devnet and can be independently verified.
                </p>
              </div>

              <div className="p-4 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                <p className="text-xs font-semibold mb-2" style={{ color: "#FF9933" }}>
                  Verify On-Chain
                </p>
                <div className="space-y-2">
                  {poll?.adminWallet && (
                    <a
                      href={getExplorerAccountUrl(poll.adminWallet)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs hover:underline"
                      style={{ color: "#4169e1" }}
                    >
                      <span>&rarr;</span> Admin Wallet on Explorer
                    </a>
                  )}
                  {poll?.mintAddress && (
                    <a
                      href={getExplorerAccountUrl(poll.mintAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs hover:underline"
                      style={{ color: "#4169e1" }}
                    >
                      <span>&rarr;</span> Vote Token Mint on Explorer
                    </a>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-lg" style={{ background: "rgba(65,105,225,0.06)", border: "1px solid rgba(65,105,225,0.15)" }}>
                <p className="text-xs font-semibold mb-1" style={{ color: "#4169e1" }}>
                  Anti-Fraud Measures
                </p>
                <p className="text-xs" style={{ color: "#9898b0" }}>
                  One vote per wallet per poll. Each vote requires a unique on-chain transaction signature. Duplicate votes are rejected at both the blockchain and database levels.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════ BLOCKCHAIN VOTE EXPLORER ═══════════ */}
        <div className="mb-8">
          {/* Section Header — mempool.space inspired */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="h-px flex-1 max-w-[80px]" style={{ background: "linear-gradient(90deg, transparent, #FF9933)" }} />
              <h2
                className="text-xl font-bold uppercase tracking-wider"
                style={{ fontFamily: "'Orbitron', sans-serif", color: "#FF9933" }}
              >
                Vote Chain Explorer
              </h2>
              <div className="h-px flex-1 max-w-[80px]" style={{ background: "linear-gradient(90deg, #FF9933, transparent)" }} />
            </div>
            <p className="text-xs uppercase tracking-widest" style={{ color: "#138808", fontFamily: "'Share Tech Mono', monospace" }}>
              Transparency at its Core
            </p>
            <p className="text-xs mt-1" style={{ color: "#666" }}>
              {ledgerTotal} vote{ledgerTotal !== 1 ? "s" : ""} recorded on Solana Devnet
            </p>
          </div>

          {/* Chain visualization — connecting line */}
          {ledger.length > 0 && (
            <div className="relative">
              {/* The chain backbone line (hidden on mobile, shown on desktop) */}
              <div
                className="absolute left-1/2 top-0 bottom-0 w-px hidden lg:block"
                style={{ background: "linear-gradient(180deg, #FF9933, #138808, #4169e1, transparent)" }}
              />

              {/* Vote blocks grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ledger.map((vote, idx) => {
                  const candColor = getCandidateColor(vote.candidateName);
                  const globalIdx = (ledgerPage - 1) * 12 + idx;
                  return (
                    <div
                      key={vote.txSignature}
                      className="relative group"
                      style={{ animationDelay: `${idx * 60}ms` }}
                    >
                      {/* Block card */}
                      <div
                        className="rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02]"
                        style={{
                          background: "linear-gradient(145deg, rgba(13,13,31,0.95), rgba(2,3,10,0.98))",
                          border: `1px solid ${candColor}33`,
                          boxShadow: `0 0 20px ${candColor}08`,
                        }}
                      >
                        {/* Block header — like mempool block header */}
                        <div
                          className="px-4 py-2 flex items-center justify-between"
                          style={{ background: `${candColor}15`, borderBottom: `1px solid ${candColor}22` }}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ background: candColor, boxShadow: `0 0 6px ${candColor}` }}
                            />
                            <span
                              className="text-xs font-bold uppercase tracking-wider"
                              style={{ color: candColor, fontFamily: "'Share Tech Mono', monospace" }}
                            >
                              Block #{ledgerTotal - globalIdx}
                            </span>
                          </div>
                          <span className="text-xs" style={{ color: "#666", fontFamily: "'Share Tech Mono', monospace" }}>
                            {formatBlockTime(vote.timestamp)}
                          </span>
                        </div>

                        {/* Block body */}
                        <div className="p-4 space-y-3">
                          {/* Voter Digital Identity */}
                          <div>
                            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "#666" }}>
                              Voter Identity
                            </p>
                            <div className="flex items-center gap-2">
                              {/* Identicon-style colored squares */}
                              <div className="flex gap-0.5">
                                {[0, 2, 4, 6].map((i) => (
                                  <div
                                    key={i}
                                    className="w-2 h-2 rounded-sm"
                                    style={{
                                      background: `#${vote.voterWallet.slice(i + 1, i + 7)}`,
                                      opacity: 0.8,
                                    }}
                                  />
                                ))}
                              </div>
                              <a
                                href={getExplorerAccountUrl(vote.voterWallet)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-mono hover:underline transition-colors"
                                style={{ color: "#9898b0" }}
                              >
                                {truncateWallet(vote.voterWallet, 6)}
                              </a>
                            </div>
                          </div>

                          {/* Voted For */}
                          <div>
                            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "#666" }}>
                              Voted For
                            </p>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-1 h-5 rounded-full"
                                style={{ background: candColor }}
                              />
                              <span className="text-sm font-bold" style={{ color: candColor }}>
                                {vote.candidateName}
                              </span>
                              {vote.memoVerified && (
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1"
                                  style={{
                                    background: "rgba(19,136,8,0.15)",
                                    color: "#138808",
                                    border: "1px solid rgba(19,136,8,0.3)",
                                    fontSize: "9px",
                                  }}
                                  title="Vote choice verified on-chain via Solana Memo program"
                                >
                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  ON-CHAIN
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Transaction Hash */}
                          <div
                            className="pt-2"
                            style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
                          >
                            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "#666" }}>
                              TX Hash
                            </p>
                            <a
                              href={getExplorerTxUrl(vote.txSignature)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-mono hover:underline flex items-center gap-1 transition-colors"
                              style={{ color: "#4169e1" }}
                            >
                              <span>{blockHash(vote.txSignature)}</span>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                            </a>
                          </div>
                        </div>

                        {/* Bottom accent bar */}
                        <div
                          className="h-0.5"
                          style={{ background: `linear-gradient(90deg, ${candColor}, transparent)` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {ledgerTotalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    onClick={() => fetchLedger(ledgerPage - 1)}
                    disabled={ledgerPage <= 1 || ledgerLoading}
                    className="px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-30"
                    style={{
                      background: "rgba(255,153,51,0.1)",
                      color: "#FF9933",
                      border: "1px solid rgba(255,153,51,0.2)",
                    }}
                  >
                    &larr; Newer
                  </button>
                  <span className="text-xs font-mono" style={{ color: "#9898b0" }}>
                    {ledgerPage} / {ledgerTotalPages}
                  </span>
                  <button
                    onClick={() => fetchLedger(ledgerPage + 1)}
                    disabled={ledgerPage >= ledgerTotalPages || ledgerLoading}
                    className="px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-30"
                    style={{
                      background: "rgba(255,153,51,0.1)",
                      color: "#FF9933",
                      border: "1px solid rgba(255,153,51,0.2)",
                    }}
                  >
                    Older &rarr;
                  </button>
                </div>
              )}

              {/* Loading overlay */}
              {ledgerLoading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl" style={{ background: "rgba(2,3,10,0.6)" }}>
                  <div className="animate-spin h-6 w-6 border-2 border-orange-500 border-t-transparent rounded-full" />
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!ledgerLoading && ledger.length === 0 && (
            <div className="card-cyber p-8 text-center">
              <div className="text-3xl mb-3" style={{ opacity: 0.3 }}>&#9638;</div>
              <p className="text-sm" style={{ color: "#9898b0" }}>No votes recorded yet. Blocks will appear here as votes come in.</p>
            </div>
          )}
        </div>

        {/* ═══════════ BOTTOM NAVIGATION ═══════════ */}
        <div className="flex justify-center gap-4 pb-8">
          <button
            className="px-6 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: "rgba(255,153,51,0.15)", color: "#FF9933", border: "1px solid rgba(255,153,51,0.3)" }}
            onClick={() => router.push(`/vote/${pollId}`)}
          >
            &larr; Cast Your Vote
          </button>
          <button
            className="px-6 py-2 rounded-lg text-sm"
            style={{ color: "#9898b0", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={() => router.push("/")}
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
