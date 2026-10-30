import { readFileSync } from 'node:fs'

const artifact = readFileSync('client.js', 'utf8')
const source = readFileSync('client.source.js', 'utf8')
const manifest = JSON.parse(readFileSync('package.json', 'utf8'))

/** Canvas visibility regressions that produced an apparently empty graph in the browser. */
const canvasVisibility = {
  // Compact deterministic seed layout: leaving every node at (0,0) makes d3
  // skip its spiral initialization and the layout explodes until nodes are sub-pixel.
  'seed phyllotaxis layout': source.includes('GOLDEN_ANGLE') && /Math\.cos\(seedAngle\) \* seedRadius/.test(source),
  // Weak forceX/forceY keeps disconnected files inside the same cloud.
  'weak x/y centering': source.includes("d3.forceX(0).strength(0.055)") && source.includes("d3.forceY(0).strength(0.055)"),
  // Nodes never paint below a pixel or so when fit-to-view zooms far out.
  'minimum node screen radius': source.includes('MIN_NODE_PX') && source.includes('function effectiveRadius'),
  // Border tokens carry their own rgba alpha; multiplying by globalAlpha made links invisible.
  'solid link color token': source.includes("theme.link = readColor('--dsw-alias-label-secondary'")
    && !source.includes("theme.link = readColor('--dsw-alias-border-l2'")
    && !source.includes("theme.link = read('--dsw-alias-border-l2'"),
  // A custom property the canvas cannot parse must not leave black default paint.
  'canvas color validation': source.includes('function readColor') && source.includes('rgb(1, 2, 3)'),
  // The sizing wrapper ref must actually be attached, otherwise the engine
  // bails out in its effect and the dialog shows a permanently blank canvas.
  'canvas wrapper ref attached': source.includes("className: 'cnx-canvas-wrap', ref: wrapRef"),
  // A paused/occluded Electron window must not leave a blank canvas before the
  // first requestAnimationFrame runs.
  'synchronous first paint': source.includes('Paint synchronously once'),
  // No temporary diagnostic build artifacts may ship.
  'no debug instrumentation': !source.includes('postDebug')
    && !source.includes('DEBUG_MODE')
    && !source.includes('cnx-diag')
    && !source.includes('TEMP DIAG')
    && !source.includes('connectome.diag')
    && !artifact.includes('cnx-diag')
    && !artifact.includes('connectome.diag')
    && !artifact.includes('DEBUG_MODE'),
}

/** Navigation + relationship features added after the first render fix. */
const navigation = {
  // A neuron click opens the file through the harness right-Sidebar preview.
  'right sidebar navigation': source.includes("clientService('sidebarRight')")
    && source.includes('openResource(address)')
    && artifact.includes('clientService'),
  // The shared `dsh-resource://file/session/...` address grammar, built locally
  // because the Client bundle resolves no harness package at runtime.
  'file resource address grammar': source.includes('dsh-resource://file/session/')
    && source.includes('function fileResourceAddress')
    && source.includes('encodeAddressSegment'),
  // Session resolution prefers the navigation service's on-screen observable and
  // falls back to the UI Session adapter.
  'on-screen session resolution': source.includes("clientService('uiSession')")
    && source.includes('sidebarRight.mounted')
    && source.includes('function currentSessionId'),
  // Click vs drag: a press without movement navigates; a drag only moves the node.
  'click opens, drag moves': source.includes('press.moved')
    && source.includes('function openNodeInSidebar')
    && source.includes('onOpenFile(releasedNode)'),
  // Dependency direction is visible without hovering (arrow points at the import target).
  'direction arrowheads': source.includes('function drawArrowHeads')
    && source.includes('ctx.closePath()')
    && source.includes('drawArrowHeads(links'),
  // Documentation references render dashed; code/style relationships solid.
  'link families': source.includes('function isDocumentationLink')
    && source.includes('setLineDash([4 / scale, 4 / scale])'),
  // Hovering a link names both endpoints and its relation kind.
  'link relationship tooltip': source.includes('function relationsOf')
    && source.includes('mode: \'link\'')
    && source.includes('relationLabel(tRef.current, linkKind(hoverLink))'),
  // Relationship rows in the node tooltip are clickable file jumps.
  'clickable relationship rows': source.includes("className: 'cnx-tip-link'")
    && source.includes('onOpenFile(row.node)'),
  // Failure to open must explain itself instead of silently closing the graph.
  'open failure notice': source.includes('noPreview') && source.includes('cnx-notice'),
}

const checks = {
  'utf8 em dash': artifact.includes('\u2014'),
  // The browser module table keys a bundle by package name, so the generated
  // loader id must equal the published package name.
  'loader id': artifact.includes('id: ' + JSON.stringify(manifest.name)),
  'loader id is package name': manifest.name === 'dsh-connectome',
  'single loader': (artifact.match(/window\.__ModuleLoader__\.load\(\{/g) ?? []).length === 1,
  'single factory': (artifact.match(/factory:/g) ?? []).length === 1,
  'single source fn': (artifact.match(/function createConnectome\(require\)/g) ?? []).length === 1,
  'no deepseek require': !/require\(\s*['"]@deepseek-ai\//.test(artifact),
  'loader last': /window\.__ModuleLoader__\.load\(\{[\s\S]*\}\);\s*$/.test(artifact),
  'no sourcemap': !/sourceMappingURL/.test(artifact),
  'lf only': !artifact.includes('\r'),
  ...canvasVisibility,
  ...navigation,
}
let failed = 0
for (const [label, ok] of Object.entries(checks)) {
  if (!ok) failed += 1
  console.log((ok ? 'ok   ' : 'FAIL ') + label)
}
process.exitCode = failed === 0 ? 0 : 1
