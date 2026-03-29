import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const APP_URL = process.env.APP_URL || "http://localhost:3000";

/**
 * Send voter invitation email
 */
export async function sendVoterInviteEmail(
  voterName: string,
  voterEmail: string,
  pollId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const signupUrl = `${APP_URL}/auth?invite=true&email=${encodeURIComponent(voterEmail)}`;
    const pollInfo = pollId ? `for Poll #${pollId}` : "";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #0d0d1f; color: #e8e8f0; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .header { text-align: center; padding: 30px 0; border-bottom: 2px solid #FF993333; }
          .logo { font-size: 32px; font-weight: 800; letter-spacing: 2px; }
          .logo-sol { color: #FF9933; }
          .logo-vote { color: #138808; }
          .logo-x { color: #4169e1; }
          .content { padding: 30px 0; line-height: 1.8; }
          .content h2 { color: #FF9933; margin-bottom: 10px; }
          .btn { display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #FF9933, #e67e00); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; margin: 20px 0; }
          .btn:hover { opacity: 0.9; }
          .features { background: #12122a; border: 1px solid #FF993322; border-radius: 12px; padding: 20px; margin: 20px 0; }
          .features li { padding: 8px 0; color: #9898b0; }
          .features li span { color: #FF9933; }
          .footer { text-align: center; padding: 20px 0; border-top: 1px solid #ffffff11; color: #666; font-size: 12px; }
          .flag { display: inline-block; height: 4px; width: 100%; background: linear-gradient(90deg, #FF9933 33%, #ffffff 33%, #ffffff 66%, #138808 66%); border-radius: 2px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">
              <span class="logo-sol">Sol</span><span class="logo-vote">Vote</span><span class="logo-x">X</span>
            </div>
            <p style="color: #9898b0; margin-top: 8px;">Decentralized Voting on Solana</p>
          </div>

          <div class="flag"></div>

          <div class="content">
            <h2>You're Invited to Vote ${pollInfo}</h2>
            <p>Hello <strong>${voterName}</strong>,</p>
            <p>You have been invited to participate in a secure, blockchain-powered election on <strong>SolVoteX</strong>. Your vote matters, and with SolVoteX, every vote is transparent, immutable, and verifiable on the Solana blockchain.</p>

            <div class="features">
              <p style="color: #FF9933; font-weight: 600; margin-bottom: 10px;">What to expect:</p>
              <ul style="padding-left: 20px;">
                <li><span>1.</span> Sign up with your email on SolVoteX</li>
                <li><span>2.</span> Complete voter verification (wallet + ID)</li>
                <li><span>3.</span> Wait for admin approval</li>
                <li><span>4.</span> Cast your vote — recorded on Solana blockchain forever</li>
              </ul>
            </div>

            <div style="text-align: center;">
              <a href="${signupUrl}" class="btn">Get Started — Sign Up Now</a>
            </div>

            <p style="color: #9898b0; font-size: 14px;">If the button doesn't work, copy and paste this link in your browser:<br/>
            <a href="${signupUrl}" style="color: #4169e1; word-break: break-all;">${signupUrl}</a></p>
          </div>

          <div class="flag"></div>

          <div class="footer">
            <p>SolVoteX — Blockchain Voting · Zero Trust · Infinite Transparency</p>
            <p>This email was sent because an election administrator invited you to participate. If you believe this was sent in error, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"SolVoteX" <${process.env.SMTP_USER}>`,
      to: voterEmail,
      subject: `You're Invited to Vote on SolVoteX ${pollInfo}`,
      html: htmlContent,
    });

    console.log(`Invitation email sent to ${voterEmail}`);
    return { success: true };
  } catch (err: any) {
    console.error("Email send failed:", err.message);
    return { success: false, error: err.message };
  }
}
