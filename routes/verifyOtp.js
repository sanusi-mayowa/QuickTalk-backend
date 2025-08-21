import express from "express";
import { firestore, auth } from "../utils/firebase.js";

const router = express.Router();

// POST /verify-otp
router.post("/", async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ success: false, error: "Email and OTP required" });
        }

        const usersRef = firestore.collection("users_profile");
        const snapshot = await usersRef.where("email", "==", email).get();
        if (snapshot.empty) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        if (!userData.otp || !userData.otpExpiresAt) {
            return res.status(400).json({ success: false, error: "OTP already used or expired" });
        }
        if (new Date() > userData.otpExpiresAt.toDate()) {
            return res.status(401).json({ success: false, error: "OTP has expired" });
        }
        if (userData.otp !== otp) {
            return res.status(400).json({ success: false, error: "Invalid OTP" });
        }

        // Create Firebase Auth user
        const firebaseUser = await auth.createUser({
            email: userData.email,
            password: userData.password,
            phoneNumber: userData.phone,
        });

        // Update Firestore
        await userDoc.ref.update({
            otp: null,
            otpExpiresAt: null,
            password: null,
            emailVerified: true,
            firebaseUid: firebaseUser.uid,
        });

        res.json({ success: true, message: "OTP verified, account created" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

export default router;
