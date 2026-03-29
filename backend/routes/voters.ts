import { Router, Response } from "express";
import User from "../models/User";
import Poll from "../models/Poll";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { sendVoterInviteEmail } from "../utils/mailer";

const router = Router();

// POST /api/voters/invite — Admin invites a voter via email
router.post("/invite", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { name, email, pollId } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Voter name and email are required" });
    }

    if (!email.includes("@")) {
      return res.status(400).json({ error: "Valid email address required" });
    }

    // If pollId is provided, verify it belongs to this admin
    if (pollId) {
      const poll = await Poll.findOne({ pollId, admin: admin._id });
      if (!poll) {
        return res.status(403).json({ error: "Poll not found or does not belong to you" });
      }
    }

    // Check if voter already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // User exists — still send the invite email as a reminder
      const result = await sendVoterInviteEmail(name, email, pollId);
      if (!result.success) {
        return res.status(500).json({ error: `Email failed: ${result.error}` });
      }
      return res.json({
        success: true,
        message: `Invite resent to ${email} (user already registered)`,
        alreadyRegistered: true,
      });
    }

    // Send invitation email
    const result = await sendVoterInviteEmail(name, email, pollId);
    if (!result.success) {
      return res.status(500).json({ error: `Email failed: ${result.error}` });
    }

    res.json({
      success: true,
      message: `Invitation sent to ${name} at ${email}`,
      alreadyRegistered: false,
    });
  } catch (err: any) {
    console.error("Invite voter error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/voters/invite-bulk — Admin invites multiple voters at once
router.post("/invite-bulk", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { voters, pollId } = req.body;
    // voters: [{ name: string, email: string }]

    if (!voters || !Array.isArray(voters) || voters.length === 0) {
      return res.status(400).json({ error: "Voters array is required" });
    }

    if (voters.length > 100) {
      return res.status(400).json({ error: "Maximum 100 invites per batch" });
    }

    // If pollId is provided, verify it belongs to this admin
    if (pollId) {
      const poll = await Poll.findOne({ pollId, admin: admin._id });
      if (!poll) {
        return res.status(403).json({ error: "Poll not found or does not belong to you" });
      }
    }

    const results: { email: string; status: string; error?: string }[] = [];

    for (const voter of voters) {
      if (!voter.name || !voter.email) {
        results.push({ email: voter.email || "unknown", status: "skipped", error: "Missing name or email" });
        continue;
      }

      const emailResult = await sendVoterInviteEmail(voter.name, voter.email, pollId);
      results.push({
        email: voter.email,
        status: emailResult.success ? "sent" : "failed",
        error: emailResult.error,
      });
    }

    const sent = results.filter((r) => r.status === "sent").length;
    const failed = results.filter((r) => r.status === "failed").length;

    res.json({
      success: true,
      message: `${sent} invites sent, ${failed} failed`,
      results,
    });
  } catch (err: any) {
    console.error("Bulk invite error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/voters/list — Admin: get voters scoped to THIS admin's polls only
router.get("/list", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Get poll IDs belonging to THIS admin
    const adminPolls = await Poll.find({ admin: admin._id }).select("pollId");
    const adminPollIds = adminPolls.map((p) => p.pollId);

    if (adminPollIds.length === 0) {
      return res.json({
        success: true,
        stats: { total: 0, verified: 0, pending: 0, unverified: 0 },
        verified: [],
        pending: [],
        unverified: [],
      });
    }

    // Only get users who have verifications for THIS admin's polls
    const users = await User.find({
      isAdmin: false,
      "verifications.pollId": { $in: adminPollIds },
    }).select("-password -solanaWallet.secretKey").sort({ date: -1 });

    // Categorize voters based on their verifications for this admin's polls only
    const verified: any[] = [];
    const unverified: any[] = [];
    const pending: any[] = [];

    users.forEach((user) => {
      // Filter verifications to only this admin's polls
      const relevantVerifications = user.verifications.filter((v) =>
        adminPollIds.includes(v.pollId)
      );

      const hasApproved = relevantVerifications.some((v) => v.status === "approved");
      const hasPending = relevantVerifications.some((v) => v.status === "pending");

      if (hasApproved) {
        verified.push({
          id: user._id,
          name: user.name,
          email: user.email,
          registeredAt: user.date,
          verifications: relevantVerifications.filter((v) => v.status === "approved"),
        });
      }

      if (hasPending) {
        pending.push({
          id: user._id,
          name: user.name,
          email: user.email,
          registeredAt: user.date,
          verifications: relevantVerifications.filter((v) => v.status === "pending"),
        });
      }

      if (!hasApproved && !hasPending) {
        unverified.push({
          id: user._id,
          name: user.name,
          email: user.email,
          registeredAt: user.date,
        });
      }
    });

    res.json({
      success: true,
      stats: {
        total: verified.length + pending.length + unverified.length,
        verified: verified.length,
        pending: pending.length,
        unverified: unverified.length,
      },
      verified,
      pending,
      unverified,
    });
  } catch (err: any) {
    console.error("Voter list error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
