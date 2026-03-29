import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";

const SOLANA_RPC = process.env.SOLANA_RPC_URL || clusterApiUrl("devnet");

// Alternate devnet RPC endpoints to try if default faucet is rate-limited
const DEVNET_RPCS = [
  SOLANA_RPC,
  "https://api.devnet.solana.com",
];

/**
 * Generate a new Solana keypair for an admin user.
 * Returns the public key and secret key (as number array for MongoDB storage).
 */
export function generateSolanaWallet(): {
  publicKey: string;
  secretKey: number[];
} {
  const keypair = Keypair.generate();
  return {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: Array.from(keypair.secretKey),
  };
}

/**
 * Reconstruct a Keypair from stored secret key (number array).
 */
export function getKeypairFromSecret(secretKey: number[]): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

/**
 * Airdrop SOL to a wallet on devnet.
 * Default: 2 SOL (enough for many transactions).
 * Returns the airdrop transaction signature.
 */
export async function airdropSol(
  publicKeyBase58: string,
  solAmount: number = 2
): Promise<{ success: boolean; signature?: string; error?: string; rateLimited?: boolean }> {
  const { PublicKey } = await import("@solana/web3.js");
  const pubkey = new PublicKey(publicKeyBase58);

  // Try each RPC endpoint
  for (const rpc of DEVNET_RPCS) {
    try {
      const connection = new Connection(rpc, "confirmed");

      const signature = await connection.requestAirdrop(
        pubkey,
        solAmount * LAMPORTS_PER_SOL
      );

      // Wait for confirmation
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        ...latestBlockhash,
      });

      console.log(
        `Airdropped ${solAmount} SOL to ${publicKeyBase58} via ${rpc}. TX: ${signature}`
      );

      return { success: true, signature };
    } catch (err: any) {
      const msg = err.message || "";
      const is429 = msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("airdrop limit");
      console.warn(`Airdrop via ${rpc} failed: ${msg}`);

      // If rate limited, try next endpoint
      if (is429) continue;

      // Non-rate-limit error, don't retry
      return { success: false, error: msg };
    }
  }

  // All endpoints rate-limited
  return {
    success: false,
    rateLimited: true,
    error: "All airdrop faucets are rate-limited. Use the web faucet at https://faucet.solana.com",
  };
}

/**
 * Get SOL balance for a wallet.
 */
export async function getSolBalance(publicKeyBase58: string): Promise<number> {
  try {
    const connection = new Connection(SOLANA_RPC, "confirmed");
    const { PublicKey } = await import("@solana/web3.js");
    const pubkey = new PublicKey(publicKeyBase58);
    const balance = await connection.getBalance(pubkey);
    return balance / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}
