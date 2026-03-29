(function () {
  const hostname = window.location.hostname;
  const isLocalHost =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "";

  const defaults = {
    frontendBaseUrl: isLocalHost
      ? ""
      : "https://fly-ai-solutions.github.io/immi-i140_frontend",
    apiBaseUrl: isLocalHost
      ? "http://127.0.0.1:8000"
      : "https://jerin-api.flyai.online/x005",
    checkoutUrl: isLocalHost
      ? "../payment/checkout.html"
      : "https://fly-ai-solutions.github.io/immi-i140_frontend/pages/payment/checkout.html",
    supportEmail: "support@immigenius.us",
    stripePublishableKey:
      "pk_live_51QgJ1jB9nS1ga46ZQ1V0cKQgHALtlLnRkNcNkRQgPYZm0HqkwWZvih3taVzL6Vr1Ewh3PxC48nEo7GMgz4PDA93Z00Gcy8tYWD",
  };

  window.ImmiAppConfig = {
    ...defaults,
    ...(window.__IMMI_APP_CONFIG__ || {}),
  };
})();
