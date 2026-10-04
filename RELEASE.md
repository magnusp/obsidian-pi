# Release process

Pi Agent keeps its release assets simple: `main.js`, `manifest.json`, and `styles.css`.

## Test locally

Use a dedicated Obsidian test vault, never your main vault.

```bash
npm ci
npm run build
npm run ci
npm run dev:install -- /path/to/vault/.obsidian/plugins/pi-agent
```

Or set a reusable target directory:

```bash
export PI_AGENT_DEV_DIR=/path/to/vault/.obsidian/plugins/pi-agent
npm run dev:install
```

Reload Obsidian, or disable and re-enable the plugin.

## Prepare a release

1. Choose the next SemVer version, for example `0.0.2`.
2. Update the version in:
   - `manifest.json`
   - `package.json`
   - `versions.json`
   - `CHANGELOG.md`
3. Regenerate the bundle, and then run the gate. The `npm run ci` command never writes to the repository, so you must run `npm run build` first, or the bundle check fails:

```bash
npm run build
npm run ci
```

4. Commit the release prep:

```bash
git add .
git commit -m "Release 0.0.2"
git push origin main
```

## Publish a release

Create and push a tag that matches the version in `manifest.json` and `package.json` exactly. Use plain SemVer with no suffix. A prerelease tag such as `0.0.16-beta.1` does not match the release trigger, so it can never satisfy the version check.

```bash
git tag 0.0.2
git push origin 0.0.2
```

The GitHub Actions release workflow verifies the quality gate, rebuilds the bundle and checks it against the committed bundle, extracts the notes for the current version from `CHANGELOG.md`, creates a GitHub release, uploads the assets that Obsidian supports, and generates artifact attestations:

- `main.js`
- `manifest.json`
- `styles.css`

For Obsidian Community plugins, the GitHub release assets are what users receive when they install or update the plugin. Do not attach extra files to the GitHub release, because Obsidian supports only the assets above.
