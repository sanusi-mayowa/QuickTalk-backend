import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import signupRoute from "./routes/signup.js";
import verifyOtpRoute from "./routes/verifyOtp.js";
import resendOtpRoute from "./routes/resendOtp.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("Firebase backend running 🚀"));

// Use routes
app.use("/signup", signupRoute);
app.use("/verify-otp", verifyOtpRoute);
app.use("/resend-otp", resendOtpRoute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
