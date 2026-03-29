import mongoose, { Schema, Document } from "mongoose";

export interface IVote extends Document {
  pollId: string;
  candidateName: string;
  voterWallet: string;
  voterUserId?: mongoose.Types.ObjectId;
  txSignature: string; // On-chain SPL token transfer signature
  memoVerified: boolean; // Whether the candidate choice was verified via on-chain Memo
  timestamp: Date;
}

const VoteSchema = new Schema<IVote>({
  pollId: { type: String, required: true },
  candidateName: { type: String, required: true },
  voterWallet: { type: String, required: true },
  voterUserId: { type: Schema.Types.ObjectId, ref: "User" },
  txSignature: { type: String, required: true, unique: true },
  memoVerified: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
});

// Prevent double voting: one vote per wallet per poll
VoteSchema.index({ pollId: 1, voterWallet: 1 }, { unique: true });

export default mongoose.model<IVote>("Vote", VoteSchema);
