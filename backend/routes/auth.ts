import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { generateSolanaWallet, airdropSol } from "../utils/solanaWallet";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "SolVoteX_JWT_Secret_2026_DevNet_Secure";

// POST /api/auth/signup — Register a new user
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { name, email, password, isAdmin } = req.body;

    // Validation
    if (!name || name.length < 2) {
      return res.status(400).json({ error: "Name must be at least 2 characters" });
    }
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email required" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const userData: any = {
      name,
      email,
      password: hashedPassword,
      isAdmin: isAdmin || false,
    };

    // If admin, generate a Solana wallet and airdrop SOL
    if (isAdmin) {
      const wallet = generateSolanaWallet();
      userData.solanaWallet = {
        publicKey: wallet.publicKey,
        secretKey: wallet.secretKey,
        createdAt: new Date(),
        solBalance: 0,
      };

      // Airdrop SOL in background (don't block signup)
      airdropSol(wallet.publicKey, 2).then((result) => {
        if (result.success) {
          console.log(`Admin wallet funded: ${wallet.publicKey} (2 SOL)`);
          // Update cached balance
          User.findOneAndUpdate(
            { email },
            { "solanaWallet.solBalance": 2 }
          ).catch(() => {});
        } else {
          console.warn(`Airdrop failed for ${wallet.publicKey}: ${result.error}`);
        }
      });
    }

    const user = new User(userData);
    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { user: { id: user.id } },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        // Send wallet public key to frontend (never the secret key!)
        walletAddress: user.solanaWallet?.publicKey || null,
      },
    });
  } catch (err: any) {
    console.error("Signup error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/login — Login user
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Generate JWT
    const token = jwt.sign(
      { user: { id: user.id } },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        walletAddress: user.solanaWallet?.publicKey || null,
      },
    });
  } catch (err: any) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/auth/user — Get current logged-in user
router.get("/user", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Exclude password and secret key from response
    const user = await User.findById(req.userId).select("-password -solanaWallet.secretKey");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        walletAddress: user.solanaWallet?.publicKey || null,
        walletBalance: user.solanaWallet?.solBalance || 0,
        verifications: user.verifications,
      },
    });
  } catch (err: any) {
    console.error("GetUser error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
