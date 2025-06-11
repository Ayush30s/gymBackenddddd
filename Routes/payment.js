const { Router } = require("express");
const dotenv = require("dotenv");
const crypto = require("crypto");
const RequestModel = require("../Models/request");

dotenv.config();
const {
  PORT,
  MERCHANT_ID,
  SALT_KEY,
  SALT_INDEX,
  PHONEPE_API_URL,
  PHONEPE_STATUS_URL,
} = process.env;

const paymentRouter = Router();

paymentRouter.post("/makepayment", async (req, res) => {
  const { userId, gymId } = req.body;

  try {
    const data = await RequestModel.findOneAndUpdate(
      {
        reqby: userId,
        reqto: gymId,
        requestType: "join",
        status: "accepted",
        paymentStatus: "unpaid", // ✅ Fixed typo
      },
      {
        paymentStatus: "paid",
      },
      { new: true }
    );

    if (!data) {
      return res
        .status(404)
        .json({
          success: false,
          message: "No matching request found or already paid",
        });
    }

    console.log(data);
    return res
      .status(200)
      .json({ success: true, message: "Payment marked as paid" });
  } catch (err) {
    console.error("Payment update error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
});

paymentRouter.post("/create-payment", async (req, res) => {
  try {
    const { amount, mobile } = req.body;
    const txnId = `TXN_${Date.now()}`;

    const payload = {
      merchantId: MERCHANT_ID,
      merchantTransactionId: txnId,
      merchantUserId: `USER_${Date.now()}`,
      amount: amount * 100, // paise
      mobileNumber: mobile,
      redirectUrl: `http://localhost:5173/payment-status?txnId=${txnId}`,
      callbackUrl: `http://localhost:${PORT}/payment-status?txnId=${txnId}`,
    };

    const base64 = Buffer.from(JSON.stringify(payload)).toString("base64");
    const checksum =
      crypto
        .createHash("sha256")
        .update(base64 + "/pg/v1/pay" + SALT_KEY)
        .digest("hex") +
      "###" +
      SALT_INDEX;

    const response = await fetch(PHONEPE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": checksum,
      },
      body: JSON.stringify({ request: base64 }),
    });

    if (!response.ok) {
      throw new Error("PhonePe API call failed");
    }

    const data = await response.json();

    const payUrl = data.data.instrumentResponse.redirectInfo.url;
    res.json({ checkoutUrl: payUrl });
  } catch (e) {
    console.error("Create payment failed", e);
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

paymentRouter.get("/payment-status", async (req, res) => {
  try {
    const { txnId } = req.query;
    const basePath = `/pg/v1/status/${MERCHANT_ID}/${txnId}`;
    const checksum =
      crypto
        .createHash("sha256")
        .update(basePath + SALT_KEY)
        .digest("hex") +
      "###" +
      SALT_INDEX;

    const { data } = await axios.get(
      `${PHONEPE_STATUS_URL}/${MERCHANT_ID}/${txnId}`,
      {
        headers: { "X-VERIFY": checksum },
      }
    );

    res.json(data);
  } catch (e) {
    console.error("Status fetch failed", e);
    res.status(500).json({ error: "Failed to get status" });
  }
});

module.exports = paymentRouter;
