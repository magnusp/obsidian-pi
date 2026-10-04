# Publishing

The mechanics of a release live in [`RELEASE.md`](../RELEASE.md). This file is the
reviewer's checklist.

Releases are automated. Pushing a tag that matches `[0-9]+.[0-9]+.[0-9]+` runs
`.github/workflows/release.yml`, which installs, runs `npm run ci`, rebuilds the
release assets, checks that rebuild against the committed bundle, extracts the
notes for that version from `CHANGELOG.md`, generates artifact attestations, and
publishes a GitHub release. There is no manual release step beyond pushing the
tag.

## Tag format

Release tags are exact SemVer with no suffix, for example `0.0.16`. Obsidian
reads the version from `manifest.json`, and `scripts/check-version.mjs` requires
the tag to equal it character for character, so a prerelease tag such as
`0.0.16-beta.1` can never satisfy the version check. The workflow trigger is
restricted to digits-and-dots so such a tag does not start a run that would fail
after the full quality gate. Tag with the plain version, or do not tag.

## Before tagging

- [ ] `manifest.json` `id` is still `pi-agent`, which Community Plugins
      install/update continuity depends on.
- [ ] `manifest.json`, `package.json`, and `versions.json` carry the same
      version, and `CHANGELOG.md` has that version as a released section.
- [ ] User-facing changes are under `## Unreleased` with issue numbers, or have
      been promoted into the release section.
- [ ] `README.md` explains requirements, install, network use, file access, and
      safety.
- [ ] `PRIVACY.md` still matches actual behaviour for anything that changed
      context sent to Pi, local storage, file writes, or shell access.
- [ ] `LICENSE` is present.
- [ ] `npm run build` has been run, and `npm run ci` passes locally. `ci` does
      not write anything, so run the build first or the bundle check fails.
- [ ] `npm audit --audit-level=high` is clean, or any finding has a recorded
      reason to be accepted.
- [ ] Manual checks in [`TESTING.md`](../TESTING.md) are complete for the
      release. Manual validation is not implied by a green build.

## Release assets

Obsidian supports exactly three release assets. Do not attach anything else:

- `main.js`
- `manifest.json`
- `styles.css`

`main.js` must be regenerated with `npm run build` and committed as part of the
release prep. `npm run ci` rebuilds in memory and compares that output against
the committed `main.js`, so a source change shipped without a regenerated
bundle fails the gate rather than passing quietly. The release workflow rebuilds
on the runner and fails if its output differs from the committed bundle, so a
tag on a commit that skipped the rebuild cannot publish a stale `main.js`.

## After tagging

- [ ] The tag matches `manifest.json.version` exactly.
- [ ] The `Release Obsidian plugin` workflow succeeded.
- [ ] The GitHub release contains only the three assets above, with the expected
      notes.
- [ ] Artifact attestations were generated for the three assets.
- [ ] The release appears correctly for an existing installation update.

## Community Plugins submission

For a submission to the Community Plugins directory:

- [ ] `manifest.json` `id` stays `pi-agent`. Obsidian records the id of an
      installed plugin, so changing it makes existing installations look like a
      different plugin.
- [ ] Decide and record the repository name. The repository is `obsidian-pi`
      while the plugin id is `pi-agent`, and Obsidian's guidance is a repository
      named `obsidian-<plugin id>`. Nothing in this repository enforces that,
      so it is an explicit decision rather than a check. If the name is kept,
      confirm the submission is accepted as-is before release, because renaming a
      repository after users have installed from it is more disruptive than
      renaming it now.
- [ ] `README.md` states requirements and install instructions, and the
      description is accurate about what the plugin sends to Pi.
- [ ] The repository is public and contains only the three release assets at
      its root.
- [ ] `isDesktopOnly` is still correct. It is, because the plugin spawns the Pi
      CLI.

## Notes

- `minAppVersion` in `manifest.json` tracks the oldest Obsidian version the
  plugin supports. Raising it is a user-visible change and needs a changelog
  entry.
- Release runs deliberately disable the npm cache so that a cache entry written
  by an earlier pull request run cannot influence published artifacts.
