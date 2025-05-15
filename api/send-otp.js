import Cors from 'cors';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import admin from 'firebase-admin';

// Initialize Firebase Admin once
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

// Initialize CORS middleware
const cors = Cors({
  origin: 'http://localhost:8081', // your frontend origin, or '*' if you want to allow all origins
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
});

// Helper to wait for middleware to run
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

// Create transporter outside handler for reuse
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function handler(req, res) {
  // Run CORS middleware
  await runMiddleware(req, res, cors);

  if (req.method === 'OPTIONS') {
    // CORS preflight request handling
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    const userRef = db.collection('users').doc(email);
    const userDoc = await userRef.get();

    if (userDoc.exists && userDoc.data().emailVerified === true) {
      return res.status(200).json({
        success: true,
        message: 'User already verified',
        otp: null,
      });
    }

    const otp = generateOTP();
    const hashedOTP = await bcrypt.hash(otp, 10);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP verification code is: ${otp}`,
    };

    await transporter.sendMail(mailOptions);

    await userRef.set(
      {
        otp: hashedOTP,
        otpTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        emailVerified: false,
      },
      { merge: true }
    );

    return res.status(200).json({ success: true, message: 'OTP sent', otp }); // Remove otp in production
  } catch (error) {
    console.error('Error in /api/send-otp:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
}
