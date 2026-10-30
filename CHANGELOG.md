# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-10-30

Makes the brain cover the whole workspace: every file family, folder geometry, and
references that point at non-code assets.

### Added

- **Every file is a neuron.** The Host no longer filters nodes by a source-code
  extension whitelist: any non-ignored regular file becomes a node, tagged with a coarse
  `kind` (`code`, `doc`, `data`, `image`, `media`, `archive`, `font`, `other`). PDFs,
  Office documents, images, fonts, media, archives and dotfiles now appear.
- **Asset references become links.** HTML `img`/`source`/`iframe`/`video`/`audio`/
  `track`/`a`/`object`/`video poster` attributes and CSS `url(...)` paths are extracted
  next to imports and Markdown links, so a PDF referenced from a README or a font
  referenced from a stylesheet shows its edge.
- **Folder structure.** The API returns a `folders` index (parent, depth, direct and
  subtree file counts) and the dialog paints folder/subfolder regions behind the graph
  as nested labelled outlines computed from the live layout. A header toggle shows or
  hides them; hovering a node emphasizes its folder chain.
- **Family shapes and legend.** Nodes are drawn as circles (code), rounded squares
  (docs), diamonds (data), rings (assets) and small dots (other); a legend counts each
  family, and the tooltip now reports kind, extension and byte size.
- **Richer stats.** `stats` gains `folders` and a per-kind `kinds` count; the header
  shows the folder count next to files and links.

### Changed

- **Chunkier scan coverage.** `.txt`, Office/PDF and other document formats are now
  nodes; lockfiles, source maps, minified bundles, editor swaps and OS junk
  (`.DS_Store`, `Thumbs.db`, `desktop.ini`) stay excluded.
- **Relations syntax table and sample payload** in the README describe the new kinds,
  asset references and folder index.
- Package version bumped to `1.1.0`; no Node/DSH engine change.

### Fixed

- References to assets that previous releases dropped (because the target was not in
  the source-file whitelist) now resolve and render as dashed structural edges.

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

[1.1.0]: https://github.com/elalamiimed/dsh-connectome/releases/tag/v1.1.0
[1.0.0]: https://github.com/elalamiimed/dsh-connectome/releases/tag/v1.0.0
