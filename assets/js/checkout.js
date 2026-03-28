const { apiBaseUrl, stripePublishableKey } = window.ImmiAppConfig;
const stripe = Stripe(stripePublishableKey);

let checkout = null;
let currentCouponCode = "";
const couponInput = document.getElementById("coupon-code");
const applyCouponBtn = document.getElementById("apply-coupon-btn");
const couponMessage = document.getElementById("coupon-message");
const loadingElement = document.getElementById("loading");
const checkoutElement = document.getElementById("checkout");
const errorElement = document.getElementById("error-text");
const errorSection = document.getElementById("error-message");

initialize();

if (applyCouponBtn && couponInput) {
  applyCouponBtn.addEventListener("click", () => {
    const code = couponInput.value.trim();
    if (!code) {
      if (couponMessage) {
        couponMessage.textContent = "Please enter a valid coupon code.";
      }
      return;
    }

    currentCouponCode = code;
    if (couponMessage) {
      couponMessage.textContent = "Applying coupon...";
    }

    if (checkout) {
      checkout.unmount();
    }

    initialize();
  });
}

async function initialize() {
  try {
    if (loadingElement) loadingElement.classList.remove("hidden");
    if (checkoutElement) checkoutElement.classList.add("hidden");
    if (errorSection) errorSection.classList.add("hidden");

    const urlParams = new URLSearchParams(window.location.search);
    const rB = urlParams.get("rB");

    // console.log("Initializing checkout with rB:", rB, "and Coupon:", currentCouponCode);

    const fetchClientSecret = async () => {
      const response = await fetch(
        `${apiBaseUrl}/create-checkout-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Send both the rB parameter and the coupon code to your backend
          body: JSON.stringify({ rB: rB, coupon: currentCouponCode }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error || `HTTP error! Status: ${response.status}`;
        throw new Error(errorMessage);
      }

      const { clientSecret, error } = await response.json();
      if (error) {
        throw new Error(error);
      }
      return clientSecret;
    };

    checkout = await stripe.initEmbeddedCheckout({
      fetchClientSecret,
    });

    checkout.mount("#checkout");

    if (loadingElement) loadingElement.classList.add("hidden");
    if (checkoutElement) checkoutElement.classList.remove("hidden");

    if (currentCouponCode && couponMessage) {
      couponMessage.textContent =
        "Coupon applied successfully. The price has been updated.";
    }
  } catch (error) {
    console.error("Checkout initialization error:", error);
    if (couponMessage) {
      couponMessage.textContent = "";
    }
    if (errorElement && errorSection) {
      errorElement.textContent = `Error: ${error.message}. If you used a coupon, it might be invalid. Please remove it or try again.`;
      errorSection.classList.remove("hidden");
      if (loadingElement) loadingElement.classList.add("hidden");
    } else {
      alert(`Error: ${error.message}`);
    }
  }
}
