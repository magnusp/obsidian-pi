# Architecture

Pi Agent is an Obsidian desktop plugin that shells out to the separately
installed Pi coding agent CLI, sends vault-aware context with the user prompt,
and streams Pi RPC events back into a chat view.

Root release assets stay in the repository root because Obsidian downloads them
directly:

```text
main.js
manifest.json
styles.css
```

`main.js` is generated. Human-readable source belongs under `src/` and is bundled
by `npm run build`. Never hand-edit `main.js` to ship a change.

## Domains

- **Plugin shell** — Obsidian lifecycle, commands, settings, view registration,
  service construction, and persistence (`src/plugin/`).
- **Context** — active note, selection, backlinks, outgoing and unresolved
  links, tags, frontmatter, headings, search results, and explicit prompt
  attachments (`src/context/`).
- **Pi integration** — process and environment construction, the persistent RPC
  client, session files, cancellation, command and model catalogs, JSON event
  parsing, token/context usage, and the extension UI bridge (`src/pi/`).
- **Threads** — local chat thread state, persistence, checksums, backups, and
  import of previously vault-stored history (`src/threads/`).
- **Annotations** — change requests and questions attached to Markdown
  selections and source-backed blocks, including the CodeMirror decoration layer
  (`src/annotations/`).
- **UI** — chat view, thread list, composer, run controls, suggestions, activity
  state, message rendering and actions, note actions, and modals (`src/ui/`).
- **Shared** — pure helpers with no Obsidian dependency, used by both plugin
  code and tests (`src/shared/`).

There is no change-tracking or diff domain. An earlier iteration snapshotted the
vault around edit-capable runs; that was removed, and Pi performs the edits
directly. `AGENTS.md` still lists `changes/` in its repository map, which is
stale.

## Source layout

```text
src/
  main.js                         ESM entry, re-exports the plugin class only
  plugin/
    PiAgentPlugin.mjs             lifecycle, commands, services, persistence
    settings-tab.mjs              settings UI
    settings.mjs                  defaults and settings/model/tool-mode helpers
    constants.mjs                 plugin IDs, view type, icon metadata
  context/
    context-builder.mjs           prompt and context packet assembly
    vault-graph.mjs               vault search, links, backlinks, tags, note context
    prompt-references.mjs         @note, #tag, /command parsing
    skills.mjs                    configured skill path resolution
    slash-commands.mjs            built-in and skill slash command metadata
    context-show.mjs              context summary rendering
  pi/
    runner.mjs                    run orchestration, CLI args, session files
    rpc-client.mjs                persistent LF-delimited RPC client
    environment.mjs               executable discovery, PATH, process invocation
    events.mjs                    RPC/JSON event normalization
    command-catalog.mjs           extension/prompt/skill command discovery
    model-catalog.mjs             model registry and effective config lookup
    extension-ui.mjs              extension UI protocol and text sanitization
    health.mjs                    Pi version check and startup warmup
    diagnostics.mjs               CLI failure classification
    token-usage.mjs               token/context usage formatting
  threads/
    thread-store.mjs              chat thread state and normalization
    chat-history-backup.mjs       checksummed atomic history snapshots
    chat-history-import.mjs        import of previously vault-stored history
  annotations/
    markdown-annotations-controller.mjs  editor wiring, picking, badges
    markdown-annotation-extension.mjs    CodeMirror decoration ViewPlugin
    annotation-model.mjs          schema, limits, normalization
    annotation-store.mjs          bounded in-memory annotation store
    annotation-anchors.mjs        re-anchoring after edits
    annotation-modal.mjs          create/edit annotation modal
    markdown-block-range.mjs      rendered block to Markdown source mapping
    reading-mode-capture.mjs      selection capture in reading view
  ui/
    PiAgentView.mjs               chat view orchestration
    thread-list-view.mjs          thread list rendering
    message-renderer.mjs          Markdown rendering of messages and thinking
    message-actions.mjs           message menus
    note-actions.mjs              transcript, note creation, cited-note actions
    vault-link-actions.mjs        link classification and opening
    activity.mjs                  activity and tool status helpers
    run-activity-state.mjs        live run state machine
    run-settings.mjs              composer run controls
    prompt-payload.mjs            prompt, image, and text attachment validation
    prompt-queue.mjs              queued prompt handling
    local-prompt-queue.mjs        persisted local queue normalization
    suggestions.mjs               / and @# autocomplete
    model-picker.mjs              model option derivation
    provider-icons.mjs            provider icon mapping
    editor-file-refresh.mjs       reload open files after Pi edits
    desktop-notifications.mjs     native completion notifications
    send-state.mjs                send button state
    thread-actions.mjs            thread action callbacks
    thread-bulk-actions.mjs       bulk thread actions
    view/run-metadata.mjs         view header metadata
    modals/                       approval, confirm, delete, extension UI,
                                  model picker, and Pi setup modals
  shared/
    frontmatter.mjs               frontmatter read/preview/patch helpers
    text.mjs                      tokenization, scoring, excerpts
    paths.mjs                     folder and list normalization
    thread-history.mjs            shared thread history shape

tests/                            Vitest unit tests for pure/source helpers
scripts/                          build, dev install, release, validation
docs/                             maintainer docs (this directory)
```

New code should prefer these domain folders instead of adding logic to
`src/main.js`, which stays a three-line entry.

## Build flow

```text
src/**/*.js,mjs  --npm run build-->  main.js (CommonJS bundle)
```

esbuild bundles `src/main.js` into a CommonJS `main.js` for Obsidian. Three
packages are deliberately **external** and must never be bundled:

```text
obsidian
@codemirror/state
@codemirror/view
```

Bundling CodeMirror would create a second copy of its extension objects, whose
`instanceof` checks fail against the host editor. `npm run build:check` fails if
the committed `main.js` is stale.

## Runtime flow

1. The user submits a prompt from the chat view or an Obsidian command.
2. The message is appended to the current chat thread.
3. The context domain assembles the packet: current note, selected text, linked
   neighborhood, backlinks, tags, search results, explicit attachments, and
   annotations.
4. The Pi domain formats the prompt and starts one long-lived `pi --mode rpc`
   process per thread, passing the tool mode, model, reasoning level, and any
   configured skill paths.
5. The plugin writes a single `prompt` request over the RPC client's stdin. JSON
   events stream back into UI state: thinking, tool activity, text deltas, token
   usage, retries, compaction, and the final answer.
6. Pi extension UI requests (dialogs, notifications, status, widgets, composer
   text) are bridged back into Obsidian UI and sanitized before display.
7. The final assistant message, thinking text, and optional token/context usage
   are stored in local thread history.

A one-shot `pi --mode json` path still exists in `src/pi/runner.mjs`, but RPC is
the primary transport.

## Tool modes

Selected by `settings.sandboxMode` and translated into Pi CLI flags in
`buildPiArgs`:

| Mode                 | Pi flags                                             |
| -------------------- | ---------------------------------------------------- |
| Chat                 | `--no-tools`                                         |
| Review (`read-only`) | `--tools read,grep,find,ls`                          |
| Edit                 | `--tools read,grep,find,ls,edit,write`               |
| Full agent           | no `--tools` flag, so Pi's complete set is available |

Enabling Edit or Full agent requires an explicit acknowledgement, stored as
`settings.acknowledgedToolRisk`. Tool modes are **not** an operating-system
sandbox; Pi runs with the user's privileges.

## Local storage

`data.json` in the plugin directory holds settings, `chatHistory`,
`localPromptQueue`, `localPromptSteering`, and `annotationData`. History is
additionally written as checksummed current/previous backups by
`chat-history-backup.mjs`. Pi's own session files are written separately as JSONL
under `pi-sessions/` in the plugin directory.

None of this is encrypted by the plugin. See `PRIVACY.md` for what is sent to Pi
and the configured model provider.

## Prompt safety boundaries

Vault content is untrusted input that reaches the model. Two places make that
explicit and should keep doing so:

- `formatTextAttachmentContext` in `src/ui/prompt-payload.mjs` wraps attached
  file contents in collision-resistant `BEGIN/END UNTRUSTED` boundaries with an
  instruction to treat them as data.
- `formatPrompt` in `src/context/context-builder.mjs` carries a matching
  instruction for annotation records.

Note that the plain note/search/attachment JSON blocks in the same prompt do not
currently carry such a framing. Extending the untrusted-data boundary to the
whole context packet is a known open item.

## Extraction rules

- Extract pure helpers first and add or keep tests for them.
- Keep Obsidian UI classes thin by moving formatting, parsing, and action logic
  into modules.
- Keep services independent: the Pi runner should not know about the DOM, and UI
  should not know CLI details beyond callbacks and state.
- Preserve behavior during module extraction; improve behavior in separate,
  reviewable changes.
- Do not add generated or runtime files to git.
