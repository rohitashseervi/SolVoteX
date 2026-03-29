import { API_BASE_URL } from "./constants";

// Helper to make authenticated API calls to the backend
async function fetchApi(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("svx-token") : null;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["auth-token"] = token;
  }

  // Don't set Content-Type for FormData (let browser set boundary)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data;
}

// ═══════════════════════ AUTH API ═══════════════════════

export async function signup(
  name: string,
  email: string,
  password: string,
  isAdmin: boolean = false
) {
  return fetchApi("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name, email, password, isAdmin }),
  });
}

export async function login(email: string, password: string) {
  return fetchApi("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getUser() {
  return fetchApi("/auth/user");
}

// ═══════════════════════ VERIFICATION API ═══════════════════════

export async function submitVerification(
  wallet: string,
  pollId: string,
  voterIdImage: File
) {
  const formData = new FormData();
  formData.append("wallet", wallet);
  formData.append("pollId", pollId);
  formData.append("voterIdImage", voterIdImage);

  return fetchApi("/verify/submit", {
    method: "POST",
    body: formData,
  });
}

export async function getPendingVerifications() {
  return fetchApi("/verify/pending");
}

export async function getCompletedVerifications() {
  return fetchApi("/verify/completed");
}

export async function approveVerification(
  userId: string,
  pollId: string,
  mintAddress: string
) {
  return fetchApi("/verify/approve", {
    method: "POST",
    body: JSON.stringify({ userId, pollId, mintAddress }),
  });
}

export async function rejectVerification(userId: string, pollId: string) {
  return fetchApi("/verify/reject", {
    method: "POST",
    body: JSON.stringify({ userId, pollId }),
  });
}

export async function getVerificationStatus(pollId: string) {
  return fetchApi(`/verify/status/${pollId}`);
}

export async function getMyVerifications() {
  return fetchApi("/verify/my-verifications");
}

// ═══════════════════════ VOTER MANAGEMENT API ═══════════════════════

export async function inviteVoter(
  name: string,
  email: string,
  pollId?: string
) {
  return fetchApi("/voters/invite", {
    method: "POST",
    body: JSON.stringify({ name, email, pollId }),
  });
}

export async function inviteVotersBulk(
  voters: { name: string; email: string }[],
  pollId?: string
) {
  return fetchApi("/voters/invite-bulk", {
    method: "POST",
    body: JSON.stringify({ voters, pollId }),
  });
}

export async function getVoterList() {
  return fetchApi("/voters/list");
}

// ═══════════════════════ STATS API ═══════════════════════

export async function getMintStats(mintAddress?: string) {
  const params = new URLSearchParams();
  if (mintAddress) params.append("mintAddress", mintAddress);
  return fetchApi(`/stats/mint?${params.toString()}`);
}

// ═══════════════════════ TOKEN API (NEW) ═══════════════════════

export async function createTokenMint(tokenName: string, tokenSymbol: string) {
  return fetchApi("/token/create-mint", {
    method: "POST",
    body: JSON.stringify({ tokenName, tokenSymbol }),
  });
}

export async function mintTokens(mintAddress: string, amount: number) {
  return fetchApi("/token/mint", {
    method: "POST",
    body: JSON.stringify({ mintAddress, amount }),
  });
}

export async function getTokenBalance(mintAddress: string) {
  return fetchApi(`/token/balance?mintAddress=${mintAddress}`);
}

export async function requestAirdrop(amount: number = 2) {
  return fetchApi("/token/airdrop", {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

export async function getAdminWalletInfo() {
  return fetchApi("/token/wallet");
}

// ═══════════════════════ POLLS API ═══════════════════════

export async function createPoll(data: {
  name: string;
  description?: string;
  candidates: { name: string; party?: string }[];
  startTime: string;
  endTime: string;
  estimatedVoters: number;
  tokenName?: string;
  tokenSymbol?: string;
}) {
  return fetchApi("/polls/create", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getPolls() {
  return fetchApi("/polls/list");
}

export async function getPoll(pollId: string) {
  return fetchApi(`/polls/${pollId}`);
}

export async function attachMintToPoll(
  pollId: string,
  mintAddress: string,
  tokenName?: string,
  tokenSymbol?: string
) {
  return fetchApi(`/polls/${pollId}/mint`, {
    method: "PUT",
    body: JSON.stringify({ mintAddress, tokenName, tokenSymbol }),
  });
}

// ═══════════════════════ VOTE API ═══════════════════════

export async function castVote(
  pollId: string,
  candidateName: string,
  voterWallet: string,
  txSignature: string
) {
  return fetchApi("/vote/cast", {
    method: "POST",
    body: JSON.stringify({ pollId, candidateName, voterWallet, txSignature }),
  });
}

export async function getVoteResults(pollId: string) {
  return fetchApi(`/vote/results/${pollId}`);
}

export async function checkVoteStatus(pollId: string, wallet: string) {
  return fetchApi(`/vote/check/${pollId}/${wallet}`);
}

export async function getVoteLedger(pollId: string, page: number = 1, limit: number = 20) {
  return fetchApi(`/vote/ledger/${pollId}?page=${page}&limit=${limit}`);
}
