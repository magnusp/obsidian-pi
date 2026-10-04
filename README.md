![Pi Agent for Obsidian](assets/pi-agent-banner.jpg)

# Pi Agent

Chat with Pi in Obsidian using context from your current note, links, backlinks, tags, explicit search results, and selected text.

> Thanks to Mario Zechner, the developer of Pi, for building the agent this plugin runs on top of.

## Requirements

Pi Agent runs only on desktop, and requires Pi coding agent 0.80.0 or newer to be installed separately (last compatibility test: 0.80.7). The upstream package is [`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent), from [`earendil-works/pi-mono`](https://github.com/earendil-works/pi-mono/tree/main/packages/coding-agent):

```bash
npm install -g @earendil-works/pi-coding-agent
pi --version
```

Newer Pi versions can add capabilities that Pi Agent does not use yet. Missing required RPC capabilities produce an upgrade diagnostic, and optional capabilities use an explicit, tested fallback rather than failing silently.

If Obsidian cannot find `pi`, restart Obsidian after installing so that Obsidian picks up your updated PATH. For custom installs such as nix-darwin, set `Pi executable path` in the plugin settings, for example `/etc/profiles/per-user/${USER}/bin/pi`.

### Before the first run

1. Install and authenticate Pi from a terminal.
2. Open a dedicated test vault before you enable Edit or Full agent mode.
3. Start in Chat or Review mode until you understand what context Pi sends.
4. Enable Edit or Full agent only for vaults and projects you are comfortable letting Pi modify.

### Tool modes

Tool mode controls which Pi CLI tools are available:

- Chat attaches Obsidian context only, and disables Pi CLI tools.
- Review lets Pi read, search, and list files.
- Edit lets Pi edit and write files.
- Full agent also lets Pi run shell commands.

Pi Agent can also run Pi inside [nono](https://nono.sh), a sandbox that mediates filesystem and network access at the operating system level. The sandbox is enabled by default when nono is detected. For setup instructions, see [Optional sandbox with nono](#optional-sandbox-with-nono).

Prompts, selected text, note content, search excerpts, attachments, and local chat history can be sent to the Pi CLI and then to your configured model provider. Read [Privacy](PRIVACY.md) before you use the plugin with sensitive vaults.

## Features

- Chat with Pi from an Obsidian sidebar.
- Attach current-note context automatically.
- Include linked notes, backlinks, tags, frontmatter, headings, selected text, and explicit search attachments.
- Choose tool modes: Chat, Review, Edit, and Full agent.
- Enable default Pi skills and add trusted custom skill folders.
- Use `/` autocomplete for Obsidian context commands and `/skill:name` commands.
- Copy responses, create notes from answers, and open cited vault notes.
- Attach change requests or questions to Markdown selections and source-backed blocks.
- Receive a native completion notification when a run finishes while Obsidian is unfocused and the operating system grants notification permission.
- Show sanitized, bounded Pi extension status in the Obsidian status bar, or hide it with `Show extension status` in the plugin settings.

### Annotations

To add a change request or a question, select text in a Markdown note and choose the `Annotations` header action. Without a selection, the same action toggles block-pick mode. Both work in editing and reading views when Obsidian can map the rendered block to Markdown source. The command palette action `Pi Agent: Add or toggle annotation for active note` is the keyboard and fallback entry point.

Annotations appear on the note. You can navigate to them, edit them, or delete them individually, and Pi Agent includes them with the active note in later Pi prompts. Detached anchors remain listed until you edit or delete them.

> Tool modes control which Pi CLI tools are enabled. They are not an operating-system sandbox. Enable the optional nono sandbox when you want a boundary outside Pi itself.

## Optional sandbox with nono

Pi Agent can run the Pi CLI inside [nono](https://nono.sh), a sandbox that mediates the filesystem and network access of Pi and everything Pi spawns. When Obsidian detects a `nono` executable on its path, the sandbox is enabled by default and every Pi launch becomes:

```bash
nono run --silent --profile <profile> --allow-cwd -- pi ...
```

The plugin never installs nono. When nono is absent, or when you turn the sandbox off under `Settings > Pi Agent > Pi CLI`, Pi launches as before. If Obsidian cannot find nono, the settings report that nono was not found on PATH. In that case, set `nono executable path` to the absolute path that `which nono` returns.

### Write a profile

Extend the registry-managed `nolabs-ai/pi` profile rather than starting from scratch. That profile already grants the Node runtime that Pi needs, read and write access to `~/.pi` for settings and credentials, read and write access to the working directory, and the credential injection rules for common providers. Confirm that the pack is installed, write a draft profile, validate it, and promote it:

```bash
mkdir -p ~/.config/nono/profile-drafts
nono list --installed               # confirm that nolabs-ai/pi is installed
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

Set `Nono profile` to `obsidian` in the plugin settings, then select `Check nono setup`.

### What the profile needs to know about Pi Agent

- The working directory is the vault root. The plugin runs Pi with the vault as its working directory and passes `--allow-cwd`, whose access level comes from the profile's `workdir.access` field (`readwrite` in the example). That is what grants vault access, so the profile requires no hardcoded vault path and works with any vault.
- The `allow` field grants read and write access, while `write` grants write-only access. Pi compiles its extensions into a jiti cache under `/tmp/jiti` and then imports that cache, which requires read access. A write-only grant fails with `EACCES ... /tmp/jiti/extensions-....mjs`.
- The `deny` globs are best-effort on Linux. Landlock has no true deny, so a glob such as `**/.env` covers only files that exist when the sandbox starts. Set `security.capability_elevation` to `true` to enforce these rules at runtime where seccomp-notify is available. macOS enforces them at runtime.
- The `commands.deny` field is deprecated. It gates commands only at startup, and a child process can bypass it. The inherited `dangerous_commands_*` groups remain in place, but you should rely on filesystem and network policy instead.
- Network access is unrestricted unless you restrict it. The `network.block` field is `false` by default. The `allow_domain` and `deny_domain` fields apply through the proxy, so they require a `network_profile` to take effect. Filesystem grants do not prevent exfiltration, so treat network policy as a separate decision.

### Troubleshooting

| Symptom                                       | Cause and fix                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `nono: Profile not found: <name>`             | The profile was never promoted. Create the draft, then `nono profile promote <name>`.              |
| `EACCES ... /tmp/jiti/extensions-....mjs`     | `/tmp/jiti` is not readable. Use `"allow": ["/tmp/jiti"]`, not `"write"`.                          |
| `nono: CWD access requires --allow-cwd`       | The profile's `workdir.access` is `none`. Set it to `read` or `readwrite`.                         |
| Run fails immediately with an extension error | Check `nono profile show <name>` includes the `nolabs-ai/pi` pack and its Node runtime grants.     |
| Permission denied outside the vault           | Expected. Run `nono why --self --path <path> --op read\|write` and widen the profile deliberately. |

nono records its decisions and audit logs in its own state directories, not in the vault. Read [Privacy](PRIVACY.md) for details.

## Privacy and safety

Pi Agent sends note content and selected text to the local Pi CLI, which can forward prompts to your configured model providers. Read [Privacy](PRIVACY.md) before you publish the plugin or use it with sensitive vaults.

In summary:

- The plugin does not include ads, telemetry, or an automatic updater.
- The plugin stores complete chat history as JSON in the plugin directory with checksummed current and previous backups. Pi runtime JSONL sessions remain separate.
- Network access happens through the separately installed Pi CLI and depends on your Pi and model provider configuration.
- At plugin startup, Pi discovers project and global extensions, prompt templates, and skills through RPC, and then applies its own project trust rules. The plugin passes any explicitly configured absolute or vault-contained skill paths to Pi.
- Edit and Full agent modes can modify files in your vault or project.
- Full agent mode enables the complete Pi tool set, including extension tools, custom tools, and shell commands.
- When Obsidian detects a nono executable, Pi Agent launches Pi inside a nono sandbox by default and uses the configured nono profile. nono mediates filesystem and network access, and writes its own logs outside the vault.
- Skills can contain instructions or scripts, so enable only skill folders that you trust.

## Installation

### Community plugins

After the plugin is approved, install it from the Obsidian Community Plugins browser.

### Manual installation

Download the latest release and copy these files into:

```text
<vault>/.obsidian/plugins/pi-agent/
```

The release contains these required files:

```text
main.js
manifest.json
styles.css
```

Enable `Pi Agent` in the Obsidian settings.

## Development

Use a dedicated test vault. Do not develop or test plugin changes in your main vault.

```bash
npm ci
npm run build
npm run ci
npm run test:pi -- /path/to/dedicated/test-vault
npm run dev:install -- /path/to/dedicated/test-vault/.obsidian/plugins/pi-agent
```

Reload Obsidian, or disable and re-enable the plugin, to load the development build.

The `test:pi` command is an opt-in RPC smoke test that runs offline, without tools, and without a session. It disables discovered extensions, skills, prompt templates, themes, context files, and project approval, and then reads local Pi state, models, and commands without sending a model prompt. The command makes no provider request, so it does not incur model provider charges.

See [Pi Agent compatibility and pre-release checklist](TESTING.md) for the complete automated checks and the manual `ObsidianTesting` checklist. Manual validation remains pending until you check every item, and testing alone does not create a release.

## Release

1. Create a release-prep branch from `main`.
2. Update `manifest.json`, `package.json`, and `versions.json`, and promote the `Unreleased` entries in `CHANGELOG.md` into the new version section.
3. Run the build before the gate. The `npm run ci` command verifies the repository and never writes to it, so you must run `npm run build` first:

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

The release workflow uses the current `CHANGELOG.md` entry as release notes, publishes the assets that Obsidian supports, and generates artifact attestations:

- `main.js`
- `manifest.json`
- `styles.css`
