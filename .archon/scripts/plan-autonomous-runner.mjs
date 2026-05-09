#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const rest = argv;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      fail(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = rest[index + 1];
    if (value == null || value.startsWith("--")) {
      fail(`Missing value for --${key}`);
    }

    options[key] = value;
    index += 1;
  }

  return options;
}

function branchToSlug(branch) {
  return branch.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  return {
    exitCode: result.status ?? 1,
    stdout,
    stderr,
    output: `${stdout}${stderr}`.trim(),
  };
}

function runNodePlanStatus(cwd, args) {
  const result = runCommand("node", [".archon/scripts/plan-status.mjs", ...args], cwd);
  if (result.exitCode !== 0) {
    throw new Error(result.output || `plan-status command failed: ${args.join(" ")}`);
  }

  return JSON.parse(result.stdout.trim());
}

function queryActiveWorkflows(cwd) {
  const result = runCommand("archon", ["workflow", "status"], cwd);
  if (result.exitCode !== 0) {
    return [];
  }

  const lines = result.stdout.split(/\r?\n/);
  const workflows = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("ID:")) {
      if (current) {
        workflows.push(current);
      }

      current = { id: line.slice(3).trim() };
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith("Name:")) {
      current.name = line.slice(5).trim();
    } else if (line.startsWith("Path:")) {
      current.path = line.slice(5).trim();
    } else if (line.startsWith("Status:")) {
      current.status = line.slice(7).trim();
    }
  }

  if (current) {
    workflows.push(current);
  }

  return workflows;
}

function hasActiveWorkflowForBranch(cwd, workflowName, branch) {
  const slug = `task-${branchToSlug(branch)}`;
  return queryActiveWorkflows(cwd).some(
    (workflow) => workflow.name === workflowName && workflow.path?.includes(`/${slug}`),
  );
}

function worktreeExists(cwd, branch) {
  const result = runCommand("archon", ["isolation", "list"], cwd);
  if (result.exitCode !== 0) {
    return false;
  }

  return result.stdout.includes(`task-${branchToSlug(branch)}`);
}

function chooseAttemptOrder(step, hasWorktree) {
  if (hasWorktree) {
    return ["continue", "start"];
  }

  if (step.status === "pending") {
    return ["start", "continue"];
  }

  return ["continue", "start"];
}

function shouldFallback(mode, output) {
  if (mode === "continue" && /No active worktree found/i.test(output)) {
    return true;
  }

  if (
    mode === "start" &&
    /(already exists|already active|existing worktree|already checked out|already being used)/i.test(output)
  ) {
    return true;
  }

  return false;
}

function executeChildWorkflow({ cwd, childWorkflow, step, attemptDir, log }) {
  const hasWorktree = worktreeExists(cwd, step.branch);
  const attemptOrder = chooseAttemptOrder(step, hasWorktree);
  let lastResult = null;
  let selectedMode = attemptOrder[0];

  for (const mode of attemptOrder) {
    selectedMode = mode;
    const args =
      mode === "start"
        ? ["workflow", "run", childWorkflow, "--branch", step.branch, "--from", "main", step.request]
        : ["continue", step.branch, "--workflow", childWorkflow, step.continueMessage];

    log(`Running child workflow via ${mode}: archon ${args.slice(0, -1).join(" ")} <message>`);
    const result = runCommand("archon", args, cwd);
    const logPath = path.join(attemptDir, `child-${mode}.log`);
    fs.writeFileSync(logPath, `${result.output}\n`);
    lastResult = { ...result, mode, logPath };

    if (result.exitCode === 0 || !shouldFallback(mode, result.output)) {
      break;
    }

    log(`Fallback from ${mode} after infrastructure error.`);
  }

  return { ...lastResult, selectedMode };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function appendLog(logFile, message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const stateFile = options.state;
  const childWorkflow = options.workflow ?? "crash-cubes-dev";
  const artifactsDir = options.artifactsDir;
  const maxHours = Number(options.maxHours ?? "8");
  const pollSeconds = Number(options.pollSeconds ?? "60");
  const maxIterations = Number(options.maxIterations ?? "999");

  if (!stateFile || !artifactsDir) {
    fail("Required options: --state <path> --artifacts-dir <path>");
  }

  ensureDir(artifactsDir);
  const attemptsRoot = path.join(artifactsDir, "attempts");
  ensureDir(attemptsRoot);
  const runnerLog = path.join(artifactsDir, "runner.log");
  const reportPath = path.join(artifactsDir, "runner-report.json");

  const startedAt = new Date();
  const deadline = startedAt.getTime() + maxHours * 60 * 60 * 1000;
  const report = {
    startedAt: startedAt.toISOString(),
    deadline: new Date(deadline).toISOString(),
    maxHours,
    pollSeconds,
    maxIterations,
    iterations: [],
    completed: false,
  };

  appendLog(runnerLog, `Autonomous runner started. Deadline ${report.deadline}.`);

  for (let iteration = 1; iteration <= maxIterations && Date.now() < deadline; iteration += 1) {
    const step = runNodePlanStatus(cwd, ["select", "--state", stateFile]);
    if (!step.hasStep) {
      report.completed = true;
      appendLog(runnerLog, "No remaining actionable steps.");
      break;
    }

    const iterationDir = path.join(attemptsRoot, `${String(iteration).padStart(3, "0")}-${step.stepId}`);
    ensureDir(iterationDir);
    const record = {
      iteration,
      stepId: step.stepId,
      branch: step.branch,
      initialStatus: step.status,
      startedAt: new Date().toISOString(),
    };
    report.iterations.push(record);
    fs.writeFileSync(path.join(iterationDir, "selected-step.json"), `${JSON.stringify(step, null, 2)}\n`);

    if (hasActiveWorkflowForBranch(cwd, childWorkflow, step.branch)) {
      record.action = "wait-active-workflow";
      appendLog(runnerLog, `Step ${step.stepId}: child workflow already active for ${step.branch}; waiting ${pollSeconds}s.`);
      fs.writeFileSync(path.join(iterationDir, "wait-reason.txt"), "active child workflow\n");
      sleep(pollSeconds * 1000);
      continue;
    }

    runNodePlanStatus(cwd, ["mark-running", "--state", stateFile, "--step", step.stepId]);
    const childStartedAt = new Date().toISOString();
    fs.writeFileSync(path.join(iterationDir, "started-at.txt"), `${childStartedAt}\n`);

    const childResult = executeChildWorkflow({
      cwd,
      childWorkflow,
      step,
      attemptDir: iterationDir,
      log: (message) => appendLog(runnerLog, `Step ${step.stepId}: ${message}`),
    });

    record.action = childResult.mode;
    record.childExitCode = childResult.exitCode;
    record.childLog = childResult.logPath;

    const update = runNodePlanStatus(cwd, [
      "update-after-run",
      "--state",
      stateFile,
      "--step",
      step.stepId,
      "--started-at",
      childStartedAt,
      "--run-root",
      "auto",
      "--artifacts-dir",
      iterationDir,
      "--exit-code",
      String(childResult.exitCode),
    ]);

    record.result = update;
    appendLog(
      runnerLog,
      `Step ${step.stepId}: finished with status ${update.status} (exit=${childResult.exitCode}, review=${update.reviewVerdict ?? "n/a"}).`,
    );

    if (update.status === "blocked") {
      appendLog(runnerLog, `Step ${step.stepId}: blocked; sleeping ${pollSeconds}s before retry.`);
      sleep(pollSeconds * 1000);
    }
  }

  report.finishedAt = new Date().toISOString();
  report.finalSummary = runNodePlanStatus(cwd, ["summary", "--state", stateFile]);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  appendLog(runnerLog, `Autonomous runner finished. Completed=${report.completed}.`);

  process.stdout.write(`${JSON.stringify({ report: reportPath, summary: report.finalSummary })}\n`);
}

main();
