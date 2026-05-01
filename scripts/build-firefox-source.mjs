import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const firefoxOutputDirectory = join(repositoryRoot, "Extensions", "combined", "dist", "firefox");
const firefoxManifestPath = join(firefoxOutputDirectory, "manifest.json");
const contentScriptPath = join(firefoxOutputDirectory, "ryd.content-script.js");
const maxContentScriptBytes = 5 * 1024 * 1024;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const shouldUseShell = process.platform === "win32";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      ...options.env,
    },
    stdio: "inherit",
    shell: shouldUseShell,
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function readCommandOutput(command, args) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    shell: shouldUseShell,
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }

  return result.stdout.trim();
}

function verifyFileExists(filePath, description) {
  if (!existsSync(filePath)) {
    throw new Error(`${description} was not generated at ${filePath}`);
  }
}

console.log(`Node.js: ${process.version}`);
console.log(`npm: ${readCommandOutput(npmCommand, ["--version"])}`);

console.log("Installing dependencies...");
run(npmCommand, ["ci"], {
  env: {
    HUSKY: "0",
  },
});

console.log("Building Firefox extension output...");
run(npmCommand, ["run", "build"]);

verifyFileExists(firefoxManifestPath, "Firefox manifest");
verifyFileExists(contentScriptPath, "Firefox content script");

const contentScriptSize = statSync(contentScriptPath).size;
if (contentScriptSize >= maxContentScriptBytes) {
  throw new Error(`ryd.content-script.js is ${contentScriptSize} bytes, expected less than ${maxContentScriptBytes}`);
}

const contentScript = readFileSync(contentScriptPath, "utf8");
if (contentScript.includes("sourceMappingURL")) {
  throw new Error("ryd.content-script.js contains a source map reference");
}

console.log(`Firefox output: ${firefoxOutputDirectory}`);
console.log(`ryd.content-script.js: ${contentScriptSize} bytes`);
console.log("AMO source build completed successfully.");
