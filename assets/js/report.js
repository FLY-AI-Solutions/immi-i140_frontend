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
    await new Promise((resolve) => iframe.addEventListener("load", resolve, { once: true }));
  }
  await new Promise((resolve) => setTimeout(resolve, 1400));
}

async function buildPdfDocument() {
  await waitForIframeReady();
  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

  const tempDiv = document.createElement("div");
  tempDiv.style.position = "absolute";
  tempDiv.style.left = "-9999px";
  tempDiv.style.background = "#fff";
  tempDiv.style.padding = "20px";
  tempDiv.style.width = iframe.clientWidth + "px";
  tempDiv.innerHTML = iframeDoc.documentElement.innerHTML;
  document.body.appendChild(tempDiv);

  await new Promise((resolve) => setTimeout(resolve, 500));

  const canvas = await html2canvas(tempDiv, {
    scale: 1.2,
    backgroundColor: "#fff",
    useCORS: true,
    logging: false,
  });

  document.body.removeChild(tempDiv);

  if (!canvas.width || !canvas.height) {
    throw new Error("Canvas is empty.");
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "pt", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const imgWidth = Math.floor(pageWidth - margin * 2);
  const imgScale = imgWidth / canvas.width;

  let yOffset = 0;
  while (yOffset < canvas.height) {
    const remainingHeightPx = canvas.height - yOffset;
    const pageCanvasHeightPx = Math.min(
      remainingHeightPx,
      (pageHeight - margin * 2) / imgScale
    );

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = pageCanvasHeightPx;

    const ctx = pageCanvas.getContext("2d");
    ctx.drawImage(
      canvas,
      0,
      yOffset,
      canvas.width,
      pageCanvasHeightPx,
      0,
      0,
      canvas.width,
      pageCanvasHeightPx
    );

    const imgData = pageCanvas.toDataURL("image/jpeg", 1.0);
    pdf.addImage(
      imgData,
      "JPEG",
      margin,
      margin,
      imgWidth,
      pageCanvasHeightPx * imgScale
    );

    yOffset += pageCanvasHeightPx;
    if (yOffset < canvas.height) {
      pdf.addPage();
    }
  }

  pdf.addPage();
  pdf.setFont("helvetica", "bolditalic");
  pdf.setFontSize(16);
  pdf.setTextColor(40, 40, 40);
  pdf.text("Disclaimer", margin, 80);

  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(12);
  pdf.setTextColor(80, 80, 80);
  const disclaimer =
    "This report has been generated automatically using AI reasoning based on patterns derived from National Interest Waiver (NIW) cases. It is for informational purposes only and is NOT legal advice. For specific legal guidance, consult a qualified immigration attorney.";
  pdf.text(disclaimer, margin, 120, { maxWidth: pageWidth - margin * 2 });

  const referenceId = activeReferenceId || "N/A";
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(50, 50, 50);
  pdf.text(`Reference ID: #${referenceId}`, margin, 200);

  return {
    pdf,
    filename: `Immigenius_Report#${referenceId}.pdf`,
  };
}

async function downloadPdfReport() {
  try {
    const { pdf, filename } = await buildPdfDocument();
    pdf.save(filename);
    showToast("PDF report downloaded.", "success");
  } catch (error) {
    console.error("PDF generation failed:", error);
    showToast("Failed to generate the PDF report.", "error", 5000);
  }
}

async function emailPdfReport() {
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
    const downloadUrl = new URL(window.location.href);
    downloadUrl.searchParams.set("download", "1");
    const response = await fetch(`${apiBaseUrl}/email-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient_email: activeCustomerEmail,
        reference_id: activeReferenceId || null,
        download_url: downloadUrl.toString(),
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
    const shouldAutoDownload = urlParams.get("download") === "1";

    activeSessionId = sessionId || "";
    activeReferenceId = rB || "";

    if (!sessionId) {
      showError("Invalid session. Please try again.");
      return;
    }

    const response = await fetch(`${apiBaseUrl}/session-status?session_id=${sessionId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

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

    const summary = result.json_data;
    const output = iframe.contentWindow;
    output.postMessage({ type: "updateSummary", data: summary }, "*");
    await emailPdfReport();
    if (shouldAutoDownload) {
      await downloadPdfReport();
    }
  } catch (error) {
    console.error("Error in initialize:", error);
    showError("An error occurred. Please try again later.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  ensureToastStack();
  const pdfButton = document.querySelector(".bi-file-earmark-pdf")?.closest("button");
  pdfButton?.addEventListener("click", downloadPdfReport);
  initialize();
});
