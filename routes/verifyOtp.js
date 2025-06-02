import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Initialize Supabase client (use your env variables)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use a service role key securely on server side
const supabase = createClient(supabaseUrl, supabaseKey);

router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  try {
    // Query user by email
    const { data: user, error, status } = await supabase
      .from('users')
      .select('otp, password, email_verified')
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

    if (user.otp !== otp) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    // Update email_verified to true and optionally remove OTP
    const { error: updateError } = await supabase
      .from('users')
      .update({ email_verified: true, otp: null })
      .eq('email', email);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update verification status' });
    }

    // Return password so frontend can create user in Supabase Auth (as per your flow)
    return res.status(200).json({ message: 'OTP verified', password: user.password });

  } catch (err) {
    console.error('Error verifying OTP:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
