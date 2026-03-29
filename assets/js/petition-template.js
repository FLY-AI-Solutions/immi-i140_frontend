const petitionSeedStorageKey = "petitionTemplateSeed";

const fallbackSeed = {
  referenceId: "DEMO-140",
  customerEmail: "demo@example.com",
  reportSummary: {
    title: "NIW Case Summary",
    pathways: [
      {
        id: "prong-1",
        label: "Substantial Merit and National Importance",
        status: "Promising",
        summary:
          "The proposed endeavor appears aligned with high-impact U.S. priorities and can be framed through economic benefit, innovation, and broader industry relevance.",
      },
      {
        id: "prong-2",
        label: "Well Positioned to Advance the Endeavor",
        status: "Needs Evidence Packaging",
        summary:
          "The applicant shows meaningful background strength, but the record should be organized around achievements, publications, projects, and third-party validation.",
      },
      {
        id: "prong-3",
        label: "Benefit of Waiving Labor Certification",
        status: "Potentially Supportable",
        summary:
          "The waiver case will be stronger once the record clearly shows why the applicant's continued work benefits the United States beyond a specific employer.",
      },
    ],
  },
};

let petitionSeed = fallbackSeed;
let evidenceState = [];

function readSeed() {
  try {
    const stored = sessionStorage.getItem(petitionSeedStorageKey);
    if (!stored) {
      return { seed: fallbackSeed, source: "fallback" };
    }
    const parsed = JSON.parse(stored);
    if (!parsed || !parsed.reportSummary) {
      return { seed: fallbackSeed, source: "fallback" };
    }
    return { seed: parsed, source: "report" };
  } catch (error) {
    console.error("Failed to parse petition seed:", error);
    return { seed: fallbackSeed, source: "fallback" };
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setStatus(targetId, message) {
  const el = document.getElementById(targetId);
  if (el) {
    el.textContent = message || "";
  }
}

function makeEvidenceItem(overrides = {}) {
  const exhibitNumber = evidenceState.length + 1;
  return {
    id: `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    exhibitLabel: overrides.exhibitLabel || `Exhibit ${exhibitNumber}`,
    title: overrides.title || "",
    purpose: overrides.purpose || "",
    sectionFocus: overrides.sectionFocus || "Section-3",
    strength: overrides.strength || "Potentially Useful",
    notes: overrides.notes || "",
    attachmentName: overrides.attachmentName || "No file selected",
  };
}

function seedEvidenceFromReport(reportSummary) {
  const pathways = Array.isArray(reportSummary?.pathways)
    ? reportSummary.pathways
    : [];
  const baseItems = [
    makeEvidenceItem({
      exhibitLabel: "Exhibit 1",
      title: "Applicant CV / Resume",
      purpose: "Core identity, education, employment, and accomplishments reference document.",
      sectionFocus: "Section-3",
      strength: "Strong",
    }),
    makeEvidenceItem({
      exhibitLabel: "Exhibit 2",
      title: "Educational credentials",
      purpose: "Supports advanced degree eligibility and credential foundation.",
      sectionFocus: "Section-2",
      strength: "Strong",
    }),
    makeEvidenceItem({
      exhibitLabel: "Exhibit 3",
      title: "Personal endeavor statement",
      purpose: "Supports the applicant's future plans and framing of the proposed endeavor.",
      sectionFocus: "Section-1",
      strength: "Strong",
    }),
  ];

  pathways.forEach((pathway, index) => {
    baseItems.push(
      makeEvidenceItem({
        exhibitLabel: `Exhibit ${index + 4}`,
        title: `${pathway.label} support package`,
        purpose: pathway.summary,
        sectionFocus: index === 0 ? "Section-2" : index === 1 ? "Section-1" : "Section-2",
        strength: pathway.status || "Potentially Useful",
      })
    );
  });

  return baseItems;
}

function renderReportInsights() {
  const container = document.getElementById("reportInsights");
  if (!container) return;

  const pathways = Array.isArray(petitionSeed.reportSummary?.pathways)
    ? petitionSeed.reportSummary.pathways
    : [];

  container.innerHTML = pathways.length
    ? pathways
        .map(
          (pathway) => `
            <article class="insight-pill">
              <div class="d-flex justify-content-between gap-3 align-items-start">
                <strong>${escapeHtml(pathway.label || "Report insight")}</strong>
                <span class="badge text-bg-secondary">${escapeHtml(pathway.status || "Draft")}</span>
              </div>
              <div class="mt-2">${escapeHtml(pathway.summary || "")}</div>
            </article>
          `
        )
        .join("")
    : "<div class='insight-pill'>No report insights available. Using fallback sample text.</div>";
}

function renderEvidenceList() {
  const container = document.getElementById("evidenceList");
  if (!container) return;

  container.innerHTML = evidenceState
    .map(
      (item) => `
        <article class="evidence-item" data-evidence-id="${escapeHtml(item.id)}">
          <div class="evidence-meta">
            <strong>${escapeHtml(item.exhibitLabel)}</strong>
            <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete-evidence">
              Remove
            </button>
          </div>
          <div class="evidence-grid">
            <label>
              <div class="small text-muted mb-1">Exhibit Label</div>
              <input type="text" data-field="exhibitLabel" value="${escapeHtml(item.exhibitLabel)}" />
            </label>
            <label>
              <div class="small text-muted mb-1">Section Focus</div>
              <select data-field="sectionFocus">
                <option ${item.sectionFocus === "Section-3" ? "selected" : ""}>Section-3</option>
                <option ${item.sectionFocus === "Section-1" ? "selected" : ""}>Section-1</option>
                <option ${item.sectionFocus === "Section-2" ? "selected" : ""}>Section-2</option>
              </select>
            </label>
            <label>
              <div class="small text-muted mb-1">Evidence Title</div>
              <input type="text" data-field="title" value="${escapeHtml(item.title)}" />
            </label>
            <label>
              <div class="small text-muted mb-1">Perceived Strength</div>
              <select data-field="strength">
                <option ${item.strength === "Strong" ? "selected" : ""}>Strong</option>
                <option ${item.strength === "Potentially Useful" ? "selected" : ""}>Potentially Useful</option>
                <option ${item.strength === "Needs Explanation" ? "selected" : ""}>Needs Explanation</option>
                <option ${item.strength === "User Added" ? "selected" : ""}>User Added</option>
              </select>
            </label>
            <label style="grid-column: 1 / -1;">
              <div class="small text-muted mb-1">Why this evidence matters</div>
              <textarea data-field="purpose">${escapeHtml(item.purpose)}</textarea>
            </label>
            <label style="grid-column: 1 / -1;">
              <div class="small text-muted mb-1">User Notes / Context</div>
              <textarea data-field="notes">${escapeHtml(item.notes)}</textarea>
            </label>
          </div>
          <div class="d-flex flex-wrap align-items-center gap-2 mt-3">
            <label class="btn btn-outline-secondary btn-sm mb-0">
              Attach PDF / PNG
              <input
                type="file"
                class="d-none"
                accept=".pdf,.png,.jpg,.jpeg"
                data-action="attachment"
              />
            </label>
            <span class="attachment-chip">${escapeHtml(item.attachmentName)}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function findEvidenceItem(element) {
  const card = element.closest("[data-evidence-id]");
  if (!card) return null;
  return evidenceState.find((item) => item.id === card.dataset.evidenceId) || null;
}

function buildSection3Text() {
  const lines = ["INDEX OF EXHIBITS"];
  evidenceState.forEach((item) => {
    lines.push(`${item.exhibitLabel}\t${item.title || "Untitled exhibit"}${item.purpose ? ` - ${item.purpose}` : ""}`);
  });
  return lines.join("\n");
}

function buildSection1Text() {
  const pathways = Array.isArray(petitionSeed.reportSummary?.pathways)
    ? petitionSeed.reportSummary.pathways
    : [];
  const userName = petitionSeed.customerEmail || "the self-petitioner";
  const chosenEvidence = evidenceState
    .filter((item) => item.sectionFocus === "Section-1" || item.sectionFocus === "Section-3")
    .map((item) => `${item.exhibitLabel} (${item.title || "Untitled exhibit"})`);

  return [
    "SECTION 1",
    "",
    `This draft brief is prepared in support of the self-petition filed by ${userName}. It is intended as a working template for organizing the petition narrative, exhibit map, and evidence-backed argument structure before final legal review or polishing.`,
    "",
    "At this stage, the record supports the following preliminary themes:",
    ...pathways.map(
      (pathway, index) =>
        `${index + 1}. ${pathway.label}: ${pathway.summary}`
    ),
    "",
    "The following exhibits have currently been mapped into the opening section:",
    ...(chosenEvidence.length ? chosenEvidence.map((line) => `- ${line}`) : ["- User still needs to select supporting exhibits."]),
    "",
    "This section should remain editable so the petitioner can revise voice, emphasis, and personal framing after evidence is finalized.",
  ].join("\n");
}

function buildSection2Text() {
  const pathways = Array.isArray(petitionSeed.reportSummary?.pathways)
    ? petitionSeed.reportSummary.pathways
    : [];
  const groupedEvidence = pathways.map((pathway, index) => {
    const sectionEvidence = evidenceState.filter(
      (item) =>
        item.sectionFocus === "Section-2" ||
        (index === 1 && item.sectionFocus === "Section-1")
    );
    return { pathway, sectionEvidence };
  });

  const sections = ["SECTION 2", ""];
  groupedEvidence.forEach(({ pathway, sectionEvidence }, index) => {
    sections.push(`${index + 1}. ${pathway.label}`);
    sections.push(pathway.summary || "Add report-based reasoning here.");
    sections.push("Suggested evidence references:");
    if (sectionEvidence.length) {
      sectionEvidence.forEach((item) => {
        sections.push(`- ${item.exhibitLabel}: ${item.title || "Untitled exhibit"}${item.notes ? ` (${item.notes})` : ""}`);
      });
    } else {
      sections.push("- Add evidence rows and map them here.");
    }
    sections.push("");
  });

  sections.push(
    "This body section is intentionally a draft scaffold. A future AI call can expand each block into a full prong-by-prong petition narrative with exhibit references."
  );

  return sections.join("\n");
}

function updateField(element) {
  const item = findEvidenceItem(element);
  if (!item) return;
  const field = element.dataset.field;
  if (!field) return;
  item[field] = element.value;
}

function handleAttachmentInput(input) {
  const item = findEvidenceItem(input);
  if (!item) return;
  const file = input.files?.[0];
  item.attachmentName = file ? file.name : "No file selected";
  renderEvidenceList();
}

function showSeedHeader(source) {
  const refEl = document.getElementById("referenceBadge");
  const seedEl = document.getElementById("seedBadge");
  if (refEl) {
    refEl.textContent = petitionSeed.referenceId || "Draft Mode";
  }
  if (seedEl) {
    seedEl.textContent =
      source === "report"
        ? "Seeded from the report page summary"
        : "Using fallback sample report";
  }
}

function runDummyEvidenceValidation() {
  const issues = evidenceState
    .filter((item) => !item.title || !item.purpose)
    .map((item) => `${item.exhibitLabel} needs a clearer title or purpose statement.`);

  const attachmentWarnings = evidenceState
    .filter((item) => item.attachmentName === "No file selected")
    .map((item) => `${item.exhibitLabel} has no file attached yet.`);

  const message = [...issues, ...attachmentWarnings];
  setStatus(
    "evidenceStatus",
    message.length
      ? `Dummy validation: ${message.join(" ")}`
      : "Dummy validation: current evidence rows look organized enough for drafting."
  );
}

function runDummyCoherencyCheck() {
  const section1 = document.getElementById("section1Text");
  const section2 = document.getElementById("section2Text");
  if (!section1 || !section2) return;

  const note =
    "\n\n[Coherency pass placeholder] Future AI step: align tone, remove repetition, and make exhibit references consistent across all sections.";
  if (!section1.value.includes("[Coherency pass placeholder]")) {
    section1.value += note;
  }
  if (!section2.value.includes("[Coherency pass placeholder]")) {
    section2.value += note;
  }
}

function initializePetitionTemplate() {
  const seedResult = readSeed();
  petitionSeed = seedResult.seed;
  evidenceState = seedEvidenceFromReport(petitionSeed.reportSummary);

  showSeedHeader(seedResult.source);
  renderReportInsights();
  renderEvidenceList();

  const section3 = document.getElementById("section3Text");
  const section1 = document.getElementById("section1Text");
  const section2 = document.getElementById("section2Text");

  if (section3) section3.value = buildSection3Text();
  if (section1) section1.value = buildSection1Text();
  if (section2) section2.value = buildSection2Text();

  document.getElementById("generateSection3Btn")?.addEventListener("click", () => {
    if (section3) {
      section3.value = buildSection3Text();
    }
    setStatus("evidenceStatus", "Section-3 refreshed from the current evidence stack.");
  });

  document.getElementById("validateEvidenceBtn")?.addEventListener("click", () => {
    runDummyEvidenceValidation();
  });

  document.getElementById("generateSection1Btn")?.addEventListener("click", () => {
    if (section1) {
      section1.value = buildSection1Text();
    }
    setStatus("evidenceStatus", "Section-1 regenerated from the current report seed and evidence rows.");
  });

  document.getElementById("generateSection2Btn")?.addEventListener("click", () => {
    if (section2) {
      section2.value = buildSection2Text();
    }
    setStatus("evidenceStatus", "Section-2 expanded into a longer draft scaffold.");
  });

  document.getElementById("coherencyCheckBtn")?.addEventListener("click", () => {
    runDummyCoherencyCheck();
    setStatus("evidenceStatus", "Coherency placeholder added. Future AI can replace this with a real revision pass.");
  });

  document.getElementById("printPetitionBtn")?.addEventListener("click", () => {
    window.print();
  });

  document.getElementById("addEvidenceBtn")?.addEventListener("click", () => {
    evidenceState.push(
      makeEvidenceItem({
        sectionFocus: "Section-3",
        strength: "User Added",
      })
    );
    renderEvidenceList();
    setStatus("evidenceStatus", "A new evidence point was added.");
  });

  document.getElementById("addCustomExhibitBtn")?.addEventListener("click", () => {
    evidenceState.push(
      makeEvidenceItem({
        title: "Custom exhibit",
        purpose: "User-added evidence outside the seeded report suggestions.",
        sectionFocus: "Section-2",
        strength: "User Added",
      })
    );
    renderEvidenceList();
    setStatus("evidenceStatus", "A custom exhibit row was added.");
  });

  document.getElementById("evidenceList")?.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
      return;
    }
    if (target.dataset.field) {
      updateField(target);
    }
  });

  document.getElementById("evidenceList")?.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.dataset.action === "attachment") {
      handleAttachmentInput(target);
      return;
    }
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
      if (target.dataset.field) {
        updateField(target);
      }
    }
  });

  document.getElementById("evidenceList")?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action !== "delete-evidence") return;
    const item = findEvidenceItem(target);
    if (!item) return;
    evidenceState = evidenceState.filter((entry) => entry.id !== item.id);
    renderEvidenceList();
    setStatus("evidenceStatus", `${item.exhibitLabel} was removed.`);
  });
}

document.addEventListener("DOMContentLoaded", initializePetitionTemplate);
