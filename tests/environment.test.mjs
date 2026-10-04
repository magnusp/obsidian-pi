import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildPiProcessEnv,
  buildPiProcessInvocation,
  buildPiProcessOptions,
  findNonoExecutable,
  findPiExecutable,
  wrapPiInvocationWithNono
} from "../src/pi/environment.mjs";

const originalEnv = {
  HOME: process.env.HOME,
  PATH: process.env.PATH,
  USER: process.env.USER
};
const originalPlatform = process.platform;

afterEach(() => {
  setPlatform(originalPlatform);
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function setPlatform(platform) {
  Object.defineProperty(process, "platform", { configurable: true, value: platform });
}

describe("Pi process environment", () => {
  it("prepends the Pi executable directory so env can find node for GUI launches", () => {
    if (process.platform === "win32") return;

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-env-"));
    const piExecutable = path.join(tempDir, "pi");
    fs.writeFileSync(piExecutable, "");
    process.env.PATH = "/usr/bin";

    const env = buildPiProcessEnv(piExecutable);

    expect(env.PATH.split(path.delimiter)[0]).toBe(tempDir);
  });

  it("uses a configured Pi executable path before auto-detection", () => {
    if (process.platform === "win32") return;

    const piExecutable = path.join(os.tmpdir(), "custom-pi");

    expect(findPiExecutable(piExecutable)).toBe(piExecutable);
  });

  it("expands home and environment variables in configured Pi executable paths", () => {
    if (process.platform === "win32") return;

    process.env.HOME = "/Users/tester";
    process.env.USER = "tester";

    expect(findPiExecutable("~/bin/pi")).toBe(path.join("/Users/tester", "bin", "pi"));
    expect(findPiExecutable("/etc/profiles/per-user/${USER}/bin/pi")).toBe(
      "/etc/profiles/per-user/tester/bin/pi"
    );
  });

  it("runs Pi launchers through cmd.exe on Windows so .cmd resolution works on Node 24+", () => {
    setPlatform("win32");

    expect(buildPiProcessInvocation("pi", ["--version"], { timeout: 1000 })).toMatchObject({
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", '""pi" "--version""'],
      options: {
        env: process.env,
        timeout: 1000,
        windowsVerbatimArguments: true
      }
    });
  });

  it("quotes Windows command arguments without backslash-escaped quotes", () => {
    setPlatform("win32");

    expect(buildPiProcessInvocation("pi.cmd", ['say "hi"']).args[3]).toBe(
      '""pi.cmd" "say ""hi""""'
    );
  });

  it("preserves spaces in Windows executable and argument paths", () => {
    setPlatform("win32");

    expect(
      buildPiProcessInvocation("C:\\Program Files\\nodejs\\pi.cmd", [
        "--session",
        "C:\\Users\\Test User\\Vault\\pi sessions\\chat.jsonl"
      ]).args[3]
    ).toBe(
      '""C:\\Program Files\\nodejs\\pi.cmd" "--session" "C:\\Users\\Test User\\Vault\\pi sessions\\chat.jsonl""'
    );
  });

  it("does not use a shell for Pi processes on POSIX", () => {
    setPlatform("darwin");

    expect(buildPiProcessOptions("pi", { timeout: 1000 })).not.toHaveProperty("shell");
  });
});

describe("nono discovery and invocation wrapping", () => {
  it("finds nono on PATH instead of assuming a command name", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nono-path-"));
    const nonoExecutable = path.join(tempDir, "nono");
    fs.writeFileSync(nonoExecutable, "");
    process.env.PATH = tempDir;

    expect(findNonoExecutable()).toBe(nonoExecutable);
    expect(findNonoExecutable("/opt/custom/nono")).toBe("/opt/custom/nono");
    expect(findNonoExecutable("~/bin/nono")).toBe(path.join(process.env.HOME, "bin", "nono"));
  });

  it("returns null when nono is not installed", () => {
    const systemNono = ["/usr/local/bin/nono", "/usr/bin/nono", "/opt/homebrew/bin/nono"].some(
      (candidate) => fs.existsSync(candidate)
    );
    if (systemNono) return;

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nono-empty-"));
    process.env.PATH = tempDir;

    expect(findNonoExecutable()).toBeNull();
  });

  it("wraps Pi with a silent nono run for the configured profile", () => {
    expect(wrapPiInvocationWithNono({ command: "pi", args: ["--mode", "rpc"] }, {
      command: "/usr/local/bin/nono",
      profile: "obsidian"
    })).toEqual({
      command: "/usr/local/bin/nono",
      args: [
        "run",
        "--silent",
        "--profile",
        "obsidian",
        "--allow-cwd",
        "--",
        "pi",
        "--mode",
        "rpc"
      ]
    });
  });

  it("leaves the invocation unwrapped without a resolved nono command or profile", () => {
    expect(wrapPiInvocationWithNono({ command: "pi", args: [] }, undefined)).toEqual({
      command: "pi",
      args: []
    });
    expect(
      wrapPiInvocationWithNono({ command: "pi", args: [] }, { command: "/nono", profile: "  " })
    ).toEqual({ command: "pi", args: [] });
  });

  it("builds a wrapped Pi invocation with a nono-ready PATH", () => {
    if (process.platform === "win32") return;

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nono-bin-"));
    const nonoExecutable = path.join(tempDir, "nono");
    fs.writeFileSync(nonoExecutable, "");

    const invocation = buildPiProcessInvocation("/usr/local/bin/pi", ["--version"], {
      nono: { command: nonoExecutable, profile: "obsidian" }
    });

    expect(invocation.command).toBe(nonoExecutable);
    expect(invocation.args).toEqual([
      "run",
      "--silent",
      "--profile",
      "obsidian",
      "--allow-cwd",
      "--",
      "/usr/local/bin/pi",
      "--version"
    ]);
    expect(invocation.options.env.PATH.split(path.delimiter)).toContain(tempDir);
    expect(invocation.options).not.toHaveProperty("nono");
  });

  it("quotes the whole wrapped command for the Windows command shell", () => {
    setPlatform("win32");

    expect(
      buildPiProcessInvocation("pi", ["--version"], {
        nono: { command: "C:\\tools\\nono.cmd", profile: "obsidian" }
      }).args[3]
    ).toBe(
      '""C:\\tools\\nono.cmd" "run" "--silent" "--profile" "obsidian" "--allow-cwd" "--" "pi" "--version""'
    );
  });
});
