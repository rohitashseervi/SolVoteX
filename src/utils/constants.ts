import { PublicKey } from "@solana/web3.js";

// Solana cluster config
export const CLUSTER = "devnet";
export const RPC_ENDPOINT = "https://api.devnet.solana.com";

// Program ID (update after deployment)
export const PROGRAM_ID = new PublicKey(
  "11111111111111111111111111111111"
);

// Backend API base URL
// For local dev: defaults to localhost:5000
// For production: set NEXT_PUBLIC_API_URL to your Render service URL (e.g. https://solvotex-api.onrender.com/api)
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// Solana Explorer base URL
export const EXPLORER_URL = "https://explorer.solana.com";
export const getExplorerTxUrl = (txHash: string) =>
  `${EXPLORER_URL}/tx/${txHash}?cluster=${CLUSTER}`;
export const getExplorerAccountUrl = (address: string) =>
  `${EXPLORER_URL}/address/${address}?cluster=${CLUSTER}`;

// Truncate wallet address for display
export const truncateWallet = (address: string, chars: number = 4) =>
  `${address.slice(0, chars)}...${address.slice(-chars)}`;
