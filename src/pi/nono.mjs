import { spawnSync } from "node:child_process";
import { buildPiProcessInvocation, findNonoExecutable } from "./environment.mjs";
import { diagnoseNonoFailure } from "./diagnostics.mjs";

export const DEFAULT_NONO_PROFILE = "obsidian";

export const NONO_MISSING_MESSAGE =
  "nono was not found on PATH. Pi Agent launches Pi directly unless a nono executable is available.";

export const NONO_PROFILE_REQUIRED_MESSAGE = `Pi Agent runs Pi inside nono, so a nono profile name is required. Set one in Settings > Pi Agent > Pi CLI, for example "${DEFAULT_NONO_PROFILE}".`;

export const NONO_PROFILE_UNRESOLVED_MESSAGE =
  "Create it with `nono profile init <name>`, then apply it with `nono profile promote <name>`.";

// State values are shared with the settings tab and the run error text.
export const NONO_STATE_ENABLED = "enabled";
export const NONO_STATE_DISABLED = "disabled";
export const NONO_STATE_MISSING = "missing";
export const NONO_STATE_PROFILE_REQUIRED = "profile-required";

export function resolveNonoWrapper(
  settings = {},
  // Default-parameter evaluation (not ??) so an explicit null means "not installed".
  executable = findNonoExecutable(settings.nonoExecutablePath)
) {
  if (!executable) return { state: NONO_STATE_MISSING, message: NONO_MISSING_MESSAGE };
  if (settings.nonoEnabled === false) {
    return { state: NONO_STATE_DISABLED, message: "Pi runs without a nono sandbox." };
  }

  const profile = normalizeProfileName(settings.nonoProfile);
  if (!profile) {
    return { state: NONO_STATE_PROFILE_REQUIRED, message: NONO_PROFILE_REQUIRED_MESSAGE };
  }

  return {
    state: NONO_STATE_ENABLED,
    command: executable,
    profile,
    message: `nono profile: ${profile}`
  };
}

export function normalizeProfileName(profile) {
  return typeof profile === "string" ? profile.trim() : "";
}

// Resolves the profile through nono itself so a typo surfaces before a run wastes a
// model request, instead of after Pi fails to start inside the sandbox.
export function checkNonoSetup(settings = {}, executable) {
  const wrapper = resolveNonoWrapper(settings, executable);
  if (wrapper.state === NONO_STATE_MISSING || wrapper.state === NONO_STATE_DISABLED) return wrapper;

  const invocation = buildPiProcessInvocation(
    wrapper.command,
    ["profile", "show", wrapper.profile],
    {
      silent: true,
      windowsHide: true
    }
  );
  const result = spawnSync(invocation.command, invocation.args, {
    ...invocation.options,
    encoding: "utf8",
    timeout: 5000
  });

  if (result.error) {
    return {
      ...wrapper,
      ok: false,
      message: `Could not run ${wrapper.command}: ${result.error.message}`
    };
  }

  if (result.status !== 0) {
    const diagnostic = diagnoseNonoFailure({
      stderr: result.stderr,
      stdout: result.stdout,
      exitCode: result.status
    });
    return { ...wrapper, ok: false, message: diagnostic.message };
  }

  return { ...wrapper, ok: true, message: `nono profile "${wrapper.profile}" is available.` };
}
