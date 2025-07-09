import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, phone, password } = req.body;

  if (!email || !phone || !password) {
    return res.status(400).json({ error: 'Email, phone, and password are required' });
  }

  try {
    // Check for existing user
    const { data: existingUser } = await supabase
      .from('user_profile')
      .select('email, phone')
      .or(`email.eq.${email},phone.eq.${phone}`)
      .single();

    if (existingUser) {
      let errorMessage = 'User already exists';
      if (existingUser.email === email && existingUser.phone === phone) {
        errorMessage = 'User already exists with this email and phone number';
      } else if (existingUser.email === email) {
        errorMessage = 'User already exists with this email address';
      } else if (existingUser.phone === phone) {
        errorMessage = 'User already exists with this phone number';
      }
      return res.status(409).json({ error: errorMessage });
    }

    // Check Supabase Auth
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      console.error('Supabase Auth error:', authError);
    } else {
      const exists = authUsers.users.find(user => user.email === email);
      if (exists) {
        return res.status(409).json({ error: 'User already exists with this email address' });
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const { error: insertError } = await supabase
      .from('user_profile')
      .insert({
        email,
        phone,
        raw_password: password,
        otp,
        otp_expires_at: otpExpiresAt.toISOString(),
        email_verified: false,
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      return res.status(500).json({ error: 'Failed to save user' });
    }

    const mailOptions = {
      from: `"QuickTalk" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'QuickTalk - Email Verification',
      html: `<p>Your verification code is: <b>${otp}</b></p>`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: 'OTP sent successfully',
      expiresAt: otpExpiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
}
