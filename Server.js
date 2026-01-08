const mongoose = require("mongoose");
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  mobile: { type: Number, required: true },
  pincode: { type: Number, required: true },
  address: { type: String, required: true }
});
const User = mongoose.model("User", userSchema);

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const exist = await User.findOne({ email, password });
  if (exist) {
    return res.send({
      data: "success",
      name: exist.name,
      mobile: exist.mobile,
      pincode: exist.pincode,
      address: exist.address
    });
  }
  res.send({ data: "Invalid email or password !" });
});

app.post("/signup", async (req, res) => {
  const { name, email, password, mobile, pincode, address } = req.body;
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.send({ data: "Email already registered" });
  }
  await User.create({
    name,
    email,
    password,
    mobile,
    pincode,
    address
  });
  res.send({ data: "Success" });
});

const mycrops = new mongoose.Schema({
  email: { type: String, required: true },
  crop_name: { type: String, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
  delivery_charge: { type: Number, required: true },
  pincode: [
    {
      code: { type: Number, required: true },
      area: { type: String, required: true }
    }
  ],
  image: {
    data: Buffer,
    contentType: String
  }
});

const MyCrops = mongoose.model("MyCrops", mycrops);

app.post("/addcrop", async (req, res) => {
  try {
    const {
      email,
      crop_name,
      price,
      stock,
      delivery_charge,
      pincode,
      image
    } = req.body;

    const base64Data = image.split(";base64,").pop();
    const buffer = Buffer.from(base64Data, "base64");

    const crop = await MyCrops.create({
      email,
      crop_name,
      price,
      stock,
      delivery_charge,
      pincode,
      image: {
        data: buffer,
        contentType: "image/png"
      }
    });

    res.send({ status: "success", cropId: crop._id });
  } catch (error) {
    res.status(500).send({ status: "error", message: error.message });
  }
});

app.get("/myallcrops/:email", async (req, res) => {
  try {
    const crops = await MyCrops.find(
      { email: req.params.email },
      {
        crop_name: 1,
        price: 1,
        stock: 1,
        delivery_charge: 1,
        pincode: 1,
        image: 1
      }
    );

    const formatted = crops.map((crop) => ({
      _id: crop._id,
      crop_name: crop.crop_name,
      price: crop.price,
      stock: crop.stock,
      delivery_charge: crop.delivery_charge,
      pincode: crop.pincode,
      image: crop.image?.data
        ? `data:${crop.image.contentType};base64,${crop.image.data.toString("base64")}`
        : null
    }));

    res.send({ status: "success", data: formatted });
  } catch (error) {
    res.status(500).send({ status: "error", message: error.message });
  }
});

app.get("/cropsbypincode/:pincode", async (req, res) => {
  try {
    const crops = await MyCrops.find({
      "pincode.code": Number(req.params.pincode),
      stock: { $gt: 0 }
    });

    const result = await Promise.all(
      crops.map(async (crop) => {
        const farmer = await User.findOne(
          { email: crop.email },
          { name: 1 }
        );

        return {
          crop_id: crop._id,
          crop_name: crop.crop_name,
          price: crop.price,
          seller_name: farmer ? farmer.name : "Unknown",
          email: crop.email,
          image: crop.image?.data
            ? `data:${crop.image.contentType};base64,${crop.image.data.toString("base64")}`
            : null
        };
      })
    );

    res.send({ status: "success", data: result });
  } catch (error) {
    res.status(500).send({ status: "error", message: error.message });
  }
});

const cartSchema = new mongoose.Schema({
  user_email: String,
  seller_email: String,
  crop_id: mongoose.Schema.Types.ObjectId,
  crop_name: String,
  price: Number,
  quantity: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now }
});

const Cart = mongoose.model("Cart", cartSchema);

app.post("/addtocart", async (req, res) => {
  try {
    const existingItem = await Cart.findOne({
      user_email: req.body.user_email,
      crop_id: req.body.crop_id
    });

    if (existingItem) {
      existingItem.quantity += req.body.quantity || 1;
      await existingItem.save();
      return res.send({ status: "success", message: "Cart quantity updated" });
    }

    await Cart.create(req.body);
    res.send({ status: "success", message: "Added to cart successfully" });
  } catch (error) {
    res.status(500).send({ status: "error", message: error.message });
  }
});

app.get("/mycart/:email", async (req, res) => {
  try {
    const cartItems = await Cart.find({ user_email: req.params.email });

    const response = await Promise.all(
      cartItems.map(async (item) => {
        const crop = await MyCrops.findById(item.crop_id);
        return {
          ...item._doc,
          image: crop?.image?.data
            ? `data:${crop.image.contentType};base64,${crop.image.data.toString("base64")}`
            : null
        };
      })
    );

    res.send({ status: "success", data: response });
  } catch (error) {
    res.status(500).send({ status: "error", message: error.message });
  }
});

const orderSchema = new mongoose.Schema({
  user_email: String,
  seller_email: String,
  crop_id: mongoose.Schema.Types.ObjectId,
  crop_name: String,
  image: String,
  quantity: Number,
  amount: Number,
  address: String,
  mobile: String,
  pincode: String,
  order_date: { type: Date, default: Date.now },
  delivery_date: Date,
  status: {
    type: String,
    enum: ["confirmed", "packed", "out for delivery", "delivered", "cancelled"],
    default: "confirmed"
  },
  otp: String
});

const Orders = mongoose.model("Orders", orderSchema);

app.post("/placeorder", async (req, res) => {
  try {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 4);

    await Orders.create({
      ...req.body,
      otp,
      delivery_date: deliveryDate,
      status: "confirmed"
    });

    res.send({ status: "success", message: "Order placed successfully", otp });
  } catch (error) {
    res.status(500).send({ status: "error", message: error.message });
  }
});

app.put("/updateprofile", async (req, res) => {
  try {
    const { email, field, value } = req.body;
    if (!["mobile", "pincode", "address"].includes(field)) {
      return res.send({ status: "error", message: "Invalid update request" });
    }
    const user = await User.findOne({ email });
    user[field] = value;
    await user.save();
    res.send({ status: "success", field, value });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    const PORT = process.env.PORT || 5001;
    app.listen(PORT, () => {
      console.log("Server running on port " + PORT);
    });
  })
  .catch((err) => console.log("MongoDB connection error:", err.message));
