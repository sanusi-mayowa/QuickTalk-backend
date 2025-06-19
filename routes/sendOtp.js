import express from 'express';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,          // Use 587 instead of 465
  secure: false,      // Must be false for port 587
  auth: {
    user: process.env.GMAIL_USER,    // Your Gmail address
    pass: process.env.GMAIL_PASS,    // Your Gmail App Password
  },
});


router.post('/send-otp', async (req, res) => {
  const { email, phone, password } = req.body;

  if (!email || !phone || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Check if user already exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('user_profile')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Supabase Fetch Error:', fetchError);
      return res.status(500).json({ error: fetchError.message || 'Failed to check user existence.' });
    }

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Generate OTP and hash password
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPassword = await bcrypt.hash(password, 10);
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 mins
    
    const { error: insertError } = await supabase.from('user_profile').insert([
      {
        email,
        phone,
        password: hashedPassword,
        raw_password: password, // ⚠️ Store temporarily
        otp,
        otp_expires_at: otpExpiresAt,
        created_at: new Date().toISOString(),
        email_verified: false,
      },
    ]);
    
    if (insertError) {
      console.error('Supabase Insert Error:', insertError);
      return res.status(500).json({ error: insertError.message || 'Failed to store OTP data.' });
    }

    // Send email
    await transporter.sendMail({
      from: `"QuickTalk" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Email verification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee;">
          <div style="padding: 20px; background-color: #f9f9f9;">
            <h2 style="color: #1a1a1a;">Email verification</h2>
            <p>Hi,</p>
            <p>You now need to verify your email address.</p>
            <p>Please enter <strong style="font-size: 18px;">${otp}</strong> when prompted on the app.</p>
            <p style="color: #666;">This verification code will expire after 5 minutes.</p>
            <p>Kind regards,</p>
            <p><strong>QuickTalk</strong></p>
          </div>
          <div style="background: #3A805B); height: 10px;"></div>
          <div style="padding: 15px; font-size: 12px; color: #555; text-align: center;">
            <p>This email was sent to you because you registered for a QuickTalk account or changed your email.</p>
            <p>If this wasn’t you, please <a href="mailto:support@quicktalk.com">contact QuickTalk</a>. Do not reply to this email.</p>
            <p>Sender: QuickTalk, 123 Innovation Drive, Tech City</p>
          </div>
        </div>
      `,
    });


    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Unexpected Error:', error);
    res.status(500).json({ error: error.message || 'Server error. Please try again.' });
  }
});

export default router;
