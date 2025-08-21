const express = require("express");
const router = express.Router();
const { firestore } = require("../utils/firebase");
const { transporter, generateOTP } = require("../utils/mailer");

// POST /signup
router.post("/", async (req, res) => {
    try {
        const { email, password, phone } = req.body;
        if (!email || !password || !phone) return res.status(400).json({ success: false, message: "All fields required" });

        const usersRef = firestore.collection("users_profile");
        const emailExists = await usersRef.where("email", "==", email).get();
        const phoneExists = await usersRef.where("phone", "==", phone).get();

        if (!emailExists.empty || !phoneExists.empty) {
            let message = "";
            if (!emailExists.empty && !phoneExists.empty) message = "Both email and phone already exist";
            else if (!emailExists.empty) message = "Email already exists";
            else if (!phoneExists.empty) message = "Phone already exists";
            return res.status(400).json({ success: false, message });
        }

        const otp = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Send OTP email
        await transporter.sendMail({
            from: `"QuickTalk" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Your QuickTalk OTP Code",
            html: `
        <div style="text-align:center; font-family:Arial;">
          <h2 style="color:#3A805B;">QuickTalk OTP Verification</h2>
          <p>Your OTP code is:</p>
          <h1 style="color:#3A805B;">${otp}</h1>
          <p>Expires in 10 minutes</p>
        </div>
      `,
        });

        const docRef = await usersRef.add({
            email,
            phone,
            password,
            otp,
            otpExpiresAt,
            emailVerified: false,
            createdAt: new Date(),
        });

        res.json({ success: true, id: docRef.id, message: "OTP sent" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
