# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

Project name: Pi Agent

Pi Agent is a desktop-only Obsidian plugin. It shells out to the separately installed Pi coding agent CLI and uses vault context from Markdown notes, links, backlinks, tags, explicit search attachments, selected text, and explicit prompt attachments.

## Scope and precedence

- This file applies to the repository tree rooted at the directory that contains it.
- A more deeply nested `AGENTS.md` file can add or override instructions for its subtree.
- Follow the Obsidian plugin guidelines and this repository's source and build rules over generic JavaScript advice.

## Repository map

Start here to understand where things live.

- Release assets: `main.js`, `manifest.json`, and `styles.css`, which Obsidian installs directly.
- Source: `src/`, the human-editable plugin source. Edit this before you touch generated release output.
- Shared helpers: `src/shared/`, pure helpers with unit tests.
- Plugin docs: `docs/`, which covers architecture, development, and publishing for maintainers.
- Tests: `tests/`, Vitest unit tests for source helpers.
- Scripts: `scripts/`, which covers the build, the development install, release packaging, and version validation.
- CI: `.github/workflows/` - `ci.yml` (quality gate), `security.yml` (zizmor workflow audit, full-tree `npm audit`, dependency review), `skip-lib-check.yml` (reports when the `skipLibCheck` workaround can be removed), and `release.yml` (tag-driven releases).

## Generated and runtime files

- `main.js` is the generated release entry, so the source change alone is not a
  finished change:

```bash
npm run build   # regenerate main.js from src/
npm run ci      # verify, including that main.js matches src/
```

The `npm run ci` command verifies the repository and never writes to it. The
`build:check` command rebuilds in memory and compares that output against the
committed `main.js`, so a source change that ships without a rebuild fails the
gate with a stale-bundle error. The `npm run build` command regenerates the
bundle, so commit it with the source change that required it.

The release workflow rebuilds on the runner and then fails if its output differs
from the committed `main.js`, so a tag on a commit that skipped the rebuild
cannot publish an out-of-date bundle.

## Dependency and action updates

`.github/dependabot.yml` opens weekly pull requests for npm and GitHub Actions
updates. The `overrides` in `package.json` that clear npm advisories need manual
edits when Dependabot cannot satisfy them from a version range; an advisory fix
that needs a new override is still a human step. The Security workflow audits
the whole installed tree, including devDependencies, so a newly disclosed
advisory against a version already in the lockfile cannot hide behind a pull
request that never touched it.

The Obsidian scanner lint has a zero-warning budget (`lint:obsidian
--max-warnings 0`) rather than errors only. Run `npm run lint:obsidian:report`
to list findings without failing on them.

Keep generated, runtime, and local files out of git:

- `node_modules/`
- `data.json`
- `pi-sessions/`
- `release-notes.md`
- release zip files

## Validation

Run the relevant checks before you finish a change.

- Full gate: `npm run ci`
- Targeted checks during refactors:
  - `npm run build`
  - `npm run build:check`
  - `npm test`
  - `npm run lint`
  - `npm run lint:obsidian`
  - `npm run typecheck`
  - `npm run format:check`
- The `npm run test:pi -- <dedicated test vault>` command is an opt-in offline Pi
  RPC smoke test. It sends no model prompt, so it does not incur a provider
  charge. See [Pi Agent compatibility and pre-release checklist](TESTING.md).

## Obsidian plugin conventions

- Do not use a global `app`; use the plugin/view `this.app` reference.
- Avoid unnecessary console logging. Warnings are acceptable for recoverable
  diagnostics.
- Avoid `innerHTML`. Build the DOM with Obsidian and DOM APIs and text setters.
- Use `registerEvent`, `registerDomEvent`, `registerInterval`, `this.register()`, or explicit cleanup for listeners, observers, timers, and resources.
- Do not detach leaves in `onunload`.
- Prefer Obsidian Vault/FileManager APIs over direct adapter access.
- Use `Vault.process()` or `FileManager.processFrontMatter()` for writes whenever
  possible.
- Use `Setting#setHeading()` for settings sections.
- Keep UI text sentence case.

## CSS conventions

- Do not introduce `:has()` selectors; structure component markup so state and focus can use sibling selectors, classes, or attributes instead.
- Do not use `!important` by default. Prefer component-local selector specificity or Obsidian CSS variables. If an external browser, theme, or editor rule genuinely requires it, document the exception beside the declaration and add a regression test.
- Prefer CSS supported by the minimum Obsidian version in `manifest.json`; avoid properties reported as unsupported or partially supported by the Obsidian plugin scanner when a stable equivalent exists.
- Keep selectors scoped to Pi Agent component classes to avoid broad invalidation and theme conflicts.
- Preserve keyboard focus, reduced-motion behavior, and light/dark theme compatibility when changing CSS.
- For CSS cleanup, update the smallest relevant source assertions and run `npm run ci`; also search `styles.css` for newly introduced `:has()`, `!important`, and unsupported compatibility workarounds.

## Source organization conventions

- Keep `src/main.js` or the eventual plugin entry small and focused on exporting the plugin class.
- Prefer small modules with a clear domain boundary:
  - `plugin/` for lifecycle, commands, settings wiring.
  - `context/` for vault graph/search/context assembly.
  - `pi/` for Pi CLI integration, model catalog, and event parsing.
  - `threads/` for chat history/thread state.
  - `annotations/` for annotation models, stores, anchors, and the CodeMirror editor layer.
  - `ui/` for views, controls, actions, activity, suggestions, and modals.
  - `shared/` for pure helpers.
- Move pure logic to modules and cover it with tests before wiring it into Obsidian UI code.
- Keep refactors behavior preserving unless you explicitly ask for a behavior
  change.

## Issue and changelog process

- Before you implement feature work or behavior changes, create or identify a
  GitHub issue, and reference it in commits, pull requests, and changelog entries.
- Work on a feature branch named for the issue, for example
  `issue-3-short-topic`.
- Before you merge remote pull requests into `main`, create a short-lived local
  `integration` branch from the current `main`, merge the pull request branches
  into it, resolve integration conflicts, regenerate `main.js`, and run
  `npm run ci`.
- Point the dedicated test vault at the `integration` worktree, and complete the
  relevant manual checks there. Merge the reviewed pull requests into `main`
  only after the combined build passes.
- The `integration` branch is transient. Create it when a batch of pull requests
  needs joint testing, and delete it once `main` has absorbed them. It is a local
  scratch branch. It is not permanent, it does not replace issue branches or pull
  requests, and you must not push it. Recreate it with
  `git checkout main && git checkout -b integration` when the next batch lands.
- Keep worktrees outside this repository directory. A worktree inside it makes
  Vitest discover the nested test suite and silently double-count the results,
  which reads as extra passing tests instead of a failure.
- Add user-facing changes under `## Unreleased` in `CHANGELOG.md`, and include
  the issue number, for example `(#3)`.
- For a release, use a release-prep branch or pull request to bump the version
  files, and manually promote the `## Unreleased` entries into the release
  version section before you tag.

## Privacy and safety documentation

Update `README.md` and [Privacy](PRIVACY.md) when a change affects any of the
following:

- Network use
- Model provider or Pi CLI data flow
- Collected vault context
- Local storage
- File access or write behavior
- Shell access
- Skill discovery, execution, or trust boundaries

## Manual testing

- Use a dedicated Obsidian test vault for manual plugin testing, never a vault
  that you care about.
- Point the plugin directory in that vault at a development build from this
  repository, for example with
  `npm run dev:install -- <vault>/.obsidian/plugins/pi-agent`, and then reload
  Obsidian to test the current checkout.
- Never test risky agent modes in a main vault.
- Do not enable Edit or Full agent mode in a sensitive vault while you validate a
  refactor.
