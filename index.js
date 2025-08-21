const express = require("express");
const cors = require("cors");
require("dotenv").config();

const signupRoute = require("./routes/signup");
const verifyOtpRoute = require("./routes/verifyOtp");
const resendOtpRoute = require("./routes/resendOtp");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("Firebase backend running 🚀"));

// Use routes
app.use("/signup", signupRoute);
app.use("/verify-otp", verifyOtpRoute);
app.use("/resend-otp", resendOtpRoute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
