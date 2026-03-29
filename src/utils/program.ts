import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "./constants";

// Derive PDA addresses for various accounts

export function getPollPDA(pollId: number): [PublicKey, number] {
  const pollIdBuffer = Buffer.alloc(8);
  pollIdBuffer.writeBigUInt64LE(BigInt(pollId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("poll"), pollIdBuffer],
    PROGRAM_ID
  );
}

export function getCandidatePDA(
  pollId: number,
  candidateName: string
): [PublicKey, number] {
  const pollIdBuffer = Buffer.alloc(8);
  pollIdBuffer.writeBigUInt64LE(BigInt(pollId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("candidate"), pollIdBuffer, Buffer.from(candidateName)],
    PROGRAM_ID
  );
}

export function getVaultPDA(pollId: number): [PublicKey, number] {
  const pollIdBuffer = Buffer.alloc(8);
  pollIdBuffer.writeBigUInt64LE(BigInt(pollId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), pollIdBuffer],
    PROGRAM_ID
  );
}

export function getVaultAuthorityPDA(pollId: number): [PublicKey, number] {
  const pollIdBuffer = Buffer.alloc(8);
  pollIdBuffer.writeBigUInt64LE(BigInt(pollId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority"), pollIdBuffer],
    PROGRAM_ID
  );
}

export function getVoteRecordPDA(
  pollId: number,
  voterPubkey: PublicKey
): [PublicKey, number] {
  const pollIdBuffer = Buffer.alloc(8);
  pollIdBuffer.writeBigUInt64LE(BigInt(pollId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vote_record"), pollIdBuffer, voterPubkey.toBuffer()],
    PROGRAM_ID
  );
}

export function getMintAuthorityPDA(mintPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mint_authority"), mintPubkey.toBuffer()],
    PROGRAM_ID
  );
}
