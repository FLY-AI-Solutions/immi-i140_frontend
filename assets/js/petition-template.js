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

const defaultActionCosts = {
  generate_section_3: 3,
  validate_evidence: 2,
  generate_section_1: 5,
  generate_section_2: 7,
  coherency_check: 3,
};

const buttonActionMap = {
  generateSection3Btn: "generate_section_3",
  validateEvidenceBtn: "validate_evidence",
  generateSection1Btn: "generate_section_1",
  generateSection2Btn: "generate_section_2",
  coherencyCheckBtn: "coherency_check",
};

let petitionSeed = fallbackSeed;
let evidenceState = [];
let petitionDataId = "";
let petitionActionCosts = { ...defaultActionCosts };
let tokenBalance = null;
let backendAiReady = false;
let aiBusy = false;

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

function getApiBaseUrl() {
  return window.ImmiAppConfig?.apiBaseUrl || "";
}

function getActionCost(action) {
  return petitionActionCosts[action] ?? defaultActionCosts[action] ?? 0;
}

function setStatus(targetId, message) {
  const el = document.getElementById(targetId);
  if (el) {
    el.textContent = message || "";
  }
}

function setTokenDisplay(balance, statusText) {
  const balanceEl = document.getElementById("tokenBalanceValue");
  const statusEl = document.getElementById("tokenStatusValue");
  if (balanceEl) {
    balanceEl.textContent = balance == null ? "--" : `${balance}`;
  }
  if (statusEl) {
    statusEl.textContent = statusText || "Ready";
  }
}

function refreshButtonLabels() {
  Object.entries(buttonActionMap).forEach(([buttonId, action]) => {
    const button = document.getElementById(buttonId);
    if (!button) return;

    const labels = {
      generate_section_3: "Generate Section-3 from Report",
      validate_evidence: "Validate Attached Evidence",
      generate_section_1: "Generate Section-1",
      generate_section_2: "Expand to Section-2",
      coherency_check: "Coherency Check & Rephrase",
    };
    button.textContent = `${labels[action]} (${getActionCost(action)} AI-Tokens)`;
  });
}

function setAiButtonsBusy(isBusy) {
  aiBusy = isBusy;
  Object.keys(buttonActionMap).forEach((buttonId) => {
    const button = document.getElementById(buttonId);
    if (button) {
      button.disabled = isBusy;
    }
  });
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
  const lines = ["SECTION 3", "", "INDEX OF EXHIBITS"];
  evidenceState.forEach((item) => {
    lines.push(
      `${item.exhibitLabel}\t${item.title || "Untitled exhibit"}${
        item.purpose ? ` - ${item.purpose}` : ""
      }`
    );
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
    ...pathways.map((pathway, index) => `${index + 1}. ${pathway.label}: ${pathway.summary}`),
    "",
    "The following exhibits have currently been mapped into the opening section:",
    ...(chosenEvidence.length
      ? chosenEvidence.map((line) => `- ${line}`)
      : ["- User still needs to select supporting exhibits."]),
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
        sections.push(
          `- ${item.exhibitLabel}: ${item.title || "Untitled exhibit"}${
            item.notes ? ` (${item.notes})` : ""
          }`
        );
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

function getSectionTexts() {
  return {
    section_1: document.getElementById("section1Text")?.value || "",
    section_2: document.getElementById("section2Text")?.value || "",
    section_3: document.getElementById("section3Text")?.value || "",
  };
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

function runLocalEvidenceValidation() {
  const issues = evidenceState
    .filter((item) => !item.title || !item.purpose)
    .map((item) => `${item.exhibitLabel} needs a clearer title or purpose statement.`);

  const attachmentWarnings = evidenceState
    .filter((item) => item.attachmentName === "No file selected")
    .map((item) => `${item.exhibitLabel} has no file attached yet.`);

  return {
    action: "validate_evidence",
    message: "Local validation completed in demo mode.",
    validation_summary:
      [...issues, ...attachmentWarnings].join(" ") ||
      "Current evidence rows look organized enough for drafting.",
    evidence_feedback: [...issues, ...attachmentWarnings],
  };
}

function runLocalCoherencyCheck() {
  const section1 = document.getElementById("section1Text");
  const section2 = document.getElementById("section2Text");
  const section3 = document.getElementById("section3Text");
  const note =
    "[Coherency pass placeholder] Future AI step: align tone, remove repetition, and make exhibit references consistent across all sections.";

  const patchText = (value) => (value.includes(note) ? value : `${value}\n\n${note}`);

  return {
    action: "coherency_check",
    message: "Local coherency placeholder applied in demo mode.",
    updated_section_1: section1 ? patchText(section1.value) : null,
    updated_section_2: section2 ? patchText(section2.value) : null,
    updated_section_3: section3 ? patchText(section3.value) : null,
    coherence_notes: [note],
  };
}

function runLocalAction(action) {
  if (action === "generate_section_3") {
    return {
      action,
      message: "Section-3 regenerated locally in demo mode.",
      updated_section_3: buildSection3Text(),
    };
  }
  if (action === "generate_section_1") {
    return {
      action,
      message: "Section-1 regenerated locally in demo mode.",
      updated_section_1: buildSection1Text(),
    };
  }
  if (action === "generate_section_2") {
    return {
      action,
      message: "Section-2 regenerated locally in demo mode.",
      updated_section_2: buildSection2Text(),
    };
  }
  if (action === "validate_evidence") {
    return runLocalEvidenceValidation();
  }
  if (action === "coherency_check") {
    return runLocalCoherencyCheck();
  }
  return {
    action,
    message: "No local handler available for this action.",
  };
}

function applyActionResult(result) {
  if (!result) return;

  const section1 = document.getElementById("section1Text");
  const section2 = document.getElementById("section2Text");
  const section3 = document.getElementById("section3Text");

  if (section1 && result.updated_section_1) {
    section1.value = result.updated_section_1;
  }
  if (section2 && result.updated_section_2) {
    section2.value = result.updated_section_2;
  }
  if (section3 && result.updated_section_3) {
    section3.value = result.updated_section_3;
  }

  const messageParts = [
    result.message,
    result.validation_summary,
    Array.isArray(result.evidence_feedback) && result.evidence_feedback.length
      ? result.evidence_feedback.join(" ")
      : "",
    Array.isArray(result.coherence_notes) && result.coherence_notes.length
      ? result.coherence_notes.join(" ")
      : "",
  ].filter(Boolean);

  setStatus("evidenceStatus", messageParts.join(" "));
}

function toggleSection(targetId, button) {
  const body = document.getElementById(targetId);
  if (!body) return;
  const head = body.previousElementSibling;
  const isHidden = body.classList.toggle("hidden");
  if (head) {
    head.classList.toggle("is-collapsed", isHidden);
  }
  if (button) {
    button.textContent = isHidden ? "Expand" : "Collapse";
  }
}

async function fetchUserState() {
  if (!petitionDataId || !/^\d+$/.test(String(petitionDataId))) {
    backendAiReady = false;
    setTokenDisplay(null, "Demo Mode");
    return;
  }

  try {
    const response = await fetch(
      `${getApiBaseUrl()}/petition/user-state/${petitionDataId}`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch petition user state: ${response.status}`);
    }

    const result = await response.json();
    petitionActionCosts = {
      ...petitionActionCosts,
      ...(result.action_costs || {}),
    };
    tokenBalance = result.ai_token_balance;
    backendAiReady = true;
    setTokenDisplay(tokenBalance, "Backend AI Ready");
    refreshButtonLabels();
  } catch (error) {
    console.error("Petition token fetch failed:", error);
    backendAiReady = false;
    setTokenDisplay(null, "Demo Mode");
    setStatus(
      "evidenceStatus",
      "Backend AI state could not be loaded, so the page is running in local demo mode."
    );
  }
}

async function callBackendAction(action) {
  const response = await fetch(`${getApiBaseUrl()}/petition/ai-action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rB: parseInt(petitionDataId, 10),
      action,
      report_summary: petitionSeed.reportSummary || {},
      evidence_items: evidenceState,
      section_texts: getSectionTexts(),
      packet_notes: document.getElementById("packetNotes")?.value || "",
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || "Petition AI action failed.");
  }
  tokenBalance = data.ai_token_balance;
  setTokenDisplay(tokenBalance, "Backend AI Ready");
  return data.result;
}

async function runAiAction(action) {
  const actionCost = getActionCost(action);
  if (aiBusy) return;

  try {
    setAiButtonsBusy(true);
    setStatus("evidenceStatus", `Running ${action.replaceAll("_", " ")}...`);

    const result = backendAiReady
      ? await callBackendAction(action)
      : runLocalAction(action);

    if (!backendAiReady) {
      setTokenDisplay(null, "Demo Mode");
    } else if (tokenBalance != null) {
      setTokenDisplay(tokenBalance, `${actionCost} Tokens Used`);
    }

    applyActionResult(result);
  } catch (error) {
    console.error("Petition AI action failed:", error);
    setStatus("evidenceStatus", error.message || "Petition AI action failed.");
  } finally {
    setAiButtonsBusy(false);
  }
}

function bindActionButtons() {
  document
    .getElementById("generateSection3Btn")
    ?.addEventListener("click", () => runAiAction("generate_section_3"));
  document
    .getElementById("validateEvidenceBtn")
    ?.addEventListener("click", () => runAiAction("validate_evidence"));
  document
    .getElementById("generateSection1Btn")
    ?.addEventListener("click", () => runAiAction("generate_section_1"));
  document
    .getElementById("generateSection2Btn")
    ?.addEventListener("click", () => runAiAction("generate_section_2"));
  document
    .getElementById("coherencyCheckBtn")
    ?.addEventListener("click", () => runAiAction("coherency_check"));
}

function bindEvidenceEditor() {
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
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
    ) {
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
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
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

function bindCollapseToggles() {
  document.querySelectorAll("[data-collapse-target]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleSection(button.dataset.collapseTarget, button);
    });
  });
}

function initializePetitionTemplate() {
  const seedResult = readSeed();
  petitionSeed = seedResult.seed;
  const urlParams = new URLSearchParams(window.location.search);
  petitionDataId = urlParams.get("rB") || petitionSeed.referenceId || "";
  evidenceState = seedEvidenceFromReport(petitionSeed.reportSummary);

  showSeedHeader(seedResult.source);
  renderReportInsights();
  renderEvidenceList();
  refreshButtonLabels();

  const section3 = document.getElementById("section3Text");
  const section1 = document.getElementById("section1Text");
  const section2 = document.getElementById("section2Text");

  if (section3) section3.value = buildSection3Text();
  if (section1) section1.value = buildSection1Text();
  if (section2) section2.value = buildSection2Text();

  bindActionButtons();
  bindEvidenceEditor();
  bindCollapseToggles();

  document.getElementById("printPetitionBtn")?.addEventListener("click", () => {
    window.print();
  });

  fetchUserState();
}

document.addEventListener("DOMContentLoaded", initializePetitionTemplate);
