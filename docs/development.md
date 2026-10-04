# Development

Use a dedicated Obsidian test vault, never a vault you care about. Edit and Full
agent modes can modify files anywhere Pi can reach.

```bash
npm ci
npm run build
npm run ci
npm run dev:install -- /path/to/vault/.obsidian/plugins/pi-agent
```

Reload Obsidian, or disable and re-enable the plugin, after installing a dev
build. `PI_AGENT_DEV_DIR` or `OBSIDIAN_PI_DEV_DIR` can be used instead of the
path argument.

The full manual checklist lives in [`TESTING.md`](../TESTING.md), and the
release flow lives in [`RELEASE.md`](../RELEASE.md).

## Branches

`main` is the release branch. Feature work happens on an issue branch named for
its issue, reviewed as a pull request, and merged into `main`.

`integration` is a transient local scratch branch for testing several pull
requests together before they reach `main`. Create it when a batch needs joint
testing, and delete it once `main` has absorbed them:

```bash
git checkout main
git checkout -b integration
git merge <pr-branch>
npm run build
npm run ci
```

Point the test vault at that branch's build for the manual checks, then merge the
reviewed pull requests into `main`. It is never pushed and never permanently
maintained, so there is no branch to resync after each merge and no local-only
history to lose. Recreate it from `main` when the next batch lands.

## Quality gates

`npm run ci` runs, in order, and writes nothing:

1. `build:check` — rebuild in memory and fail if the committed `main.js` differs
2. `format:check` — Prettier over source, tests, scripts, docs, workflows, and
   JSON
3. `lint` — ESLint over `src`, `scripts`, and `tests`
4. `lint:obsidian` — the Obsidian plugin scanner, with a zero-warning budget
5. `typecheck` — `tsc --noEmit`
6. `test` — Vitest
7. `version:check` — version consistency across manifests

`ci` deliberately does not run `build`. It used to, and the bundle check that
followed regenerated the very file it compared against, so a stale committed
`main.js` always passed. Rebuild first, then verify:

```bash
npm run build
npm run ci
```

Run the whole gate before pushing. Targeted runs are fine while iterating:

```bash
npm run build:check
npm test
npm run lint
npm run lint:obsidian:report
npm run typecheck
npm run format:check
```

`lint:obsidian` fails on any scanner warning, because submission review reads
the full scanner output. `lint:obsidian:report` lists the same findings without
failing, for looking them up.

## Dependencies

Everything is a devDependency; the plugin ships a single bundled `main.js` and
no runtime `dependencies`. `obsidian`, `@codemirror/state`, and
`@codemirror/view` stay external in the build.

`package.json` carries `overrides` that pin transitive packages carrying
advisories. They are intentional: removing one will reintroduce a vulnerability,
so verify with `npm audit` before touching them.

`.github/dependabot.yml` opens weekly pull requests for npm and GitHub Actions
updates, which is what keeps those overrides and the pinned action SHAs current.
Dependabot cannot satisfy an override from a version range alone, so an advisory
that needs a new `overrides` entry is still a manual edit. The Security workflow
runs `npm audit --audit-level=high` over the whole installed tree on pull
requests, pushes, and a weekly schedule; `npm audit` covers the devDependencies
that execute during the build, and `npm run audit` runs the same check locally.

Use `npm ci`, not `npm install`, for reproducible installs. Some advisories have
no reachable fix through `npm audit fix`, so the lockfile is regenerated
deliberately rather than by the audit fixer.

## Continuous integration

| Workflow             | Trigger                                             | Purpose                                                                |
| -------------------- | --------------------------------------------------- | ---------------------------------------------------------------------- |
| `ci.yml`             | pull requests, pushes to `main`                     | Runs the `npm run ci` quality gate                                     |
| `security.yml`       | pull requests, pushes to `main`, weekly, manual     | Runs the zizmor workflow audit, `npm audit`, and the dependency review |
| `skip-lib-check.yml` | pull requests touching dependencies, weekly, manual | Reports when `skipLibCheck` can be removed                             |
| `release.yml`        | tags matching `[0-9]+.[0-9]+.[0-9]+`                | Publishes the release                                                  |

Notes that matter when changing these:

- Actions are pinned to full commit SHAs with a trailing `# vX.Y.Z` comment.
  GitHub only guarantees immutability at a SHA, so keep that form.
- zizmor runs in Advanced Security mode, which uploads SARIF and does not
  fail the run. Blocking comes from a `code_scanning` ruleset rule that gates
  merges on `zizmor` results at `alerts_threshold: errors`. That ruleset is a
  repository setting, not a file in this repository, so it will not travel with a
  clone.
- `release.yml` rebuilds and then diffs against the committed bundle. It
  runs `npm run ci`, which no longer writes, then `npm run build`, then
  `git diff --exit-code -- main.js`. A tag on a commit that changed `src/`
  without regenerating the bundle therefore fails the run before anything is
  published.
- The release trigger is digits and dots, not `*.*.*`. Obsidian reads the
  version from `manifest.json`, so a prerelease tag such as `0.0.16-beta.1` can
  never satisfy the version check. Restricting the trigger keeps such a tag
  from burning a full quality-gate run.
- `tsconfig.json` sets `skipLibCheck` because `obsidian@1.13.x` publishes
  declarations where `Menu`, `Modal`, and `PopoverSuggest` declare
  `HistoryHandler` without `onHistoryBack`. `skip-lib-check.yml` exists so the
  workaround is removed once upstream fixes it.

## Worktrees

`AGENTS.md` uses a transient local `integration` branch for joint testing of
several pull requests before they reach `main`. If you create a worktree for it
**inside** this repository, Vitest discovers the tests inside it and the suite
silently double-counts, which looks like extra passing tests rather than a
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
- Add privacy documentation for any new data, network, or file access, and update
  `README.md` and [Privacy](../PRIVACY.md) accordingly.
- Create or reference a GitHub issue before feature work, and add user-facing
  entries under `## Unreleased` in `CHANGELOG.md` with the issue number.
