require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(express.json());
app.use(cors());

// =====================
// MongoDB Connection
// =====================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    app.listen(4000, () => {
      console.log("Server running on port 4000");
    });
  })
  .catch((err) => console.log(err));

// =====================
// Models
// =====================

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  coins: { type: Number, default: 10 },
  referralCode: String,
  referralCount: { type: Number, default: 0 },
  role: { type: String, default: "user" },
  ticketType: { type: String, default: null }
});

const photoSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  image: String,
  votes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const transactionSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  type: String,
  package: String,
  amount: Number,
  reference: String,
  status: { type: String, default: "pending" }
});

const User = mongoose.model("User", userSchema);
const Photo = mongoose.model("Photo", photoSchema);
const Transaction = mongoose.model("Transaction", transactionSchema);

// =====================
// Auth Middleware
// =====================

function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch {
    res.status(400).json({ message: "Invalid token" });
  }
}

// =====================
// Register
// =====================

app.post("/register", async (req, res) => {
  try {
    const { username, password, referral } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    const referralCode = Math.random().toString(36).substring(7);

    const user = new User({
      username,
      password: hashed,
      referralCode
    });

    if (referral) {
      const refUser = await User.findOne({ referralCode: referral });
      if (refUser && refUser.referralCount < 2) {
        refUser.coins += 4;
        refUser.referralCount += 1;
        await refUser.save();
      }
    }

    await user.save();
    res.json({ message: "Registered successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// =====================
// Login
// =====================

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ message: "User not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ message: "Wrong password" });

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET
  );

  res.json({ token });
});
