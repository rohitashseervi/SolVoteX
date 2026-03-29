import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import User from "../models/User";
import Poll from "../models/Poll";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { transferSplToken } from "../utils/tokenTransfer";

const router = Router();

// Multer config for voter ID image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, PDF files allowed"));
    }
  },
});

// POST /api/verify/submit — Voter submits verification for a specific poll
router.post(
  "/submit",
  authMiddleware,
  upload.single("voterIdImage"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { wallet, pollId } = req.body;

      if (!wallet || !pollId) {
        return res.status(400).json({ error: "Wallet address and Poll ID are required" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Voter ID image is required" });
      }

      // Check if poll exists
      const poll = await Poll.findOne({ pollId });
      if (!poll) {
        return res.status(404).json({ error: `Poll with ID "${pollId}" does not exist. Please check the Poll ID and try again.` });
      }

      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if already submitted for this poll
      const existingVerification = user.verifications.find(
        (v) => v.pollId === pollId
      );
      if (existingVerification) {
        return res.status(400).json({
          error: `Verification already submitted for poll ${pollId}. Status: ${existingVerification.status}`,
        });
      }

      // Add verification entry
      user.verifications.push({
        pollId,
        wallet,
        imageUrl: `/uploads/${req.file.filename}`,
        status: "pending",
        submittedAt: new Date(),
      });

      await user.save();

      res.json({
        success: true,
        message: "Verification submitted. Awaiting admin approval.",
      });
    } catch (err: any) {
      console.error("Verification submit error:", err.message);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// GET /api/verify/pending — Admin: get pending verifications ONLY for their polls
router.get("/pending", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Get all poll IDs created by THIS admin
    const adminPolls = await Poll.find({ admin: admin._id }).select("pollId");
    const adminPollIds = adminPolls.map((p) => p.pollId);

    if (adminPollIds.length === 0) {
      return res.json({ success: true, pending: [] });
    }

    // Find all users with pending verifications for THIS admin's polls only
    const users = await User.find({
      "verifications.status": "pending",
      "verifications.pollId": { $in: adminPollIds },
    }).select("-password -solanaWallet.secretKey");

    const pendingList = users.flatMap((user) =>
      user.verifications
        .filter((v) => v.status === "pending" && adminPollIds.includes(v.pollId))
        .map((v) => ({
          userId: user._id,
          userName: user.name,
          userEmail: user.email,
          pollId: v.pollId,
          wallet: v.wallet,
          imageUrl: v.imageUrl,
          submittedAt: v.submittedAt,
        }))
    );

    res.json({ success: true, pending: pendingList });
  } catch (err: any) {
    console.error("Fetch pending error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/verify/completed — Admin: get completed/rejected verifications ONLY for their polls
router.get("/completed", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Get all poll IDs created by THIS admin
    const adminPolls = await Poll.find({ admin: admin._id }).select("pollId");
    const adminPollIds = adminPolls.map((p) => p.pollId);

    if (adminPollIds.length === 0) {
      return res.json({ success: true, completed: [] });
    }

    const users = await User.find({
      "verifications.status": { $in: ["approved", "rejected"] },
      "verifications.pollId": { $in: adminPollIds },
    }).select("-password -solanaWallet.secretKey");

    const completedList = users.flatMap((user) =>
      user.verifications
        .filter((v) => v.status !== "pending" && adminPollIds.includes(v.pollId))
        .map((v) => ({
          userId: user._id,
          userName: user.name,
          userEmail: user.email,
          pollId: v.pollId,
          wallet: v.wallet,
          imageUrl: v.imageUrl,
          status: v.status,
          submittedAt: v.submittedAt,
          reviewedAt: v.reviewedAt,
        }))
    );

    res.json({ success: true, completed: completedList });
  } catch (err: any) {
    console.error("Fetch completed error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/verify/approve — Admin approves a voter + transfers SPL token
router.post("/approve", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!admin.solanaWallet) {
      return res.status(400).json({ error: "Admin wallet not configured" });
    }

    const { userId, pollId, mintAddress } = req.body;

    if (!userId || !pollId || !mintAddress) {
      return res.status(400).json({ error: "userId, pollId, and mintAddress are required" });
    }

    // Verify this poll belongs to THIS admin
    const poll = await Poll.findOne({ pollId, admin: admin._id });
    if (!poll) {
      return res.status(403).json({ error: "You can only approve verifications for your own polls" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const verification = user.verifications.find(
      (v) => v.pollId === pollId && v.status === "pending"
    );

    if (!verification) {
      return res.status(400).json({ error: "No pending verification found for this poll" });
    }

    // Transfer 1 SPL token using admin's stored keypair
    const transferResult = await transferSplToken(
      admin.solanaWallet.secretKey,
      verification.wallet,
      mintAddress,
      1
    );

    if (!transferResult.success) {
      return res.status(500).json({
        error: `Token transfer failed: ${transferResult.error}`,
      });
    }

    // Update verification status
    verification.status = "approved";
    verification.reviewedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: `Voter approved. 1 token sent to ${verification.wallet}`,
      txHash: transferResult.txHash,
    });
  } catch (err: any) {
    console.error("Approve error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/verify/reject — Admin rejects a voter
router.post("/reject", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { userId, pollId } = req.body;

    // Verify this poll belongs to THIS admin
    const poll = await Poll.findOne({ pollId, admin: admin._id });
    if (!poll) {
      return res.status(403).json({ error: "You can only reject verifications for your own polls" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const verification = user.verifications.find(
      (v) => v.pollId === pollId && v.status === "pending"
    );

    if (!verification) {
      return res.status(400).json({ error: "No pending verification found" });
    }

    verification.status = "rejected";
    verification.reviewedAt = new Date();
    await user.save();

    res.json({ success: true, message: "Voter verification rejected." });
  } catch (err: any) {
    console.error("Reject error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/verify/status/:pollId — Voter checks their verification status for a poll
router.get(
  "/status/:pollId",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const verification = user.verifications.find(
        (v) => v.pollId === req.params.pollId
      );

      if (!verification) {
        return res.json({ success: true, status: "not_submitted" });
      }

      res.json({ success: true, status: verification.status });
    } catch (err: any) {
      console.error("Status check error:", err.message);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// GET /api/verify/my-verifications — Voter gets all their verification submissions
router.get(
  "/my-verifications",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        success: true,
        verifications: user.verifications.map((v) => ({
          pollId: v.pollId,
          wallet: v.wallet,
          status: v.status,
          submittedAt: v.submittedAt,
        })),
      });
    } catch (err: any) {
      console.error("My verifications error:", err.message);
      res.status(500).json({ error: "Server error" });
    }
  }
);

export default router;
