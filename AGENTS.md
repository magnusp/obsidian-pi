# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

Project name: Pi Agent

Pi Agent is a desktop-only Obsidian plugin that shells out to the separately installed Pi coding agent CLI and uses vault context from Markdown notes, links, backlinks, tags, explicit search attachments, selected text, and explicit prompt attachments.

## Scope and precedence

- This file applies to the repository tree rooted at the directory containing this `AGENTS.md` file.
- More deeply nested `AGENTS.md` files may add or override instructions for their subtrees.
- Follow Obsidian plugin guidelines and this repository's source/build rules over generic JavaScript advice.

## Repository map

Use this as the first place to understand where things live.

- Release assets: `main.js`, `manifest.json`, `styles.css` - files Obsidian installs directly.
- Source: `src/` - human-editable plugin source. Edit this before touching generated release output.
- Shared helpers: `src/shared/` - pure helpers with unit tests.
- Plugin docs: `docs/` - maintainer architecture, development, and publishing notes.
- Tests: `tests/` - Vitest unit tests for source helpers.
- Scripts: `scripts/` - build, dev install, release packaging, and version validation.
- CI: `.github/workflows/` - `ci.yml` (quality gate), `security.yml` (zizmor workflow audit, full-tree `npm audit`, dependency review), `skip-lib-check.yml` (reports when the `skipLibCheck` workaround can be removed), and `release.yml` (tag-driven releases).

## Generated and runtime files

- `main.js` is the generated release entry, so the source change alone is not a
  finished change:

```bash
npm run build   # regenerate main.js from src/
npm run ci      # verify, including that main.js matches src/
```

`npm run ci` verifies and never writes. `build:check` rebuilds in memory and
compares that output against the committed `main.js`, so a source change
shipped without a rebuild fails the gate with a stale-bundle error. `npm run
build` regenerates the bundle; commit it with the source change that required
it.

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

The Obsidian scanner lint is budgeted at zero warnings
(`lint:obsidian --max-warnings 0`) rather than errors only. Run
`npm run lint:obsidian:report` to list findings without failing on them.

Keep generated/runtime/local files out of git:

- `node_modules/`
- `data.json`
- `pi-sessions/`
- `release-notes.md`
- release zip files

## Validation

Run the relevant checks before finishing changes.

- Full gate: `npm run ci`
- Targeted checks during refactors:
  - `npm run build`
  - `npm run build:check`
  - `npm test`
  - `npm run lint`
  - `npm run lint:obsidian`
  - `npm run typecheck`
  - `npm run format:check`
- `npm run test:pi -- <dedicated test vault>` is an opt-in offline Pi RPC smoke
  test. It sends no model prompt, so it incurs no provider charge. See
  `TESTING.md`.

## Obsidian plugin conventions

- Do not use a global `app`; use the plugin/view `this.app` reference.
- Avoid unnecessary console logging. Warnings are acceptable for recoverable diagnostics.
- Avoid `innerHTML`; build DOM with Obsidian/DOM APIs and text setters.
- Use `registerEvent`, `registerDomEvent`, `registerInterval`, `this.register()`, or explicit cleanup for listeners, observers, timers, and resources.
- Do not detach leaves in `onunload`.
- Prefer Obsidian Vault/FileManager APIs over direct adapter access.
- Use `Vault.process()` or `FileManager.processFrontMatter()` for writes when possible.
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
- Keep refactors behavior-preserving unless the user explicitly asks for behavior changes.

## Issue and changelog process

- Before implementing feature work or behavior changes, create or identify a GitHub issue and reference it in commits, pull requests, and changelog entries.
- Work on a feature branch named for the issue, for example `issue-3-short-topic`.
- Before merging remote pull requests into `main`, create a short-lived local `integration` branch from the current `main` and merge the pull request branches into it, resolve integration conflicts, regenerate `main.js`, and run `npm run ci`.
- Point the dedicated test vault at the `integration` worktree and complete relevant manual checks there. Merge the reviewed pull requests into `main` only after the combined build passes.
- `integration` is transient. Create it when a batch of pull requests needs joint testing, and delete it once `main` has absorbed them. It is a local scratch branch, not a permanent branch, not a replacement for issue branches or pull requests, and not something to push. Recreate it with `git checkout main && git checkout -b integration` when the next batch lands.
- Keep worktrees outside this repository directory. A worktree created inside it makes Vitest discover the nested test suite and silently double-count results, which reads as extra passing tests rather than a failure.
- Add user-facing changes under `## Unreleased` in `CHANGELOG.md` and include the issue number, for example `(#3)`.
- For releases, use a release-prep branch/PR to bump version files and manually promote `## Unreleased` entries into the release version section before tagging.

## Privacy and safety documentation

Update `README.md` and `PRIVACY.md` whenever changes affect:

- network use
- model-provider or Pi CLI data flow
- collected vault context
- local storage
- file access or write behavior
- shell access
- skills discovery, execution, or trust boundaries

## Manual testing

- Use a dedicated Obsidian test vault for manual plugin testing, never a vault you care about.
- Point that vault's plugin directory at a development build from this repository, for example with `npm run dev:install -- <vault>/.obsidian/plugins/pi-agent`, then reload Obsidian to test the current checkout.
- Never test risky agent modes in a main vault.
- Do not enable Edit or Full agent mode in a sensitive vault while validating refactors.
