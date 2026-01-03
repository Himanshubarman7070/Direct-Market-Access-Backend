const mongoose = require("mongoose");
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/*PORT=5000
MONGO_URI = "mongodb+srv://himanshubarman7070_db_user:sapSzB0idtUF3f29@testing.2rfhpvq.mongodb.net/?appName=Tesppting"*/

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const User = mongoose.model("User", userSchema);

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.get("/register", async (req, res) => {
  try {
    const { email, password } = req.query;
    await User.create({ email, password });
    res.send("register api called");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ✅ CONNECT DB FIRST → THEN START SERVER
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log("Server is running on port " + PORT);
    });
  })
  .catch((err) => {
    console.log("MongoDB connection error:", err.message);
  });
