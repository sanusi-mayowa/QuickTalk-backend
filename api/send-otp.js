// Required modules
const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const admin = require("firebase-admin");

// Load environment variables
dotenv.config();

// Initialize Firebase Admin with service account from env
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT.replace(/\\n/g, '\n'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["Content-Type"] }));
app.use(bodyParser.json());

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Function to generate a 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP endpoint
app.post("/api/send-otp", async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ success: false, message: "Email is required" });

  const otp = generateOTP();
  const hashedOTP = await bcrypt.hash(otp, 10);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP verification code is: ${otp}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    await db.collection("otpVerifications").doc(email).set({
      hashedOTP,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ success: true, message: "OTP sent" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.toString() });
  }
});

// Verify OTP endpoint
app.post("/api/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) return res.status(400).json({ success: false, message: "Email and OTP are required" });

  try {
    const doc = await db.collection("otpVerifications").doc(email).get();
    if (!doc.exists) return res.status(400).json({ success: false, message: "No OTP found" });

    const { hashedOTP } = doc.data();
    const isValid = await bcrypt.compare(otp, hashedOTP);

    if (isValid) {
      // Nullify OTP after successful verification
      await db.collection("otpVerifications").doc(email).set({ hashedOTP: null }, { merge: true });

      return res.status(200).json({ success: true, message: "OTP verified" });
    } else {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.toString() });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
