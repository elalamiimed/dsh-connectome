# Contributing

Thanks for taking a look! Issues and pull requests are welcome.

## Development setup

The plugin is plain JavaScript with **no dev dependencies**: the d3 distributions it
inlines are committed under `vendor/`, and the tests use Node builtins only.

```bash
git clone https://github.com/elalamiimed/dsh-connectome.git
cd dsh-connectome

node build.mjs     # regenerate client.js from client.source.js + vendor/
npm test           # scanner, artifact and package contract tests
npm run check      # node --check on host and generated client
```

You only need `npm install` if you want to rebuild `client.js` from a different
d3-force copy: `node build.mjs --modules <node_modules dir>` looks there after
`vendor/`.

## Project layout

| Path | Role |
| --- | --- |
| `index.js` | Host half: workspace scanner, dependency parser, fenced graph route. |
| `client.source.js` | Readable Client half: slots, overlay, canvas engine. Build input. |
| `client.js` | Generated browser artifact. **Never edit by hand** — run `node build.mjs`. |
| `build.mjs` | Dependency-free build: inlines `vendor/d3-*.min.js`, emits the loader. |
| `test/` | Node-builtin test suites. |
| `locale/` | Plugin display metadata (English/Chinese). |

## Rules of thumb

- Keep the UI free of JSX (the client is authored as plain `React.createElement`) and
  keep `client.source.js` free of `import`/`export` lines and non-baseline `require`
  calls; the build validates both.
- UI colors must come from the host `--dsw-alias-*` theme tokens, and spacing/type
  geometry from the local `--ds-*` layer in the overlay stylesheet — do not invent
  one-off colors or spacing values.
- Never edit `client.js` directly: the build banner says so.
- Add a regression check to `test/` when you fix a rendering or interaction bug.
- Keep the first render path cheap: the canvas engine must retain its synchronous
  first paint and its stopped/rAF-driven simulation.
- Run `npm test` before opening a PR; CI runs the same suite on Node 18/20/22 and
  verifies that `client.js` is reproducible.

## Reporting bugs

Include your DSH version (`dsh --version` or the desktop build), OS, the workspace
shape (approximate file count), and what you expected to see. A screenshot or screen
recording of the canvas is very helpful.
