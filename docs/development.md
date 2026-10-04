# Development

Use a dedicated Obsidian test vault, never a vault you care about. Edit and Full
agent modes can modify files anywhere Pi can reach.

```bash
npm ci
npm run ci
npm run dev:install -- /path/to/vault/.obsidian/plugins/pi-agent
```

Reload Obsidian, or disable and re-enable the plugin, after installing a dev
build. `PI_AGENT_DEV_DIR` or `OBSIDIAN_PI_DEV_DIR` can be used instead of the
path argument.

The full manual checklist lives in [`TESTING.md`](../TESTING.md), and the
release flow lives in [`RELEASE.md`](../RELEASE.md).

## Quality gates

`npm run ci` runs, in order:

1. `build` — regenerate `main.js` from `src/`
2. `build:check` — fail if the committed `main.js` is stale
3. `format:check` — Prettier over source, tests, scripts, docs, workflows, and
   JSON
4. `lint` — ESLint over `src`, `scripts`, and `tests`
5. `lint:obsidian:errors` — the Obsidian plugin scanner, errors only
6. `typecheck` — `tsc --noEmit`
7. `test` — Vitest
8. `version:check` — version consistency across manifests

Run the whole gate before pushing. Targeted runs are fine while iterating:

```bash
npm run build && npm run build:check
npm test
npm run lint
npm run typecheck
npm run format:check
```

## Dependencies

Everything is a devDependency; the plugin ships a single bundled `main.js` and
no runtime `dependencies`. `obsidian`, `@codemirror/state`, and
`@codemirror/view` stay external in the build.

`package.json` carries `overrides` that pin transitive packages carrying
advisories. They are intentional: removing one will reintroduce a vulnerability,
so verify with `npm audit` before touching them.

Use `npm ci`, not `npm install`, for reproducible installs. Some advisories have
no reachable fix through `npm audit fix`, so the lockfile is regenerated
deliberately rather than by the audit fixer.

## Continuous integration

| Workflow             | Trigger                                             | Purpose                                     |
| -------------------- | --------------------------------------------------- | ------------------------------------------- |
| `ci.yml`             | pull requests, pushes to `main`                     | the `npm run ci` quality gate               |
| `security.yml`       | pull requests, pushes to `main`, weekly, manual     | zizmor workflow audit and dependency review |
| `skip-lib-check.yml` | pull requests touching dependencies, weekly, manual | reports when `skipLibCheck` can be removed  |
| `release.yml`        | tags matching `*.*.*`                               | publishes the release                       |

Notes that matter when changing these:

- **Actions are pinned to full commit SHAs** with a trailing `# vX.Y.Z` comment.
  GitHub only guarantees immutability at a SHA, so please keep that form.
- **zizmor runs in Advanced Security mode**, which uploads SARIF and does not
  fail the run. Blocking comes from a `code_scanning` ruleset rule that gates
  merges on `zizmor` results at `alerts_threshold: errors`. That ruleset is a
  repository setting, not a file in this repository, so it will not travel with a
  clone.
- **`tsconfig.json` sets `skipLibCheck`** because `obsidian@1.13.x` publishes
  declarations where `Menu`, `Modal`, and `PopoverSuggest` declare
  `HistoryHandler` without `onHistoryBack`. `skip-lib-check.yml` exists so the
  workaround is removed once upstream fixes it.

## Worktrees

`AGENTS.md` uses a `development` worktree for integration testing. If you create
one **inside** this repository, Vitest discovers the tests inside it and the
suite silently double-counts, which looks like extra passing tests rather than a
failure. Keep worktrees outside the repository directory, or remove them before
running `npm test`.

## Source rules

- Keep UI text sentence case.
- Use Obsidian `Setting#setHeading()` for settings sections.
- Use `registerEvent`, `registerDomEvent`, `registerInterval`, `this.register()`,
  or explicit cleanup for listeners, observers, timers, and resources.
- Prefer `Vault.process()` and `FileManager.processFrontMatter()` for writes.
- Avoid `innerHTML`; build DOM with Obsidian helpers and text setters.
- Do not introduce `:has()` selectors or `!important` in `styles.css` unless
  documented inline with a regression test.
- Add privacy documentation for any new data, network, or file access, and
  update `README.md` and `PRIVACY.md` accordingly.
- Create or reference a GitHub issue before feature work, and add user-facing
  entries under `## Unreleased` in `CHANGELOG.md` with the issue number.
