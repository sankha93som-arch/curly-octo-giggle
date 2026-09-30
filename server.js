require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const ENV = process.env.CASHFREE_ENV === "production" ? "production" : "sandbox";
const BASE_URL =
  ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

function cashfreeHeaders() {
  return {
    "Content-Type": "application/json",
    "x-client-id": process.env.CASHFREE_CLIENT_ID,
    "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
    "x-api-version": process.env.CASHFREE_API_VERSION || "2023-08-01",
  };
}

function randomOrderId() {
  return "order_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
}

// Creates the order server-side (credentials never leave the server) and
// hands back the payment_session_id the browser needs to open checkout.
app.post("/api/create-order", async (req, res) => {
  try {
    const {
      order_id,
      order_amount,
      order_currency,
      customer_id,
      customer_phone,
      customer_email,
      return_url,
    } = req.body;

    const payload = {
      order_id: order_id || randomOrderId(),
      order_amount: parseFloat(order_amount),
      order_currency: order_currency || "INR",
      customer_details: {
        customer_id,
        customer_phone,
        customer_email: customer_email || undefined,
      },
    };

    if (return_url) {
      payload.order_meta = { return_url };
    }

    const cfRes = await fetch(BASE_URL + "/orders", {
      method: "POST",
      headers: cashfreeHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await cfRes.json();
    // Tell the front end which mode ("sandbox"/"production") to init the
    // checkout SDK with, since it no longer knows the credentials' env.
    res.status(cfRes.status).json({ ...data, environment: ENV });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Looks up order/payment status. Also proxied so the secret stays server-side.
app.get("/api/orders/:orderId", async (req, res) => {
  try {
    const cfRes = await fetch(
      BASE_URL + "/orders/" + encodeURIComponent(req.params.orderId),
      { method: "GET", headers: cashfreeHeaders() }
    );
    const data = await cfRes.json();
    res.status(cfRes.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Cashfree tester running at http://localhost:${PORT} (${ENV})`);
});
