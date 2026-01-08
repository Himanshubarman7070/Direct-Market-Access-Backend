const mongoose = require("mongoose");
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());



const userSchema = new mongoose.Schema({
  name:{type:String,required:true},
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  mobile:{type:Number,required:true},
  pincode:{type:Number,required:true},
  address:{type:String,required:true}
});
const User = mongoose.model("User", userSchema);

app.post("/login",async (req, res) => {
   const {email,password} = req.body;
   const exist   = await User.findOne({email,password});
   if(exist) {
       res.send({
        data:"success",
        name:exist.name,
        mobile:exist.mobile,
        pincode:exist.pincode,
        address:exist.address
       });
   }
    res.send({data:"Invalid email or password !"})
});

app.post("/signup", async (req, res) => {
  
    const { name, email, password, mobile, pincode, address } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.send({data:"Email already registered"});
    }

    await User.create({
      name,
      email,
      password,
      mobile,
      pincode,
      address,
    });
    res.send({data:"Success"});
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

    if (!image) {
      return res.status(400).send({ error: "Image is required" });
    }

    // convert base64 to buffer
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
    console.log("Suceess image")
    res.send({
      status: "success",
      cropId: crop._id
    });
    

  } catch (error) {
    console.log("failed image")
    res.status(500).send({
      status: "error",
      message: error.message
    });
  }
});

app.get("/myallcrops/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const crops = await MyCrops.find(
      { email },
      {
        crop_name: 1,
        price: 1,
        stock: 1,
        delivery_charge: 1,
        pincode: 1,
        image: 1
      }
    );

    if (!crops.length) {
      return res.send({ status: "success", data: [] });
    }

    // convert image buffer to base64
    const formattedCrops = crops.map((crop) => ({
      _id: crop._id,
      crop_name: crop.crop_name,
      price: crop.price,
      stock: crop.stock,
      delivery_charge: crop.delivery_charge,
      pincode: crop.pincode,
      image: crop.image?.data
        ? `data:${crop.image.contentType};base64,${crop.image.data.toString(
            "base64"
          )}`
        : null
    }));

    res.send({
      status: "success",
      data: formattedCrops
    });

  } catch (error) {
    res.status(500).send({
      status: "error",
      message: error.message
    });
  }
});

app.get("/cropsbypincode/:pincode", async (req, res) => {
  try {
    const { pincode } = req.params;

    const crops = await MyCrops.find({
      "pincode.code": Number(pincode),
      stock: { $gt: 0 }
    });

    if (!crops.length) {
      return res.send({
        status: "success",
        data: []
      });
    }

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

    res.send({
      status: "success",
      data: result
    });

  } catch (error) {
    res.status(500).send({
      status: "error",
      message: error.message
    });
  }
});

const cartSchema = new mongoose.Schema({
  user_email: {
    type: String,
    required: true
  },
  seller_email: {
    type: String,
    required: true
  },
  crop_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  crop_name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    default: 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Cart = mongoose.model("Cart", cartSchema);
app.post("/addtocart", async (req, res) => {
  try {
    const {
      user_email,
      seller_email,
      crop_id,
      crop_name,
      price,
      quantity
    } = req.body;

    if (!user_email || !seller_email || !crop_id) {
      return res.status(400).send({
        status: "error",
        message: "Missing required fields"
      });
    }

    const existingItem = await Cart.findOne({
      user_email,
      crop_id
    });

    if (existingItem) {
      existingItem.quantity += quantity || 1;
      await existingItem.save();

      return res.send({
        status: "success",
        message: "Cart quantity updated"
      });
    }

    await Cart.create({
      user_email,
      seller_email,
      crop_id,
      crop_name,
      price,
      quantity: quantity || 1
    });

    res.send({
      status: "success",
      message: "Added to cart successfully"
    });

  } catch (error) {
    res.status(500).send({
      status: "error",
      message: error.message
    });
  }
});


app.get("/mycart/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const cartItems = await Cart.find({ user_email: email });

    if (!cartItems.length) {
      return res.send({
        status: "success",
        data: []
      });
    }

    const responseData = await Promise.all(
      cartItems.map(async (item) => {
        const crop = await MyCrops.findById(item.crop_id);

        return {
          _id: item._id,                
          crop_id: item.crop_id,
          crop_name: item.crop_name,
          price: item.price,
          seller_email: item.seller_email,
          quantity: item.quantity,
          image: crop?.image?.data
            ? `data:${crop.image.contentType};base64,${crop.image.data.toString(
                "base64"
              )}`
            : null
        };
      })
    );

    res.send({
      status: "success",
      data: responseData
    });

  } catch (error) {
    res.status(500).send({
      status: "error",
      message: error.message
    });
  }
});

app.delete("/removefromcart/:cartId", async (req, res) => {
  try {
    const { cartId } = req.params;

    const deletedItem = await Cart.findByIdAndDelete(cartId);

    if (!deletedItem) {
      return res.status(404).send({
        status: "error",
        message: "Cart item not found"
      });
    }

    res.send({
      status: "success",
      message: "Item removed from cart"
    });

  } catch (error) {
    res.status(500).send({
      status: "error",
      message: error.message
    });
  }
});

const orderSchema = new mongoose.Schema({
  user_email: { type: String, required: true },
  seller_email: { type: String, required: true },

  crop_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  crop_name: { type: String, required: true },
  image: String,

  quantity: { type: Number, required: true },
  amount: { type: Number, required: true },

  address: { type: String, required: true },
  mobile: { type: String, required: true },
  pincode: { type: String, required: true },

  order_date: { type: Date, default: Date.now },
  delivery_date: { type: Date },

  status: {
    type: String,
    enum: ["confirmed", "packed", "out for delivery", "delivered","cancelled"],
    default: "confirmed"
  },

 
  otp: {
    type: String,
    required: true
  }
});

const Orders = mongoose.model("Orders", orderSchema);
 

app.get("/deliverycharge/:cropId", async (req, res) => {
  try {
    const crop = await MyCrops.findById(req.params.cropId);

    if (!crop) {
      return res.status(404).send({ status: "error", message: "Crop not found" });
    }

    res.send({
      status: "success",
      delivery_charge: crop.delivery_charge
    });

  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
});

app.post("/placeorder", async (req, res) => {
  try {
    const {
      user_email,
      seller_email,
      crop_id,
      crop_name,
      image,
      quantity,
      amount,
      address,
      mobile,
      pincode
    } = req.body;

    
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 4);

    await Orders.create({
      user_email,
      seller_email,
      crop_id,
      crop_name,
      image,
      quantity,
      amount,
      address,
      mobile,
      pincode,
      otp,                       
      delivery_date: deliveryDate,
      status: "confirmed"

    });

    res.send({
      status: "success",
      message: "Order placed successfully",
      otp                              
    });

  } catch (error) {
    res.status(500).send({
      status: "error",
      message: error.message
    });
  }
});

app.get("/myorders/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const orders = await Orders.find({ user_email: email }).sort({
      order_date: -1
    });

    res.send({
      status: "success",
      data: orders    
    });

  } catch (error) {
    res.status(500).send({
      status: "error",
      message: error.message
    });
  }
});

app.put("/cancelorder/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Orders.findById(orderId);

    if (!order) {
      return res.status(404).send({
        status: "error",
        message: "Order not found"
      });
    }

    if (order.status === "delivered") {
      return res.send({
        status: "error",
        message: "Delivered order cannot be cancelled"
      });
    }

    order.status = "cancelled";
    await order.save();

    res.send({
      status: "success",
      message: "Order cancelled successfully"
    });

  } catch (error) {
    res.status(500).send({
      status: "error",
      message: error.message
    });
  }
});

app.delete("/removecrop/:cropId", async (req, res) => {
  try {
    const { cropId } = req.params;

    
    await Orders.updateMany(
      {
        crop_id: cropId,
        status: { $ne: "delivered" }
      },
      {
        $set: { status: "cancelled" }
      }
    );

    const deletedCrop = await MyCrops.findByIdAndDelete(cropId);

    if (!deletedCrop) {
      return res.send({
        status: "error",
        message: "Crop not found"
      });
    }

    res.send({
      status: "success",
      message: "Crop removed & all bookings cancelled"
    });

  } catch (error) {
    res.status(500).send({
      status: "error",
      message: error.message
    });
  }
});

app.get("/bookings/:sellerEmail/:cropId", async (req, res) => {
  try {
    const { sellerEmail, cropId } = req.params;

    const orders = await Orders.find({
      seller_email: sellerEmail,
      crop_id: cropId
    }).sort({ order_date: -1 });

    res.send({
      status: "success",
      data: orders
    });
  } catch (err) {
    res.status(500).send({
      status: "error",
      message: err.message
    });
  }
});

app.put("/updateorderstatus/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Orders.findById(orderId);
    if (!order) {
      return res.send({ status: "error", message: "Order not found" });
    }

    const flow = [
      "confirmed",
      "packed",
      "out for delivery",
      "delivered"
    ];

    const index = flow.indexOf(order.status);
    if (index >= 0 && index < 2) {
      order.status = flow[index + 1];
      await order.save();
    }

    res.send({ status: "success", newStatus: order.status });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
});

app.put("/cancelbooking/:orderId", async (req, res) => {
  try {
    const order = await Orders.findById(req.params.orderId);

    if (!order) {
      return res.send({ status: "error", message: "Order not found" });
    }

    if (order.status === "delivered") {
      return res.send({
        status: "error",
        message: "Delivered order cannot be cancelled"
      });
    }

    order.status = "cancelled";
    await order.save();

    res.send({ status: "success" });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
});

app.put("/verifyotp/:orderId", async (req, res) => {
  try {
    const { otp } = req.body;

    const order = await Orders.findById(req.params.orderId);
    if (!order) {
      return res.send({ status: "error", message: "Order not found" });
    }

    if (order.otp !== otp) {
      return res.send({ status: "error", message: "Invalid OTP" });
    }

    order.status = "delivered";
    await order.save();

    res.send({ status: "success" });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
});

app.put("/updateprofile", async (req, res) => {
  try {
    const { email, field, value } = req.body;


    const allowedFields = ["mobile", "pincode", "address"];

    if (!email || !allowedFields.includes(field) || !value) {
      return res.send({
        status: "error",
        message: "Invalid update request"
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.send({
        status: "error",
        message: "User not found"
      });
    }

    user[field] = value;
    await user.save();

    res.send({
      status: "success",
      field,
      value
    });

  } catch (err) {
    res.status(500).send({
      status: "error",
      message: err.message
    });
  }
});

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
