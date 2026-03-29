import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "SolVoteX_JWT_Secret_2026_DevNet_Secure";

export interface AuthRequest extends Request {
  userId?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.header("auth-token");

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { user: { id: string } };
    req.userId = decoded.user.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token." });
  }
}
