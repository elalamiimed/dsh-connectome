# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-10-30

First public release, published to npm as
[`dsh-connectome@1.0.0`](https://www.npmjs.com/package/dsh-connectome).

### Added

- **Connectome overlay** — a frame-wide dialog (slot `shell.overlay`) that renders a
  force-directed graph of the current workspace on a single `<canvas>`.
- **Relationship edges** — directed dependency links with arrowheads at the imported
  file: solid for `import` / `export … from` / dynamic `import()` / `require` /
  CSS `@import`, dashed for HTML and Markdown references. Hovering a link names both
  endpoints and the relation kind.
- **Relationship inspector** — hovering a node highlights its neighbourhood and lists
  its direct relationships (`→` imports, `←` imported by), each row clickable; `+N`
  summarises the remaining ones.
- **Click to code** — clicking a neuron opens that file in the harness' right-Sidebar
  document preview (`ctx.sidebarRight` + `dsh-resource://file/session/…`), with line
  numbers, copy and automatic reload. A missing preview/session is explained in the
  dialog footer instead of failing silently.
- **Sidebar entry** — a `🧠 Connectome` row in the sidebar panel list's **More** menu
  (slot `sidebar.panellist.actions`).
- **Workspace switcher, rescan, fit, zoom, pan, node drag** and `Esc` to close.
- **Theme-aware canvas** — colors read from live `--dsw-alias-*` tokens; light/dark
  switches recolor the graph.
- **Host scanner** — bounded recursive workspace scan with regex-based dependency
  extraction for JS/TS/Vue/Svelte, CSS/SCSS/Sass/Less/Stylus, HTML, Markdown and
  Python, served over a same-origin, connection-fenced `POST /connectome/api/graph`
  route.
- **Tests** — dependency-free scanner/route tests, artifact structure tests and a
  package/release contract test (`node test/*.test.mjs`).

[1.0.0]: https://github.com/elalamiimed/dsh-connectome/releases/tag/v1.0.0
