const form = document.querySelector("#calculator");
const result = document.querySelector("#result");
const operationList = document.querySelector("#operationList");
const logOperationButton = document.querySelector("#logOperation");
const applyResultButton = document.querySelector("#applyResult");
const clearRecordButton = document.querySelector("#clearRecord");
const clearAllRecordsButton = document.querySelector("#clearAllRecords");
const generateDescriptionButton = document.querySelector("#generateDescription");
const copyDescriptionButton = document.querySelector("#copyDescription");
const finalDescription = document.querySelector("#finalDescription");

const fields = {
  sampleId: document.querySelector("#sampleId"),
  solvent: document.querySelector("#solvent"),
  sampleVol: document.querySelector("#sampleVol"),
  sampleUnit: document.querySelector("#sampleUnit"),
  startingSolventVol: document.querySelector("#startingSolventVol"),
  startingSolventUnit: document.querySelector("#startingSolventUnit"),
  wavelength: document.querySelector("#wavelength"),
  currentAbs: document.querySelector("#currentAbs"),
  targetAbs: document.querySelector("#targetAbs"),
  currentVol: document.querySelector("#currentVol"),
  stockVol: document.querySelector("#stockVol"),
  stockUnit: document.querySelector("#stockUnit"),
  maxVol: document.querySelector("#maxVol"),
  unit: document.querySelector("#unit"),
  volumeUnitLabels: document.querySelectorAll(".volume-unit-label"),
};

let pendingOperation = null;
let operations = [];
let currentVolEdited = false;
let stockVolEdited = false;
let pendingOperationLogged = false;

function readPositiveNumber(input) {
  const value = Number(input.value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function readNonNegativeNumber(input) {
  const value = Number(input.value);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function formatAmount(value, unit) {
  if (value === 0) return `0 ${unit}`;
  const rounded = value >= 100 ? value.toFixed(1) : value >= 10 ? value.toFixed(2) : value.toFixed(3);
  return `${rounded.replace(/\.?0+$/, "")} ${unit}`;
}

function formatAbs(value) {
  return value.toFixed(3).replace(/\.?0+$/, "");
}

function convertVolume(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  if (fromUnit === "mL" && toUnit === "uL") return value * 1000;
  if (fromUnit === "uL" && toUnit === "mL") return value / 1000;
  return value;
}

function formatInputNumber(value) {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(6).replace(/\.?0+$/, "");
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function getSampleKey() {
  return fields.sampleId.value.trim() || "Unnamed sample";
}

function getCurrentSampleOperations() {
  const sampleKey = getSampleKey();
  return operations.filter((operation) => operation.sampleKey === sampleKey);
}

function getCurrentSetup() {
  return {
    solvent: fields.solvent.value.trim() || "solvent",
    sampleVol: readNonNegativeNumber(fields.sampleVol),
    sampleUnit: fields.sampleUnit.value,
    startingSolventVol: readNonNegativeNumber(fields.startingSolventVol),
    startingSolventUnit: fields.startingSolventUnit.value,
    wavelength: readPositiveNumber(fields.wavelength),
  };
}

function getManualState(unit = fields.unit.value) {
  const setup = getCurrentSetup();
  const currentVolume = readPositiveNumber(fields.currentVol);
  const enteredSample = readNonNegativeNumber(fields.stockVol);
  const setupSample = setup.sampleVol === null ? 0 : convertVolume(setup.sampleVol, setup.sampleUnit, unit);
  const sampleVolume = enteredSample === null ? setupSample : convertVolume(enteredSample, fields.stockUnit.value, unit);
  const totalVolume = currentVolume === null ? sampleVolume + convertVolume(setup.startingSolventVol || 0, setup.startingSolventUnit, unit) : currentVolume;

  return {
    unit,
    total: totalVolume,
    sample: sampleVolume,
    solvent: Math.max(0, totalVolume - sampleVolume),
  };
}

function hasCurrentSampleOperations() {
  return getCurrentSampleOperations().length > 0;
}

function syncFirstCalculationDefaults() {
  if (hasCurrentSampleOperations()) return;

  const calculatorUnit = fields.unit.value;
  const sampleVol = readNonNegativeNumber(fields.sampleVol);
  const solventVol = readNonNegativeNumber(fields.startingSolventVol) || 0;

  if (!currentVolEdited && sampleVol !== null) {
    const sampleInCalculatorUnit = convertVolume(sampleVol, fields.sampleUnit.value, calculatorUnit);
    const solventInCalculatorUnit = convertVolume(solventVol, fields.startingSolventUnit.value, calculatorUnit);
    fields.currentVol.value = formatInputNumber(sampleInCalculatorUnit + solventInCalculatorUnit);
  }

  if (!stockVolEdited && sampleVol !== null) {
    fields.stockUnit.value = fields.sampleUnit.value;
    fields.stockVol.value = formatInputNumber(sampleVol);
  }
}

function getDescriptionSetup(sampleOperations) {
  const lastOperation = sampleOperations[sampleOperations.length - 1];
  return lastOperation?.setup || getCurrentSetup();
}

function showMessage(html, type = "") {
  result.className = `result ${type}`.trim();
  result.innerHTML = html;
}

function setPendingOperation(operation) {
  pendingOperation = operation ? {
    ...operation,
    applied: false,
    actualState: getManualState(operation.unit),
    sampleKey: getSampleKey(),
    solvent: fields.solvent.value.trim() || "solvent",
    setup: getCurrentSetup(),
  } : null;
  pendingOperationLogged = false;
  logOperationButton.disabled = !operation;
  applyResultButton.disabled = !operation || operation.kind === "none";
}

function checkVolumeLimit(finalVolume, unit) {
  const maxVolume = readPositiveNumber(fields.maxVol);
  if (!maxVolume) return "";
  if (finalVolume <= maxVolume) return "";
  return `<p class="note">Warning: final volume will be ${formatAmount(finalVolume, unit)}, above your ${formatAmount(maxVolume, unit)} limit.</p>`;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  syncFirstCalculationDefaults();
  setPendingOperation(null);

  const currentAbs = readPositiveNumber(fields.currentAbs);
  const targetAbs = readPositiveNumber(fields.targetAbs);
  const currentVol = readPositiveNumber(fields.currentVol);
  const unit = fields.unit.value;

  if (!currentAbs || !targetAbs || !currentVol) {
    showMessage("<strong>Missing value</strong>Please enter positive numbers for current absorbance, target absorbance, and current volume.", "warning");
    return;
  }

  const tolerance = Math.max(1e-9, targetAbs * 0.001);
  if (Math.abs(currentAbs - targetAbs) <= tolerance) {
    showMessage(`<strong>Already at target</strong><span class="amount">0 ${unit}</span><p class="note">No extra water or raw suspension is needed.</p>`, "good");
    setPendingOperation({
      kind: "none",
      amount: 0,
      currentAbs,
      targetAbs,
      startingVolume: currentVol,
      finalVolume: currentVol,
      unit,
    });
    return;
  }

  if (currentAbs > targetAbs) {
    const waterToAdd = currentVol * (currentAbs / targetAbs - 1);
    const finalVolume = currentVol + waterToAdd;
    const solvent = fields.solvent.value.trim() || "solvent";
    setPendingOperation({
      kind: "solvent",
      amount: waterToAdd,
      currentAbs,
      targetAbs,
      startingVolume: currentVol,
      finalVolume,
      unit,
    });
    showMessage(
      `<strong>Add ${escapeHtml(solvent)}</strong><span class="amount">${formatAmount(waterToAdd, unit)}</span><p class="note">Final volume: ${formatAmount(finalVolume, unit)}. This assumes absorbance is linear with concentration.</p>${checkVolumeLimit(finalVolume, unit)}`,
      "good"
    );
    return;
  }

  const stockVolInput = readPositiveNumber(fields.stockVol);
  const stockVol = stockVolInput === null ? null : convertVolume(stockVolInput, fields.stockUnit.value, unit);
  if (!stockVol) {
    showMessage("<strong>Raw suspension volume needed</strong>S1 is below the target, so enter how much raw suspension is already in the current cuvette mixture.", "warning");
    return;
  }

  if (stockVol >= currentVol) {
    showMessage("<strong>Check the raw suspension volume</strong>The raw suspension adding volume should be smaller than the current total volume in the cuvette.", "warning");
    return;
  }

  const estimatedStockAbs = currentAbs * currentVol / stockVol;
  if (estimatedStockAbs <= targetAbs) {
    showMessage("<strong>Target cannot be reached from these values</strong>The raw suspension concentration estimated from your current mixture is not high enough to reach the target absorbance.", "warning");
    return;
  }

  const stockToAdd = currentVol * (targetAbs - currentAbs) / (estimatedStockAbs - targetAbs);
  const finalVolume = currentVol + stockToAdd;
  setPendingOperation({
    kind: "sample",
    amount: stockToAdd,
    currentAbs,
    targetAbs,
    startingVolume: currentVol,
    finalVolume,
    unit,
    estimatedStockAbs,
  });
  showMessage(
    `<strong>Add raw suspension</strong><span class="amount">${formatAmount(stockToAdd, unit)}</span><p class="note">Final volume: ${formatAmount(finalVolume, unit)}. Estimated raw suspension absorbance: ${formatAbs(estimatedStockAbs)} Abs.</p>${checkVolumeLimit(finalVolume, unit)}`,
    "good"
  );
});

function operationText(operation, index) {
  const action = {
    solvent: `Add ${formatAmount(operation.amount, operation.unit)} ${operation.solvent || "solvent"}`,
    sample: `Add ${formatAmount(operation.amount, operation.unit)} raw suspension`,
    none: "No addition needed",
  }[operation.kind];
  const state = operation.actualState
    ? ` Logged state: ${formatAmount(operation.actualState.sample, operation.actualState.unit)} sample + ${formatAmount(operation.actualState.solvent, operation.actualState.unit)} ${operation.solvent || "solvent"}.`
    : "";
  return `${index + 1}. ${action}; Abs ${formatAbs(operation.currentAbs)} to target ${formatAbs(operation.targetAbs)}; final volume ${formatAmount(operation.finalVolume, operation.unit)}.${state}`;
}

function renderOperations() {
  if (!operations.length) {
    operationList.innerHTML = "No operation logged yet.";
    return;
  }

  const groups = getOperationGroups();

  operationList.innerHTML = Array.from(groups, ([sampleKey, sampleOperations]) => `
    <section class="sample-record">
      <h3>${escapeHtml(sampleKey)}</h3>
      <ol>
        ${sampleOperations.map((operation, index) => `<li>${escapeHtml(operationText(operation, index).replace(`${index + 1}. `, ""))}</li>`).join("")}
      </ol>
    </section>
  `).join("");
}

function getRecordTotals(unit, sampleOperations, setup) {
  const lastState = sampleOperations[sampleOperations.length - 1]?.actualState;
  if (lastState) {
    return {
      sample: convertVolume(lastState.sample, lastState.unit, unit),
      solvent: convertVolume(lastState.solvent, lastState.unit, unit),
    };
  }

  const baseSolvent = convertVolume(setup.startingSolventVol || 0, setup.startingSolventUnit, unit);
  const baseSample = setup.sampleVol === null ? 0 : convertVolume(setup.sampleVol, setup.sampleUnit, unit);
  return { sample: baseSample, solvent: baseSolvent };
}

function buildSampleDescription(sampleId, sampleOperations) {
  const unit = fields.unit.value;
  const setup = getDescriptionSetup(sampleOperations);
  const lastOperation = sampleOperations[sampleOperations.length - 1];
  const totals = getRecordTotals(unit, sampleOperations, setup);
  const pieces = [];

  pieces.push(`Sample ${sampleId}:`);
  pieces.push(`${formatAmount(totals.sample, unit)} sample`);
  pieces.push(`+ ${formatAmount(totals.solvent, unit)} ${setup.solvent}`);

  const absValue = lastOperation ? lastOperation.currentAbs : (readPositiveNumber(fields.currentAbs) || readPositiveNumber(fields.targetAbs));
  if (absValue) pieces.push(`with final Abs ${formatAbs(absValue)}`);
  if (setup.wavelength) pieces.push(`at ${formatAbs(setup.wavelength)} nm excitation wavelength`);

  return `${pieces.join(" ")}.`;
}

function getOperationGroups() {
  return operations.reduce((sampleGroups, operation) => {
    if (!sampleGroups.has(operation.sampleKey)) sampleGroups.set(operation.sampleKey, []);
    sampleGroups.get(operation.sampleKey).push(operation);
    return sampleGroups;
  }, new Map());
}

function buildDescription() {
  const groups = getOperationGroups();
  if (!groups.size) return buildSampleDescription(getSampleKey(), []);
  return Array.from(groups, ([sampleId, sampleOperations]) => buildSampleDescription(sampleId, sampleOperations)).join("\n");
}

logOperationButton.addEventListener("click", () => {
  if (!pendingOperation || pendingOperationLogged) return;
  operations.push(pendingOperation);
  pendingOperationLogged = true;
  logOperationButton.disabled = true;
  renderOperations();
  finalDescription.value = buildDescription();
});

applyResultButton.addEventListener("click", () => {
  if (!pendingOperation || pendingOperation.kind === "none") return;

  const calculatorUnit = fields.unit.value;
  const currentVolume = readPositiveNumber(fields.currentVol);
  const finalVolume = currentVolume === null
    ? pendingOperation.finalVolume
    : currentVolume + convertVolume(pendingOperation.amount, pendingOperation.unit, calculatorUnit);

  fields.currentVol.value = formatInputNumber(finalVolume);
  currentVolEdited = true;

  if (pendingOperation.kind === "sample") {
    const currentStockVol = readNonNegativeNumber(fields.stockVol) || 0;
    const additionInStockUnit = convertVolume(pendingOperation.amount, pendingOperation.unit, fields.stockUnit.value);
    fields.stockVol.value = formatInputNumber(currentStockVol + additionInStockUnit);
    stockVolEdited = true;
  }

  pendingOperation.applied = true;
  pendingOperation.actualState = getManualState(pendingOperation.unit);

  showMessage(
    `<strong>Added into sample</strong><p class="note">Current volume is now ${formatAmount(finalVolume, calculatorUnit)}.</p>`,
    "good"
  );
  applyResultButton.disabled = true;
});

clearRecordButton.addEventListener("click", () => {
  const sampleKey = getSampleKey();
  operations = operations.filter((operation) => operation.sampleKey !== sampleKey);
  setPendingOperation(null);
  renderOperations();
  finalDescription.value = "";
});

clearAllRecordsButton.addEventListener("click", () => {
  operations = [];
  setPendingOperation(null);
  renderOperations();
  finalDescription.value = "";
});

generateDescriptionButton.addEventListener("click", () => {
  finalDescription.value = buildDescription();
});

copyDescriptionButton.addEventListener("click", async () => {
  const text = finalDescription.value || buildDescription();
  finalDescription.value = text;

  try {
    await navigator.clipboard.writeText(text);
    copyDescriptionButton.textContent = "Copied";
  } catch {
    finalDescription.select();
    document.execCommand("copy");
    copyDescriptionButton.textContent = "Copied";
  }

  window.setTimeout(() => {
    copyDescriptionButton.textContent = "Copy description";
  }, 1400);
});

fields.unit.addEventListener("change", () => {
  fields.volumeUnitLabels.forEach((label) => {
    label.textContent = fields.unit.value;
  });
  if (!hasCurrentSampleOperations()) currentVolEdited = false;
  setPendingOperation(null);
  syncFirstCalculationDefaults();
  renderOperations();
  finalDescription.value = "";
});

[fields.sampleVol, fields.startingSolventVol].forEach((field) => {
  field.addEventListener("input", syncFirstCalculationDefaults);
});

[fields.sampleUnit, fields.startingSolventUnit].forEach((field) => {
  field.addEventListener("change", () => {
    currentVolEdited = false;
    stockVolEdited = false;
    syncFirstCalculationDefaults();
  });
});

fields.sampleId.addEventListener("input", () => {
  currentVolEdited = false;
  stockVolEdited = false;
  syncFirstCalculationDefaults();
});

fields.currentVol.addEventListener("input", () => {
  currentVolEdited = true;
});

fields.stockVol.addEventListener("input", () => {
  stockVolEdited = true;
});

fields.stockUnit.addEventListener("change", () => {
  stockVolEdited = true;
});

syncFirstCalculationDefaults();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}
