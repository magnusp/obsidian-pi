# Privacy

Pi Agent is a desktop-only Obsidian plugin. It maintains local RPC subprocesses with the separately installed Pi CLI.

## Data sent to Pi

When you send a message, the plugin can include the following content:

- Your prompt and selected text
- Current note content and metadata
- Backlinks, outgoing links, unresolved links, headings, tags, and frontmatter
- Explicit ranked search result excerpts when you use search attachments or commands
- Explicit `@note`, `#tag`, and `/search` attachments
- Skill and prompt template content that Pi expands after applying its resource and project trust rules
- Local chat thread history for continuity
- PNG, JPEG, or WebP images that you explicitly select, paste, or drop into the composer
- UTF-8 text, code, and configuration files that you explicitly select from the vault or the local filesystem. Content is limited to 64 KiB per file and 192 KiB total, is marked when truncated, and is sent as delimited untrusted prompt context
- Annotations for the active note, including quoted source text, rendered selection text, intent, and the context you wrote

Pi can forward this prompt and context to the model provider configured in your Pi settings.

## Network use

The plugin does not call model provider APIs directly, and it does not include telemetry. Network use happens through the Pi CLI and depends on your Pi provider and model configuration. When the optional nono sandbox is active, nono mediates that network access according to the configured profile, so a profile can allow, restrict, or block outbound connections.

When you attach annotations to a prompt, the configured provider can receive their plaintext content along with the rest of the prompt. Consult that provider's privacy and retention terms.

The opt-in compatibility smoke command starts Pi with `--offline`, disables discovered resources, and sends no model prompt, so it makes no model provider request. Ordinary chats are not offline unless your Pi configuration makes them so.

When Obsidian is unfocused and the operating system grants notification permission, the plugin can emit a generic local completion notification. The notification text does not include prompts, note content, thinking, tool arguments, or model responses. Selecting it focuses Obsidian and opens the originating local chat.

Pi extensions can provide local status, widget, and view title text through RPC. The plugin strips terminal escape sequences and control characters before it displays that text as plain text. Status and widget values stay in memory, and the plugin neither adds them to prompts nor persists them. The plugin stores only the `Show extension status` preference.

## Local storage

The plugin stores settings, complete local chat history, annotations, and unsent local follow-up queue items as plaintext JSON under `.obsidian/plugins/pi-agent/`. The plugin keeps chat history in `data.json` and in checksummed current and previous recovery backup files. The chat history includes captured thinking text when the configured provider exposes it. The plugin does not encrypt these files. Annotation records include note paths, quoted source text, optional rendered selection text, and your annotation context.

The plugin stores queued image data locally as base64, and queued text file content as plaintext, until you send or remove the item. After you send it, Pi and the configured model provider receive the content. The plugin does not attach unsupported binaries, PDF files, office documents, or archives, and it does not present Pi RPC as supporting generic binary files. After the plugin restarts, saved follow-ups remain paused until you resume or discard them, which prevents stale prompts from replaying automatically.

When you delete a chat, the plugin removes it from the plugin history and the current recovery snapshot. The rotating previous snapshot can retain the chat until the next successful save. When a chat has a local Pi session, the deletion dialog separately offers to delete that session file, and the plugin removes the local Pi data only after you choose that option. Session information shows the local storage path, and HTML export writes a separate local file at the path that Pi reports. The plugin also writes Pi session JSONL files under the plugin directory during local runs, and those files remain separate from the chat history.

Obsidian Sync, third-party sync tools, backups, and vault copies can sync or copy the plugin data, including the annotations. Their retention and security policies apply. The plugin writes Pi session files under the plugin directory during local runs, and it ignores these runtime files in git.

## File and shell access

At startup, the plugin asks Pi RPC to discover extensions, their commands, prompt templates, and skills. Pi remains responsible for loading these resources and for applying its project trust decisions. The plugin does not independently read project prompt or skill files for command discovery or expansion. The plugin passes any optional absolute or vault-contained relative skill paths that you configure to Pi as trusted additional skill paths.

Tool modes control which Pi CLI tools are enabled:

- Chat: no Pi CLI tools.
- Review: read, search, and list tools.
- Edit: read, search, and list tools, plus edit and write tools.
- Full agent: the complete Pi tool set, including extension tools, custom tools, and shell commands.

Tool modes are not an operating system sandbox. Enable Edit or Full agent only for vaults and projects that you are comfortable letting Pi inspect or modify.

## Optional nono sandbox

When Obsidian detects the separately installed `nono` executable on the path it hands to child processes, the plugin launches Pi as `nono run --silent --profile <profile> --allow-cwd -- pi ...` for every Pi process it starts. That list includes chat runs, the persistent RPC session, the model and command catalogs, and the startup warmup. Detection is the only trigger. The plugin never installs nono, and it launches Pi as before when nono is absent or when you turn the sandbox off in the settings.

The sandbox mediates filesystem and network access for Pi and everything Pi spawns, and it denies operations that the selected profile does not cover. The plugin passes `--allow-cwd` because non-interactive runs otherwise cannot access their working directory, and that flag authorizes only the access level the profile defines.

The sandbox sits outside the plugin, so its decisions and audit logs live in nono state directories, for example under `~/.local/state/nono`, rather than in the vault. Its own retention behavior applies to those logs. The profile can grant access beyond the vault, so a sandbox is only as restrictive as the profile that it uses. Review the profile with `nono profile show <name>` and `nono why --self --path <path> --op read|write`.

When a sandbox denial reaches a run, the plugin reports a sandbox failure with `nono why` remediation instead of a Pi failure. The plugin stores only the profile name, the sandbox toggle, and an optional nono executable path in `data.json`.

## Skills

Skills can contain instructions or scripts. Enable only the default or custom skill folders that you trust.
