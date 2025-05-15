const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// Parse Firebase service account from env
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// CORS middleware - allow only your frontend origin
app.use(
  cors({
    origin: "http://localhost:8081", // change to your frontend URL
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    credentials: true, // enable if you use cookies or auth headers
  })
);

// Explicitly handle OPTIONS preflight requests
app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:8081");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.sendStatus(204);
});

// Use express.json() to parse JSON request bodies
app.use(express.json());

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP endpoint
app.post("/api/send-otp", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is required" });
  }

  try {
    const userRef = db.collection("users").doc(email);
    const userDoc = await userRef.get();

    // If user exists and is verified, return otp:null
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

    // Return OTP only for testing; remove in production
    return res.status(200).json({ success: true, message: "OTP sent", otp });
  } catch (error) {
    console.error("Error in /api/send-otp:", error);
    return res.status(500).json({ success: false, message: error.toString() });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
