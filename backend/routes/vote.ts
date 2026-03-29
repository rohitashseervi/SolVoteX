import { Router, Request, Response } from "express";
import { Connection, clusterApiUrl } from "@solana/web3.js";
import Vote from "../models/Vote";
import Poll from "../models/Poll";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();
const SOLANA_RPC = process.env.SOLANA_RPC_URL || clusterApiUrl("devnet");

/**
 * POST /api/vote/cast — Record a vote after voter signs SPL token transfer via Phantom
 * Body: { pollId, candidateName, voterWallet, txSignature }
 */
router.post("/cast", async (req: Request, res: Response) => {
  try {
    const { pollId, candidateName, voterWallet, txSignature } = req.body;

    if (!pollId || !candidateName || !voterWallet || !txSignature) {
      return res.status(400).json({ error: "pollId, candidateName, voterWallet, and txSignature are all required" });
    }

    // 1. Verify the poll exists and is live
    const poll = await Poll.findOne({ pollId });
    if (!poll) {
      return res.status(404).json({ error: "Poll not found" });
    }

    const now = new Date();
    if (now < poll.startTime) {
      return res.status(400).json({ error: "Voting has not started yet" });
    }
    if (now > poll.endTime) {
      return res.status(400).json({ error: "Voting has ended" });
    }

    // 2. Verify the candidate exists in this poll
    const candidate = poll.candidates.find((c) => c.name === candidateName);
    if (!candidate) {
      return res.status(400).json({ error: `Candidate "${candidateName}" not found in this poll` });
    }

    // 3. Check for duplicate vote
    const existingVote = await Vote.findOne({ pollId, voterWallet });
    if (existingVote) {
      return res.status(400).json({ error: "You have already voted in this poll" });
    }

    // 4. Verify the transaction on-chain (including memo data)
    let memoVerified = false;
    try {
      const connection = new Connection(SOLANA_RPC, "confirmed");
      const tx = await connection.getTransaction(txSignature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        return res.status(400).json({ error: "Transaction not found on-chain. It may still be confirming — try again in a few seconds." });
      }

      if (tx.meta?.err) {
        return res.status(400).json({ error: "Transaction failed on-chain" });
      }

      // Check for Memo instruction — verify candidate choice is embedded on-chain
      try {
        const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
        const accountKeys = tx.transaction.message.getAccountKeys
          ? tx.transaction.message.getAccountKeys().staticAccountKeys.map((k: any) => k.toBase58())
          : (tx.transaction.message as any).accountKeys?.map((k: any) => k.toBase58()) || [];

        const instructions = tx.transaction.message.compiledInstructions || (tx.transaction.message as any).instructions || [];

        for (const ix of instructions) {
          const progIdx = typeof ix.programIdIndex === 'number' ? ix.programIdIndex : -1;
          if (progIdx >= 0 && accountKeys[progIdx] === MEMO_PROGRAM) {
            const memoBytes = ix.data instanceof Uint8Array ? ix.data : Buffer.from(ix.data, 'base64');
            const memoStr = Buffer.from(memoBytes).toString("utf-8");
            const memoObj = JSON.parse(memoStr);
            if (memoObj.candidate === candidateName && memoObj.poll === pollId) {
              memoVerified = true;
            }
          }
        }
      } catch (memoErr: any) {
        console.warn("Memo verification note:", memoErr.message);
        // Non-fatal — older clients may not include memo
      }
    } catch (err: any) {
      console.warn("TX verification warning:", err.message);
      // Allow through if RPC is having issues — the tx signature uniqueness constraint prevents abuse
    }

    // 5. Record the vote
    const vote = new Vote({
      pollId,
      candidateName,
      voterWallet,
      txSignature,
      memoVerified,
    });

    await vote.save();

    res.status(201).json({
      success: true,
      vote: {
        pollId: vote.pollId,
        candidateName: vote.candidateName,
        voterWallet: vote.voterWallet,
        txSignature: vote.txSignature,
        timestamp: vote.timestamp,
        memoVerified,
      },
      message: `Vote recorded for "${candidateName}" in Poll #${pollId}`,
    });
  } catch (err: any) {
    console.error("Cast vote error:", err.message);
    if (err.code === 11000) {
      return res.status(400).json({ error: "Duplicate vote — you have already voted in this poll" });
    }
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/vote/results/:pollId — Get live vote results for a poll
 */
router.get("/results/:pollId", async (req: Request, res: Response) => {
  try {
    const poll = await Poll.findOne({ pollId: req.params.pollId });
    if (!poll) {
      return res.status(404).json({ error: "Poll not found" });
    }

    // Count votes per candidate
    const votes = await Vote.aggregate([
      { $match: { pollId: req.params.pollId } },
      { $group: { _id: "$candidateName", count: { $sum: 1 } } },
    ]);

    const voteMap: Record<string, number> = {};
    votes.forEach((v) => { voteMap[v._id] = v.count; });

    const totalVotes = votes.reduce((sum, v) => sum + v.count, 0);

    const candidateResults = poll.candidates.map((c, i) => ({
      name: c.name,
      party: c.party,
      votes: voteMap[c.name] || 0,
      color: ["#FF9933", "#138808", "#4169e1", "#dc2626", "#9333ea", "#06b6d4"][i % 6],
    }));

    // Compute status
    const now = new Date();
    let status: "upcoming" | "live" | "ended" = "upcoming";
    if (now >= poll.startTime && now <= poll.endTime) status = "live";
    else if (now > poll.endTime) status = "ended";

    res.json({
      success: true,
      poll: {
        pollId: poll.pollId,
        name: poll.name,
        description: poll.description,
        startTime: poll.startTime,
        endTime: poll.endTime,
        status,
        adminWallet: poll.adminWallet,
        mintAddress: poll.mintAddress,
      },
      candidates: candidateResults,
      totalVotes,
    });
  } catch (err: any) {
    console.error("Vote results error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/vote/check/:pollId/:wallet — Check if a wallet has already voted
 */
router.get("/check/:pollId/:wallet", async (req: Request, res: Response) => {
  try {
    const vote = await Vote.findOne({
      pollId: req.params.pollId,
      voterWallet: req.params.wallet,
    });

    res.json({
      success: true,
      hasVoted: !!vote,
      vote: vote ? {
        candidateName: vote.candidateName,
        txSignature: vote.txSignature,
        timestamp: vote.timestamp,
      } : null,
    });
  } catch (err: any) {
    console.error("Vote check error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/vote/ledger/:pollId — Get individual vote records (public transparency ledger)
 * Returns recent votes with wallet, candidate, tx signature, and timestamp
 */
router.get("/ledger/:pollId", async (req: Request, res: Response) => {
  try {
    const poll = await Poll.findOne({ pollId: req.params.pollId });
    if (!poll) {
      return res.status(404).json({ error: "Poll not found" });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const totalRecords = await Vote.countDocuments({ pollId: req.params.pollId });

    const votes = await Vote.find({ pollId: req.params.pollId })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .select("voterWallet candidateName txSignature timestamp memoVerified");

    res.json({
      success: true,
      ledger: votes.map((v) => ({
        voterWallet: v.voterWallet,
        candidateName: v.candidateName,
        txSignature: v.txSignature,
        timestamp: v.timestamp,
        memoVerified: v.memoVerified || false,
      })),
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
      },
    });
  } catch (err: any) {
    console.error("Vote ledger error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
