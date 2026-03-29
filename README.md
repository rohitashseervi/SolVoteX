# SolVoteX — Decentralized Voting on Solana

A blockchain-powered voting platform where every vote is an on-chain transaction with full transparency and verifiability. Built on Solana devnet with SPL token transfers and Memo program for provable vote records.

## How It Works

1. **Admin** creates a poll — an SPL token mint is auto-generated on Solana devnet
2. **Voters** register with their Phantom wallet and submit ID verification
3. **Admin** approves verified voters — 1 vote token is minted to their wallet
4. **Voter** casts their vote by signing an SPL token transfer via Phantom
5. **Memo instruction** embeds the candidate choice directly on-chain
6. **Results** are live, with a blockchain explorer showing every vote block

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS, Recharts
- **Backend**: Express.js, TypeScript, MongoDB (Mongoose)
- **Blockchain**: Solana devnet, SPL Token Program, Memo Program
- **Wallet**: Phantom via @solana/wallet-adapter
- **Auth**: JWT-based authentication with admin/voter roles

## Key Features

- On-chain vote proof with Solana Memo (candidate choice written to blockchain)
- One wallet, one vote — enforced at both blockchain and database level
- Admin data isolation — each admin only sees their own polls/voters/stats
- Live results dashboard with bar/pie charts and auto-refresh
- Vote Chain Explorer — mempool.space-inspired block visualization
- Metaplex token metadata for proper token naming in Phantom
- Debounced poll ID validation on voter registration

## Project Structure

```
solvotex-app/
  src/                  # Next.js frontend
    app/                # Pages (auth, admin, vote, results, verify)
    components/         # Landing page, Scene3D
    contexts/           # Auth context
    utils/              # API client, constants
  backend/              # Express.js API
    routes/             # auth, polls, vote, verification, voters, stats, token
    models/             # User, Poll, Vote (Mongoose)
    utils/              # tokenTransfer, solanaWallet, mailer
    middleware/          # JWT auth
```

## Running Locally

**Prerequisites**: Node.js 18+, MongoDB running locally, Phantom wallet extension

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Start both (frontend on :3000, backend on :5000)
npm run dev:all
```

Create a `backend/.env` file (see `backend/.env.example` for reference).

## Deployment

- **Backend + Frontend**: Render.com (two web services)
- **Database**: MongoDB Atlas (free tier)
- **Landing Gateway**: Walrus (infinity.wal.app)

See `DEPLOY.md` for step-by-step deployment instructions.

## Environment Variables

### Backend (`backend/.env`)
| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 5000) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret |
| `SOLANA_RPC_URL` | Solana RPC endpoint |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `SMTP_HOST/PORT/USER/PASS` | Email config for notifications |
| `APP_URL` | Frontend URL (for email links) |

### Frontend
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
