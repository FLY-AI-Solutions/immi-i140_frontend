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
  validate_single_evidence: 2,
  generate_evidence_reasoning: 4,
  generate_section_1: 5,
  generate_section_2: 7,
  coherency_check: 3,
};

let petitionSeed = fallbackSeed;
let evidenceState = [];
let petitionDataId = "";
let petitionActionCosts = { ...defaultActionCosts };
let tokenBalance = null;
let backendAiReady = false;
let aiBusy = false;
const sectionSaveState = {
  section3: false,
  section1: false,
  section2: false,
};

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
  const labels = {
    generateSection3Btn: `Generate (${getActionCost("generate_section_3")} AI-Tokens)`,
    generateSection1Btn: `Generate (${getActionCost("generate_section_1")} AI-Tokens)`,
    generateSection2Btn: `Generate (${getActionCost("generate_section_2")} AI-Tokens)`,
    coherencyCheckBtn: `Rephrase (${getActionCost("coherency_check")} AI-Tokens)`,
  };

  Object.entries(labels).forEach(([id, label]) => {
    const button = document.getElementById(id);
    if (button) {
      button.textContent = label;
    }
  });
}

function setAiButtonsBusy(isBusy) {
  aiBusy = isBusy;
  [
    "generateSection3Btn",
    "generateSection1Btn",
    "generateSection2Btn",
    "coherencyCheckBtn",
  ].forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      button.disabled = isBusy;
    }
  });
}

function markSectionSaved(sectionKey, isSaved) {
  sectionSaveState[sectionKey] = isSaved;
  const badgeMap = {
    section3: "section3SavedBadge",
    section1: "section1SavedBadge",
    section2: "section2SavedBadge",
  };
  const badge = document.getElementById(badgeMap[sectionKey]);
  if (!badge) return;

  badge.textContent = isSaved ? "Saved" : "Not Saved";
  badge.classList.toggle("pending", !isSaved);
}

function makeEvidenceItem(overrides = {}) {
  const exhibitNumber = evidenceState.length + 1;
  return {
    id: `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    exhibitLabel: overrides.exhibitLabel || `Exhibit ${exhibitNumber}`,
    title: overrides.title || "",
    purpose: overrides.purpose || "",
    sectionFocus: overrides.sectionFocus || "Section-A",
    strength: overrides.strength || "Potentially Useful",
    notes: overrides.notes || "",
    attachmentName: overrides.attachmentName || "No file selected",
    attachmentProvided: overrides.attachmentProvided || false,
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
      sectionFocus: "Section-A",
      strength: "Strong",
    }),
    makeEvidenceItem({
      exhibitLabel: "Exhibit 2",
      title: "Educational credentials",
      purpose: "Supports advanced degree eligibility and credential foundation.",
      sectionFocus: "Section-C",
      strength: "Strong",
    }),
    makeEvidenceItem({
      exhibitLabel: "Exhibit 3",
      title: "Personal endeavor statement",
      purpose: "Supports the applicant's future plans and framing of the proposed endeavor.",
      sectionFocus: "Section-B",
      strength: "Strong",
    }),
  ];

  pathways.forEach((pathway, index) => {
    baseItems.push(
      makeEvidenceItem({
        exhibitLabel: `Exhibit ${index + 4}`,
        title: `${pathway.label} support package`,
        purpose: pathway.summary,
        sectionFocus: index === 1 ? "Section-B" : "Section-C",
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
              <div class="readonly-chip">
                <strong>Section Focus</strong>
                ${escapeHtml(item.sectionFocus)}
              </div>
            </label>
            <label>
              <div class="small text-muted mb-1">Evidence Title</div>
              <input type="text" data-field="title" value="${escapeHtml(item.title)}" />
            </label>
            <label>
              <div class="readonly-chip">
                <strong>Perceived Strength</strong>
                ${escapeHtml(item.strength)}
              </div>
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
          <div class="evidence-actions mt-3">
            <button
              type="button"
              class="btn btn-outline-dark btn-sm"
              data-action="validate-single-evidence"
            >
              Validate (${getActionCost("validate_single_evidence")} AI-Tokens)
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm"
              data-action="generate-evidence-reasoning"
            >
              Generate Reasoning From Doc (${getActionCost("generate_evidence_reasoning")} AI-Tokens)
            </button>
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
  const lines = ["SECTION-A: INDEX OF EXHIBITS", ""];
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
    .filter((item) => item.sectionFocus === "Section-B" || item.sectionFocus === "Section-A")
    .map((item) => `${item.exhibitLabel} (${item.title || "Untitled exhibit"})`);

  return [
    "SECTION-B: PETITION SUMMARY PAGE",
    "",
    `This draft brief is prepared in support of the self-petition filed by ${userName}. It is intended as a working template for organizing the petition narrative, exhibit map, and evidence-backed argument structure before final legal review or polishing.`,
    "",
    "At this stage, the record supports the following preliminary themes:",
    ...pathways.map((pathway, index) => `${index + 1}. ${pathway.label}: ${pathway.summary}`),
    "",
    "The following exhibits have currently been mapped into the summary page:",
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
  const groupedEvidence = pathways.map((pathway) => {
    const sectionEvidence = evidenceState.filter((item) => item.sectionFocus === "Section-C");
    return { pathway, sectionEvidence };
  });

  const sections = ["SECTION-C: PETITION BODY", ""];
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
    "This body section is intentionally a draft scaffold. Use the prompt box above this section to control tone, detail level, or emphasis before regenerating."
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
  markSectionSaved("section3", false);
}

function handleAttachmentInput(input) {
  const item = findEvidenceItem(input);
  if (!item) return;
  const file = input.files?.[0];
  item.attachmentName = file ? file.name : "No file selected";
  item.attachmentProvided = Boolean(file);
  renderEvidenceList();
  markSectionSaved("section3", false);
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

function runLocalSingleEvidenceValidation(item) {
  const warnings = [];
  if (!item.title) warnings.push("Title is missing.");
  if (!item.purpose) warnings.push("Reasoning is missing.");
  if (!item.attachmentProvided) warnings.push("No attachment was provided.");

  return {
    action: "validate_single_evidence",
    message: `${item.exhibitLabel} reviewed in demo mode.`,
    validation_summary: warnings.length
      ? warnings.join(" ")
      : `${item.exhibitLabel} looks usable as a draft exhibit entry.`,
    evidence_feedback: warnings,
    updated_evidence_item: {
      ...item,
      strength: warnings.length ? "Needs Explanation" : "Strong",
    },
  };
}

function runLocalEvidenceReasoning(item) {
  if (!item.attachmentProvided && !item.notes && !item.purpose) {
    return {
      action: "generate_evidence_reasoning",
      message:
        "This card needs an attachment or more context before reasoning can be generated.",
      evidence_feedback: ["Attach a PDF/PNG or add notes/context first."],
    };
  }

  return {
    action: "generate_evidence_reasoning",
    message: `${item.exhibitLabel} reasoning draft generated in demo mode.`,
    updated_evidence_item: {
      ...item,
      purpose:
        item.purpose ||
        "This exhibit appears relevant to the petition record and should be tied to the applicant's qualifications, endeavor, or NIW prong support.",
      notes:
        item.notes ||
        "AI draft note: review this exhibit for dates, authorship, and how it strengthens the petition narrative.",
      sectionFocus: item.sectionFocus || "Section-C",
      strength: item.attachmentProvided ? "Potentially Useful" : "Needs Explanation",
    },
  };
}

function runLocalCoherencyCheck() {
  const section2 = document.getElementById("section2Text");
  const note =
    "[Coherency pass placeholder] Future AI step: align tone, remove repetition, and make exhibit references consistent in the petition body.";

  return {
    action: "coherency_check",
    message: "Local Section-C rephrase placeholder applied in demo mode.",
    updated_section_2: section2 && !section2.value.includes(note) ? `${section2.value}\n\n${note}` : section2?.value || "",
    coherence_notes: [note],
  };
}

function runLocalAction(action, evidenceItem = null) {
  if (action === "generate_section_3") {
    return {
      action,
      message: "Section-A regenerated locally in demo mode.",
      updated_section_3: buildSection3Text(),
    };
  }
  if (action === "generate_section_1") {
    return {
      action,
      message: "Section-B regenerated locally in demo mode.",
      updated_section_1: buildSection1Text(),
    };
  }
  if (action === "generate_section_2") {
    return {
      action,
      message: "Section-C regenerated locally in demo mode.",
      updated_section_2: buildSection2Text(),
    };
  }
  if (action === "validate_single_evidence" && evidenceItem) {
    return runLocalSingleEvidenceValidation(evidenceItem);
  }
  if (action === "generate_evidence_reasoning" && evidenceItem) {
    return runLocalEvidenceReasoning(evidenceItem);
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

  if (result.updated_evidence_item?.id) {
    evidenceState = evidenceState.map((item) =>
      item.id === result.updated_evidence_item.id
        ? { ...item, ...result.updated_evidence_item }
        : item
    );
    renderEvidenceList();
    markSectionSaved("section3", false);
  }

  const section1 = document.getElementById("section1Text");
  const section2 = document.getElementById("section2Text");
  const section3 = document.getElementById("section3Text");

  if (section1 && result.updated_section_1) {
    section1.value = result.updated_section_1;
    markSectionSaved("section1", false);
  }
  if (section2 && result.updated_section_2) {
    section2.value = result.updated_section_2;
    markSectionSaved("section2", false);
  }
  if (section3 && result.updated_section_3) {
    section3.value = result.updated_section_3;
    markSectionSaved("section3", false);
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

function updateCollapseIcon(button, isHidden) {
  const icon = button?.querySelector("i");
  if (icon) {
    icon.className = isHidden ? "bi bi-chevron-down" : "bi bi-chevron-up";
  }
}

function toggleSection(targetId, button) {
  const body = document.getElementById(targetId);
  if (!body) return;
  const card = button?.closest(".petition-card, .petition-stage");
  const header = button?.closest(".petition-stage-head");
  const isHidden = body.classList.toggle("hidden");
  if (header) {
    header.classList.toggle("is-collapsed", isHidden);
  }
  if (card) {
    card.classList.toggle("is-collapsed", isHidden);
  }
  updateCollapseIcon(button, isHidden);
}

async function fetchUserState() {
  if (!petitionDataId || !/^\d+$/.test(String(petitionDataId))) {
    backendAiReady = false;
    setTokenDisplay(null, "Demo Mode");
    return;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/petition/user-state/${petitionDataId}`);
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
    renderEvidenceList();
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

async function callBackendAction(action, evidenceItem = null) {
  const response = await fetch(`${getApiBaseUrl()}/petition/ai-action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rB: parseInt(petitionDataId, 10),
      action,
      report_summary: petitionSeed.reportSummary || {},
      evidence_items: evidenceItem ? [evidenceItem] : evidenceState,
      section_texts: getSectionTexts(),
      packet_notes: document.getElementById("packetNotes")?.value || "",
      writing_instructions: document.getElementById("section2Prompt")?.value || "",
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

async function runAiAction(action, evidenceItem = null) {
  const actionCost = getActionCost(action);
  if (aiBusy) return;

  try {
    setAiButtonsBusy(true);
    setStatus("evidenceStatus", `Running ${action.replaceAll("_", " ")}...`);

    const result = backendAiReady
      ? await callBackendAction(action, evidenceItem)
      : runLocalAction(action, evidenceItem);

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

async function exportDocx() {
  if (!backendAiReady) {
    setStatus("evidenceStatus", "DOCX export requires the backend petition service.");
    return;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/petition/export-docx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference_id: petitionDataId || petitionSeed.referenceId || "draft",
        section_texts: getSectionTexts(),
        packet_notes: document.getElementById("packetNotes")?.value || "",
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || "DOCX export failed.");
    }

    const payload = data.file_base64 || "";
    const byteCharacters = atob(payload);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i += 1) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([new Uint8Array(byteNumbers)], {
      type:
        data.mime_type ||
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = data.filename || "petition_draft.docx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
    setStatus("evidenceStatus", "DOCX petition file generated successfully.");
  } catch (error) {
    console.error("DOCX export failed:", error);
    setStatus("evidenceStatus", error.message || "DOCX export failed.");
  }
}

function requireSaved(sectionKey, message) {
  if (sectionSaveState[sectionKey]) {
    return true;
  }
  setStatus("evidenceStatus", message);
  return false;
}

function bindSectionButtons() {
  document.getElementById("generateSection3Btn")?.addEventListener("click", () => {
    runAiAction("generate_section_3");
  });

  document.getElementById("saveSection3Btn")?.addEventListener("click", () => {
    markSectionSaved("section3", true);
    setStatus("evidenceStatus", "Section-A has been saved.");
  });

  document.getElementById("generateSection1Btn")?.addEventListener("click", () => {
    if (!requireSaved("section3", "Save Section-A before generating Section-B.")) {
      return;
    }
    runAiAction("generate_section_1");
  });

  document.getElementById("saveSection1Btn")?.addEventListener("click", () => {
    markSectionSaved("section1", true);
    setStatus("evidenceStatus", "Section-B has been saved.");
  });

  document.getElementById("generateSection2Btn")?.addEventListener("click", () => {
    if (!requireSaved("section1", "Save Section-B before generating Section-C.")) {
      return;
    }
    runAiAction("generate_section_2");
  });

  document.getElementById("coherencyCheckBtn")?.addEventListener("click", () => {
    if (!document.getElementById("section2Text")?.value.trim()) {
      setStatus("evidenceStatus", "Generate Section-C first before asking for a rephrase.");
      return;
    }
    runAiAction("coherency_check");
  });

  document.getElementById("saveSection2Btn")?.addEventListener("click", () => {
    markSectionSaved("section2", true);
    setStatus("evidenceStatus", "Section-C has been saved.");
  });
}

function bindEvidenceEditor() {
  document.getElementById("addEvidenceBtn")?.addEventListener("click", () => {
    evidenceState.push(
      makeEvidenceItem({
        sectionFocus: "Section-A",
        strength: "User Added",
      })
    );
    renderEvidenceList();
    markSectionSaved("section3", false);
    setStatus("evidenceStatus", "A new evidence point was added.");
  });

  document.getElementById("addCustomExhibitBtn")?.addEventListener("click", () => {
    evidenceState.push(
      makeEvidenceItem({
        title: "Custom exhibit",
        purpose: "User-added evidence outside the seeded report suggestions.",
        sectionFocus: "Section-C",
        strength: "User Added",
      })
    );
    renderEvidenceList();
    markSectionSaved("section3", false);
    setStatus("evidenceStatus", "A custom exhibit row was added.");
  });

  document.getElementById("evidenceList")?.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
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
    }
  });

  document.getElementById("evidenceList")?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.dataset.action || target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    const item = findEvidenceItem(target);

    if (action === "delete-evidence") {
      if (!item) return;
      evidenceState = evidenceState.filter((entry) => entry.id !== item.id);
      renderEvidenceList();
      markSectionSaved("section3", false);
      setStatus("evidenceStatus", `${item.exhibitLabel} was removed.`);
      return;
    }

    if (!item) return;

    if (action === "validate-single-evidence") {
      runAiAction("validate_single_evidence", item);
      return;
    }

    if (action === "generate-evidence-reasoning") {
      if (!item.attachmentProvided && !item.notes && !item.purpose) {
        setStatus(
          "evidenceStatus",
          "Add an attachment or more context to that evidence card before generating reasoning."
        );
        return;
      }
      runAiAction("generate_evidence_reasoning", item);
    }
  });
}

function bindCollapseToggles() {
  document.querySelectorAll("[data-collapse-target]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleSection(button.dataset.collapseTarget, button);
    });
  });
}

function bindDirtyTracking() {
  document.getElementById("section3Text")?.addEventListener("input", () => {
    markSectionSaved("section3", false);
  });
  document.getElementById("section1Text")?.addEventListener("input", () => {
    markSectionSaved("section1", false);
  });
  document.getElementById("section2Text")?.addEventListener("input", () => {
    markSectionSaved("section2", false);
  });
  document.getElementById("section2Prompt")?.addEventListener("input", () => {
    markSectionSaved("section2", false);
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

  markSectionSaved("section3", false);
  markSectionSaved("section1", false);
  markSectionSaved("section2", false);

  bindSectionButtons();
  bindEvidenceEditor();
  bindCollapseToggles();
  bindDirtyTracking();

  document.getElementById("printPetitionBtn")?.addEventListener("click", exportDocx);

  fetchUserState();
}

document.addEventListener("DOMContentLoaded", initializePetitionTemplate);
