/**
 * dsh-connectome — Host half tests.
 *
 * Dependency-free: only Node builtins plus the plugin module itself.
 * Run from the package directory with:
 *
 *     node test/scan.test.mjs
 *
 * It builds a throwaway fixture directory under `test/`, asserts the scanner
 * output (every file kind, folder index, links, resolution, stats), then drives
 * the HTTP route through a minimal fake Cordis context (uniform rejections,
 * method, body, workspace selection, cache, error envelopes) and removes the
 * fixture.
 */
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const { apply, inject, name, scanWorkspace } = await import('../index.js')

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_ROOT = path.join(TEST_DIR, `.tmp-scan-${process.pid}-${Date.now()}`)
const GRAPH_PATH = '/connectome/api/graph'
const LARGE_FILE_BYTES = 600 * 1024

let checks = 0

/** @param {unknown} condition @param {string} message */
function check(condition, message) {
  checks += 1
  assert.ok(condition, message)
}

/** @param {unknown} actual @param {unknown} expected @param {string} message */
function checkEqual(actual, expected, message) {
  checks += 1
  assert.deepEqual(actual, expected, message)
}

/** @param {string} left @param {string} right @returns {number} */
function compareIds(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

/**
 * The fixture deliberately contains every graph-visible family: code, styles,
 * Markdown, a PDF, images, structured data, a font, a binary and dotfiles, plus
 * ignored directories and generated files. `src/large.js` is appended by
 * {@link writeFixture} because it exceeds the text-read cap.
 */
const FIXTURE_FILES = {
  'src/index.js': [
    "import { util } from './util'",
    "import './styles.css'",
    "export { util } from './util'",
    "// import { ghost } from './ghost.js'",
    "/* import('./ghost-dynamic.js') */",
    "export const lazy = () => import('./lazy.js')",
    "const legacy = require('./legacy.cjs')",
    'export default legacy',
  ].join('\n'),
  'src/util.js': 'export const util = 1\n',
  'src/legacy.cjs': 'module.exports = { legacy: true }\n',
  'src/lazy.js': 'export default 1\n',
  'src/alias-user.js': "import { util } from '@/src/util.js'\nexport default util\n",
  'src/root-relative.js': "import { util } from '/src/util.js'\nexport default util\n",
  'src/styles.css': [
    '@import "./theme.css";',
    '.logo { background: url(./media/logo.svg); }',
    '@font-face { font-family: Inter; src: url("./fonts/inter.woff2") format("woff2"); }',
    'body { color: #0f172a; }',
  ].join('\n'),
  'src/theme.css': ':root { --x: 1; }\n',
  'src/media/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>\n',
  'src/fonts/inter.woff2': 'wOF2 binary fixture\n',
  'src/plain.txt': 'plain text fixture\n',
  'src/features/deep/deep.ts': 'export const deep = 1\n',
  'src/features/other.ts': "import { deep } from './deep/deep'\nexport default deep\n",
  'src/bundle.min.js': "import './index.js'\n",
  'src/raw.map': '{}\n',
  'docs/readme.md': 'See [util](../src/util.js), ![logo](../src/media/logo.svg) and [spec](./spec.pdf).\n',
  'docs/guide.md': 'Back to [readme](readme.md#top) and [site](../web/index.html).\n',
  'docs/notes.txt': 'notes\n',
  'docs/spec.pdf': '%PDF-1.4 binary fixture\n',
  'web/index.html': [
    '<script src="main.js"></script>',
    '<link href="style.css" rel="stylesheet">',
    '<img src="../assets/hero.png" alt="hero">',
    '<a href="../docs/spec.pdf">spec</a>',
  ].join('\n'),
  'web/main.js': 'export const x = 1\n',
  'web/style.css': 'body { margin: 0; }\n',
  'assets/hero.png': 'PNG binary fixture\n',
  'py/app.py': 'from .helper import x\n',
  'py/helper.py': 'x = 1\n',
  'data/config.json': '{ "name": "fixture" }\n',
  'tools/run.exe': 'MZ binary fixture\n',
  '.gitignore': 'node_modules\n',
  '.DS_Store': 'junk\n',
  'node_modules/pkg/index.js': "import '../../src/index.js'\n",
  '.git/secret.js': "import '../src/index.js'\n",
  'dist/bundle.js': "import '../src/index.js'\n",
  '.dsh/state.json': '{}\n',
  'package-lock.json': '{}\n',
}

/** Fixture entries that must never become nodes. */
const IGNORED_FIXTURE = [
  '.DS_Store',
  '.dsh/state.json',
  '.git/secret.js',
  'dist/bundle.js',
  'node_modules/pkg/index.js',
  'package-lock.json',
  'src/bundle.min.js',
  'src/raw.map',
]

/** Every node the fixture must produce, sorted by id. */
const EXPECTED_IDS = [...Object.keys(FIXTURE_FILES).filter((id) => !IGNORED_FIXTURE.includes(id)), 'src/large.js'].sort(compareIds)

/** Folder index the fixture must produce. */
const EXPECTED_FOLDERS = [
  { id: 'assets', parent: null, depth: 1, files: 1, total: 1 },
  { id: 'data', parent: null, depth: 1, files: 1, total: 1 },
  { id: 'docs', parent: null, depth: 1, files: 4, total: 4 },
  { id: 'py', parent: null, depth: 1, files: 2, total: 2 },
  { id: 'src', parent: null, depth: 1, files: 10, total: 14 },
  { id: 'src/features', parent: 'src', depth: 2, files: 1, total: 2 },
  { id: 'src/features/deep', parent: 'src/features', depth: 3, files: 1, total: 1 },
  { id: 'src/fonts', parent: 'src', depth: 2, files: 1, total: 1 },
  { id: 'src/media', parent: 'src', depth: 2, files: 1, total: 1 },
  { id: 'tools', parent: null, depth: 1, files: 1, total: 1 },
  { id: 'web', parent: null, depth: 1, files: 3, total: 3 },
]

/** Every relationship the fixture must produce, sorted by source then target. */
const EXPECTED_LINKS = [
  { source: 'docs/guide.md', target: 'docs/readme.md', kind: 'markdown-link' },
  { source: 'docs/guide.md', target: 'web/index.html', kind: 'markdown-link' },
  { source: 'docs/readme.md', target: 'docs/spec.pdf', kind: 'markdown-link' },
  { source: 'docs/readme.md', target: 'src/media/logo.svg', kind: 'markdown-link' },
  { source: 'docs/readme.md', target: 'src/util.js', kind: 'markdown-link' },
  { source: 'py/app.py', target: 'py/helper.py', kind: 'python-import' },
  { source: 'src/alias-user.js', target: 'src/util.js', kind: 'import' },
  { source: 'src/features/other.ts', target: 'src/features/deep/deep.ts', kind: 'import' },
  { source: 'src/index.js', target: 'src/lazy.js', kind: 'dynamic-import' },
  { source: 'src/index.js', target: 'src/legacy.cjs', kind: 'require' },
  { source: 'src/index.js', target: 'src/styles.css', kind: 'import' },
  { source: 'src/index.js', target: 'src/util.js', kind: 'import' },
  { source: 'src/root-relative.js', target: 'src/util.js', kind: 'import' },
  { source: 'src/styles.css', target: 'src/fonts/inter.woff2', kind: 'asset-ref' },
  { source: 'src/styles.css', target: 'src/media/logo.svg', kind: 'asset-ref' },
  { source: 'src/styles.css', target: 'src/theme.css', kind: 'style-import' },
  { source: 'web/index.html', target: 'assets/hero.png', kind: 'html-ref' },
  { source: 'web/index.html', target: 'docs/spec.pdf', kind: 'html-ref' },
  { source: 'web/index.html', target: 'web/main.js', kind: 'html-ref' },
  { source: 'web/index.html', target: 'web/style.css', kind: 'html-ref' },
]

/** Expected per-kind node counts for the fixture. */
const EXPECTED_KINDS = { code: 16, doc: 5, data: 1, image: 2, media: 0, archive: 0, font: 1, other: 2 }

/** @returns {Promise<void>} */
async function writeFixture() {
  for (const [relativePath, contents] of Object.entries(FIXTURE_FILES)) {
    const absolutePath = path.join(FIXTURE_ROOT, ...relativePath.split('/'))
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, contents)
  }
  // Bigger than MAX_TEXT_BYTES (512 KiB) but still a node: parsed prefix only,
  // so the trailing import must not become a link.
  const largePath = path.join(FIXTURE_ROOT, 'src', 'large.js')
  await fs.writeFile(largePath, `${'a'.repeat(LARGE_FILE_BYTES)}\nimport './util.js'\n`)
}

/** @param {Array<{ source: string, target: string, kind: string }>} links */
function findLink(links, source, target) {
  return links.find((entry) => entry.source === source && entry.target === target)
}

/* -------------------------------------------------------------------------- */
/* HTTP harness: a minimal stand-in for the Cordis context + node req/res     */
/* -------------------------------------------------------------------------- */

/**
 * @param {{ workspaces?: unknown[], defaultDirectory?: string, rejection?: 401 | 403 }} [options]
 * @returns {{ ctx: any, routes: any[] }}
 */
function createFakeContext(options = {}) {
  const { workspaces, defaultDirectory, rejection } = options
  const routes = []
  const services = {}
  if (workspaces !== undefined) services.workspaceRegistry = { list: () => workspaces }
  if (defaultDirectory !== undefined) services.workingDirectory = { defaultDirectory }
  const ctx = {
    effect(callback) {
      const disposer = callback()
      return typeof disposer === 'function' ? disposer : () => {}
    },
    webServer: {
      register(route) {
        routes.push(route)
        return () => {}
      },
    },
    connection: {
      requestRejection: () => rejection,
    },
    get(serviceName) {
      return services[serviceName]
    },
  }
  return { ctx, routes }
}

/** @param {{ method?: string, body?: string }} [options] */
function createRequest(options = {}) {
  const { method = 'POST', body } = options
  const req = new EventEmitter()
  req.method = method
  req.headers = {}
  req.resume = () => {}
  queueMicrotask(() => {
    if (body !== undefined) req.emit('data', Buffer.from(body))
    req.emit('end')
  })
  return req
}

function createResponse() {
  const res = new EventEmitter()
  res.headersSent = false
  res.writableEnded = false
  res.statusCode = 0
  res.headers = {}
  res.body = ''
  res.writeHead = (status, headers) => {
    res.statusCode = status
    res.headers = headers ?? {}
    res.headersSent = true
    return res
  }
  res.end = (chunk) => {
    if (chunk !== undefined) res.body += String(chunk)
    res.writableEnded = true
    res.emit('finish')
    return res
  }
  return res
}

/**
 * @param {any} route registered route object.
 * @param {{ method?: string, body?: string }} [options]
 * @returns {Promise<{ status: number, headers: Record<string, string>, json: any }>}
 */
async function callRoute(route, options = {}) {
  const req = createRequest(options)
  const res = createResponse()
  const finished = new Promise((resolve) => res.once('finish', resolve))
  await route.handler(req, res)
  await finished
  return {
    status: res.statusCode,
    headers: res.headers,
    json: res.body === '' ? undefined : JSON.parse(res.body),
  }
}

/**
 * Assert the standard JSON error envelope and headers.
 *
 * @param {{ status: number, headers: Record<string, string>, json: any }} result
 * @param {number} status expected HTTP status.
 * @param {string} code expected error code.
 * @param {string} label assertion label.
 */
function checkErrorResponse(result, status, code, label) {
  check(result.status === status, `${label}: expected status ${status}, got ${result.status}`)
  check(result.json !== undefined && result.json.ok === false, `${label}: expected ok:false`)
  check(result.json?.error?.code === code, `${label}: expected error code ${code}, got ${String(result.json?.error?.code)}`)
  check(typeof result.json?.error?.message === 'string' && result.json.error.message.length > 0, `${label}: error message must be a non-empty string`)
  check(result.headers['content-type'] === 'application/json; charset=utf-8', `${label}: JSON content type`)
  check(result.headers['cache-control'] === 'no-store', `${label}: cache-control no-store`)
}

/** @param {any} options context options @returns {any} registered route */
function registerApiRoute(options) {
  const fake = createFakeContext(options)
  apply(fake.ctx)
  check(fake.routes.length === 1, 'apply registers exactly one HTTP route')
  return fake.routes[0]
}

/* -------------------------------------------------------------------------- */
/* Assertions                                                                 */
/* -------------------------------------------------------------------------- */

/** @param {any} graph scanWorkspace result */
function assertScanner(graph) {
  check(graph.root === FIXTURE_ROOT_REAL, `root must be the canonical fixture path, got ${graph.root}`)
  check(Array.isArray(graph.nodes), 'nodes must be an array')
  check(Array.isArray(graph.links), 'links must be an array')
  check(Array.isArray(graph.folders), 'folders must be an array')

  const ids = graph.nodes.map((node) => node.id)
  checkEqual(ids, EXPECTED_IDS, 'every non-ignored fixture file must be a node, sorted by id')

  const allowedKinds = new Set(['code', 'doc', 'data', 'image', 'media', 'archive', 'font', 'other'])
  for (const node of graph.nodes) {
    check(typeof node.id === 'string' && node.id.length > 0, 'node id must be a non-empty string')
    check(!node.id.includes('\\'), `node id must use '/', got ${node.id}`)
    check(!node.id.startsWith('/') && !/^[A-Za-z]:/.test(node.id), `node id must be relative, got ${node.id}`)
    check(node.label === path.posix.basename(node.id), `label mismatch for ${node.id}`)
    check(node.ext === path.posix.extname(node.id).toLowerCase(), `ext mismatch for ${node.id}`)
    check(node.dir === path.posix.dirname(node.id), `dir mismatch for ${node.id}`)
    check(Number.isInteger(node.size) && node.size >= 0, `size must be an integer for ${node.id}`)
    check(allowedKinds.has(node.kind), `node kind must be a declared family for ${node.id}, got ${String(node.kind)}`)
  }

  const kindOf = (id) => graph.nodes.find((node) => node.id === id)?.kind
  check(kindOf('src/index.js') === 'code', 'JavaScript must be a code node')
  check(kindOf('src/styles.css') === 'code', 'CSS must be a code node')
  check(kindOf('web/index.html') === 'code', 'HTML must be a code node')
  check(kindOf('docs/readme.md') === 'doc', 'Markdown must be a document node')
  check(kindOf('docs/spec.pdf') === 'doc', 'a PDF must become a document node')
  check(kindOf('src/plain.txt') === 'doc', 'plain text must become a document node')
  check(kindOf('src/media/logo.svg') === 'image', 'an SVG must become an image node')
  check(kindOf('assets/hero.png') === 'image', 'a PNG must become an image node')
  check(kindOf('src/fonts/inter.woff2') === 'font', 'a WOFF2 must become a font node')
  check(kindOf('data/config.json') === 'data', 'JSON must become a data node')
  check(kindOf('tools/run.exe') === 'other', 'an unknown binary must become an other node')
  check(kindOf('.gitignore') === 'other', 'dotfiles are files too and must appear')
  check(kindOf('LICENSE') === undefined, 'fixture has no LICENSE node')
  check(kindOf('src/large.js') === 'code', 'oversized text file must still be a code node')

  const indexNode = graph.nodes.find((node) => node.id === 'src/index.js')
  check(indexNode?.label === 'index.js', 'label must be the basename')
  check(indexNode?.ext === '.js', 'ext must be lowercase with dot')
  check(indexNode?.dir === 'src', 'dir must be the parent directory')
  check(indexNode?.size === Buffer.byteLength(FIXTURE_FILES['src/index.js']), 'size must come from fs.stat')

  const largeNode = graph.nodes.find((node) => node.id === 'src/large.js')
  check(largeNode !== undefined && largeNode.size > LARGE_FILE_BYTES, 'oversized text file must still be a node')

  for (const ignored of IGNORED_FIXTURE) {
    check(!ids.includes(ignored), `${ignored} must be ignored`)
  }

  checkEqual(graph.folders, EXPECTED_FOLDERS, 'folder index must list every containing directory with counts and parents')

  const links = graph.links
  checkEqual(links.length, EXPECTED_LINKS.length, `expected ${EXPECTED_LINKS.length} links, got ${links.length}`)
  checkEqual(links, EXPECTED_LINKS, 'links must be complete, sorted by source then target, with expected kinds')

  check(findLink(links, 'src/index.js', 'src/util.js')?.kind === 'import', 'static import kind')
  check(findLink(links, 'src/index.js', 'src/lazy.js')?.kind === 'dynamic-import', 'dynamic import kind')
  check(findLink(links, 'src/index.js', 'src/legacy.cjs')?.kind === 'require', 'require kind')
  check(findLink(links, 'src/styles.css', 'src/theme.css')?.kind === 'style-import', 'style import kind')
  check(findLink(links, 'src/styles.css', 'src/media/logo.svg')?.kind === 'asset-ref', 'CSS url() must link an image asset')
  check(findLink(links, 'src/styles.css', 'src/fonts/inter.woff2')?.kind === 'asset-ref', 'CSS url() must link a font asset')
  check(findLink(links, 'docs/readme.md', 'docs/spec.pdf')?.kind === 'markdown-link', 'Markdown must link a PDF')
  check(findLink(links, 'docs/readme.md', 'src/media/logo.svg')?.kind === 'markdown-link', 'Markdown images must link image files')
  check(findLink(links, 'web/index.html', 'assets/hero.png')?.kind === 'html-ref', 'HTML <img src> must link an image')
  check(findLink(links, 'web/index.html', 'docs/spec.pdf')?.kind === 'html-ref', 'HTML <a href> must link a PDF')
  check(findLink(links, 'py/app.py', 'py/helper.py')?.kind === 'python-import', 'python import kind')
  check(findLink(links, 'src/alias-user.js', 'src/util.js') !== undefined, '@/ alias must resolve from the root')
  check(findLink(links, 'src/root-relative.js', 'src/util.js') !== undefined, 'root-relative specifier must resolve from the root')

  check(!links.some((link) => link.source === 'src/index.js' && link.target.includes('ghost')), 'commented-out imports must not link')
  check(!links.some((link) => link.source === 'src/large.js'), 'text beyond MAX_TEXT_BYTES must not be parsed')
  check(!links.some((link) => link.source === 'web/main.js' && link.target.includes('http')), 'absolute URLs must not link')

  const nodeIdSet = new Set(ids)
  const pairKeys = new Set(links.map((link) => `${link.source}\u0000${link.target}`))
  check(pairKeys.size === links.length, 'links must be deduped on source+target')
  check(links.every((link) => nodeIdSet.has(link.source) && nodeIdSet.has(link.target)), 'links must only reference node ids')
  check(links.every((link) => link.source !== link.target), 'no self links')
  const sortedLinks = [...links].sort((left, right) => (left.source === right.source ? (left.target < right.target ? -1 : left.target > right.target ? 1 : 0) : left.source < right.source ? -1 : 1))
  checkEqual(links, sortedLinks, 'links must be sorted')

  const stats = graph.stats
  check(Number.isInteger(stats.files) && stats.files === graph.nodes.length, 'stats.files must equal node count')
  check(Number.isInteger(stats.folders) && stats.folders === graph.folders.length, 'stats.folders must equal folder count')
  check(Number.isInteger(stats.scanned) && stats.scanned === 18, `stats.scanned must count parsed files, got ${stats.scanned}`)
  check(Number.isInteger(stats.links) && stats.links === links.length, 'stats.links must equal link count')
  check(stats.truncated === false, 'small fixture must not be truncated')
  check(Number.isInteger(stats.durationMs) && stats.durationMs >= 0, 'stats.durationMs must be an integer')
  checkEqual(stats.kinds, EXPECTED_KINDS, 'stats.kinds must count every file family')
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

let FIXTURE_ROOT_REAL

async function main() {
  check(name === 'dsh-connectome', 'exported plugin name must be dsh-connectome')
  checkEqual(inject, ['webServer', 'connection'], 'inject must list webServer and connection')
  check(typeof apply === 'function', 'apply must be exported as a function')
  check(typeof scanWorkspace === 'function', 'scanWorkspace must be exported as a function')

  await fs.mkdir(FIXTURE_ROOT, { recursive: true })
  try {
    await writeFixture()
    FIXTURE_ROOT_REAL = await fs.realpath(FIXTURE_ROOT)

    /* ------------------------------ scanner ------------------------------- */
    const graph = await scanWorkspace(FIXTURE_ROOT)
    assertScanner(graph)

    // Deterministic output (only durationMs may vary).
    const again = await scanWorkspace(FIXTURE_ROOT)
    checkEqual(again.nodes, graph.nodes, 'nodes must be deterministic')
    checkEqual(again.links, graph.links, 'links must be deterministic')
    checkEqual(again.folders, graph.folders, 'folders must be deterministic')
    check(again.root === graph.root, 'root must be stable')
    checkEqual({ ...again.stats, durationMs: 0 }, { ...graph.stats, durationMs: 0 }, 'stats must be deterministic')

    // Budget limits set truncated.
    const limitedFiles = await scanWorkspace(FIXTURE_ROOT, { maxFiles: 3 })
    check(limitedFiles.nodes.length === 3, 'maxFiles must cap nodes')
    check(limitedFiles.stats.truncated === true, 'maxFiles overflow must set truncated')
    check(limitedFiles.folders.length <= limitedFiles.nodes.length, 'folder index must only contain scanned nodes')
    const limitedParse = await scanWorkspace(FIXTURE_ROOT, { maxParseFiles: 1 })
    check(limitedParse.stats.scanned === 1, 'maxParseFiles must cap parsed files')
    check(limitedParse.stats.truncated === true, 'maxParseFiles overflow must set truncated')

    // Clear failure for a missing root.
    let missingRootError
    try {
      await scanWorkspace(path.join(FIXTURE_ROOT, 'missing-dir'))
    } catch (error) {
      missingRootError = error
    }
    check(missingRootError instanceof Error && /does not exist/.test(missingRootError.message), 'scanWorkspace must throw for a missing root')

    /* ------------------------------ HTTP API ------------------------------ */
    const route = registerApiRoute()
    check(route.kind === 'exact', 'route kind must be exact')
    check(route.path === GRAPH_PATH, `route path must be ${GRAPH_PATH}`)
    check(typeof route.handler === 'function', 'route must expose a handler')

    checkErrorResponse(await callRoute(route, { body: '{}' }), 409, 'no-workspace', 'no workspace')
    checkErrorResponse(await callRoute(route, {}), 409, 'no-workspace', 'omitted body')
    checkErrorResponse(await callRoute(route, { body: JSON.stringify({ pad: 'x'.repeat(70 * 1024) }) }), 413, 'invalid-body', 'oversized body')
    checkErrorResponse(await callRoute(route, { method: 'GET' }), 405, 'method-error', 'wrong method')
    const methodResult = await callRoute(route, { method: 'GET' })
    check(methodResult.headers.allow === 'POST', '405 must advertise Allow: POST')

    const rejected401 = await callRoute(registerApiRoute({ rejection: 401 }), { body: '{}' })
    checkErrorResponse(rejected401, 401, 'unauthorized', 'rejected 401')
    const rejected403 = await callRoute(registerApiRoute({ rejection: 403 }), { body: '{}' })
    checkErrorResponse(rejected403, 403, 'forbidden', 'rejected 403')

    const fixtureWorkspace = { id: 'ws-1', path: FIXTURE_ROOT, title: 'Fixture' }
    const workspaceRoute = registerApiRoute({ workspaces: [fixtureWorkspace], defaultDirectory: FIXTURE_ROOT })

    checkErrorResponse(await callRoute(workspaceRoute, { body: '{' }), 400, 'invalid-body', 'invalid JSON body')
    checkErrorResponse(await callRoute(workspaceRoute, { body: '[1,2]' }), 400, 'invalid-body', 'non-object JSON body')
    checkErrorResponse(await callRoute(workspaceRoute, { body: '{"root":42}' }), 400, 'invalid-root', 'non-string root')
    checkErrorResponse(await callRoute(workspaceRoute, { body: JSON.stringify({ root: path.dirname(FIXTURE_ROOT) }) }), 400, 'root-not-allowed', 'outside root')

    const success = await callRoute(workspaceRoute, { body: '{}' })
    check(success.status === 200, `default workspace scan must return 200, got ${success.status}`)
    check(success.json?.ok === true, 'success payload must set ok:true')
    check(success.json.root === FIXTURE_ROOT_REAL, 'success root must be canonical')
    checkEqual(success.json.roots, [{ path: FIXTURE_ROOT_REAL, title: 'Fixture' }], 'cwd covered by a workspace must not be offered twice')
    check(success.json.nodes?.length === EXPECTED_IDS.length, 'success payload must carry every file node')
    check(success.json.links?.length === EXPECTED_LINKS.length, 'success payload must carry every link')
    check(success.json.folders?.length === EXPECTED_FOLDERS.length, 'success payload must carry the folder index')
    check(success.json.stats?.files === EXPECTED_IDS.length && success.json.stats?.links === EXPECTED_LINKS.length, 'success payload must carry stats')
    check(success.json.stats?.folders === EXPECTED_FOLDERS.length, 'success stats must count folders')
    check(success.headers['content-type'] === 'application/json; charset=utf-8', 'success must be JSON')
    check(success.headers['cache-control'] === 'no-store', 'success must not be cached by the browser')

    // The body is optional: an empty POST scans the default root.
    const emptyBody = await callRoute(workspaceRoute, {})
    check(emptyBody.status === 200 && emptyBody.json.root === FIXTURE_ROOT_REAL, 'empty body must scan the default root')

    // Second call within the TTL must be served from the in-memory cache.
    const cached = await callRoute(workspaceRoute, { body: '{}' })
    checkEqual(cached.json, success.json, 'repeated scans of one root must reuse the cache')

    // Explicit root, with and without a trailing separator.
    const explicit = await callRoute(workspaceRoute, { body: JSON.stringify({ root: `${FIXTURE_ROOT}${path.sep}` }) })
    check(explicit.status === 200 && explicit.json.root === FIXTURE_ROOT_REAL, 'explicit root must canonicalize and succeed')

    // Default-root order: skip a registered workspace whose directory is gone.
    const staleFirst = registerApiRoute({
      workspaces: [{ id: 'gone', path: path.join(FIXTURE_ROOT, 'missing-dir'), title: 'Missing' }, fixtureWorkspace],
      defaultDirectory: FIXTURE_ROOT,
    })
    const staleResult = await callRoute(staleFirst, { body: '{}' })
    check(staleResult.status === 200 && staleResult.json.root === FIXTURE_ROOT_REAL, 'default root must skip missing workspaces')
    checkEqual(staleResult.json.roots, [{ path: FIXTURE_ROOT_REAL, title: 'Fixture' }], 'missing workspaces must not be offered')

    // Default-root order: a workspace containing the default directory wins.
    const contained = registerApiRoute({ workspaces: [fixtureWorkspace], defaultDirectory: path.join(FIXTURE_ROOT, 'src') })
    const containedResult = await callRoute(contained, { body: '{}' })
    check(containedResult.status === 200 && containedResult.json.root === FIXTURE_ROOT_REAL, 'default root must be the workspace containing cwd')

    // Default-root order: cwd alone (no registered workspaces).
    const cwdOnly = registerApiRoute({ workspaces: [], defaultDirectory: FIXTURE_ROOT })
    const cwdResult = await callRoute(cwdOnly, { body: '{}' })
    check(cwdResult.status === 200 && cwdResult.json.root === FIXTURE_ROOT_REAL, 'cwd must be scanned when no workspace exists')
    checkEqual(cwdResult.json.roots, [{ path: FIXTURE_ROOT_REAL, title: 'Current working directory' }], 'cwd-only root must be titled')

    /* ------------------------------ summary ------------------------------- */
    console.log(`OK scan.test.mjs: ${checks} checks`)
  } finally {
    await fs.rm(FIXTURE_ROOT, { recursive: true, force: true })
  }
}

try {
  await main()
} catch (error) {
  console.error(`FAIL scan.test.mjs: ${error instanceof Error ? error.stack : String(error)}`)
  process.exitCode = 1
}
