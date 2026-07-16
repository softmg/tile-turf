import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const isWindows = process.platform === "win32";

const resolveCommand = (command) => {
  const result = spawnSync(isWindows ? "where" : "command", isWindows ? [command] : ["-v", command], {
    encoding: "utf8",
    shell: !isWindows,
  });
  if (result.status !== 0) return null;
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
};

const bunCommand = resolveCommand("bun");
const npmCommand = resolveCommand(isWindows ? "npm.cmd" : "npm");
const npmCli = npmCommand
  ? path.join(path.dirname(npmCommand), "node_modules", "npm", "bin", "npm-cli.js")
  : null;
const scriptRunner = bunCommand ?? (npmCli && existsSync(npmCli) ? process.execPath : npmCommand);
const scriptRunnerPrefix = bunCommand ? [] : npmCli && existsSync(npmCli) ? [npmCli] : [];

if (!scriptRunner) {
  console.error("Neither bun nor npm was found in PATH.");
  process.exit(1);
}

const scriptRunnerLabel = bunCommand ? "bun" : "npm";

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: "inherit", shell: options.shell ?? false });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
};

console.log(`Packaging Yandex build with ${scriptRunnerLabel}.`);

run(scriptRunner, [...scriptRunnerPrefix, "run", "typecheck"]);
run(scriptRunner, [...scriptRunnerPrefix, "run", "build:yandex"]);
run(scriptRunner, [...scriptRunnerPrefix, "run", "validate:yandex"]);
run(process.execPath, ["scripts/package-yandex.js"]);
run(process.execPath, ["scripts/validate-yandex-archive.js"]);
