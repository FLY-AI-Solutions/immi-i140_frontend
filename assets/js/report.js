const toastStackId = "toastStack";
const iframe = document.getElementById("widgetFrame");
let activeSessionId = "";
let activeReferenceId = "";
let activeCustomerEmail = "";
let activeSummary = null;

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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  const referenceId = activeReferenceId || "N/A";
  const logoUrl = new URL(
    "../../assets/images/immigenius-logo.png",
    window.location.href
  ).toString();
  const reportMarkup = buildPrintableSummaryMarkup();

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
        padding: 18mm 16mm 12mm;
        margin-bottom: 10mm;
        overflow: hidden;
      }
      .page-header::before {
        content: "";
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at top right, rgba(185, 176, 162, 0.18), transparent 45%);
      }
      .watermark-logo {
        position: absolute;
        right: 10mm;
        top: 7mm;
        width: 54mm;
        opacity: 0.1;
        transform: rotate(-8deg);
      }
      .eyebrow {
        font-family: Arial, sans-serif;
        font-size: 9pt;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: #7d7263;
        margin-bottom: 8px;
        position: relative;
        z-index: 1;
      }
      .page-title {
        font-family: Arial, sans-serif;
        font-size: 24pt;
        line-height: 1.2;
        font-weight: 700;
        margin: 0 0 8px;
        color: #1c1c1c;
        position: relative;
        z-index: 1;
      }
      .page-meta {
        font-family: Arial, sans-serif;
        font-size: 10pt;
        color: #5b5b5b;
        position: relative;
        z-index: 1;
      }
      .report-body {
        background: #ffffff;
        border: 1px solid #e6e1d7;
        border-radius: 16px;
        padding: 12mm;
      }
      .report-title {
        font-family: Arial, sans-serif;
        font-size: 19pt;
        margin: 0 0 9mm;
        color: #2f2b28;
      }
      .pathway-card {
        border: 1px solid #e3ddd2;
        border-left: 6px solid #7d7263;
        border-radius: 12px;
        padding: 7mm 6mm;
        margin-bottom: 7mm;
        break-inside: avoid;
      }
      .pathway-head {
        display: flex;
        justify-content: space-between;
        gap: 8mm;
        align-items: baseline;
        margin-bottom: 4mm;
      }
      .pathway-label {
        font-family: Arial, sans-serif;
        font-size: 15pt;
        font-weight: 700;
        color: #2f2b28;
      }
      .pathway-status {
        font-family: Arial, sans-serif;
        font-size: 10pt;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #6d6457;
      }
      .pathway-content {
        font-family: "Times New Roman", Times, serif;
        font-size: 12pt;
        color: #1c1c1c;
      }
      .pathway-content p {
        margin: 0 0 3mm;
      }
      .pathway-content h4 {
        font-family: Arial, sans-serif;
        font-size: 13pt;
        margin: 5mm 0 2.5mm;
        color: #2f2b28;
      }
      .pathway-content ul {
        margin: 0 0 4mm 6mm;
        padding-left: 6mm;
      }
      .pathway-content li {
        margin-bottom: 1.5mm;
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
        <img class="watermark-logo" src="${logoUrl}" alt="Immigenius Logo" />
        <div class="eyebrow">Immigenius by FlyAI Solutions</div>
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

function formatSectionContent(sectionContent) {
  const normalized = sectionContent
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\r/g, "")
    .trim();

  if (!normalized) {
    return "";
  }

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let html = "";
  let bullets = [];

  const flushBullets = () => {
    if (!bullets.length) return;
    html += `<ul>${bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    bullets = [];
  };

  lines.forEach((line) => {
    if (line.startsWith("-")) {
      bullets.push(line.replace(/^-+\s*/, "").trim());
    } else {
      flushBullets();
      html += `<p>${escapeHtml(line)}</p>`;
    }
  });

  flushBullets();
  return html;
}

function formatSummarySections(summaryHtml) {
  const normalized = String(summaryHtml || "").replace(/\r/g, "");
  const regex =
    /(Strengths|Weak points|Recommended Next Steps)\s*:?\s*([\s\S]*?)(?=(Strengths|Weak points|Recommended Next Steps)\s*:|$)/gi;

  let result = "";
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(normalized)) !== null) {
    const leading = normalized.slice(lastIndex, match.index).trim();
    if (leading) {
      result += formatSectionContent(leading);
    }

    const heading = match[1];
    const content = match[2] || "";
    result += `<h4>${escapeHtml(heading)}</h4>${formatSectionContent(content)}`;
    lastIndex = regex.lastIndex;
  }

  const trailing = normalized.slice(lastIndex).trim();
  if (trailing) {
    result += formatSectionContent(trailing);
  }

  return result || formatSectionContent(normalized);
}

function buildPrintableSummaryMarkup() {
  const summary = activeSummary || {};
  const title = escapeHtml(summary.title || "NIW Case Summary");
  const pathways = Array.isArray(summary.pathways) ? summary.pathways : [];

  const pathwayMarkup = pathways
    .map((pathway) => {
      const badgeColor = pathway.badgeColor || "#7d7263";
      return `
        <article class="pathway-card" style="border-left-color:${escapeHtml(
          badgeColor
        )}">
          <div class="pathway-head">
            <div class="pathway-label">${escapeHtml(pathway.label || "")}</div>
            <div class="pathway-status">${escapeHtml(pathway.status || "")}</div>
          </div>
          <div class="pathway-content">
            ${formatSummarySections(pathway.summary || "")}
          </div>
        </article>
      `;
    })
    .join("");

  return `<h2 class="report-title">${title}</h2>${pathwayMarkup}`;
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

function openPetitionTemplate() {
  if (!activeSummary) {
    showToast("The report summary is still loading. Please try again in a moment.", "info", 4500);
    return;
  }

  const seedPayload = {
    referenceId: activeReferenceId || "",
    customerEmail: activeCustomerEmail || "",
    generatedAt: new Date().toISOString(),
    reportSummary: activeSummary,
  };

  sessionStorage.setItem(
    "petitionTemplateSeed",
    JSON.stringify(seedPayload)
  );

  const nextUrl = new URL("../petition/petition_template_form.html", window.location.href);
  if (activeReferenceId) {
    nextUrl.searchParams.set("rB", activeReferenceId);
  }
  window.location.href = nextUrl.toString();
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

    const sessionStatusUrl = new URL(`${apiBaseUrl}/session-status`);
    sessionStatusUrl.searchParams.set("session_id", sessionId);
    if (rB) {
      sessionStatusUrl.searchParams.set("rB", rB);
    }

    const response = await fetch(
      sessionStatusUrl.toString(),
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

    activeSummary = result.json_data;
    const output = iframe.contentWindow;
    output.postMessage({ type: "updateSummary", data: activeSummary }, "*");

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
  const petitionButton = document.getElementById("openPetitionTemplateBtn");
  printButton?.addEventListener("click", printReport);
  petitionButton?.addEventListener("click", openPetitionTemplate);
  initialize();
});
