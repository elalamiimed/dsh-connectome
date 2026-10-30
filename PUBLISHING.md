# Publishing Connectome

Maintainer notes for releasing a new version. The public install channel is the
registry package **`dsh-connectome`**; the GitHub repository can also be installed
straight from source (`github:elalamiimed/dsh-connectome`).

> **Status:** `1.0.0` is live on npm. `1.1.0` — every file family, folder/subfolder
> regions and asset references — is committed on `main` (CI green) and awaits the
> maintainer's interactive publish: run `npm publish --registry https://registry.npmjs.org`
> and complete the browser one-time-password flow. After publishing, tag `v1.1.0` and
> create the GitHub release, then refresh the npm mirror (see the placeholder note below).

## Publishing a new version

The npm name `dsh-connectome` is owned by the publishing account. The package is
unscoped, public, and `publishConfig.access: public` is already set.

```bash
npm login --registry=https://registry.npmjs.org   # account that owns dsh-connectome
npm publish --registry=https://registry.npmjs.org --access public
```

The `prepublishOnly` script rebuilds `client.js`, syntax-checks both halves, and runs
the scanner/artifact/package test suites, so a broken artifact cannot be published.

## Release a version

1. Bump `version` in `package.json` and add a matching `CHANGELOG.md` section.
2. `node build.mjs && npm test` locally.
3. Commit, then tag: `git tag v1.2.3 && git push origin main v1.2.3`.
4. Either publish locally (`npm publish`) or let the tag-driven workflow do it:
   - Add a repository secret **`NPM_TOKEN`** (an npm automation token with publish
     rights for `dsh-connectome`).
   - Add a repository variable **`NPM_PUBLISH_ENABLED`** with value `true`.
   - The `Release` workflow then publishes the tag with `--provenance --access public`.
     Without the variable the tag run succeeds while skipping the publish job, so a
     tag push made before you are ready does not leave a red X in the Actions tab.
5. Create a GitHub release for the tag (release notes from `CHANGELOG.md`).

The workflow checks that the tag (`vX.Y.Z`) matches `package.json` before publishing.

## npm staged publishing and mirror placeholders

For a brand-new package, npm may first create a `0.0.0-stage` placeholder version
while the release is being reviewed. That placeholder has no `dsh.bundle`, so an
install that resolves it fails with `dsh-connectome declares no dsh.bundle`. npmjs
switches `latest` to the real version once the release lands; mirrors can lag.

If `registry.npmmirror.com` still advertises the placeholder, force a sync and verify:

```bash
curl -X PUT https://registry.npmmirror.com/dsh-connectome/sync
# {"ok":true,"logId":"..."} — the version endpoint is available right away,
# the package-level metadata may take a few more minutes to clear CDN caches
pnpm view dsh-connectome version --registry https://registry.npmmirror.com
```

Until a fresh mirror serves the release, users can pick **Official npm registry** in
the install dialog or install `github:elalamiimed/dsh-connectome`.

## Install channels users see

| Channel | Command / target | Notes |
| --- | --- | --- |
| Web UI **Plugins → Install** | `dsh-connectome` | Live on npm; `latest` is 1.1.0. |
| Web UI **Plugins → Install** | `github:elalamiimed/dsh-connectome` | Works before npm publication and tracks `main`. |
| Terminal | `dsh plugin --profile desktop add dsh-connectome` | Then enable the bundle in Plugins. |
| Terminal | `dsh plugin --profile desktop add github:elalamiimed/dsh-connectome` | Same caveat. |

## Why the old working name is not the npm name

The npm package `dsh-project-brain` was already taken by an unrelated DSH plugin, so
this project publishes as `dsh-connectome`. The Git history and the local development
folder may still carry the old working title; it is not part of the published identity.
