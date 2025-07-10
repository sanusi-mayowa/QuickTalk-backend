import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sendOtpRoute from './api/sendOtp.js';
import verifyOtpRoute from './api/verifyOtp.js';

dotenv.config();

const app = express();

app.use(cors({
  origin: 'http://localhost:8081',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Use the routes
app.use('/api', sendOtpRoute);
app.use('/api', verifyOtpRoute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
