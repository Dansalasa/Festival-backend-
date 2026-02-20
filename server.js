require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(cors());

/* =====================
   MongoDB Connection
===================== */
mongoose.connect(process.env.MONGO_URI)
.then(() => {
  console.log("MongoDB Connected");
  app.listen(4000, () => console.log("Server running on port 4000"));
})
.catch(err => console.log(err));

/* =====================
   User Model
===================== */
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  email: { type: String, unique: true },
  password: String,
  coins: { type: Number, default: 10 },
  role: { type: String, default: "user" },
  ticketCode: { type: String, default: null },
  ticketType: { type: String, default: null },
  ticketUsed: { type: Boolean, default: false } // verify system
});

const User = mongoose.model("User", userSchema);

/* =====================
   Register
===================== */
app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      email,
      password: hashed
    });

    await user.save();
    res.json({ message: "Registered successfully ✅" });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================
   Login
===================== */
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Wrong password" });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================
   Pay Coins
===================== */
app.post("/pay-coins", async (req, res) => {
  try {
    const { email, coins, amount } = req.body;

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: amount * 100,
        metadata: { coins }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json(response.data);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* =====================
   Buy Festival Ticket
===================== */
app.post("/buy-ticket", async (req, res) => {
  try {
    const { email, ticketType } = req.body;

    let amount = 0;

    if (ticketType === "silver") amount = 3000;
    if (ticketType === "gold") amount = 5000;

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: amount * 100,
        metadata: { ticketType }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json(response.data);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* =====================
   Paystack Webhook
===================== */
app.post("/paystack-webhook", async (req, res) => {
  try {
    const event = req.body;

    if (event.event === "charge.success") {

      const data = event.data;
      const email = data.customer.email;

      const user = await User.findOne({ email });
      if (!user) return res.sendStatus(200);

      // ===== COINS =====
      if (data.metadata.coins) {
        user.coins += parseInt(data.metadata.coins);
        await user.save();
      }

      // ===== FESTIVAL TICKET =====
      if (data.metadata.ticketType) {

        const baseCode = Math.floor(10000000 + Math.random() * 90000000);

        let finalCode = "";

        if (data.metadata.ticketType === "silver") {
          finalCode = baseCode + "NABAICHI";
        }

        if (data.metadata.ticketType === "gold") {
          finalCode = baseCode + "KYAMSHE";
        }

        user.ticketType = data.metadata.ticketType;
        user.ticketCode = finalCode;
        user.ticketUsed = false;

        await user.save();
      }
    }

    res.sendStatus(200);

  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

/* =====================
   VERIFY TICKET SYSTEM
===================== */
app.post("/verify-ticket", async (req, res) => {
  try {
    const { ticketCode } = req.body;

    const user = await User.findOne({ ticketCode });

    if (!user) {
      return res.status(400).json({ message: "Invalid ticket ❌" });
    }

    if (user.ticketUsed) {
      return res.status(400).json({ message: "Ticket already used ❌" });
    }

    user.ticketUsed = true;
    await user.save();

    res.json({
      message: "Ticket verified successfully ✅",
      ticketType: user.ticketType
    });

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
