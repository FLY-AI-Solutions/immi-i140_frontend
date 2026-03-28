async function initialize() {
  try {
    const { apiBaseUrl, checkoutUrl } = window.ImmiAppConfig;
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const sessionId = urlParams.get("session_id");

    if (!sessionId) {
      console.error("No session_id found in URL");
      showError("Invalid session. Please try again.");
      return;
    }

    // Check session status
    const response = await fetch(
      `${apiBaseUrl}/session-status?session_id=${sessionId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const session = await response.json();

    if (session.error) {
      console.error("Session error:", session.error);
      showError("Failed to retrieve session status.");
      return;
    }

    if (session.status === "open") {
      window.location.replace(checkoutUrl);
    } else if (session.status === "complete") {
      const successElement = document.getElementById("success");
      const emailElement = document.getElementById("customer-email");

      if (!successElement || !emailElement) {
        console.error("Required DOM elements not found");
        showError("Page setup error. Please contact support.");
        return;
      }

      successElement.classList.remove("hidden");
      emailElement.textContent = session.customer_email || "Not provided";

      const urlParams = new URLSearchParams(window.location.search);
      const rB = urlParams.get("rB");
      if (!rB) {
        console.error("No rB found in URL");
        showError("Missing data reference (rB).");
        return;
      }

      const dataResponse = await fetch(
        `${apiBaseUrl}/get-user-data`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rB: parseInt(rB) }),
        }
      );

      if (!dataResponse.ok)
        throw new Error(`Failed to fetch user data: ${dataResponse.status}`);

      const result = await dataResponse.json();

      if (result.status === "success" && result.json_data) {
        const summary = result.json_data;
        const output = document.getElementById("widgetFrame").contentWindow;
        output.postMessage({ type: "updateSummary", data: summary }, "*");
      } else {
        showError(result.message || "Failed to load data.");
      }
    } else {
      console.warn("Unexpected session status:", session.status);
      showError("Unexpected session status.");
    }
  } catch (error) {
    console.error("Error in initialize:", error);
    showError("An error occurred. Please try again later.");
  }
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
  } else {
    alert(message);
  }
}

initialize();

// ---------------- PDF Generation ----------------
document.addEventListener("DOMContentLoaded", () => {
  const pdfButton = document
    .querySelector(".bi-file-earmark-pdf")
    ?.closest("button");
  const iframe = document.getElementById("widgetFrame");

  pdfButton?.addEventListener("click", async () => {
    try {
      // Wait for iframe to load fully
      if (!iframe.contentDocument || !iframe.contentDocument.body) {
        await new Promise((resolve) =>
          iframe.addEventListener("load", resolve)
        );
      }

      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

      // Clone content into temp div to avoid CORS / iframe issues
      const tempDiv = document.createElement("div");
      tempDiv.style.position = "absolute";
      tempDiv.style.left = "-9999px";
      tempDiv.style.background = "#fff";
      tempDiv.style.padding = "20px";
      tempDiv.style.width = iframe.clientWidth + "px";
      tempDiv.innerHTML = iframeDoc.documentElement.innerHTML;
      document.body.appendChild(tempDiv);

      // Give time for images/fonts to load
      await new Promise((r) => setTimeout(r, 500));

      const canvas = await html2canvas(tempDiv, {
        scale: 1.2,
        backgroundColor: "#fff",
        useCORS: true,
        logging: false,
      });

      document.body.removeChild(tempDiv);

      if (!canvas.width || !canvas.height) throw new Error("Canvas is empty!");

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("p", "pt", "a4");

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;

      const imgWidth = Math.floor(pageWidth - margin * 2);
      const imgScale = imgWidth / canvas.width;

      let yOffset = 0;
      while (yOffset < canvas.height) {
        // Calculate portion height for this page
        const remainingHeightPx = canvas.height - yOffset;
        const pageCanvasHeightPx = Math.min(
          remainingHeightPx,
          (pageHeight - margin * 2) / imgScale
        );

        // Draw portion into new canvas
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

        if (yOffset < canvas.height) pdf.addPage();
      }

      // Add disclaimer page
      pdf.addPage();
      pdf.setFont("helvetica", "bolditalic");
      pdf.setFontSize(16);
      pdf.setTextColor(40, 40, 40);
      pdf.text("Disclaimer", margin, 80);

      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(12);
      pdf.setTextColor(80, 80, 80);
      const disclaimer = `
        This report has been generated automatically using AI reasoning based on patterns derived from National Interest Waiver (NIW) cases. It is for informational purposes only and is NOT legal advice. For specific legal guidance, consult a qualified immigration attorney.
      `;
      pdf.text(disclaimer, margin, 120, { maxWidth: pageWidth - margin * 2 });
      // Insert Reference ID under heading
      const urlParams = new URLSearchParams(window.location.search);
      const rB = urlParams.get("rB") || "N/A";
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(50, 50, 50);
      pdf.text(`Reference ID: #${rB}`, margin, 200);

      const filename = `Immigenius_Report#${rB}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Check console for details.");
    }
  });
});
