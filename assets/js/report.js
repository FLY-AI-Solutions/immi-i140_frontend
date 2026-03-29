const toastStackId = "toastStack";
const iframe = document.getElementById("widgetFrame");
let activeSessionId = "";
let activeReferenceId = "";
let activeCustomerEmail = "";

function ensureToastStack() {
  let stack = document.getElementById(toastStackId);
  if (stack) return stack;

  stack = document.createElement("div");
  stack.id = toastStackId;
  stack.style.position = "fixed";
  stack.style.left = "1.5rem";
  stack.style.bottom = "1.5rem";
  stack.style.zIndex = "2000";
  stack.style.display = "flex";
  stack.style.flexDirection = "column";
  stack.style.gap = "0.75rem";
  document.body.appendChild(stack);
  return stack;
}

function showToast(message, type = "info", duration = 4000) {
  const colors = {
    success: "#12b76a",
    error: "#f04438",
    info: "#7c8aa5",
  };

  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.minWidth = "280px";
  toast.style.maxWidth = "360px";
  toast.style.padding = "0.95rem 1rem";
  toast.style.borderRadius = "14px";
  toast.style.background = "rgba(28, 28, 28, 0.96)";
  toast.style.color = "#fff";
  toast.style.borderLeft = `4px solid ${colors[type] || colors.info}`;
  toast.style.boxShadow = "0 14px 40px rgba(0, 0, 0, 0.28)";
  toast.style.opacity = "0";
  toast.style.transform = "translateY(18px)";
  toast.style.transition = "opacity 0.25s ease, transform 0.25s ease";

  ensureToastStack().appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(18px)";
    window.setTimeout(() => toast.remove(), 250);
  }, duration);
}

function showError(message) {
  const errorElement = document.getElementById("error-message");
  if (errorElement) {
    const errorText = document.getElementById("error-text");
    if (errorText) {
      errorText.textContent = message;
    } else {
      errorElement.textContent = message;
    }
    errorElement.classList.remove("hidden");
  }
  showToast(message, "error", 5000);
}

async function waitForIframeReady() {
  if (!iframe.contentDocument || !iframe.contentDocument.body) {
    await new Promise((resolve) =>
      iframe.addEventListener("load", resolve, { once: true })
    );
  }
  await new Promise((resolve) => setTimeout(resolve, 1400));
}

function buildPrintHtml() {
  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  const reportMarkup = iframeDoc.body?.innerHTML || iframeDoc.documentElement.innerHTML;
  const referenceId = activeReferenceId || "N/A";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>FLYAI Solutions Report #${referenceId}</title>
    <style>
      @page {
        size: A4;
        margin: 18mm 16mm 18mm 16mm;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #eef1f4;
      }
      body {
        font-family: "Times New Roman", Times, serif;
        font-size: 12pt;
        line-height: 1.55;
        color: #1c1c1c;
      }
      .page-shell {
        width: 100%;
      }
      .page-header {
        position: relative;
        background: linear-gradient(135deg, #f7f4ef 0%, #ece5d9 100%);
        border: 1px solid #d8cec0;
        border-radius: 18px;
        padding: 22mm 16mm 12mm;
        margin-bottom: 10mm;
        overflow: hidden;
      }
      .page-header::after {
        content: "FLYAI SOLUTIONS";
        position: absolute;
        right: -6mm;
        top: 5mm;
        font-size: 26pt;
        font-weight: 700;
        letter-spacing: 2px;
        color: rgba(185, 176, 162, 0.2);
        transform: rotate(-8deg);
        white-space: nowrap;
      }
      .eyebrow {
        font-family: Arial, sans-serif;
        font-size: 9pt;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: #7d7263;
        margin-bottom: 8px;
      }
      .page-title {
        font-family: Arial, sans-serif;
        font-size: 24pt;
        line-height: 1.2;
        font-weight: 700;
        margin: 0 0 8px;
        color: #1c1c1c;
      }
      .page-meta {
        font-family: Arial, sans-serif;
        font-size: 10pt;
        color: #5b5b5b;
      }
      .report-body {
        background: #ffffff;
        border: 1px solid #e6e1d7;
        border-radius: 16px;
        padding: 12mm;
      }
      .report-body * {
        font-family: "Times New Roman", Times, serif !important;
      }
      .report-body h1,
      .report-body h2,
      .report-body h3,
      .report-body h4,
      .report-body h5,
      .report-body h6 {
        font-family: Arial, sans-serif !important;
        color: #2f2b28 !important;
        margin-top: 0;
        page-break-after: avoid;
      }
      .report-body h1 { font-size: 22pt !important; }
      .report-body h2 { font-size: 18pt !important; }
      .report-body h3 { font-size: 15pt !important; }
      .report-body p,
      .report-body li,
      .report-body span,
      .report-body div {
        font-size: 12pt !important;
        color: #1c1c1c !important;
      }
      .report-body table {
        width: 100% !important;
        border-collapse: collapse !important;
      }
      .report-body th,
      .report-body td {
        border: 1px solid #d8cec0 !important;
        padding: 8px 10px !important;
        font-size: 11.5pt !important;
      }
      .print-footer {
        margin-top: 8mm;
        font-family: Arial, sans-serif;
        font-size: 9pt;
        color: #6f6f6f;
        text-align: center;
      }
      @media print {
        html, body {
          background: #ffffff;
        }
        .page-header,
        .report-body {
          box-shadow: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="page-shell">
      <section class="page-header">
        <div class="eyebrow">FlyAI Solutions</div>
        <h1 class="page-title">NIW Eligibility Report</h1>
        <div class="page-meta">Reference ID: #${referenceId}</div>
      </section>
      <section class="report-body">${reportMarkup}</section>
      <div class="print-footer">
        Generated by FLYAI Solutions. This report is informational and not legal advice.
      </div>
    </div>
    <script>
      window.onload = function () {
        window.print();
      };
    </script>
  </body>
</html>`;
}

async function printReport() {
  try {
    await waitForIframeReady();
    const printWindow = window.open("", "_blank", "width=980,height=760");
    if (!printWindow) {
      throw new Error("Unable to open the print view. Please allow pop-ups for this site.");
    }
    printWindow.document.open();
    printWindow.document.write(buildPrintHtml());
    printWindow.document.close();
    showToast("Print view opened successfully.", "success");
  } catch (error) {
    console.error("Print view failed:", error);
    showToast(error.message, "error", 5000);
  }
}

async function emailReportLink() {
  if (!activeCustomerEmail) {
    return;
  }

  const sessionKey = `report-email-sent:${activeSessionId}`;
  if (sessionStorage.getItem(sessionKey) === "1") {
    return;
  }

  try {
    showToast("Preparing your report email...", "info");
    const { apiBaseUrl } = window.ImmiAppConfig;
    const reportUrl = new URL(window.location.href);
    reportUrl.searchParams.set("print", "1");
    reportUrl.searchParams.set("emailed", "1");

    const response = await fetch(`${apiBaseUrl}/email-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient_email: activeCustomerEmail,
        reference_id: activeReferenceId || null,
        download_url: reportUrl.toString(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to send the report email.");
    }

    sessionStorage.setItem(sessionKey, "1");
    showToast(`Report email sent to ${activeCustomerEmail}.`, "success", 5000);
  } catch (error) {
    console.error("Email report failed:", error);
    showToast(error.message, "error", 5000);
  }
}

async function initialize() {
  try {
    const { apiBaseUrl, checkoutUrl } = window.ImmiAppConfig;
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get("session_id");
    const rB = urlParams.get("rB");
    const shouldAutoPrint = urlParams.get("print") === "1";
    const isEmailLink = urlParams.get("emailed") === "1";

    activeSessionId = sessionId || "";
    activeReferenceId = rB || "";

    if (!sessionId) {
      showError("Invalid session. Please try again.");
      return;
    }

    const response = await fetch(
      `${apiBaseUrl}/session-status?session_id=${sessionId}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const session = await response.json();
    if (session.error) {
      showError("Failed to retrieve session status.");
      return;
    }

    if (session.status === "open") {
      window.location.replace(checkoutUrl);
      return;
    }

    if (session.status !== "complete") {
      showError("Unexpected session status.");
      return;
    }

    const successElement = document.getElementById("success");
    const emailElement = document.getElementById("customer-email");
    if (!successElement || !emailElement) {
      showError("Page setup error. Please contact support.");
      return;
    }

    successElement.classList.remove("hidden");
    activeCustomerEmail = session.customer_email || "";
    emailElement.textContent = activeCustomerEmail || "Not provided";

    if (!rB) {
      showError("Missing data reference (rB).");
      return;
    }

    const dataResponse = await fetch(`${apiBaseUrl}/get-user-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rB: parseInt(rB, 10) }),
    });

    if (!dataResponse.ok) {
      throw new Error(`Failed to fetch user data: ${dataResponse.status}`);
    }

    const result = await dataResponse.json();
    if (result.status !== "success" || !result.json_data) {
      showError(result.message || "Failed to load data.");
      return;
    }

    const output = iframe.contentWindow;
    output.postMessage({ type: "updateSummary", data: result.json_data }, "*");

    if (!isEmailLink) {
      await emailReportLink();
    }

    if (shouldAutoPrint) {
      await printReport();
    }
  } catch (error) {
    console.error("Error in initialize:", error);
    showError("An error occurred. Please try again later.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  ensureToastStack();
  const printButton = document
    .querySelector(".bi-printer")
    ?.closest("button");
  printButton?.addEventListener("click", printReport);
  initialize();
});
