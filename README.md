![Pi Agent for Obsidian](assets/pi-agent-banner.jpg)

# Pi Agent

Chat with Pi in Obsidian using context from your current note, links, backlinks, tags, explicit search results, and selected text.

> Thanks to Mario Zechner, the developer of Pi, for building the agent this plugin runs on top of.

## Requirements

Pi Agent is desktop-only and requires Pi coding agent **0.80.0 or newer** to be installed separately (last compatibility test: **0.80.7**). The upstream package is [`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent), from [`earendil-works/pi-mono`](https://github.com/earendil-works/pi-mono/tree/main/packages/coding-agent):

```bash
npm install -g @earendil-works/pi-coding-agent
pi --version
```

Newer Pi versions may add capabilities that Pi Agent does not use yet. Missing required RPC capabilities produce an upgrade diagnostic; optional capabilities must use an explicit, tested fallback rather than failing silently.

If Obsidian cannot find `pi`, restart Obsidian after installation so it picks up your updated PATH. For custom installs such as nix-darwin, set **Pi executable path** in the plugin settings, for example `/etc/profiles/per-user/${USER}/bin/pi`.

First run checklist:

1. Install and authenticate Pi from a terminal.
2. Open a dedicated test vault before enabling Edit or Full agent mode.
3. Start in Chat or Review mode until you understand what context is sent.
4. Enable Edit or Full agent only for vaults/projects you are comfortable letting Pi modify.

Tool modes, briefly:

- Chat attaches Obsidian context only; Pi CLI tools are disabled.
- Review lets Pi read/search/list files.
- Edit lets Pi edit/write files.
- Full agent also lets Pi run shell commands.

Optional sandboxing with [nono](https://github.com/nono): when a `nono` executable is detected on the path Obsidian uses, Pi Agent launches Pi as `nono run --silent --profile <profile> --allow-cwd -- pi ...` instead of `pi ...`, so filesystem and network access is mediated by the operating system. `--allow-cwd` is required because Pi runs with the vault as its working directory; it only authorizes the level the profile already defines. This is on by default once nono is detected. Set the required profile name (**Nono profile**, default `obsidian`) in settings, or turn the sandbox off there. See [Optional sandbox with nono](#optional-sandbox-with-nono) for a profile that extends `nolabs-ai/pi`.

Privacy reminder: prompts, selected text, note content, search excerpts, attachments, and local chat history can be sent to the Pi CLI and then to your configured model provider.

## Features

- Chat with Pi from an Obsidian sidebar.
- Attach current-note context automatically.
- Include linked notes, backlinks, tags, frontmatter, headings, selected text, and explicit search attachments.
- Choose tool modes: Chat, Review, Edit, and Full agent.
- Enable default Pi skills and add trusted custom skill folders.
- Use `/` autocomplete for Obsidian context commands and `/skill:name` commands.
- Copy responses, create notes from answers, and open cited vault notes.
- Attach change requests or questions to Markdown selections and source-backed blocks.
- Receive a native completion notification when an agent run finishes while Obsidian is unfocused, where desktop notification permission is available.
- Show sanitized, bounded Pi extension status in Obsidian's status bar, or hide it with **Show extension status** in settings.

### Annotations

Open a Markdown note and select text, then choose the **Annotations** header action to add a change request or question. With no selection, the action toggles block-pick mode; it works in both editing and reading views when Obsidian can map the rendered block to Markdown source. The command palette action **Pi Agent: Add or toggle annotation for active note** is the keyboard/fallback entry point. Annotations appear on the note, can be navigated, edited, or individually deleted, and are included with the active note in subsequent Pi prompts; detached anchors remain listed until edited or deleted.

> Tool modes control which Pi CLI tools are enabled. They are not an operating-system sandbox. Enable the optional nono sandbox when you want a boundary outside Pi itself.

## Optional sandbox with nono

Pi Agent can run the Pi CLI inside [nono](https://github.com/nono), an OS-level sandbox that mediates the filesystem and network access of Pi and everything it spawns. When a `nono` executable is detected on the path Obsidian uses, this is on by default and every Pi launch becomes:

```bash
nono run --silent --profile <profile> --allow-cwd -- pi ...
```

The plugin never installs nono, and Pi launches exactly as before when nono is absent or the sandbox is turned off in **Settings > Pi Agent > Pi CLI**. If Obsidian cannot find nono, the settings show _"nono was not found on PATH"_; set **nono executable path** to the absolute path from `which nono`.

### Write a profile

Extend the registry-managed `nolabs-ai/pi` profile rather than starting from scratch. It already grants the Node runtime Pi needs, read+write on `~/.pi` for settings and credentials, `workdir` read+write, and the credential-injection rules for common providers:

```bash
mkdir -p ~/.config/nono/profile-drafts
nono pack list                      # confirm nolabs-ai/pi is installed
$EDITOR ~/.config/nono/profile-drafts/obsidian.json
nono profile validate ~/.config/nono/profile-drafts/obsidian.json
nono profile promote obsidian --diff   # review before applying
nono profile promote obsidian
nono profile show obsidian
```

A minimal profile:

```json
{
  "extends": ["nolabs-ai/pi"],
  "meta": {
    "name": "obsidian",
    "description": "Pi Agent running against an Obsidian vault"
  },
  "workdir": {
    "access": "readwrite"
  },
  "filesystem": {
    "allow": ["/tmp/jiti"],
    "deny": ["~/.ssh", "~/.aws", "~/.config/gh", "**/.env", "**/*.pem"]
  }
}
```

Then set **Nono profile** to `obsidian` in the plugin settings and press **Check nono setup**.

### What the profile needs to know about Pi Agent

- **The working directory is the vault root.** The plugin runs Pi with the vault as its cwd and passes `--allow-cwd`, whose access level comes from the profile's `workdir.access` (`readwrite` above). That is what grants vault access, so the profile needs no hardcoded vault path and works for any vault.
- **`allow` is read+write, `write` is write-only.** Pi compiles its extensions into a jiti cache under `/tmp/jiti` and then imports it, which needs read access; a `write`-only grant fails with `EACCES ... /tmp/jiti/extensions-....mjs`.
- **`deny` globs are best-effort on Linux.** Landlock has no true deny, so a glob like `**/.env` only covers files that exist at sandbox start. Set `security.capability_elevation` to `true` for runtime enforcement where seccomp-notify is available. macOS enforces these at runtime.
- **`commands.deny` is deprecated** and is startup-only gating that a child process can bypass. The inherited `dangerous_commands_*` groups remain; rely on filesystem and network policy instead.
- **Network is unrestricted unless you restrict it.** `network.block` is `false` by default. `allow_domain` and `deny_domain` apply through the proxy and therefore need a `network_profile` to be enforced. Filesystem grants do not prevent exfiltration, so treat network policy as its own decision.

### Troubleshooting

| Symptom                                       | Cause and fix                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `nono: Profile not found: <name>`             | The profile was never promoted. Create the draft, then `nono profile promote <name>`.              |
| `EACCES ... /tmp/jiti/extensions-....mjs`     | `/tmp/jiti` is not readable. Use `"allow": ["/tmp/jiti"]`, not `"write"`.                          |
| `nono: CWD access requires --allow-cwd`       | The profile's `workdir.access` is `none`. Set it to `read` or `readwrite`.                         |
| Run fails immediately with an extension error | Check `nono profile show <name>` includes the `nolabs-ai/pi` pack and its Node runtime grants.     |
| Permission denied outside the vault           | Expected. Run `nono why --self --path <path> --op read\|write` and widen the profile deliberately. |

nono decisions and audit logs live in nono's own state directories, not in the vault; see [PRIVACY.md](PRIVACY.md).

## Privacy and safety

Pi Agent can send note content and selected text to the local Pi CLI, which may forward prompts to configured model providers. See [PRIVACY.md](PRIVACY.md) for details before publishing or using the plugin with sensitive vaults.

Short version:

- The plugin does not include ads, telemetry, or an auto-updater.
- Complete chat history is stored as JSON in the plugin directory with checksummed current/previous backups; Pi runtime JSONL sessions remain separate.
- Network access happens through the separately installed Pi CLI and depends on your Pi/model-provider configuration.
- At plugin startup, Pi discovers project/global extensions, prompt templates, and skills through RPC and applies its own project-trust rules. The plugin passes any explicitly configured absolute or vault-contained skill paths to Pi.
- Edit and Full agent modes can modify files in your vault/project.
- Full agent mode enables Pi's complete tool set, including extension/custom tools and shell commands.
- When a nono executable is detected, Pi launches inside a nono sandbox by default using the configured nono profile; nono mediates filesystem and network access and writes its own logs outside the vault.
- Skills can contain instructions or scripts; only enable skill folders you trust.

## Installation

### Community plugins

After approval, install from Obsidian's Community Plugins browser.

### Manual installation

Download the latest release and copy these files into:

```text
<vault>/.obsidian/plugins/pi-agent/
```

Required files:

```text
main.js
manifest.json
styles.css
```

Then enable **Pi Agent** in Obsidian settings.

## Development

Use a dedicated test vault. Do not develop or test plugin changes in your main vault.

```bash
npm ci
npm run build
npm run ci
npm run test:pi -- /path/to/dedicated/test-vault
npm run dev:install -- /path/to/dedicated/test-vault/.obsidian/plugins/pi-agent
```

`test:pi` is an opt-in, offline/no-tool/no-session RPC smoke test. It disables discovered extensions, skills, prompt templates, themes, context files, and project approval, then reads local Pi state, models, and commands without sending a model prompt. No provider request is made, so the command does not incur model-provider charges. Then reload Obsidian, or disable and re-enable the plugin.

See [TESTING.md](TESTING.md) for the complete automated and dedicated `ObsidianTesting` manual checklist. Manual validation is pending until every item is explicitly checked; testing does not create a release.

## Release

1. Create a release-prep branch from `main`.
2. Update `manifest.json`, `package.json`, and `versions.json`; promote `CHANGELOG.md` `Unreleased` entries into the new version section.
3. Run the build and the gate. `npm run ci` verifies and never writes, so
   `npm run build` has to run first:

```bash
npm run build
npm run ci
```

4. Commit and merge the release prep into `main`.
5. Create and push a matching SemVer tag from `main`, for example:

```bash
git tag 0.0.1
git push origin 0.0.1
```

The release workflow uses the current `CHANGELOG.md` entry as release notes, publishes the Obsidian-supported assets, and generates artifact attestations:

- `main.js`
- `manifest.json`
- `styles.css`
