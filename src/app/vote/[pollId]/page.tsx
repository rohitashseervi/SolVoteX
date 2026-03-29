"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { useAuth } from "@/contexts/AuthContext";
import { truncateWallet, getExplorerTxUrl } from "@/utils/constants";
import { getVoteResults, checkVoteStatus, castVote } from "@/utils/api";
import toast, { Toaster } from "react-hot-toast";

// Solana Memo Program — used to embed candidate choice on-chain
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

interface CandidateResult {
  name: string;
  party: string;
  votes: number;
  color: string;
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

export default function VotePage() {
  const params = useParams();
  const router = useRouter();
  const pollId = params.pollId as string;
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { isLoggedIn } = useAuth();

  const [candidates, setCandidates] = useState<CandidateResult[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [voted, setVoted] = useState(false);
  const [votedCandidate, setVotedCandidate] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [poll, setPoll] = useState<PollData | null>(null);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alreadyVotedTx, setAlreadyVotedTx] = useState<string | null>(null);

  // Fetch poll data + candidates from backend
  const fetchPollData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getVoteResults(pollId);
      setPoll(data.poll);
      setCandidates(data.candidates || []);
      setTotalVotes(data.totalVotes || 0);
    } catch (err: any) {
      setError(err.message || "Failed to load poll data");
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  useEffect(() => {
    fetchPollData();
  }, [fetchPollData]);

  // Check if wallet has already voted
  useEffect(() => {
    if (!connected || !publicKey || !pollId) return;

    const checkExistingVote = async () => {
      try {
        const data = await checkVoteStatus(pollId, publicKey.toBase58());
        if (data.hasVoted && data.vote) {
          setVoted(true);
          setVotedCandidate(data.vote.candidateName);
          setTxHash(data.vote.txSignature);
        }
      } catch {
        // Not critical
      }
    };

    checkExistingVote();
  }, [connected, publicKey, pollId]);

  const handleVote = async () => {
    if (!selectedCandidate) {
      toast.error("Please select a candidate");
      return;
    }
    if (!connected || !publicKey) {
      toast.error("Please connect your Phantom wallet first");
      return;
    }
    if (!poll) {
      toast.error("Poll data not loaded");
      return;
    }
    if (!poll.mintAddress) {
      toast.error("Poll tokens not yet ready. Please try again shortly.");
      return;
    }
    if (poll.status !== "live") {
      toast.error(poll.status === "upcoming" ? "Voting has not started yet" : "Voting has ended");
      return;
    }

    setVoting(true);
    try {
      // 1. Build SPL token transfer: 1 vote token from voter → admin wallet
      const mintPubkey = new PublicKey(poll.mintAddress);
      const adminPubkey = new PublicKey(poll.adminWallet);
      const voterPubkey = publicKey;

      // Get Associated Token Accounts
      const voterATA = await getAssociatedTokenAddress(
        mintPubkey,
        voterPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const adminATA = await getAssociatedTokenAddress(
        mintPubkey,
        adminPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Check voter has token balance
      try {
        const voterBalance = await connection.getTokenAccountBalance(voterATA);
        const amount = Number(voterBalance.value.amount);
        if (amount < 1) {
          toast.error("You don't have a voting token. Please complete verification first.");
          setVoting(false);
          return;
        }
      } catch {
        toast.error("No voting token found in your wallet. Please complete verification first.");
        setVoting(false);
        return;
      }

      // 2. Create transfer instruction (1 token, 0 decimals)
      const transferIx = createTransferInstruction(
        voterATA,       // source
        adminATA,        // destination
        voterPubkey,     // owner (signer)
        1,               // amount (1 vote token)
        [],              // multi-signers
        TOKEN_PROGRAM_ID
      );

      // 3. Build memo instruction — embeds vote choice on-chain for full transparency
      const memoData = JSON.stringify({
        app: "SolVoteX",
        poll: pollId,
        pollName: poll.name,
        candidate: selectedCandidate,
        timestamp: new Date().toISOString(),
      });

      const memoIx = new TransactionInstruction({
        keys: [{ pubkey: voterPubkey, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memoData, "utf-8"),
      });

      // 4. Build & send transaction via Phantom (SPL transfer + Memo)
      const transaction = new Transaction().add(transferIx).add(memoIx);
      transaction.feePayer = voterPubkey;

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;

      toast.loading("Please approve the transaction in Phantom...", { id: "vote-tx" });

      const signature = await sendTransaction(transaction, connection);

      toast.loading("Confirming on-chain...", { id: "vote-tx" });

      // 5. Wait for confirmation
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      toast.dismiss("vote-tx");

      // 6. Record the vote in our backend
      await castVote(pollId, selectedCandidate, voterPubkey.toBase58(), signature);

      setTxHash(signature);
      setVoted(true);
      setVotedCandidate(selectedCandidate);

      // Refresh results
      fetchPollData();

      toast.success("Vote cast successfully on-chain!");
    } catch (err: any) {
      toast.dismiss("vote-tx");
      console.error("Vote error:", err);

      if (err.message?.includes("User rejected")) {
        toast.error("Transaction cancelled by user");
      } else if (err.message?.includes("already voted")) {
        toast.error("You have already voted in this poll");
        setVoted(true);
      } else {
        toast.error(err.message || "Voting failed. Please try again.");
      }
    } finally {
      setVoting(false);
    }
  };

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#02030a" }}>
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm" style={{ color: "#9898b0" }}>Loading poll data...</p>
        </div>
      </div>
    );
  }

  // ─── Error state ───
  if (error || !poll) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#02030a" }}>
        <div className="text-center card-cyber p-8 max-w-md">
          <div className="text-4xl mb-4">⚠</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: "#dc2626" }}>
            Poll Not Found
          </h2>
          <p className="text-sm mb-6" style={{ color: "#9898b0" }}>
            {error || "This poll does not exist or has been removed."}
          </p>
          <button
            className="px-6 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "rgba(65,105,225,0.15)", color: "#4169e1", border: "1px solid rgba(65,105,225,0.3)" }}
            onClick={() => router.push("/")}
          >
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  const statusColor = poll.status === "live" ? "#138808" : poll.status === "upcoming" ? "#FF9933" : "#dc2626";
  const statusLabel = poll.status === "live" ? "LIVE" : poll.status === "upcoming" ? "UPCOMING" : "ENDED";

  return (
    <div
      className="min-h-screen p-4 relative"
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

      {/* Top bar */}
      <div className="max-w-4xl mx-auto pt-6 relative z-10">
        <div className="flex items-center justify-between mb-8">
          <button className="text-sm hover:underline" style={{ color: "#4169e1" }} onClick={() => router.push("/")}>
            &larr; Back
          </button>
          <div className="flex items-center gap-3">
            <span
              className="text-xs px-3 py-1 rounded-full font-semibold"
              style={{
                background: `${statusColor}22`,
                color: statusColor,
                border: `1px solid ${statusColor}44`,
              }}
            >
              {poll.status === "live" && <span className="live-dot mr-2" />}
              {statusLabel}
            </span>
            <WalletMultiButton />
          </div>
        </div>

        {/* Poll Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            <span style={{ color: "#FF9933" }}>{poll.name}</span>
          </h1>
          {poll.description && (
            <p className="text-sm mt-2 max-w-lg mx-auto" style={{ color: "#9898b0" }}>
              {poll.description}
            </p>
          )}
          <p className="text-xs mt-3" style={{ color: "#666" }}>
            Poll ID: {pollId} &nbsp;|&nbsp; Total Votes: {totalVotes}
          </p>
          {connected && publicKey && (
            <p className="text-xs mt-1" style={{ color: "#4169e1" }}>
              Connected: {truncateWallet(publicKey.toBase58())}
            </p>
          )}
          {/* Time info */}
          <div className="flex items-center justify-center gap-4 mt-3 text-xs" style={{ color: "#666" }}>
            <span>Start: {new Date(poll.startTime).toLocaleString()}</span>
            <span>End: {new Date(poll.endTime).toLocaleString()}</span>
          </div>
        </div>

        {voted ? (
          /* ═══════════ ALREADY VOTED ═══════════ */
          <div className="max-w-md mx-auto text-center">
            <div className="card-cyber p-8">
              <div className="text-6xl mb-4" style={{ color: "#138808" }}>&#10003;</div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: "#138808" }}>
                Vote Confirmed On-Chain
              </h2>
              <p className="text-sm mb-4" style={{ color: "#9898b0" }}>
                You voted for{" "}
                <span style={{ color: "#FF9933", fontWeight: 600 }}>{votedCandidate || selectedCandidate}</span>
              </p>
              {txHash && (
                <div className="p-3 rounded-lg mb-4" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <p className="text-xs mb-1" style={{ color: "#9898b0" }}>Transaction (Your Receipt):</p>
                  <a
                    href={getExplorerTxUrl(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs break-all hover:underline"
                    style={{ color: "#4169e1" }}
                  >
                    {txHash}
                  </a>
                </div>
              )}

              {/* Show current standings */}
              {candidates.length > 0 && (
                <div className="mt-6 text-left space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#9898b0" }}>
                    Current Standings
                  </p>
                  {candidates.map((c) => {
                    const pct = totalVotes > 0 ? ((c.votes / totalVotes) * 100).toFixed(1) : "0";
                    return (
                      <div key={c.name} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span style={{ color: c.color }}>{c.name}</span>
                            <span style={{ color: "#9898b0" }}>{c.votes} ({pct}%)</span>
                          </div>
                          <div className="vote-bar-container">
                            <div
                              className="vote-bar-fill"
                              style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${c.color}, ${c.color}88)` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-3 justify-center mt-6">
                <button
                  className="px-6 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: "rgba(65,105,225,0.15)", color: "#4169e1", border: "1px solid rgba(65,105,225,0.3)" }}
                  onClick={() => router.push(`/results/${pollId}`)}
                >
                  View Live Results &rarr;
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
        ) : poll.status === "upcoming" ? (
          /* ═══════════ NOT STARTED YET ═══════════ */
          <div className="max-w-md mx-auto text-center">
            <div className="card-cyber p-8">
              <div className="text-5xl mb-4">&#9200;</div>
              <h2 className="text-xl font-bold mb-2" style={{ color: "#FF9933" }}>Voting Not Started</h2>
              <p className="text-sm" style={{ color: "#9898b0" }}>
                Voting begins on {new Date(poll.startTime).toLocaleString()}
              </p>
            </div>
          </div>
        ) : poll.status === "ended" ? (
          /* ═══════════ POLL ENDED ═══════════ */
          <div className="max-w-md mx-auto text-center">
            <div className="card-cyber p-8">
              <div className="text-5xl mb-4">&#128232;</div>
              <h2 className="text-xl font-bold mb-2" style={{ color: "#dc2626" }}>Voting Has Ended</h2>
              <p className="text-sm mb-4" style={{ color: "#9898b0" }}>
                This poll closed on {new Date(poll.endTime).toLocaleString()}
              </p>
              <button
                className="px-6 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "rgba(65,105,225,0.15)", color: "#4169e1", border: "1px solid rgba(65,105,225,0.3)" }}
                onClick={() => router.push(`/results/${pollId}`)}
              >
                View Final Results &rarr;
              </button>
            </div>
          </div>
        ) : (
          /* ═══════════ CANDIDATE SELECTION (LIVE) ═══════════ */
          <div>
            {/* Candidates grid */}
            <div className="grid gap-4 max-w-2xl mx-auto mb-8">
              {candidates.map((c) => {
                const pct = totalVotes > 0 ? ((c.votes / totalVotes) * 100).toFixed(1) : "0";
                const isSelected = selectedCandidate === c.name;

                return (
                  <div
                    key={c.name}
                    className="card-cyber p-5 cursor-pointer transition-all"
                    style={{
                      borderColor: isSelected ? c.color : undefined,
                      boxShadow: isSelected ? `0 0 20px ${c.color}33` : undefined,
                    }}
                    onClick={() => !voting && setSelectedCandidate(c.name)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Selection indicator */}
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          border: `2px solid ${isSelected ? c.color : "rgba(255,255,255,0.2)"}`,
                          background: isSelected ? c.color : "transparent",
                        }}
                      >
                        {isSelected && <span className="text-white text-xs">&#10003;</span>}
                      </div>

                      {/* Candidate info */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold" style={{ color: c.color }}>
                            {c.name}
                          </h3>
                          <span className="text-sm font-bold" style={{ color: c.color }}>
                            {c.votes} votes ({pct}%)
                          </span>
                        </div>
                        {c.party && (
                          <p className="text-xs mb-2" style={{ color: "#9898b0" }}>
                            {c.party}
                          </p>
                        )}

                        {/* Live vote bar */}
                        <div className="vote-bar-container">
                          <div
                            className="vote-bar-fill"
                            style={{
                              width: `${pct}%`,
                              background: `linear-gradient(90deg, ${c.color}, ${c.color}88)`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vote button area */}
            <div className="text-center">
              {!connected ? (
                <div className="space-y-3">
                  <p className="text-sm" style={{ color: "#9898b0" }}>
                    Connect your Phantom wallet to cast your vote
                  </p>
                  <WalletMultiButton />
                  <p className="text-xs" style={{ color: "#666" }}>
                    You need 1 SPL voting token in your wallet (received after admin verification)
                  </p>
                </div>
              ) : (
                <div>
                  <button
                    onClick={handleVote}
                    disabled={!selectedCandidate || voting}
                    className="px-12 py-4 rounded-lg font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-40"
                    style={{
                      background: selectedCandidate
                        ? "linear-gradient(135deg, #FF9933, #e67e00)"
                        : "rgba(255,255,255,0.05)",
                      color: "#fff",
                      boxShadow: selectedCandidate ? "0 4px 30px rgba(255,153,51,0.4)" : "none",
                    }}
                  >
                    {voting ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Signing Transaction...
                      </span>
                    ) : (
                      "CAST YOUR VOTE ON-CHAIN"
                    )}
                  </button>

                  {/* Info box about what happens */}
                  <div
                    className="mt-4 p-3 rounded-lg max-w-md mx-auto text-left"
                    style={{ background: "rgba(255,153,51,0.06)", border: "1px solid rgba(255,153,51,0.15)" }}
                  >
                    <p className="text-xs" style={{ color: "#FF9933", fontWeight: 600 }}>
                      How voting works:
                    </p>
                    <p className="text-xs mt-1" style={{ color: "#9898b0" }}>
                      Clicking vote will open Phantom to sign a 1-token SPL transfer + Memo. Your candidate choice is embedded directly on Solana blockchain — fully transparent and independently verifiable by anyone.
                    </p>
                  </div>
                </div>
              )}

              {/* View Results link */}
              <div className="mt-6">
                <button
                  className="text-xs hover:underline"
                  style={{ color: "#4169e1" }}
                  onClick={() => router.push(`/results/${pollId}`)}
                >
                  View Live Results Dashboard &rarr;
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
