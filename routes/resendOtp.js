import express from "express";
import { firestore } from "../utils/firebase.js";
import { transporter, generateOTP } from "../utils/mailer.js";

const router = express.Router();

// POST /resend-otp
router.post("/", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, error: "Email required" });
        }

        const usersRef = firestore.collection("users_profile");
        const snapshot = await usersRef.where("email", "==", email).get();
        if (snapshot.empty) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        if (userData.otpExpiresAt && new Date() < userData.otpExpiresAt.toDate()) {
            return res.status(400).json({
                success: false,
                error: "You can only request a new OTP after the previous one expires",
            });
        }

        const newOtp = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await transporter.sendMail({
            from: `"QuickTalk" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Your QuickTalk OTP Code",
            html: `
                <div style="text-align:center; font-family:Arial;">
                  <h2 style="color:#3A805B;">QuickTalk OTP Verification</h2>
                  <p>Your new OTP code is:</p>
                  <h1 style="color:#3A805B;">${newOtp}</h1>
                  <p>Expires in 10 minutes</p>
                </div>
            `,
        });

        await userDoc.ref.update({ otp: newOtp, otpExpiresAt });
        res.json({ success: true, message: "New OTP sent" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

export default router;
