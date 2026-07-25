import fs from "node:fs";

const REQUIRED_FIELDS = ["id", "connector", "action", "target", "approvalMode"];
const RISK_ORDER = ["low", "medium", "high"];
const SECRET_PATTERNS = [/sk-[A-Za-z0-9_-]{12,}/, /gh[opsu]_[A-Za-z0-9_]{20,}/, /password\s*[:=]\s*\S+/i, /token\s*[:=]\s*\S+/i];

export function readPlan(filePath) {
  const raw = filePath === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    const issue = new Error(`Invalid JSON in ${filePath}: ${error.message}`);
    issue.code = "INVALID_JSON";
    throw issue;
  }
}

export function validatePlan(plan) {
  const errors = [];
  const warnings = [];
  if (!isObject(plan)) {
    return { ok: false, errors: ["$ must be an object."], warnings };
  }
  for (const field of REQUIRED_FIELDS) if (!isNonEmptyString(plan[field])) errors.push(`Missing required string field: ${field}`);
  if (!Array.isArray(plan.changes) || plan.changes.length === 0) errors.push("At least one simulated change is required.");
  for (const [index, change] of (Array.isArray(plan.changes) ? plan.changes : []).entries()) {
    if (!isObject(change)) {
      errors.push(`changes[${index}] must be an object.`);
      continue;
    }
    if (!isNonEmptyString(change.operation) || !isNonEmptyString(change.record)) errors.push(`change ${index + 1} requires operation and record.`);
    if (!RISK_ORDER.includes(change.risk)) errors.push(`changes[${index}].risk must be low, medium, or high.`);
  }
  if (!Array.isArray(plan.approvals) || plan.approvals.length === 0) warnings.push("No approval checklist items recorded.");
  if (!Array.isArray(plan.rollback) || plan.rollback.length === 0) warnings.push("No rollback notes recorded.");
  validateStringEntries(plan.approvals, "approvals", errors);
  validateStringEntries(plan.rollback, "rollback", errors);
  for (const finding of findSecretLikeValues(plan)) warnings.push(`Secret-looking value at ${finding.path}`);
  return { ok: errors.length === 0, errors, warnings };
}

export function buildReceipt(plan) {
  const validation = validatePlan(plan);
  const source = isObject(plan) ? plan : {};
  const changes = (Array.isArray(source.changes) ? source.changes : []).map((change) => (
    isObject(change) ? { ...change, risk: normalizeRisk(change.risk) } : change
  ));
  const risks = changes.map((change) => isObject(change) ? change.risk : "high");
  const highestRisk = risks.includes("high") ? "high" : risks.includes("medium") ? "medium" : "low";
  return {
    id: source.id,
    connector: source.connector,
    action: source.action,
    target: source.target,
    approvalMode: source.approvalMode,
    highestRisk,
    changes,
    approvals: Array.isArray(source.approvals) ? source.approvals : [],
    rollback: Array.isArray(source.rollback) ? source.rollback : [],
    validation
  };
}

export function renderMarkdown(plan) {
  const receipt = buildReceipt(plan);
  const lines = [`# Connector Dry-Run Receipt: ${receipt.id || "missing id"}`, "", `- Connector: ${receipt.connector || "missing"}`, `- Action: ${receipt.action || "missing"}`, `- Target: ${receipt.target || "missing"}`, `- Approval mode: ${receipt.approvalMode || "missing"}`, `- Highest risk: ${receipt.highestRisk}`, `- Validation: ${receipt.validation.ok ? "pass" : "fail"}`, "", "## Simulated Changes", ""];
  if (!receipt.changes.length) lines.push("- none recorded");
  for (const change of receipt.changes) {
    const entry = isObject(change) ? change : {};
    lines.push(`- ${entry.operation || "missing operation"} ${entry.record || "missing record"} (${entry.risk || "medium"}): ${entry.summary || "no summary"}`);
  }
  lines.push("", "## Approval Checklist", "");
  if (!receipt.approvals.length) lines.push("- none recorded");
  for (const item of receipt.approvals) lines.push(`- ${isNonEmptyString(item) ? item : "invalid approval item"}`);
  lines.push("", "## Rollback Notes", "");
  if (!receipt.rollback.length) lines.push("- none recorded");
  for (const item of receipt.rollback) lines.push(`- ${isNonEmptyString(item) ? item : "invalid rollback item"}`);
  if (receipt.validation.errors.length || receipt.validation.warnings.length) {
    lines.push("", "## Validation Findings", "");
    for (const error of receipt.validation.errors) lines.push(`- error: ${error}`);
    for (const warning of receipt.validation.warnings) lines.push(`- warning: ${warning}`);
  }
  return `${lines.join("\n")}\n`;
}

function findSecretLikeValues(value, path = "$") {
  const findings = [];
  if (typeof value === "string") return SECRET_PATTERNS.some((pattern) => pattern.test(value)) ? [{ path }] : findings;
  if (Array.isArray(value)) value.forEach((entry, index) => findings.push(...findSecretLikeValues(entry, `${path}[${index}]`)));
  else if (value && typeof value === "object") for (const [key, entry] of Object.entries(value)) findings.push(...findSecretLikeValues(entry, `${path}.${key}`));
  return findings;
}

function validateStringEntries(value, field, errors) {
  if (!Array.isArray(value)) return;
  for (const [index, entry] of value.entries()) {
    if (!isNonEmptyString(entry)) errors.push(`${field}[${index}] must be a nonempty string.`);
  }
}

function normalizeRisk(risk) {
  return RISK_ORDER.includes(risk) ? risk : "high";
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
