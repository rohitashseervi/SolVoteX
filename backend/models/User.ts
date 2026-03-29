import mongoose, { Schema, Document } from "mongoose";

export interface IVerification {
  pollId: string;
  wallet: string;
  imageUrl: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: Date;
  reviewedAt?: Date;
}

export interface ISolanaWallet {
  publicKey: string;
  secretKey: number[]; // Uint8Array stored as number array in MongoDB
  createdAt: Date;
  solBalance?: number; // cached SOL balance (not real-time)
}

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  isAdmin: boolean;
  date: Date;
  verifications: IVerification[];
  // Admin-only: server-generated Solana wallet for on-chain operations
  solanaWallet?: ISolanaWallet;
}

const VerificationSchema = new Schema<IVerification>({
  pollId: { type: String, required: true },
  wallet: { type: String, required: true },
  imageUrl: { type: String, required: true },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
});

const SolanaWalletSchema = new Schema<ISolanaWallet>({
  publicKey: { type: String, required: true },
  secretKey: { type: [Number], required: true },
  createdAt: { type: Date, default: Date.now },
  solBalance: { type: Number, default: 0 },
});

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true, minlength: 2 },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, minlength: 6 },
  isAdmin: { type: Boolean, default: false },
  date: { type: Date, default: Date.now },
  verifications: { type: [VerificationSchema], default: [] },
  solanaWallet: { type: SolanaWalletSchema, default: undefined },
});

export default mongoose.model<IUser>("User", UserSchema);
