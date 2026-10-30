# Publishing Connectome

Maintainer notes for releasing a new version. The public install channel is the
registry package **`dsh-connectome`**; the GitHub repository can already be installed
straight from source (`github:elalamiimed/dsh-connectome`).

## Before the first npm publish

The npm name `dsh-connectome` must be owned by the publishing account. The package is
unscoped, public, and `publishConfig.access: public` is already set.

```bash
npm login                      # account that will own dsh-connectome
npm view dsh-connectome name   # 404 = free (at the time of writing it was free)
npm publish                    # runs prepublishOnly: build + check + tests
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

## Install channels users see

| Channel | Command / target | Notes |
| --- | --- | --- |
| Web UI **Plugins → Install** | `dsh-connectome` | After the first npm publish. |
| Web UI **Plugins → Install** | `github:elalamiimed/dsh-connectome` | Works before npm publication and tracks `main`. |
| Terminal | `dsh plugin --profile desktop add dsh-connectome` | Then enable the bundle in Plugins. |
| Terminal | `dsh plugin --profile desktop add github:elalamiimed/dsh-connectome` | Same caveat. |

## Why the old working name is not the npm name

The npm package `dsh-project-brain` was already taken by an unrelated DSH plugin, so
this project publishes as `dsh-connectome`. The Git history and the local development
folder may still carry the old working title; it is not part of the published identity.
