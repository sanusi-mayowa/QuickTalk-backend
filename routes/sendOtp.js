import express from 'express';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import { db } from '../firebase.js';
import generateOtp from '../utils/generateOtp.js';

dotenv.config();
const router = express.Router();

router.post('/send-otp', async (req, res) => {
  const { email, phone, password } = req.body;

  if (!email || !phone || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Check if user already exists
    const existingUser = await db.collection('users').doc(email).get();
    if (existingUser.exists) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const otp = generateOtp();
    const hashedPassword = await bcrypt.hash(password, 10);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    try {
      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: email,
        subject: 'Your OTP Code',
        html: `<h2>Your OTP is: ${otp}</h2>`,
      });
    } catch (emailError) {
      return res.status(500).json({ error: 'Failed to send OTP email' });
    }

    await db.collection('users').doc(email).set({
      email,
      phone,
      password: hashedPassword,
      otp,
      otpCreatedAt: new Date(),
      emailVerified: false,
    });

    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error('Error sending OTP:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

export default router;