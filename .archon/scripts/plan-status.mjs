#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const STATE_STATUSES = new Set([
  "manual",
  "pending",
  "in_progress",
  "validation_failed",
  "review_failed",
  "done",
  "blocked",
]);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function stripWrappingQuotes(value) {
  if (typeof value !== "string" || value.length < 2) {
    return value;
  }

  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }

  return value;
}

function normalizeOptionKey(key) {
  return key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      fail(`Unexpected argument: ${token}`);
    }

    const key = normalizeOptionKey(token.slice(2));
    const value = rest[index + 1];
    if (value == null || value.startsWith("--")) {
      fail(`Missing value for --${key}`);
    }

    options[key] = stripWrappingQuotes(value);
    index += 1;
  }

  return { command, options };
}

function loadState(stateFile) {
  const raw = fs.readFileSync(stateFile, "utf8");
  const data = yaml.load(raw);

  if (!data || !Array.isArray(data.steps)) {
    fail(`State file ${stateFile} must contain a top-level "steps" array.`);
  }

  for (const step of data.steps) {
    if (!step.id || !step.title || !step.status) {
      fail(`Each step in ${stateFile} must include id, title, and status.`);
    }

    if (!STATE_STATUSES.has(step.status)) {
      fail(`Unsupported status "${step.status}" in ${stateFile}.`);
    }
  }

  return data;
}

function saveState(stateFile, data) {
  const next = yaml.dump(data, {
    lineWidth: 120,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });

  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, next);
}

function printJson(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function getSelectedStep(data) {
  const priority = ["in_progress", "validation_failed", "review_failed", "blocked", "pending"];

  for (const status of priority) {
    const step = data.steps.find((entry) => entry.status === status);
    if (step) {
      return step;
    }
  }

  return null;
}

function selectStep(stateFile) {
  const data = loadState(stateFile);
  const step = getSelectedStep(data);

  if (!step) {
    printJson({
      hasStep: false,
      stepId: null,
      title: null,
      branch: null,
      action: "none",
      request: null,
      continueMessage: null,
      status: "complete",
    });
    return;
  }

  const action = step.status === "pending" ? "start" : "continue";
  printJson({
    hasStep: true,
    stepId: step.id,
    title: step.title,
    branch: step.branch ?? null,
    action,
    request: step.request ?? "",
    continueMessage:
      step.continueMessage ??
      "Read the latest validation and review artifacts. Fix failures for this step only. Do not start the next plan step.",
    status: step.status,
  });
}

function markRunning(stateFile, stepId) {
  const data = loadState(stateFile);
  const step = data.steps.find((entry) => entry.id === stepId);
  if (!step) {
    fail(`Step ${stepId} not found in ${stateFile}.`);
  }

  const now = new Date().toISOString();
  step.status = "in_progress";
  step.updatedAt = now;
  step.lastAttemptAt = now;

  saveState(stateFile, data);
  printJson({ ok: true, stepId, status: step.status, updatedAt: now });
}

function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return null;
  }

  const content = fs.readFileSync(envPath, "utf8");
  const values = {};

  for (const line of content.split(/\r?\n/)) {
    if (!line || !line.includes("=")) {
      continue;
    }

    const [key, ...rest] = line.split("=");
    values[key.trim()] = rest.join("=").trim();
  }

  return values;
}

function discoverRunRoots() {
  const root = path.join(process.env.HOME ?? "", ".archon", "workspaces");
  if (!root || !fs.existsSync(root)) {
    return [];
  }

  const results = [];
  for (const workspace of fs.readdirSync(root, { withFileTypes: true })) {
    if (!workspace.isDirectory()) {
      continue;
    }

    const runRoot = path.join(root, workspace.name, "crash-cubes", "artifacts", "runs");
    if (fs.existsSync(runRoot)) {
      results.push(runRoot);
    }
  }

  return results;
}

function getRunRoots(runRoot) {
  if (!runRoot || runRoot === "auto") {
    return discoverRunRoots();
  }

  return [runRoot].filter((candidate) => fs.existsSync(candidate));
}

function findLatestRunDir(runRoot, startedAtIso) {
  const runRoots = getRunRoots(runRoot);
  if (runRoots.length === 0) {
    return null;
  }

  const startedAt = Date.parse(startedAtIso);
  if (Number.isNaN(startedAt)) {
    fail(`Invalid --started-at value: ${startedAtIso}`);
  }

  const candidates = runRoots
    .flatMap((currentRoot) =>
      fs
        .readdirSync(currentRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(currentRoot, entry.name)),
    )
    .filter((dir) => fs.existsSync(path.join(dir, "repo-snapshot.md")))
    .map((dir) => ({
      dir,
      mtime: fs.statSync(dir).mtimeMs,
    }))
    .filter((entry) => entry.mtime >= startedAt - 1000)
    .sort((left, right) => right.mtime - left.mtime);

  return candidates[0]?.dir ?? null;
}

function parseReviewVerdict(reviewPath) {
  if (!fs.existsSync(reviewPath)) {
    return null;
  }

  const content = fs.readFileSync(reviewPath, "utf8");
  const verdictLine = content
    .split(/\r?\n/)
    .find((line) => /^Verdict:/i.test(line.trim()));

  if (!verdictLine) {
    return null;
  }

  return verdictLine.split(":").slice(1).join(":").trim().toLowerCase();
}

function ensureNumber(value, fallback = null) {
  if (value == null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function updateAfterRun(stateFile, options) {
  const {
    step: stepId,
    startedAt,
    runRoot,
    exitCode: exitCodeRaw,
    artifactsDir,
  } = options;

  if (!stepId || !startedAt || !runRoot || !artifactsDir) {
    fail("update-after-run requires --step, --started-at, --run-root, and --artifacts-dir.");
  }

  const exitCode = ensureNumber(exitCodeRaw, 1);
  const data = loadState(stateFile);
  const step = data.steps.find((entry) => entry.id === stepId);
  if (!step) {
    fail(`Step ${stepId} not found in ${stateFile}.`);
  }

  const runDir = findLatestRunDir(runRoot, startedAt);
  const finalValidation = runDir
    ? readEnvFile(path.join(runDir, "final-validation", "status.env"))
    : null;
  const validation = runDir
    ? readEnvFile(path.join(runDir, "validation", "status.env"))
    : null;
  const reviewVerdict = runDir ? parseReviewVerdict(path.join(runDir, "review.md")) : null;

  let nextStatus = "blocked";
  if (finalValidation) {
    const test = ensureNumber(finalValidation.test, 1);
    const lint = ensureNumber(finalValidation.lint, 1);
    const build = ensureNumber(finalValidation.build, 1);
    const validationOk = test === 0 && lint === 0 && build === 0;

    if (!validationOk) {
      nextStatus = "validation_failed";
    } else if (reviewVerdict === "needs-follow-up") {
      nextStatus = "review_failed";
    } else if (reviewVerdict === "pass" || reviewVerdict === "pass-with-notes") {
      nextStatus = "done";
    } else {
      nextStatus = "blocked";
    }
  } else if (validation) {
    nextStatus = "validation_failed";
  } else if (exitCode === 0) {
    nextStatus = "blocked";
  }

  const now = new Date().toISOString();
  step.status = nextStatus;
  step.updatedAt = now;
  step.lastExitCode = exitCode;
  step.lastRunArtifacts = runDir;
  step.lastReviewVerdict = reviewVerdict;
  step.lastValidation = finalValidation ?? validation;

  saveState(stateFile, data);

  const summary = {
    ok: true,
    stepId,
    status: nextStatus,
    exitCode,
    runDir,
    reviewVerdict,
    finalValidation,
    validation,
    updatedAt: now,
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(path.join(artifactsDir, "state-update.json"), `${JSON.stringify(summary, null, 2)}\n`);
  printJson(summary);
}

function summary(stateFile) {
  const data = loadState(stateFile);
  const counts = data.steps.reduce(
    (accumulator, step) => {
      accumulator[step.status] = (accumulator[step.status] ?? 0) + 1;
      return accumulator;
    },
    {},
  );

  printJson({
    total: data.steps.length,
    counts,
    nextStep: getSelectedStep(data)?.id ?? null,
  });
}

const { command, options } = parseArgs(process.argv.slice(2));
const stateFile = options.state;

if (!stateFile) {
  fail("Missing required --state <path> option.");
}

switch (command) {
  case "select":
    selectStep(stateFile);
    break;
  case "mark-running":
    markRunning(stateFile, options.step);
    break;
  case "update-after-run":
    updateAfterRun(stateFile, options);
    break;
  case "summary":
    summary(stateFile);
    break;
  default:
    fail(`Unsupported command: ${command}`);
}
