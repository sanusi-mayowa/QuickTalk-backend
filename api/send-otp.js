import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import admin from "firebase-admin";
import Cors from "cors";

// Initialize CORS middleware
const cors = Cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
});

// Helper to run middleware in Vercel function
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) reject(result);
      else resolve(result);
    });
  });
}

// Initialize Firebase Admin once (cache in Lambda environment)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function handler(req, res) {
  await runMiddleware(req, res, cors); // Run CORS for every request

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  try {
    // Nodemailer transporter setup
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const userRef = db.collection("users").doc(email);
    const userDoc = await userRef.get();

    if (userDoc.exists && userDoc.data().emailVerified === true) {
      return res.status(200).json({
        success: true,
        message: "User already verified",
        otp: null,
      });
    }

    const otp = generateOTP();
    const hashedOTP = await bcrypt.hash(otp, 10);

    // Send OTP email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP verification code is: ${otp}`,
    };

    await transporter.sendMail(mailOptions);

    // Save hashed OTP + timestamp + set emailVerified false
    await userRef.set(
      {
        otp: hashedOTP,
        otpTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        emailVerified: false,
      },
      { merge: true }
    );

    // Return OTP only for dev/testing — remove in prod
    return res.status(200).json({ success: true, message: "OTP sent", otp });
  } catch (error) {
    console.error("Error in send-otp:", error);
    return res.status(500).json({ success: false, message: error.toString() });
  }
}
