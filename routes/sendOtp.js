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
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
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
      .from('users')
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

    // Store OTP and user info temporarily
    const { error: insertError } = await supabase.from('users').insert([
      {
        email,
        phone,
        password: hashedPassword,
        otp,
        created_at: new Date().toISOString(),
      },
    ]);

    if (insertError) {
      console.error('Supabase Insert Error:', insertError);
      return res.status(500).json({ error: insertError.message || 'Failed to store OTP data.' });
    }

    // Send email
    await transporter.sendMail({
      from: `"QuickTalk" <${process.env.MAIL_USER}>`,
      // from: process.env.GMAIL_USER,
      to: email,
      subject: 'Your OTP Verification Code',
      html: `<p>Your OTP is: <b>${otp}</b></p>`,
    });

    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Unexpected Error:', error);
    res.status(500).json({ error: error.message || 'Server error. Please try again.' });
  }
});

export default router;
