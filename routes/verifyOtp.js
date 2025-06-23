import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

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
    console.log('Verifying OTP for:', email);

    // Step 1: Fetch user
    const { data: user, error, status } = await supabase
      .from('user_profile')
      .select('otp, raw_password, phone, otp_expires_at, email_verified')
      .eq('email', email)
      .single();

    if (error && status !== 406) {
      console.error('Supabase query error:', error);
      return res.status(500).json({ error: 'Failed to fetch user', details: error.message });
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

    // Step 3: Check OTP expiration
    const now = new Date();
    const expiresAt = new Date(user.otp_expires_at);
    
    if (now > expiresAt) {
      return res.status(401).json({ error: 'OTP has expired' });
    }

    const rawPassword = user.raw_password;
    const phone = user.phone;

    // Step 4: Create user in Supabase Auth first
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: rawPassword,
      email_confirm: true,
      user_metadata: {
        phone: phone
      }
    });

    if (authError) {
      console.error('Failed to create auth user:', authError);
      return res.status(500).json({ error: 'Failed to create user account' });
    }

    // Step 5: Update verification and clean sensitive fields
    const { error: updateError } = await supabase
      .from('user_profile')
      .update({
        email_verified: true,
        otp: null,
        otp_expires_at: null,
        raw_password: null,
        auth_user_id: authData.user.id
      })
      .eq('email', email);

    if (updateError) {
      console.error('Failed to update user verification:', updateError);
      return res.status(500).json({ error: 'Failed to update verification status' });
    }

    // Step 6: Return success response
    return res.status(200).json({
      message: 'OTP verified successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        phone: phone
      }
    });

  } catch (err) {
    console.error('Server error during OTP verification:', err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
});

export default router;