import mongoose, { Schema, Document } from "mongoose";

export interface ICandidate {
  name: string;
  party: string;
}

export interface IPoll extends Document {
  pollId: string; // unique ID (e.g. "1", "2", or a custom slug)
  name: string;
  description: string;
  admin: mongoose.Types.ObjectId; // reference to User
  adminWallet: string; // admin's Solana wallet address
  mintAddress?: string; // SPL token mint for this poll
  tokenName?: string;
  tokenSymbol?: string;
  estimatedVoters: number; // how many voters admin expects
  tokensMinted: number; // how many tokens were auto-minted
  mintStatus: "pending" | "minting" | "ready" | "failed"; // token setup progress
  mintError?: string; // error message if minting failed
  candidates: ICandidate[];
  startTime: Date;
  endTime: Date;
  status: "upcoming" | "live" | "ended";
  createdAt: Date;
}

const CandidateSchema = new Schema<ICandidate>({
  name: { type: String, required: true },
  party: { type: String, default: "" },
});

const PollSchema = new Schema<IPoll>({
  pollId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: "" },
  admin: { type: Schema.Types.ObjectId, ref: "User", required: true },
  adminWallet: { type: String, required: true },
  mintAddress: { type: String },
  tokenName: { type: String },
  tokenSymbol: { type: String },
  estimatedVoters: { type: Number, default: 0 },
  tokensMinted: { type: Number, default: 0 },
  mintStatus: {
    type: String,
    enum: ["pending", "minting", "ready", "failed"],
    default: "pending",
  },
  mintError: { type: String },
  candidates: { type: [CandidateSchema], default: [] },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: {
    type: String,
    enum: ["upcoming", "live", "ended"],
    default: "upcoming",
  },
  createdAt: { type: Date, default: Date.now },
});

// Auto-compute status based on current time
PollSchema.methods.computeStatus = function (): "upcoming" | "live" | "ended" {
  const now = new Date();
  if (now < this.startTime) return "upcoming";
  if (now > this.endTime) return "ended";
  return "live";
};

export default mongoose.model<IPoll>("Poll", PollSchema);
