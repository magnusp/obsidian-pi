import { describe, expect, it } from "vitest";
import {
  diagnoseNonoFailure,
  diagnosePiCliFailure,
  formatPiCliFailure,
  isNonoDenial,
  isNonoProfileMissing,
  NODE_RUNTIME_MISSING_MESSAGE,
  PI_CLI_MISSING_MESSAGE
} from "../src/pi/diagnostics.mjs";

describe("Pi CLI diagnostics", () => {
  it("returns an install message when the Pi executable is missing", () => {
    const error = Object.assign(new Error("spawn pi ENOENT"), { code: "ENOENT" });

    const diagnostic = diagnosePiCliFailure({ error });

    expect(diagnostic).toEqual({ kind: "pi-missing", message: PI_CLI_MISSING_MESSAGE });
  });

  it("returns a Node/PATH message when env cannot find node", () => {
    const diagnostic = diagnosePiCliFailure({
      stderr: "/usr/bin/env: node: No such file or directory",
      exitCode: 127
    });

    expect(diagnostic).toEqual({ kind: "node-missing", message: NODE_RUNTIME_MISSING_MESSAGE });
  });

  it("keeps context for generic Pi failures", () => {
    expect(
      formatPiCliFailure({
        context: "Could not query Pi model registry",
        stderr: "provider auth failed",
        exitCode: 1
      })
    ).toBe("Could not query Pi model registry: provider auth failed");
  });
});

describe("nono diagnostics", () => {
  it("recognizes an unresolved profile and points at the profile commands", () => {
    const diagnostic = diagnoseNonoFailure({
      stderr: "nono: Profile not found: obsidian",
      exitCode: 1
    });

    expect(diagnostic.kind).toBe("nono-profile-missing");
    expect(diagnostic.message).toContain("nono profile init");
    expect(diagnostic.message).toContain("nono profile promote");
    expect(isNonoProfileMissing("nono: Profile not found: obsidian")).toBe(true);
  });

  it("reports sandbox denials with nono why remediation", () => {
    expect(isNonoDenial("nono: tool-sandbox denied gh: blocked")).toBe(true);
    expect(isNonoDenial("connect denied for family=2")).toBe(true);
    expect(isNonoDenial("Blocker: denied via policy group default")).toBe(true);

    const diagnostic = diagnoseNonoFailure({
      stderr: "nono: tool-sandbox denied gh: Command 'gh' is blocked",
      exitCode: 1
    });

    expect(diagnostic.kind).toBe("nono-denied");
    expect(diagnostic.message).toContain("nono why --self --path");
    expect(diagnostic.message).toContain("tool-sandbox denied");
  });

  it("does not mistake ordinary agent output for a sandbox denial", () => {
    expect(isNonoDenial("Model refused the request.")).toBe(false);
    expect(isNonoDenial("Error: permission denied opening note")).toBe(false);
  });

  it("keeps context for other nono failures", () => {
    expect(
      diagnoseNonoFailure({ context: "nono profile check", stderr: "boom", exitCode: 2 }).message
    ).toBe("nono profile check: boom");
  });
});
