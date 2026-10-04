# Publishing

The mechanics of a release live in [`RELEASE.md`](../RELEASE.md). This file is the
reviewer's checklist.

Releases are automated. Pushing a tag that matches `*.*.*` runs
`.github/workflows/release.yml`, which installs, runs `npm run ci`, extracts the
notes for that version from `CHANGELOG.md`, generates artifact attestations, and
publishes a GitHub release. There is no manual release step beyond pushing the
tag.

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
- [ ] `npm run ci` passes locally.
- [ ] Manual checks in [`TESTING.md`](../TESTING.md) are complete for the
      release. Manual validation is not implied by a green build.

## Release assets

Obsidian supports exactly three release assets. Do not attach anything else:

- `main.js`
- `manifest.json`
- `styles.css`

`main.js` must be regenerated with `npm run build` and committed as part of the
release prep, since `build:check` verifies it.

## After tagging

- [ ] The tag matches `manifest.json.version` exactly.
- [ ] The `Release Obsidian plugin` workflow succeeded.
- [ ] The GitHub release contains only the three assets above, with the expected
      notes.
- [ ] Artifact attestations were generated for the three assets.
- [ ] The release appears correctly for an existing installation update.

## Notes

- `minAppVersion` in `manifest.json` tracks the oldest Obsidian version the
  plugin supports. Raising it is a user-visible change and needs a changelog
  entry.
- Release runs deliberately disable the npm cache so that a cache entry written
  by an earlier pull request run cannot influence published artifacts.
