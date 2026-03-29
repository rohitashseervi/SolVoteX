import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  transfer,
  createMint,
  mintTo,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import { getKeypairFromSecret } from "./solanaWallet";

const SOLANA_RPC = process.env.SOLANA_RPC_URL || clusterApiUrl("devnet");

// ── Metaplex Token Metadata Program ──────────────────────
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

/**
 * Derive the metadata PDA for a given mint.
 */
function getMetadataPDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  return pda;
}

/**
 * Build a CreateMetadataAccountV3 instruction manually.
 * This avoids needing the heavy @metaplex-foundation packages.
 */
function buildCreateMetadataV3Instruction(
  metadataPDA: PublicKey,
  mint: PublicKey,
  mintAuthority: PublicKey,
  payer: PublicKey,
  updateAuthority: PublicKey,
  name: string,
  symbol: string,
  uri: string
): TransactionInstruction {
  // Serialize the CreateMetadataAccountV3 instruction data
  // Discriminator: 33 (CreateMetadataAccountV3)
  const nameBytes = Buffer.from(name);
  const symbolBytes = Buffer.from(symbol);
  const uriBytes = Buffer.from(uri);

  // Calculate buffer size
  const dataSize =
    1 + // discriminator
    4 + nameBytes.length + // name (borsh string: 4 byte len + data)
    4 + symbolBytes.length + // symbol
    4 + uriBytes.length + // uri
    2 + // seller_fee_basis_points (u16)
    1 + // option<creators> = None
    1 + // option<collection> = None
    1 + // option<uses> = None
    1 + // is_mutable (bool)
    1 + // option<collection_details> = None (V3 field)
    0;

  const data = Buffer.alloc(dataSize);
  let offset = 0;

  // Discriminator for CreateMetadataAccountV3
  data.writeUInt8(33, offset);
  offset += 1;

  // name
  data.writeUInt32LE(nameBytes.length, offset);
  offset += 4;
  nameBytes.copy(data, offset);
  offset += nameBytes.length;

  // symbol
  data.writeUInt32LE(symbolBytes.length, offset);
  offset += 4;
  symbolBytes.copy(data, offset);
  offset += symbolBytes.length;

  // uri
  data.writeUInt32LE(uriBytes.length, offset);
  offset += 4;
  uriBytes.copy(data, offset);
  offset += uriBytes.length;

  // seller_fee_basis_points = 0
  data.writeUInt16LE(0, offset);
  offset += 2;

  // creators = None
  data.writeUInt8(0, offset);
  offset += 1;

  // collection = None
  data.writeUInt8(0, offset);
  offset += 1;

  // uses = None
  data.writeUInt8(0, offset);
  offset += 1;

  // is_mutable = true
  data.writeUInt8(1, offset);
  offset += 1;

  // collection_details = None (V3)
  data.writeUInt8(0, offset);
  offset += 1;

  const keys = [
    { pubkey: metadataPDA, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: mintAuthority, isSigner: true, isWritable: false },
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: updateAuthority, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId: TOKEN_METADATA_PROGRAM_ID,
    data: data.subarray(0, offset),
  });
}

/**
 * Attach Metaplex token metadata (name, symbol) to a mint.
 * This is what makes Phantom/Explorer show the token name instead of "Unknown Token".
 */
export async function attachTokenMetadata(
  adminSecretKey: number[],
  mintAddress: string,
  tokenName: string,
  tokenSymbol: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const connection = new Connection(SOLANA_RPC, "confirmed");
    const adminKeypair = getKeypairFromSecret(adminSecretKey);
    const mintPubkey = new PublicKey(mintAddress);
    const metadataPDA = getMetadataPDA(mintPubkey);

    const ix = buildCreateMetadataV3Instruction(
      metadataPDA,
      mintPubkey,
      adminKeypair.publicKey, // mint authority
      adminKeypair.publicKey, // payer
      adminKeypair.publicKey, // update authority
      tokenName,
      tokenSymbol,
      "" // uri (empty — no off-chain JSON needed for basic name/symbol)
    );

    const tx = new Transaction().add(ix);
    tx.feePayer = adminKeypair.publicKey;
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;

    tx.sign(adminKeypair);
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, "confirmed");

    console.log(`Token metadata attached: ${tokenName} (${tokenSymbol}) → ${mintAddress}`);
    return { success: true };
  } catch (err: any) {
    console.error("Attach metadata failed:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Transfer SPL tokens from admin wallet to a voter's wallet.
 * Loads admin keypair from the stored secret key (from DB).
 */
export async function transferSplToken(
  adminSecretKey: number[],
  voterWalletAddress: string,
  mintAddress: string,
  amount: number = 1
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const connection = new Connection(SOLANA_RPC, "confirmed");
    const adminKeypair = getKeypairFromSecret(adminSecretKey);

    const mintPubkey = new PublicKey(mintAddress);
    const voterPubkey = new PublicKey(voterWalletAddress);

    // Get or create the admin's token account
    const adminTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      adminKeypair,
      mintPubkey,
      adminKeypair.publicKey
    );

    // Get or create the voter's token account
    const voterTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      adminKeypair, // admin pays for account creation
      mintPubkey,
      voterPubkey
    );

    // Transfer tokens
    const txHash = await transfer(
      connection,
      adminKeypair,
      adminTokenAccount.address,
      voterTokenAccount.address,
      adminKeypair,
      amount
    );

    console.log(
      `Transferred ${amount} token(s) to ${voterWalletAddress}. TX: ${txHash}`
    );

    return { success: true, txHash: txHash.toString() };
  } catch (err: any) {
    console.error("Token transfer failed:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Create a new SPL token mint using the admin's generated keypair.
 * Returns the mint address.
 */
export async function createSplMint(
  adminSecretKey: number[],
  decimals: number = 0
): Promise<{ success: boolean; mintAddress?: string; error?: string }> {
  try {
    const connection = new Connection(SOLANA_RPC, "confirmed");
    const adminKeypair = getKeypairFromSecret(adminSecretKey);

    const mint = await createMint(
      connection,
      adminKeypair, // payer
      adminKeypair.publicKey, // mint authority
      null, // freeze authority (none)
      decimals
    );

    console.log(`SPL Mint created: ${mint.toBase58()}`);

    return { success: true, mintAddress: mint.toBase58() };
  } catch (err: any) {
    console.error("Create mint failed:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Mint tokens to the admin's own token account.
 */
export async function mintTokensToAdmin(
  adminSecretKey: number[],
  mintAddress: string,
  amount: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const connection = new Connection(SOLANA_RPC, "confirmed");
    const adminKeypair = getKeypairFromSecret(adminSecretKey);
    const mintPubkey = new PublicKey(mintAddress);

    // Get or create admin's associated token account
    const adminAta = await getOrCreateAssociatedTokenAccount(
      connection,
      adminKeypair,
      mintPubkey,
      adminKeypair.publicKey
    );

    // Mint tokens to admin's token account
    const txHash = await mintTo(
      connection,
      adminKeypair, // payer
      mintPubkey,
      adminAta.address,
      adminKeypair, // mint authority
      amount
    );

    console.log(`Minted ${amount} tokens to admin. TX: ${txHash}`);

    return { success: true, txHash: txHash.toString() };
  } catch (err: any) {
    console.error("Mint tokens failed:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get the admin's token balance for a specific mint.
 */
export async function getAdminTokenBalance(
  adminPublicKey: string,
  mintAddress: string
): Promise<number> {
  try {
    const connection = new Connection(SOLANA_RPC, "confirmed");
    const adminPubkey = new PublicKey(adminPublicKey);
    const mintPubkey = new PublicKey(mintAddress);

    const ata = await getAssociatedTokenAddress(mintPubkey, adminPubkey);
    const account = await getAccount(connection, ata);
    return Number(account.amount);
  } catch {
    return 0;
  }
}
