require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();

// =====================
// Middlewares
// =====================
app.use(express.json());
app.use(cors());

// =====================
// Root Route
// =====================
app.get("/", (req, res) => {
  res.send("🔥 Festival Backend is running successfully!");
});

// =====================
// MongoDB Connection
// =====================
const PORT = process.env.PORT || 4000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");

    app.listen(PORT, () => {
      console.log("🚀 Server running on port " + PORT);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
  });

// ================= USER MODEL =================
const userSchema = new mongoose.Schema({
  email: String,
  coins: { type: Number, default: 0 }
});

const User = mongoose.model("User", userSchema);
// Schemas
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

const User = mongoose.model("User", userSchema);

// =====================
// Register Route
// =====================
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      password: hashedPassword,
      referralCode: Math.random().toString(36).substring(7)
    });

    await newUser.save();

    res.json({ message: "Registered successfully ✅" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// =====================
// Login Route
// =====================
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
