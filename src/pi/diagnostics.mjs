const PI_INSTALL_COMMAND = "npm install -g @earendil-works/pi-coding-agent";

export const PI_CLI_MISSING_MESSAGE = `Pi CLI was not found. Install it with \`${PI_INSTALL_COMMAND}\`, then restart Obsidian so it can find \`pi\` on PATH.`;

export const NODE_RUNTIME_MISSING_MESSAGE =
  "Pi CLI was found, but Node.js is not available to Obsidian. Install Node.js, then fully restart Obsidian. If you use nvm, fnm, asdf, or another version manager, make sure its Node bin directory is available to GUI apps or install Node with Homebrew/the official installer.";

const NODE_RUNTIME_MISSING_PATTERNS = [
  /env:\s*node:\s*No such file or directory/i,
  /usr\/bin\/env:\s*['"]?node['"]?:\s*No such file or directory/i,
  /\/usr\/bin\/env:\s*node:\s*No such file or directory/i,
  /spawn\s+node\s+ENOENT/i
];

const NONO_PROFILE_MISSING_PATTERNS = [/nono:\s*profile not found/i, /unknown profile/i];

const NONO_DENIAL_PATTERNS = [
  /nono:\s*tool-sandbox denied/i,
  /\bdenied via\b/i,
  /\bdenied for family=/i,
  /\bdenied:\s/i,
  /endpoint denied by policy/i,
  /\bapproval denied\b/i,
  /blocked by policy group/i,
  /blocked by trust policy/i
];

const NONO_DENIAL_REMEDIATION =
  "Run `nono why --self --path <path> --op read|write` to see which grants cover that path, then widen the profile with `nono profile promote <name>`.";

const NONO_PROFILE_UNRESOLVED_HINT =
  "Create it with `nono profile init <name>`, then apply it with `nono profile promote <name>`.";

export function createPiCliError(options = {}) {
  return new Error(formatPiCliFailure(options));
}

export function formatPiCliFailure(options = {}) {
  return diagnosePiCliFailure(options).message;
}

export function diagnosePiCliFailure({
  context = "Could not run Pi CLI",
  error,
  stderr,
  stdout,
  exitCode
} = {}) {
  const text = getCombinedErrorText(error, stderr, stdout);

  if (isPiCliMissing(error)) return { kind: "pi-missing", message: PI_CLI_MISSING_MESSAGE };
  if (isNodeRuntimeMissing(text)) {
    return { kind: "node-missing", message: NODE_RUNTIME_MISSING_MESSAGE };
  }

  const detail =
    text || (typeof exitCode === "number" ? `Pi exited with code ${exitCode}.` : "Unknown error.");
  return { kind: "generic", message: `${context}: ${detail}` };
}

export function isNodeRuntimeMissing(text = "") {
  return NODE_RUNTIME_MISSING_PATTERNS.some((pattern) => pattern.test(text));
}

export function isPiCliMissing(error) {
  return error && error.code === "ENOENT";
}

export function diagnoseNonoFailure({
  context = "nono failed",
  error,
  stderr,
  stdout,
  exitCode
} = {}) {
  const text = getCombinedErrorText(error, stderr, stdout);

  if (isNonoProfileMissing(text)) {
    return {
      kind: "nono-profile-missing",
      message: `nono could not resolve the configured profile. ${NONO_PROFILE_UNRESOLVED_HINT}`
    };
  }
  if (isNonoDenial(text)) {
    return {
      kind: "nono-denied",
      message: `nono denied an operation the agent attempted. ${NONO_DENIAL_REMEDIATION}\n${text}`
    };
  }

  const detail =
    text ||
    (typeof exitCode === "number" ? `nono exited with code ${exitCode}.` : "Unknown error.");
  return { kind: "generic", message: `${context}: ${detail}` };
}

export function isNonoProfileMissing(text = "") {
  return NONO_PROFILE_MISSING_PATTERNS.some((pattern) => pattern.test(text));
}

export function isNonoDenial(text = "") {
  return NONO_DENIAL_PATTERNS.some((pattern) => pattern.test(text));
}

function getCombinedErrorText(error, stderr, stdout) {
  return [getErrorMessage(error), stderr, stdout]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join("\n");
}

function getErrorMessage(error) {
  if (!error) return "";
  return error instanceof Error ? error.message : String(error);
}
