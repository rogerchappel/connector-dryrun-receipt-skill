import fs from "node:fs";

const REQUIRED_FIELDS = ["id", "connector", "action", "target", "approvalMode"];
const REQUIRED_FIELD_PLACEHOLDERS = Object.fromEntries(REQUIRED_FIELDS.map((field) => [field, `missing ${field}`]));
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
    if (!isNonEmptyString(change.operation)) errors.push(`changes[${index}].operation must be a nonempty string.`);
    if (!isNonEmptyString(change.record)) errors.push(`changes[${index}].record must be a nonempty string.`);
    if (Object.hasOwn(change, "summary") && typeof change.summary !== "string") {
      errors.push(`changes[${index}].summary must be a string when present.`);
    }
    if (!RISK_ORDER.includes(change.risk)) errors.push(`changes[${index}].risk must be low, medium, or high.`);
  }
  validateStringArrayField(plan, "approvals", "No approval checklist items recorded.", errors, warnings);
  validateStringArrayField(plan, "rollback", "No rollback notes recorded.", errors, warnings);
  for (const finding of findSecretLikeValues(plan)) warnings.push(`Secret-looking value at ${finding.path}`);
  return { ok: errors.length === 0, errors, warnings };
}

export function buildReceipt(plan) {
  const validation = validatePlan(plan);
  const source = isObject(plan) ? plan : {};
  const changes = (Array.isArray(source.changes) ? source.changes : []).map(normalizeChange);
  const risks = changes.map((change) => isObject(change) ? change.risk : "high");
  const highestRisk = risks.length === 0 || risks.includes("high") ? "high" : risks.includes("medium") ? "medium" : "low";
  return {
    ...Object.fromEntries(REQUIRED_FIELDS.map((field) => [
      field,
      isNonEmptyString(source[field]) ? source[field] : REQUIRED_FIELD_PLACEHOLDERS[field]
    ])),
    highestRisk,
    changes,
    approvals: normalizeStringEntries(source.approvals, "invalid approval item"),
    rollback: normalizeStringEntries(source.rollback, "invalid rollback item"),
    validation
  };
}

export function renderMarkdown(plan) {
  const receipt = buildReceipt(plan);
  const literal = (value) => renderMarkdownLiteral(value);
  const lines = [`# Connector Dry-Run Receipt: ${literal(receipt.id || "missing id")}`, "", `- Connector: ${literal(receipt.connector || "missing")}`, `- Action: ${literal(receipt.action || "missing")}`, `- Target: ${literal(receipt.target || "missing")}`, `- Approval mode: ${literal(receipt.approvalMode || "missing")}`, `- Highest risk: ${literal(receipt.highestRisk)}`, `- Validation: ${receipt.validation.ok ? "pass" : "fail"}`, "", "## Simulated Changes", ""];
  if (!receipt.changes.length) lines.push("- none recorded");
  for (const change of receipt.changes) {
    const entry = isObject(change) ? change : {};
    lines.push(`- ${literal(entry.operation || "missing operation")} ${literal(entry.record || "missing record")} (${literal(entry.risk || "medium")}): ${literal(entry.summary || "no summary")}`);
  }
  lines.push("", "## Approval Checklist", "");
  if (!receipt.approvals.length) lines.push("- none recorded");
  for (const item of receipt.approvals) lines.push(`- ${literal(isNonEmptyString(item) ? item : "invalid approval item")}`);
  lines.push("", "## Rollback Notes", "");
  if (!receipt.rollback.length) lines.push("- none recorded");
  for (const item of receipt.rollback) lines.push(`- ${literal(isNonEmptyString(item) ? item : "invalid rollback item")}`);
  if (receipt.validation.errors.length || receipt.validation.warnings.length) {
    lines.push("", "## Validation Findings", "");
    for (const error of receipt.validation.errors) lines.push(`- error: ${error}`);
    for (const warning of receipt.validation.warnings) lines.push(`- warning: ${literal(warning)}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderMarkdownLiteral(value) {
  return String(value)
    .replace(/[\r\n\u2028\u2029]+/g, " ")
    .replace(/[\t\f\v ]+/g, " ")
    .trim()
    .replace(/([\\`*_[\]{}<>()|])/g, "\\$1");
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

function validateStringArrayField(plan, field, emptyWarning, errors, warnings) {
  if (!Object.hasOwn(plan, field)) {
    warnings.push(emptyWarning);
    return;
  }
  if (!Array.isArray(plan[field])) {
    errors.push(`${field} must be an array when present.`);
    return;
  }
  if (plan[field].length === 0) warnings.push(emptyWarning);
  validateStringEntries(plan[field], field, errors);
}

function normalizeRisk(risk) {
  return RISK_ORDER.includes(risk) ? risk : "high";
}

function normalizeChange(change) {
  if (!isObject(change)) return change;
  return {
    ...change,
    operation: isNonEmptyString(change.operation) ? change.operation : "missing operation",
    record: isNonEmptyString(change.record) ? change.record : "missing record",
    risk: normalizeRisk(change.risk),
    summary: isNonEmptyString(change.summary) ? change.summary : "no summary"
  };
}

function normalizeStringEntries(value, placeholder) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => isNonEmptyString(entry) ? entry : placeholder);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
