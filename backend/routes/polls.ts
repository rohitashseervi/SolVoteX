import { Router, Response } from "express";
import Poll from "../models/Poll";
import User from "../models/User";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { createSplMint, mintTokensToAdmin, attachTokenMetadata } from "../utils/tokenTransfer";
import { getSolBalance } from "../utils/solanaWallet";

const router = Router();

/**
 * Background function: creates SPL mint + mints tokens for a poll.
 * Updates the poll document as it progresses.
 */
async function autoMintForPoll(
  pollId: string,
  adminSecretKey: number[],
  estimatedVoters: number,
  tokenName: string,
  tokenSymbol: string
) {
  try {
    // Mark as minting
    await Poll.findOneAndUpdate({ pollId }, { mintStatus: "minting" });

    // Add 10% buffer so admin has extra tokens in case more voters show up
    const tokenCount = Math.ceil(estimatedVoters * 1.1);

    // Step 1: Create SPL mint (0 decimals = whole vote tokens)
    const mintResult = await createSplMint(adminSecretKey, 0);
    if (!mintResult.success || !mintResult.mintAddress) {
      await Poll.findOneAndUpdate({ pollId }, {
        mintStatus: "failed",
        mintError: `Mint creation failed: ${mintResult.error}`,
      });
      return;
    }

    const mintAddress = mintResult.mintAddress;
    console.log(`[AutoMint] Poll ${pollId}: Mint created → ${mintAddress}`);

    // Update poll with mint address immediately
    await Poll.findOneAndUpdate({ pollId }, { mintAddress });

    // Step 2: Attach Metaplex metadata (so Phantom shows name instead of "Unknown Token")
    const metadataResult = await attachTokenMetadata(
      adminSecretKey,
      mintAddress,
      tokenName,
      tokenSymbol
    );
    if (metadataResult.success) {
      console.log(`[AutoMint] Poll ${pollId}: Metadata attached → ${tokenName} (${tokenSymbol})`);
    } else {
      // Non-fatal — token still works, just shows as "Unknown" in Phantom
      console.warn(`[AutoMint] Poll ${pollId}: Metadata failed (non-fatal): ${metadataResult.error}`);
    }

    // Step 3: Mint tokens to admin's wallet
    const mintTokenResult = await mintTokensToAdmin(adminSecretKey, mintAddress, tokenCount);
    if (!mintTokenResult.success) {
      await Poll.findOneAndUpdate({ pollId }, {
        mintStatus: "failed",
        mintError: `Token minting failed: ${mintTokenResult.error}`,
      });
      return;
    }

    console.log(`[AutoMint] Poll ${pollId}: Minted ${tokenCount} tokens → admin wallet`);

    // Mark as ready
    await Poll.findOneAndUpdate({ pollId }, {
      mintStatus: "ready",
      tokensMinted: tokenCount,
      mintError: undefined,
    });

    console.log(`[AutoMint] Poll ${pollId}: Token setup complete!`);
  } catch (err: any) {
    console.error(`[AutoMint] Poll ${pollId} error:`, err.message);
    await Poll.findOneAndUpdate({ pollId }, {
      mintStatus: "failed",
      mintError: err.message,
    });
  }
}

// POST /api/polls/create — Admin creates a new poll (auto-mints tokens)
router.post("/create", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!admin.solanaWallet) {
      return res.status(400).json({ error: "Admin wallet not found" });
    }

    const { name, description, candidates, startTime, endTime, estimatedVoters, tokenName, tokenSymbol } = req.body;

    if (!name || !startTime || !endTime) {
      return res.status(400).json({ error: "Poll name, start time, and end time are required" });
    }

    if (!candidates || candidates.length < 2) {
      return res.status(400).json({ error: "At least 2 candidates are required" });
    }

    if (!estimatedVoters || estimatedVoters < 1) {
      return res.status(400).json({ error: "Estimated voter count is required (minimum 1)" });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) {
      return res.status(400).json({ error: "End time must be after start time" });
    }

    // Check if admin has enough SOL for mint creation + minting (~0.05 SOL needed)
    const solBalance = await getSolBalance(admin.solanaWallet.publicKey);
    if (solBalance < 0.02) {
      return res.status(400).json({
        error: `Insufficient SOL balance (${solBalance.toFixed(4)} SOL). Need at least 0.02 SOL for token creation. Use the Airdrop button or Solana Faucet.`,
        needsSol: true,
        walletAddress: admin.solanaWallet.publicKey,
      });
    }

    // Generate a unique poll ID
    const pollCount = await Poll.countDocuments();
    const pollId = String(pollCount + 1);

    // Compute initial status
    const now = new Date();
    let status: "upcoming" | "live" | "ended" = "upcoming";
    if (now >= start && now <= end) status = "live";
    else if (now > end) status = "ended";

    const poll = new Poll({
      pollId,
      name,
      description: description || "",
      admin: admin._id,
      adminWallet: admin.solanaWallet.publicKey,
      tokenName: tokenName || `${name.replace(/\s+/g, "")}Token`,
      tokenSymbol: tokenSymbol || "VOTE",
      estimatedVoters: Number(estimatedVoters),
      tokensMinted: 0,
      mintStatus: "pending",
      candidates: candidates.map((c: { name: string; party?: string }) => ({
        name: c.name,
        party: c.party || "",
      })),
      startTime: start,
      endTime: end,
      status,
    });

    await poll.save();

    // Fire-and-forget: auto-create mint + mint tokens + attach metadata in background
    const finalTokenName = tokenName || `${name.replace(/\s+/g, "")}Token`;
    const finalTokenSymbol = tokenSymbol || "VOTE";
    autoMintForPoll(pollId, admin.solanaWallet.secretKey, Number(estimatedVoters), finalTokenName, finalTokenSymbol);

    res.status(201).json({
      success: true,
      poll: {
        pollId: poll.pollId,
        name: poll.name,
        description: poll.description,
        candidates: poll.candidates,
        startTime: poll.startTime,
        endTime: poll.endTime,
        status: poll.status,
        adminWallet: poll.adminWallet,
        tokenName: poll.tokenName,
        tokenSymbol: poll.tokenSymbol,
        estimatedVoters: poll.estimatedVoters,
        mintStatus: "pending",
        createdAt: poll.createdAt,
      },
      message: `Poll "${name}" created with ID: ${pollId}. Token minting in progress...`,
    });
  } catch (err: any) {
    console.error("Create poll error:", err.message);
    if (err.code === 11000) {
      return res.status(400).json({ error: "Poll ID already exists" });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/polls/list — Admin: get all polls created by this admin
router.get("/list", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const polls = await Poll.find({ admin: admin._id }).sort({ createdAt: -1 });

    // Update statuses based on current time
    const now = new Date();
    const updatedPolls = polls.map((poll) => {
      let status: "upcoming" | "live" | "ended" = "upcoming";
      if (now >= poll.startTime && now <= poll.endTime) status = "live";
      else if (now > poll.endTime) status = "ended";

      // Update in DB if changed (non-blocking)
      if (poll.status !== status) {
        Poll.findByIdAndUpdate(poll._id, { status }).catch(() => {});
      }

      return {
        pollId: poll.pollId,
        name: poll.name,
        description: poll.description,
        candidates: poll.candidates,
        startTime: poll.startTime,
        endTime: poll.endTime,
        status,
        adminWallet: poll.adminWallet,
        mintAddress: poll.mintAddress,
        tokenName: poll.tokenName,
        tokenSymbol: poll.tokenSymbol,
        estimatedVoters: poll.estimatedVoters,
        tokensMinted: poll.tokensMinted,
        mintStatus: poll.mintStatus,
        mintError: poll.mintError,
        createdAt: poll.createdAt,
      };
    });

    res.json({ success: true, polls: updatedPolls });
  } catch (err: any) {
    console.error("List polls error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/polls/:pollId — Get a specific poll (public)
router.get("/:pollId", async (req, res) => {
  try {
    const poll = await Poll.findOne({ pollId: req.params.pollId });
    if (!poll) {
      return res.status(404).json({ error: "Poll not found" });
    }

    // Update status based on current time
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
        candidates: poll.candidates,
        startTime: poll.startTime,
        endTime: poll.endTime,
        status,
        adminWallet: poll.adminWallet,
        mintAddress: poll.mintAddress,
        tokenName: poll.tokenName,
        tokenSymbol: poll.tokenSymbol,
      },
    });
  } catch (err: any) {
    console.error("Get poll error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/polls/:pollId/mint — Admin attaches a mint address to a poll
router.put("/:pollId/mint", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { mintAddress, tokenName, tokenSymbol } = req.body;
    if (!mintAddress) {
      return res.status(400).json({ error: "Mint address is required" });
    }

    const poll = await Poll.findOneAndUpdate(
      { pollId: req.params.pollId, admin: admin._id },
      { mintAddress, tokenName, tokenSymbol },
      { new: true }
    );

    if (!poll) {
      return res.status(404).json({ error: "Poll not found or not yours" });
    }

    res.json({ success: true, message: `Mint attached to poll ${poll.pollId}` });
  } catch (err: any) {
    console.error("Update poll mint error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
