import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  try {
    // Step 1: Fetch user with raw_password
    const { data: user, error, status } = await supabase
      .from('users')
      .select('otp, raw_password, otp_expires_at, email_verified')
      .eq('email', email)
      .single();

    if (error && status !== 406) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Step 2: Validate OTP
    if (user.otp !== otp) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    // Step 3: Check if OTP is expired
    if (!user.otp_expires_at || new Date() > new Date(user.otp_expires_at)) {
      return res.status(401).json({ error: 'OTP has expired' });
    }

    const rawPassword = user.raw_password; // Save to return after cleanup

    // Step 4: Update email_verified and clean up fields (including raw_password)
    const { error: updateError } = await supabase
      .from('users')
      .update({
        email_verified: true,
        otp: null,
        otp_expires_at: null,
        raw_password: null,  // <-- delete raw_password immediately
      })
      .eq('email', email);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update verification status' });
    }

    // Step 5: Return raw_password to frontend
    return res.status(200).json({
      message: 'OTP verified',
      password: rawPassword,
    });

  } catch (err) {
    console.error('Error verifying OTP:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
