import { Router, Response } from "express";
import User from "../models/User";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import {
  createSplMint,
  mintTokensToAdmin,
  getAdminTokenBalance,
} from "../utils/tokenTransfer";
import { airdropSol, getSolBalance } from "../utils/solanaWallet";

const router = Router();

// POST /api/token/create-mint — Admin creates a new SPL token mint
router.post("/create-mint", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!admin.solanaWallet) {
      return res.status(400).json({ error: "Admin wallet not found. Contact support." });
    }

    const { tokenName, tokenSymbol } = req.body;

    // Create SPL mint using admin's stored keypair
    const result = await createSplMint(admin.solanaWallet.secretKey, 0);

    if (!result.success) {
      return res.status(500).json({ error: `Mint creation failed: ${result.error}` });
    }

    res.json({
      success: true,
      mintAddress: result.mintAddress,
      adminWallet: admin.solanaWallet.publicKey,
      tokenName: tokenName || "SolVoteX Token",
      tokenSymbol: tokenSymbol || "SVX",
      message: `Token mint created: ${result.mintAddress}`,
    });
  } catch (err: any) {
    console.error("Create mint error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/token/mint — Admin mints tokens to their wallet
router.post("/mint", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!admin.solanaWallet) {
      return res.status(400).json({ error: "Admin wallet not found" });
    }

    const { mintAddress, amount } = req.body;

    if (!mintAddress || !amount || amount <= 0) {
      return res.status(400).json({ error: "Mint address and valid amount are required" });
    }

    const result = await mintTokensToAdmin(
      admin.solanaWallet.secretKey,
      mintAddress,
      amount
    );

    if (!result.success) {
      return res.status(500).json({ error: `Minting failed: ${result.error}` });
    }

    res.json({
      success: true,
      txHash: result.txHash,
      amount,
      mintAddress,
      message: `Minted ${amount} tokens successfully`,
    });
  } catch (err: any) {
    console.error("Mint tokens error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/token/balance — Get admin's token balance for a mint
router.get("/balance", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!admin.solanaWallet) {
      return res.status(400).json({ error: "Admin wallet not found" });
    }

    const { mintAddress } = req.query;

    if (!mintAddress) {
      return res.status(400).json({ error: "mintAddress query param required" });
    }

    const tokenBalance = await getAdminTokenBalance(
      admin.solanaWallet.publicKey,
      mintAddress as string
    );

    const solBalance = await getSolBalance(admin.solanaWallet.publicKey);

    res.json({
      success: true,
      adminWallet: admin.solanaWallet.publicKey,
      mintAddress,
      tokenBalance,
      solBalance,
    });
  } catch (err: any) {
    console.error("Token balance error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/token/airdrop — Request more devnet SOL for admin wallet
router.post("/airdrop", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!admin.solanaWallet) {
      return res.status(400).json({ error: "Admin wallet not found" });
    }

    const { amount } = req.body;
    const solAmount = Math.min(amount || 2, 2); // Max 2 SOL per airdrop

    const result = await airdropSol(admin.solanaWallet.publicKey, solAmount);

    if (!result.success) {
      const statusCode = result.rateLimited ? 429 : 500;
      return res.status(statusCode).json({
        error: result.error || "Airdrop failed",
        rateLimited: result.rateLimited || false,
        walletAddress: admin.solanaWallet.publicKey,
        faucetUrl: result.rateLimited ? "https://faucet.solana.com" : undefined,
      });
    }

    // Update cached balance
    const newBalance = await getSolBalance(admin.solanaWallet.publicKey);
    await User.findByIdAndUpdate(req.userId, {
      "solanaWallet.solBalance": newBalance,
    });

    res.json({
      success: true,
      signature: result.signature,
      solBalance: newBalance,
      message: `Airdropped ${solAmount} SOL to admin wallet`,
    });
  } catch (err: any) {
    console.error("Airdrop error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/token/wallet — Get admin wallet info
router.get("/wallet", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!admin.solanaWallet) {
      return res.status(400).json({ error: "Admin wallet not found" });
    }

    const solBalance = await getSolBalance(admin.solanaWallet.publicKey);

    // Update cached balance
    await User.findByIdAndUpdate(req.userId, {
      "solanaWallet.solBalance": solBalance,
    });

    res.json({
      success: true,
      walletAddress: admin.solanaWallet.publicKey,
      solBalance,
      createdAt: admin.solanaWallet.createdAt,
    });
  } catch (err: any) {
    console.error("Wallet info error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
