"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { RPC_ENDPOINT, truncateWallet, getExplorerTxUrl } from "@/utils/constants";
import { getCandidatePDA, getVaultPDA } from "@/utils/program";

interface CandidateVotes {
  name: string;
  votes: number;
  party: string;
  symbolImage: string;
}

interface ActivityFeedEntry {
  id: string;
  wallet: string; // truncated
  fullWallet: string;
  candidateName: string;
  txHash: string;
  explorerUrl: string;
  timestamp: Date;
}

interface LiveVoteData {
  candidates: CandidateVotes[];
  totalVotes: number;
  vaultBalance: number;
  activityFeed: ActivityFeedEntry[];
  isConnected: boolean;
}

/**
 * Custom hook for real-time vote counting via Solana WebSocket subscriptions.
 * Subscribes to Candidate PDA accounts and the poll vault for live updates.
 */
export function useLiveVotes(
  pollId: number | null,
  candidateNames: string[]
): LiveVoteData {
  const [candidates, setCandidates] = useState<CandidateVotes[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [vaultBalance, setVaultBalance] = useState(0);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const connectionRef = useRef<Connection | null>(null);
  const subscriptionIds = useRef<number[]>([]);

  const addToFeed = useCallback(
    (entry: Omit<ActivityFeedEntry, "id" | "timestamp">) => {
      setActivityFeed((prev) => [
        {
          ...entry,
          id: `${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
        },
        ...prev.slice(0, 49), // Keep last 50 entries
      ]);
    },
    []
  );

  useEffect(() => {
    if (!pollId || candidateNames.length === 0) return;

    const connection = new Connection(RPC_ENDPOINT, {
      commitment: "confirmed",
      wsEndpoint: RPC_ENDPOINT.replace("https", "wss"),
    });
    connectionRef.current = connection;

    // Subscribe to each candidate's PDA account
    candidateNames.forEach((name) => {
      const [candidatePDA] = getCandidatePDA(pollId, name);

      const subId = connection.onAccountChange(
        candidatePDA,
        (accountInfo) => {
          try {
            // Decode candidate account data (skip 8-byte discriminator)
            const data = accountInfo.data;
            if (data.length < 8) return;

            // Read votes (u64) — offset depends on account structure
            // poll: Pubkey (32) + poll_id: u64 (8) + candidate_name: String (4+len) + party: String (4+len) + symbol_image: String (4+len) + votes: u64 (8)
            // For now, we'll re-fetch using the program's IDL decoder
            // Simple approach: read the last 8 bytes as votes
            const votesOffset = data.length - 8;
            const votes = Number(data.readBigUInt64LE(votesOffset));

            setCandidates((prev) => {
              const updated = [...prev];
              const idx = updated.findIndex((c) => c.name === name);
              if (idx >= 0) {
                updated[idx] = { ...updated[idx], votes };
              }
              return updated;
            });
          } catch (err) {
            console.error("Error decoding candidate data:", err);
          }
        },
        "confirmed"
      );

      subscriptionIds.current.push(subId);
    });

    // Subscribe to vault token account for balance updates
    const [vaultPDA] = getVaultPDA(pollId);
    const vaultSubId = connection.onAccountChange(
      vaultPDA,
      (accountInfo) => {
        try {
          // SPL Token account: amount is at offset 64 (8 bytes, u64)
          const data = accountInfo.data;
          if (data.length >= 72) {
            const balance = Number(data.readBigUInt64LE(64));
            setVaultBalance(balance);
            setTotalVotes(balance); // 1 token = 1 vote
          }
        } catch (err) {
          console.error("Error decoding vault data:", err);
        }
      },
      "confirmed"
    );
    subscriptionIds.current.push(vaultSubId);

    setIsConnected(true);

    // Cleanup subscriptions on unmount
    return () => {
      subscriptionIds.current.forEach((id) => {
        connection.removeAccountChangeListener(id);
      });
      subscriptionIds.current = [];
      setIsConnected(false);
    };
  }, [pollId, candidateNames.join(",")]);

  return {
    candidates,
    totalVotes,
    vaultBalance,
    activityFeed,
    isConnected,
  };
}
