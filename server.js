const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json()); // Essential to read data from the frontend
app.use(express.static(__dirname));

// ==========================================
// 1. DATABASE CONNECTION
// ==========================================
mongoose.connect("mongodb://127.0.0.1:27017/routingAppDB")
  .then(() => console.log("✅ MongoDB connected!"))
  .catch(err => console.error("❌ MongoDB Error:", err));

// ==========================================
// 2. PARCEL SCHEMA
// ==========================================
const parcelSchema = new mongoose.Schema({
  parcel_id: {
    type: String,
    unique: true,
    required: true
  },
  sender_name: String,
  phone: String,
  pickup_address: String,
  delivery_address: String,
  weight: Number,
  status: { type: String, default: "Pending" },
  created_at: { type: Date, default: Date.now }
});

const Parcel = mongoose.model("Parcel", parcelSchema);

// ==========================================
// 3. API ROUTES
// ==========================================

// SAVE DATA
app.post("/api/parcels", async (req, res) => {
  try {
    const parcel = new Parcel({
      parcel_id: req.body.parcel_id, // ✅ REQUIRED FIX
      sender_name: req.body.sender_name,
      phone: req.body.phone,
      pickup_address: req.body.pickup_address,
      delivery_address: req.body.delivery_address,
      weight: req.body.weight
    });

    const saved = await parcel.save();
    console.log("💾 Saved to DB:", saved);
    res.status(201).json(saved);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET DATA
app.get("/api/history", async (req, res) => {
  try {
    const data = await Parcel.find().sort({ created_at: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).send(err);
  }
});

// UPDATE STATUS (Used during tracking simulation)
app.patch("/api/parcels/:id", async (req, res) => {
  try {
    await Parcel.findByIdAndUpdate(req.params.id, { status: "Delivered" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).send(err);
  }
});

// NODE v24 COMPATIBILITY
app.get("*any", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server on http://localhost:${PORT}`)
);
