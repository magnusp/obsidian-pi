import { spawnSync } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkNonoSetup,
  DEFAULT_NONO_PROFILE,
  NONO_PROFILE_REQUIRED_MESSAGE,
  normalizeProfileName,
  resolveNonoWrapper
} from "../src/pi/nono.mjs";

vi.mock("node:child_process", async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, spawnSync: vi.fn() };
});

const NONO_EXECUTABLE = "/usr/local/bin/nono";

beforeEach(() => {
  spawnSync.mockReset();
});

describe("nono wrapper resolution", () => {
  it("auto-enables a resolved profile without explicit opt-in", () => {
    expect(resolveNonoWrapper({ nonoProfile: DEFAULT_NONO_PROFILE }, NONO_EXECUTABLE)).toEqual({
      state: "enabled",
      command: NONO_EXECUTABLE,
      profile: DEFAULT_NONO_PROFILE,
      message: `nono profile: ${DEFAULT_NONO_PROFILE}`
    });
  });

  it("reports a missing sandbox instead of assuming a command name", () => {
    expect(resolveNonoWrapper({}, null)).toEqual({
      state: "missing",
      message: expect.stringContaining("nono was not found on PATH")
    });
  });

  it("skips the sandbox when the user turns it off", () => {
    const wrapper = resolveNonoWrapper(
      { nonoEnabled: false, nonoProfile: "obsidian" },
      NONO_EXECUTABLE
    );

    expect(wrapper.state).toBe("disabled");
    expect(wrapper.command).toBeUndefined();
  });

  it("blocks a blank profile rather than launching Pi unsandboxed", () => {
    expect(resolveNonoWrapper({ nonoProfile: "   " }, NONO_EXECUTABLE)).toEqual({
      state: "profile-required",
      message: NONO_PROFILE_REQUIRED_MESSAGE
    });
  });

  it("trims profile names and defaults the profile constant", () => {
    expect(normalizeProfileName("  obsidian  ")).toBe("obsidian");
    expect(normalizeProfileName(undefined)).toBe("");
    expect(DEFAULT_NONO_PROFILE).toBe("obsidian");
  });
});

describe("nono setup check", () => {
  it("validates the profile through nono itself", () => {
    spawnSync.mockReturnValue({ status: 0, stdout: "{}", stderr: "" });

    expect(
      checkNonoSetup({ nonoProfile: "obsidian" }, NONO_EXECUTABLE)
    ).toMatchObject({ state: "enabled", ok: true });
    expect(spawnSync.mock.calls[0][0]).toBe(NONO_EXECUTABLE);
    expect(spawnSync.mock.calls[0][1]).toEqual(["profile", "show", "obsidian"]);
  });

  it("surfaces an unresolvable profile as an actionable message", () => {
    spawnSync.mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "nono: Profile not found: obsidian\n"
    });

    const result = checkNonoSetup({ nonoProfile: "obsidian" }, NONO_EXECUTABLE);

    expect(result.ok).toBe(false);
    expect(result.message).toContain("nono profile init");
  });

  it("does not run nono when it is absent or disabled", () => {
    checkNonoSetup({}, null);
    checkNonoSetup({ nonoEnabled: false }, NONO_EXECUTABLE);

    expect(spawnSync).not.toHaveBeenCalled();
  });
});