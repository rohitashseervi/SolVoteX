import { Router, Response } from "express";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import User from "../models/User";
import Poll from "../models/Poll";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();
const SOLANA_RPC = process.env.SOLANA_RPC_URL || clusterApiUrl("devnet");

// GET /api/stats/mint — Admin: get token supply info scoped to THIS admin's polls
router.get("/mint", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { mintAddress } = req.query;

    // Get poll IDs for THIS admin only
    const adminPolls = await Poll.find({ admin: admin._id }).select("pollId");
    const adminPollIds = adminPolls.map((p) => p.pollId);

    // Get voter stats scoped to this admin's polls
    const allUsers = await User.find({
      isAdmin: false,
      "verifications.pollId": { $in: adminPollIds },
    });

    // Count only verifications for this admin's polls
    let totalVerified = 0;
    let totalPending = 0;
    const uniqueVoters = new Set<string>();

    allUsers.forEach((u) => {
      u.verifications.forEach((v) => {
        if (adminPollIds.includes(v.pollId)) {
          uniqueVoters.add(u._id.toString());
          if (v.status === "approved") totalVerified++;
          else if (v.status === "pending") totalPending++;
        }
      });
    });

    const totalInvited = uniqueVoters.size;
    const totalUnverified = Math.max(0, totalInvited - totalVerified - totalPending);

    let adminTokenBalance = 0;
    let totalMintSupply = 0;

    // Use admin's stored wallet to fetch on-chain token data
    if (mintAddress && admin.solanaWallet) {
      try {
        const connection = new Connection(SOLANA_RPC, "confirmed");
        const mintPubkey = new PublicKey(mintAddress as string);
        const adminPubkey = new PublicKey(admin.solanaWallet.publicKey);

        // Get admin's token account balance
        const adminAta = await getAssociatedTokenAddress(mintPubkey, adminPubkey);
        try {
          const tokenAccount = await getAccount(connection, adminAta);
          adminTokenBalance = Number(tokenAccount.amount);
        } catch {
          adminTokenBalance = 0;
        }

        // Get total mint supply
        const mintInfo = await connection.getTokenSupply(mintPubkey);
        totalMintSupply = Number(mintInfo.value.amount);
      } catch (err: any) {
        console.error("On-chain fetch error:", err.message);
      }
    }

    const tokensDistributed = totalMintSupply - adminTokenBalance;
    const tokensNeeded = Math.max(0, (totalPending + totalUnverified) - adminTokenBalance);

    res.json({
      success: true,
      stats: {
        totalInvited,
        totalVerified,
        totalPending,
        totalUnverified,
        totalMintSupply,
        adminTokenBalance,
        tokensDistributed,
        tokensNeeded,
      },
    });
  } catch (err: any) {
    console.error("Mint stats error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
