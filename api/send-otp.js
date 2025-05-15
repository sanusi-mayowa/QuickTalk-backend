// Required modules
const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Express app setup
const app = express();
const port = process.env.PORT || 8080;

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);
app.options("*", cors());
app.use(bodyParser.json());

// Email transporter
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
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  try {
    const userRef = db.collection("users").doc(email);
    const userDoc = await userRef.get();

    // Check if user already verified
    if (userDoc.exists && userDoc.data().emailVerified === true) {
      return res.status(200).json({
        success: true,
        message: "User already verified",
        otp: null,
      });
    }

    const otp = generateOTP();
    const hashedOTP = await bcrypt.hash(otp, 10);

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP verification code is: ${otp}`,
    };

    // Send OTP email
    await transporter.sendMail(mailOptions);

    // Store hashed OTP in Firestore
    await userRef.set(
      {
        otp: hashedOTP,
        otpTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        emailVerified: false,
      },
      { merge: true }
    );

    return res.status(200).json({ success: true, message: "OTP sent", otp }); // remove `otp` in production
  } catch (error) {
    return res.status(500).json({ success: false, message: error.toString() });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
