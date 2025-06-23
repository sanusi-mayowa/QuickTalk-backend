import express from 'express';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

router.post('/send-otp', async (req, res) => {
  const { email, phone, password } = req.body;

  if (!email || !phone || !password) {
    return res.status(400).json({ error: 'Email, phone, and password are required' });
  }

  try {
    // Check if user already exists in user_profile table
    const { data: existingUser, error: checkError } = await supabase
      .from('user_profile')
      .select('email, phone')
      .or(`email.eq.${email},phone.eq.${phone}`)
      .single();

    if (existingUser) {
      let errorMessage = 'User already exists';
      if (existingUser.email === email && existingUser.phone === phone) {
        errorMessage = 'User already exists with this email and phone number';
      } else if (existingUser.email === email) {
        errorMessage = 'User already exists with this email address';
      } else if (existingUser.phone === phone) {
        errorMessage = 'User already exists with this phone number';
      }
      
      return res.status(409).json({ 
        error: errorMessage 
      });
    }

    // Check if user already exists in Supabase Auth
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error checking auth users:', authError);
    } else {
      const existingAuthUser = authUsers.users.find(user => user.email === email);
      if (existingAuthUser) {
        return res.status(409).json({ 
          error: 'User already exists with this email address' 
        });
      }
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store user data temporarily
    const { error: insertError } = await supabase
      .from('user_profile')
      .insert({
        email,
        phone,
        raw_password: password,
        otp,
        otp_expires_at: otpExpiresAt.toISOString(),
        email_verified: false,
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
      return res.status(500).json({ error: 'Failed to store user data' });
    }

    // Send OTP via email
    const mailOptions = {
      from: `"QuickTalk" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'QuickTalk - Email Verification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3A805B; margin: 0;">QuickTalk</h1>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
            <h2 style="color: #3A805B; margin-bottom: 20px;">Email Verification</h2>
            <p style="color: #666; font-size: 16px; margin-bottom: 30px;">
              Please use the verification code below to complete your registration:
            </p>
            
            <div style="background-color: #3A805B; color: white; padding: 20px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 30px 0;">
              ${otp}
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              This code will expire in <strong>10 minutes</strong>.
            </p>
            <p style="color: #666; font-size: 14px;">
              If you didn't request this code, please ignore this email.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
            <p>© 2024 QuickTalk. All rights reserved.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ 
      message: 'OTP sent successfully',
      expiresAt: otpExpiresAt.toISOString()
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// New endpoint for resending OTP
router.post('/resend-otp', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Check if user exists and is not verified
    const { data: user, error: fetchError } = await supabase
      .from('user_profile')
      .select('email, phone, raw_password, email_verified')
      .eq('email', email)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user with new OTP
    const { error: updateError } = await supabase
      .from('user_profile')
      .update({
        otp,
        otp_expires_at: otpExpiresAt.toISOString(),
      })
      .eq('email', email);

    if (updateError) {
      console.error('Failed to update OTP:', updateError);
      return res.status(500).json({ error: 'Failed to generate new OTP' });
    }

    // Send new OTP via email
    const mailOptions = {
      from: `"QuickTalk" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'QuickTalk - New Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3A805B; margin: 0;">QuickTalk</h1>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
            <h2 style="color: #3A805B; margin-bottom: 20px;">New Verification Code</h2>
            <p style="color: #666; font-size: 16px; margin-bottom: 30px;">
              Here's your new verification code:
            </p>
            
            <div style="background-color: #3A805B; color: white; padding: 20px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 30px 0;">
              ${otp}
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              This code will expire in <strong>10 minutes</strong>.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
            <p>© 2024 QuickTalk. All rights reserved.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ 
      message: 'New OTP sent successfully',
      expiresAt: otpExpiresAt.toISOString()
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

export default router;