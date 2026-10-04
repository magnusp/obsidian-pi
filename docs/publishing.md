# Publishing

The mechanics of a release live in [Release process](../RELEASE.md). This file is
the reviewer's checklist.

Releases are automated. Pushing a tag that matches `[0-9]+.[0-9]+.[0-9]+` runs
`.github/workflows/release.yml`. That workflow installs dependencies, runs
`npm run ci`, rebuilds the release assets, checks the rebuild against the
committed bundle, extracts the notes for the version from `CHANGELOG.md`,
generates artifact attestations, and publishes a GitHub release. Pushing the
tag is the only manual step.

## Tag format

Release tags are exact SemVer values with no suffix, for example `0.0.16`.
Obsidian reads the version from `manifest.json`, and `scripts/check-version.mjs`
requires the tag to match it character for character, so a prerelease tag such
as `0.0.16-beta.1` can never satisfy the version check. The workflow trigger is
restricted to digits and dots, so such a tag does not start a run that fails
after the full quality gate. Tag with the plain version, or do not tag.

## Before tagging

- [ ] `manifest.json` `id` is still `pi-agent`, which Community Plugins
      install/update continuity depends on.
- [ ] `manifest.json`, `package.json`, and `versions.json` carry the same
      version, and `CHANGELOG.md` has that version as a released section.
- [ ] User-facing changes are under `## Unreleased` with issue numbers, or have
      been promoted into the release section.
- [ ] `README.md` explains requirements, installation, network use, file access, and
      safety.
- [ ] `PRIVACY.md` still describes the actual behavior for anything that changed the
      context sent to Pi, local storage, file writes, or shell access.
- [ ] `LICENSE` is present.
- [ ] You ran `npm run build`, and `npm run ci` passes locally. The `ci` command does
      not write anything, so run the build first, or the bundle check fails.
- [ ] `npm audit --audit-level=high` is clean, or any finding has a recorded
      reason to be accepted.
- [ ] The manual checks in [Pi Agent compatibility and pre-release checklist](../TESTING.md)
      are complete for the release. A green build does not imply manual validation.

## Release assets

Obsidian supports exactly three release assets. Do not attach anything else:

- `main.js`
- `manifest.json`
- `styles.css`

Regenerate `main.js` with `npm run build`, and commit it as part of the release
prep. The `npm run ci` command rebuilds in memory and compares that output
against the committed `main.js`, so a source change that ships without a
regenerated bundle fails the gate instead of passing quietly. The release
workflow rebuilds on the runner and fails if its output differs from the
committed bundle, so you cannot tag a commit that skipped the rebuild and
publish a stale `main.js`.

## After tagging

- [ ] The tag matches `manifest.json.version` exactly.
- [ ] The `Release Obsidian plugin` workflow succeeded.
- [ ] The GitHub release contains only the three assets above, with the expected
      notes.
- [ ] Artifact attestations were generated for the three assets.
- [ ] The release appears correctly for an existing installation update.

## Community Plugins submission

For a submission to the Community plugins directory:

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
- [ ] `README.md` states the requirements and the installation instructions, and its
      description is accurate about what the plugin sends to Pi.
- [ ] The repository is public and contains only the three release assets at
      its root.
- [ ] `isDesktopOnly` is still correct. It is correct, because the plugin spawns the Pi
      CLI.

## Notes

- `minAppVersion` in `manifest.json` tracks the oldest Obsidian version the
  plugin supports. Raising it is a user-visible change and needs a changelog
  entry.
- Release runs deliberately disable the npm cache, so that a cache entry written by an
  earlier pull request run cannot influence the published artifacts.
