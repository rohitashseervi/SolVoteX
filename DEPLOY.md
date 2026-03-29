# SolVoteX Deployment Guide

## Architecture

```
Walrus (infinity.wal.app)               Render.com                  MongoDB Atlas
 [Landing Gateway]  ---redirect--->  [Next.js Frontend]  --->  [Express Backend]  --->  [Database]
  Static HTML page                    Web Service #1             Web Service #2          Cloud DB
  "Launch App" button                 Port 3000                  Port 5000
                                           |                          |
                                      Solana Devnet (RPC + Memo + SPL Tokens)
```

- **Walrus**: Decentralized landing page hosted on Walrus storage (infinity.wal.app)
- **Render Service 1**: Next.js frontend (server-rendered, full features)
- **Render Service 2**: Express.js backend API
- **MongoDB Atlas**: Cloud database (free tier)

---

## Step 1: Set Up MongoDB Atlas (Free Tier)

1. Go to https://www.mongodb.com/atlas and create a free account
2. Create a free cluster (M0 Sandbox)
3. Under "Database Access" -> Add a database user with password
4. Under "Network Access" -> Add `0.0.0.0/0` (allow from anywhere, required for Render)
5. Click "Connect" -> "Drivers" -> Copy the connection string
   - Format: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/solvotex?retryWrites=true&w=majority`

---

## Step 2: Push Code to GitHub

Push the `solvotex-app` folder to a GitHub repository. Both Render services will deploy from this same repo.

---

## Step 3: Deploy Backend on Render

1. Go to https://dashboard.render.com -> "New" -> "Web Service"

2. Connect your GitHub repo

3. Configure:
   - **Name**: `solvotex-api`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (or Starter $7/mo for no cold starts)

4. Add Environment Variables:
   ```
   PORT=5000
   MONGO_URI=mongodb+srv://...your-atlas-uri.../solvotex?retryWrites=true&w=majority
   JWT_SECRET=<generate-a-strong-random-string>
   SOLANA_RPC_URL=https://api.devnet.solana.com
   ALLOWED_ORIGINS=https://solvotex-frontend.onrender.com
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-gmail-app-password
   APP_URL=https://solvotex-frontend.onrender.com
   ```

5. Click "Create Web Service" and wait for deploy

6. Note your backend URL (e.g. `https://solvotex-api.onrender.com`)

7. Test: `https://solvotex-api.onrender.com/api/health` should return `{"status":"ok"}`

---

## Step 4: Deploy Frontend on Render

1. Go to Render dashboard -> "New" -> "Web Service"

2. Connect the SAME GitHub repo

3. Configure:
   - **Name**: `solvotex-frontend` (or `solvotex`)
   - **Root Directory**: (leave empty — project root)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (or Starter)

4. Add Environment Variables:
   ```
   NEXT_PUBLIC_API_URL=https://solvotex-api.onrender.com/api
   ```
   (Use the backend URL from Step 3)

5. Click "Create Web Service"

6. Note your frontend URL (e.g. `https://solvotex.onrender.com`)

7. **IMPORTANT**: Go back to the backend service and update `ALLOWED_ORIGINS` to include your frontend URL

---

## Step 5: Deploy Landing Page to Walrus

1. Edit `walrus-landing/index.html`:
   - Update the `SOLVOTEX_APP_URL` variable at the top to your Render frontend URL:
     ```javascript
     const SOLVOTEX_APP_URL = "https://solvotex.onrender.com";
     ```

2. Go to https://infinity.wal.app

3. Upload the `walrus-landing/index.html` file

4. Your Walrus site is now the Web3 gateway — clicking "Launch App" redirects to Render

---

## Post-Deployment Checklist

- [ ] Backend health check: `https://your-api.onrender.com/api/health`
- [ ] Frontend loads at Render URL
- [ ] Walrus landing page loads and "Launch App" redirects correctly
- [ ] User signup & login works
- [ ] Admin can create polls with SPL token minting
- [ ] Phantom wallet connects on HTTPS
- [ ] Voter verification flow works
- [ ] Voting with SPL transfer + Memo works
- [ ] Results page + Vote Chain Explorer loads
- [ ] On-chain verification badges appear on new votes
- [ ] No CORS errors in browser console

---

## Troubleshooting

**"Failed to fetch" errors:**
- Verify `NEXT_PUBLIC_API_URL` is set correctly in Render frontend env
- Check Render backend logs for CORS errors
- Confirm `ALLOWED_ORIGINS` includes frontend URL (with https://, no trailing slash)

**Render free tier cold starts:**
- Free services sleep after 15 min of inactivity
- First request after idle takes 30-60 seconds
- Starter tier ($7/mo) keeps services always running

**MongoDB connection fails:**
- Atlas Network Access must include `0.0.0.0/0`
- Double-check username/password in connection string
- Check Render backend logs for specific MongoDB errors

**Phantom wallet won't connect:**
- Phantom requires HTTPS (Render provides this automatically)
- Make sure Phantom is set to Solana Devnet
- Check browser console for wallet adapter errors

**Walrus upload issues:**
- The landing page is a single HTML file — no build step needed
- Make sure the `SOLVOTEX_APP_URL` is updated before uploading
