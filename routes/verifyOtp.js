import express from 'express';
import { db } from '../firebase.js';
const router = express.Router();

router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  try {
    const userRef = db.collection('users').doc(email);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    if (userData.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Update Firestore
    await userRef.update({
      emailVerified: true,
      otp: null,
    });

    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    console.error('Error verifying OTP:', err);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

export default router;
