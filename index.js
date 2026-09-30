const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const responseEl = $("response");
const product = {
  name: "Northstar Traverse",
  price: 1499,
  currency: "INR",
};
const cashfree = typeof Cashfree !== "undefined" ? Cashfree({ mode: "sandbox" }) : null;

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = "status" + (kind ? " " + kind : "");
}

function showResponse(data) {
  responseEl.textContent =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

function buildOrderPayload() {
  const orderId = `order_${Date.now()}`;
  const customerName = $("customerName").value.trim() || "Guest Customer";
  const customerPhone = $("customerPhone").value.trim() || "9999999999";
  const customerEmail = $("customerEmail").value.trim() || "guest@example.com";
  const returnUrl = "https://www.mancity.com";

  return {
    order_id: orderId,
    order_amount: (product.price / 100).toFixed(2),
    order_currency: product.currency,
    customer_id: `cust_${Date.now()}`,
    customer_phone: customerPhone,
    customer_email: customerEmail,
    customer_name: customerName,
    return_url: returnUrl,
  };
}

async function createOrder() {
  const payload = buildOrderPayload();

  setStatus("Creating secure Cashfree order...");
  showResponse("Waiting for response...");

  const res = await fetch("/api/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  showResponse(data);

  if (!res.ok) {
    setStatus("Order creation failed — HTTP " + res.status, "error");
    return null;
  }

  if (!data.payment_session_id) {
    setStatus("Order created, but no payment_session_id was returned.", "error");
    return null;
  }

  return data;
}

function launchCheckout(order) {
  if (!cashfree) {
    setStatus("Cashfree SDK did not load. Check your network connection.", "error");
    return;
  }

  const checkoutOptions = {
    paymentSessionId: order.payment_session_id,
    redirectTarget: "_self",
  };

  setStatus("Opening Cashfree redirect checkout...", "ok");

  cashfree.checkout(checkoutOptions).then((result) => {
    if (result.error) {
      setStatus("Payment was not completed. You can try again.", "error");
      return;
    }

    if (result.redirect) {
      setStatus("Redirecting to the return URL...", "ok");
      return;
    }

    if (result.paymentDetails) {
      setStatus("Payment attempt submitted. Verifying order status...", "ok");
    }
  });
}

$("checkoutForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = event.target.querySelector("button[type='submit']");
  submitButton.disabled = true;

  try {
    const order = await createOrder();
    if (order) {
      launchCheckout(order);
    }
  } catch (err) {
    setStatus("Network error while creating order.", "error");
    showResponse(String(err));
  } finally {
    submitButton.disabled = false;
  }
});

$("buyNowButton").addEventListener("click", () => {
  $("customerName").focus();
  $("checkoutForm").requestSubmit();
});
