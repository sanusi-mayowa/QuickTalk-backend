// index.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { db } from './firebase.js';
import { Resend } from 'resend';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(cors());
app.use(express.json());

app.post('/api/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // Save OTP to Firestore
    await db.collection('users').doc(email).set(
      {
        otp,
        otpCreatedAt: new Date(),
      },
      { merge: true }
    );

    // Send OTP using Resend
    await resend.emails.send({
      from: 'QuickTalk <onboarding@resend.dev>', // You can customize later
      to: email,
      subject: 'Your OTP Code',
      html: `<p>Your OTP is: <strong>${otp}</strong>. It will expire in 10 minutes.</p>`,
    });

    res.status(200).json({ message: 'OTP sent and saved successfully' });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
