import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

// Import routes using ES module syntax
import sendOtpRoute from './routes/sendOtp.js';
import verifyOtpRoute from './routes/verifyOtp.js';
// import generateOtp from './utils/generateOtp.js';


const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', sendOtpRoute);
app.use('/api', verifyOtpRoute);
// app.use('/api', generateOtp);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
