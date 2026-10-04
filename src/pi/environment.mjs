import fs from "node:fs";
import path from "node:path";

const POSIX_PI_CANDIDATES = ["/opt/homebrew/bin/pi", "/usr/local/bin/pi", "/usr/bin/pi"];
const WINDOWS_PI_CANDIDATES = ["pi.cmd", "pi.exe", "pi"];
const POSIX_NONO_CANDIDATES = ["nono"];
const WINDOWS_NONO_CANDIDATES = ["nono.cmd", "nono.exe", "nono"];
const POSIX_PATH_CANDIDATES = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin"
];

export function findPiExecutable(configuredPath = "") {
  const configuredExecutable = normalizePiExecutablePath(configuredPath);
  if (configuredExecutable) return configuredExecutable;
  if (process.platform === "win32") return WINDOWS_PI_CANDIDATES[0];

  for (const candidate of POSIX_PI_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const piNode = findPiNodeExecutable();
  if (piNode) return piNode;

  return "pi";
}

// nono is detected rather than assumed: unlike Pi, an absent sandbox binary must not
// change how Pi launches, so this returns null instead of a bare command name.
export function findNonoExecutable(configuredPath = "") {
  const configuredExecutable = normalizePiExecutablePath(configuredPath);
  if (configuredExecutable) return configuredExecutable;

  const candidates = process.platform === "win32" ? WINDOWS_NONO_CANDIDATES : POSIX_NONO_CANDIDATES;
  // PATH entries come first: when a GUI app inherits a PATH that already resolves
  // nono, that install wins over a possibly stale system directory.
  const directories = uniqueExistingDirectories([
    ...getExistingPathEntries(),
    ...POSIX_PATH_CANDIDATES,
    ...getNodeVersionManagerDirectories()
  ]);

  for (const directory of directories) {
    for (const candidate of candidates) {
      const executable = path.join(directory, candidate);
      if (fs.existsSync(executable)) return executable;
    }
  }

  return null;
}

export function normalizePiExecutablePath(executablePath) {
  const normalizedPath = typeof executablePath === "string" ? executablePath.trim() : "";
  if (!normalizedPath) return "";

  return expandEnvironmentVariables(expandHomeDirectory(normalizedPath));
}

function expandHomeDirectory(executablePath) {
  const home = process.env.HOME;
  if (!home) return executablePath;
  if (executablePath === "~") return home;
  return executablePath.startsWith(`~${path.sep}`)
    ? path.join(home, executablePath.slice(2))
    : executablePath;
}

function expandEnvironmentVariables(executablePath) {
  return executablePath.replace(/\$(\w+)|\$\{([^}]+)\}/g, (match, name, bracedName) => {
    const value = process.env[name || bracedName];
    return value === undefined ? match : value;
  });
}

function findPiNodeExecutable() {
  const home = process.env.HOME;
  if (!home) return null;

  const root = path.join(home, ".local", "share", "pi-node");

  try {
    const versions = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(root, d.name));

    for (const v of versions) {
      const candidate = path.join(v, "bin", "pi");
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {
    return null;
  }

  return null;
}

export function buildPiProcessInvocation(piExecutable, args = [], options = {}) {
  const processOptions = buildPiProcessOptions(piExecutable, options);
  const target = wrapPiInvocationWithNono({ command: piExecutable, args }, options.nono);

  return shouldUseWindowsCommandShell(target.command)
    ? {
        command: process.env.ComSpec || "cmd.exe",
        args: ["/d", "/s", "/c", quoteWindowsCommand([target.command, ...target.args])],
        options: {
          ...processOptions,
          windowsVerbatimArguments: true
        }
      }
    : {
        command: target.command,
        args: target.args,
        options: processOptions
      };
}

// Wrapping happens here, in the single place every Pi launch passes through, so the
// RPC client, one-shot runs, and health checks cannot drift apart on sandbox behavior.
export function wrapPiInvocationWithNono({ command, args }, nono) {
  const profile = typeof nono?.profile === "string" ? nono.profile.trim() : "";
  if (!nono?.command || !profile) return { command, args };

  return {
    command: nono.command,
    // nono refuses any CWD access in non-interactive mode, and Pi runs with the
    // vault as its working directory. --allow-cwd only authorizes the profile's
    // configured level (read-only unless the profile raises it), so the profile
    // still decides how much Pi can reach.
    args: ["run", "--silent", "--profile", profile, "--allow-cwd", "--", command, ...args]
  };
}

export function buildPiProcessOptions(piExecutable = findPiExecutable(), options = {}) {
  const { nono, ...spawnOptions } = options;

  return {
    ...spawnOptions,
    env: buildPiProcessEnv(piExecutable, nono?.command ? [nono.command] : [])
  };
}

export function buildPiProcessEnv(piExecutable = findPiExecutable(), extraExecutables = []) {
  if (process.platform === "win32") return process.env;

  return {
    ...process.env,
    PATH: buildPosixPath(piExecutable, extraExecutables)
  };
}

function shouldUseWindowsCommandShell(piExecutable) {
  return process.platform === "win32" && !/\.exe$/i.test(piExecutable);
}

function quoteWindowsCommand(parts) {
  const command = parts.map((part) => `"${String(part).replace(/"/g, '""')}"`).join(" ");
  // cmd.exe /s strips the first and last quote from the /c command string.
  // Add an outer quote pair so the inner executable/argument quotes survive parsing.
  return `"${command}"`;
}

function buildPosixPath(piExecutable, extraExecutables = []) {
  return uniqueExistingDirectories([
    ...getExecutableDirectory(piExecutable),
    ...extraExecutables.flatMap((executable) => getExecutableDirectory(executable)),
    ...POSIX_PATH_CANDIDATES,
    ...getPiNodePaths(),
    ...getNodeVersionManagerDirectories(),
    ...getExistingPathEntries()
  ]).join(path.delimiter);
}

function getPiNodePaths() {
  const home = process.env.HOME;
  if (!home) return [];

  const root = path.join(home, ".local", "share", "pi-node");

  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(root, d.name, "bin"));
  } catch {
    return [];
  }
}

function getExistingPathEntries() {
  return (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
}

function getExecutableDirectory(executable) {
  return path.isAbsolute(executable) ? [path.dirname(executable)] : [];
}

function getNodeVersionManagerDirectories() {
  const home = process.env.HOME;
  if (!home) return [];

  return [
    ...getNvmNodeBinDirectories(path.join(home, ".nvm", "versions", "node")),
    ...getFnmNodeBinDirectories(path.join(home, ".fnm", "node-versions")),
    path.join(home, ".asdf", "shims"),
    path.join(home, ".volta", "bin")
  ];
}

function getNvmNodeBinDirectories(root) {
  return getChildDirectories(root).map((directory) => path.join(directory, "bin"));
}

function getFnmNodeBinDirectories(root) {
  return getChildDirectories(root).map((directory) => path.join(directory, "installation", "bin"));
}

function getChildDirectories(root) {
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(root, entry.name));
  } catch {
    return [];
  }
}

function uniqueExistingDirectories(directories) {
  const seen = new Set();
  return directories.filter((directory) => {
    if (!directory || seen.has(directory) || !fs.existsSync(directory)) return false;
    seen.add(directory);
    return true;
  });
}
