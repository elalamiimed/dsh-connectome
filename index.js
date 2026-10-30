/**
 * dsh-connectome — Host half.
 *
 * Scans the active workspace directory and exposes a read-only, same-origin
 * HTTP endpoint that the browser half (`client.js`) calls to render a project
 * dependency graph.
 *
 * Every regular workspace file becomes a node (code, documents, PDFs, images,
 * data, media, fonts, archives …), each tagged with a coarse `kind`; the folder
 * tree is returned as well so the Client can draw folder/subfolder regions.
 * Text formats are parsed for references: imports/requires, styles, HTML and
 * Markdown links, CSS `url(...)` assets and Python imports. A reference becomes
 * a link whenever it resolves to another scanned file, whatever its type.
 *
 * HTTP API (exact route, registered in {@link apply}):
 *   POST /connectome/api/graph
 *   Request body: optional JSON `{ "root": "<absolute directory>" }`
 *   Success 200: { ok: true, root, roots, nodes, links, folders, stats }
 *   Failure:     { ok: false, error: { code, message } }
 *
 * The scanner itself ({@link scanWorkspace}) is exported as a pure async
 * function so it can be exercised without a running Harness. It only uses Node
 * builtins (`node:fs/promises`, `node:path`) and never throws on an individual
 * unreadable file or directory.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

/** @type {string} */
export const name = 'dsh-connectome'

/**
 * Host services required by the route. All other services are read optionally
 * at request time through `ctx.get(...)`.
 * @type {readonly string[]}
 */
export const inject = ['webServer', 'connection']

/* -------------------------------------------------------------------------- */
/* Host constants                                                             */
/* -------------------------------------------------------------------------- */

/** Exact same-origin HTTP route the browser half calls. */
const GRAPH_ROUTE_PATH = '/connectome/api/graph'

/**

/** Hard cap for a request body; the only expected body is `{ "root": "..." }`. */
const MAX_REQUEST_BODY_BYTES = 64 * 1024

/** How long a completed scan of one root may be reused. */
const GRAPH_CACHE_TTL_MS = 15_000

/** Bound the per-plugin cache; one entry per recently scanned root. */
const GRAPH_CACHE_MAX_ENTRIES = 8

/** Every response carries these headers (JSON + never cached). */
const JSON_RESPONSE_HEADERS = Object.freeze({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
})

/** Title used when the deployment's default directory is offered as a root. */
const CURRENT_DIRECTORY_TITLE = 'Current working directory'

/* -------------------------------------------------------------------------- */
/* Scanner constants (documented limits)                                      */
/* -------------------------------------------------------------------------- */

/** Maximum number of file nodes returned for one scan. */
const MAX_FILES = 2_000

/** Maximum number of file entries examined while walking (bounds huge repos). */
const MAX_ENTRIES = 12_000

/** Maximum bytes read from one file while extracting imports. */
const MAX_TEXT_BYTES = 512 * 1024

/** Maximum number of files parsed for links in one scan. */
const MAX_PARSE_FILES = 1_500

/** Files larger than this become nodes but are never parsed (avoids generated blobs). */
const MAX_NODE_BYTES = 2 * 1024 * 1024

/**
 * Soft wall-clock budget for one scan. Cold network/cloud filesystems can make a
 * first read orders of magnitude slower than a warm local disk; the route then
 * answers with the partial graph it already has (`stats.truncated`) instead of
 * leaving the dialog hanging.
 */
const SCAN_DURATION_LIMIT_MS = 8_000

/* -------------------------------------------------------------------------- */
/* Scanner tables                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Coarse file families. Every scanned file becomes a node; the Client colors
 * and shapes neurons by `kind` and the dialog legend counts them.
 * @type {readonly string[]}
 */
const FILE_KINDS = Object.freeze(['code', 'doc', 'data', 'image', 'media', 'archive', 'font', 'other'])

/** Extension (lowercase, with dot) → coarse file kind. */
const KIND_BY_EXTENSION = new Map([
  // code: scripts, styles and markup
  ['.js', 'code'], ['.jsx', 'code'], ['.mjs', 'code'], ['.cjs', 'code'],
  ['.ts', 'code'], ['.tsx', 'code'], ['.mts', 'code'], ['.cts', 'code'],
  ['.vue', 'code'], ['.svelte', 'code'], ['.astro', 'code'],
  ['.css', 'code'], ['.scss', 'code'], ['.sass', 'code'], ['.less', 'code'], ['.styl', 'code'],
  ['.html', 'code'], ['.htm', 'code'],
  ['.py', 'code'], ['.rb', 'code'], ['.go', 'code'], ['.rs', 'code'],
  ['.java', 'code'], ['.kt', 'code'], ['.kts', 'code'], ['.cs', 'code'], ['.php', 'code'],
  ['.c', 'code'], ['.h', 'code'], ['.cc', 'code'], ['.cpp', 'code'], ['.hpp', 'code'],
  ['.sh', 'code'], ['.bash', 'code'], ['.zsh', 'code'], ['.ps1', 'code'],
  ['.sql', 'code'], ['.graphql', 'code'], ['.gql', 'code'], ['.proto', 'code'],
  // documents: prose plus what a reviewer opens to read
  ['.md', 'doc'], ['.mdx', 'doc'], ['.txt', 'doc'], ['.rst', 'doc'], ['.tex', 'doc'],
  ['.pdf', 'doc'], ['.doc', 'doc'], ['.docx', 'doc'], ['.ppt', 'doc'], ['.pptx', 'doc'],
  ['.odt', 'doc'], ['.ods', 'doc'], ['.odp', 'doc'], ['.rtf', 'doc'], ['.epub', 'doc'],
  // structured data and configuration
  ['.json', 'data'], ['.jsonc', 'data'], ['.json5', 'data'], ['.yml', 'data'], ['.yaml', 'data'],
  ['.toml', 'data'], ['.xml', 'data'], ['.ini', 'data'], ['.csv', 'data'], ['.tsv', 'data'],
  ['.ipynb', 'data'], ['.db', 'data'], ['.sqlite', 'data'], ['.parquet', 'data'],
  // images
  ['.svg', 'image'], ['.png', 'image'], ['.jpg', 'image'], ['.jpeg', 'image'], ['.gif', 'image'],
  ['.webp', 'image'], ['.avif', 'image'], ['.bmp', 'image'], ['.ico', 'image'],
  ['.tif', 'image'], ['.tiff', 'image'], ['.heic', 'image'], ['.heif', 'image'],
  // audio / video
  ['.mp3', 'media'], ['.wav', 'media'], ['.ogg', 'media'], ['.m4a', 'media'], ['.flac', 'media'],
  ['.aac', 'media'], ['.opus', 'media'], ['.mp4', 'media'], ['.webm', 'media'], ['.mov', 'media'],
  ['.avi', 'media'], ['.mkv', 'media'], ['.m4v', 'media'],
  // archives and package containers
  ['.zip', 'archive'], ['.tar', 'archive'], ['.gz', 'archive'], ['.tgz', 'archive'],
  ['.bz2', 'archive'], ['.xz', 'archive'], ['.7z', 'archive'], ['.rar', 'archive'],
  ['.jar', 'archive'], ['.whl', 'archive'],
  // fonts
  ['.woff', 'font'], ['.woff2', 'font'], ['.ttf', 'font'], ['.otf', 'font'], ['.eot', 'font'],
])

/** Extensionless files whose name identifies the kind. */
const KIND_BY_NAME = new Map([
  ['dockerfile', 'code'],
  ['makefile', 'code'],
  ['procfile', 'code'],
  ['gemfile', 'code'],
  ['rakefile', 'code'],
  ['justfile', 'code'],
  ['license', 'doc'],
  ['licence', 'doc'],
  ['copying', 'doc'],
  ['notice', 'doc'],
  ['readme', 'doc'],
  ['changelog', 'doc'],
  ['authors', 'doc'],
  ['contributors', 'doc'],
])

/** Extensions parsed for import/export/require specifiers. */
const SCRIPT_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts', '.vue', '.svelte', '.astro'])

/** Extensions parsed for `@import` / `@use` / `@forward`. */
const STYLE_EXTENSIONS = new Set(['.css', '.scss', '.sass', '.less', '.styl'])

/** Extensions parsed for `<script src>` / `<link href>` references. */
const MARKUP_EXTENSIONS = new Set(['.html', '.htm', '.vue', '.svelte'])

/** Extensions parsed for markdown relative links. */
const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx'])

/** Extensions parsed for Python relative imports. */
const PYTHON_EXTENSIONS = new Set(['.py'])

/** Union of every extension worth reading for links. */
const PARSE_EXTENSIONS = new Set([
  ...SCRIPT_EXTENSIONS,
  ...STYLE_EXTENSIONS,
  ...MARKUP_EXTENSIONS,
  ...MARKDOWN_EXTENSIONS,
  ...PYTHON_EXTENSIONS,
])

/** Resolution candidates tried after an exact node-id match (order matters). */
const RESOLVE_EXTENSIONS = Object.freeze([
  '.ts', '.tsx', '.d.ts', '.mts', '.cts',
  '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.vue', '.svelte', '.astro',
  '.css', '.scss', '.sass', '.less',
  '.md', '.mdx',
  '.py', '.rb', '.go', '.rs', '.java', '.cs', '.php', '.html',
])

/** Directory names that are never walked (case-insensitive). */
const IGNORED_DIRECTORY_NAMES = new Set([
  'node_modules', '.git', '.hg', '.svn', '.dsh', '.next', '.nuxt',
  '.svelte-kit', '.turbo', '.parcel-cache', '.cache', '.idea', '.vscode',
  'coverage', 'dist', 'build', 'out', 'target', 'bin', 'obj', '__pycache__',
  '.venv', 'venv', 'env', '.mypy_cache', '.pytest_cache', '.gradle',
  '.terraform', '.yarn', 'bower_components', 'jspm_packages', 'tmp', 'temp',
])

/** Lockfiles, generated files and OS junk that never become nodes. */
const IGNORED_FILE_NAMES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'npm-shrinkwrap.json',
  '.ds_store', 'thumbs.db', 'desktop.ini',
])

/* -------------------------------------------------------------------------- */
/* Extraction patterns                                                        */
/* -------------------------------------------------------------------------- */

const BLOCK_COMMENT_RE = /\/\*[\s\S]*?\*\//g
const LINE_COMMENT_RE = /(^|[^\\:])\/\/[^\n\r]*/g

// `import x from '...'`, `import {a} from '...'`, `import '...'`.
const IMPORT_SOURCE_RE = /\bimport\s+(?:[\w$*{}\s,]+?\bfrom\s+)?['"]([^'"]+)['"]/g
// `export * from '...'` and `export {a} from '...'`.
const EXPORT_FROM_RE = /\bexport\s+(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g
// `import('./x')`.
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
// `require('./x')`.
const REQUIRE_RE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g
// `@import "..."`, `@use "..."`, `@forward "..."`, `@import url("...")`.
const STYLE_IMPORT_RE = /@(?:import|use|forward)\s+(?:url\(\s*)?['"]([^'"]+)['"]/g
// `<script src="...">`.
const SCRIPT_SRC_RE = /<script\b[^>]*\bsrc\s*=\s*['"]([^'"]+)['"]/gi
// `<link href="...">`.
const LINK_HREF_RE = /<link\b[^>]*\bhref\s*=\s*['"]([^'"]+)['"]/gi
// `<img src>`, `<source src>`, `<iframe src>`, `<embed src>`, `<video src>`,
// `<audio src>`, `<track src>`: markup asset references.
const ASSET_SRC_RE = /<(?:img|source|iframe|embed|video|audio|track)\b[^>]*\bsrc\s*=\s*['"]([^'"]+)['"]/gi
// `<a href>` / `<area href>`: navigational references, often to documents.
const ANCHOR_HREF_RE = /<(?:a|area)\b[^>]*\bhref\s*=\s*['"]([^'"]+)['"]/gi
// `<object data="...">`.
const OBJECT_DATA_RE = /<object\b[^>]*\bdata\s*=\s*['"]([^'"]+)['"]/gi
// `<video poster="...">`.
const VIDEO_POSTER_RE = /<video\b[^>]*\bposter\s*=\s*['"]([^'"]+)['"]/gi
// CSS `url(...)` references: images, fonts, cursors.
const CSS_URL_RE = /url\(\s*(?:['"])?([^'")]+?)(?:['"])?\s*\)/gi
// Markdown links and images: `[x](./path)` / `![x](../path)`.
const MARKDOWN_LINK_RE = /\]\(\s*([^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g
// `from .helper import x` / `from ..pkg.mod import x`.
const PYTHON_FROM_RE = /^[ \t]*from[ \t]+(\.+[A-Za-z0-9_.]*)[ \t]+import\b/gm
// `import a.b` (bare names are dropped by the resolver; relative-only rule).
const PYTHON_IMPORT_RE = /^[ \t]*import[ \t]+([A-Za-z0-9_.]+)/gm

/* -------------------------------------------------------------------------- */
/* Plugin entry point                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Register the graph HTTP route on the Harness web server.
 *
 * The route owns its full response lifecycle and delegates all scanning to
 * {@link scanWorkspace}. Cache state is private to this plugin instance.
 *
 * @param {import('cordis').Context} ctx plugin context (hard `webServer`/`connection` injects).
 * @returns {void}
 */
export function apply(ctx) {
  const cache = new Map()
  const pending = new Map()

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: GRAPH_ROUTE_PATH,
        handler: (req, res) => handleGraphRequest(ctx, req, res, cache, pending),
      }),
    'connectome: graph route',
  )
}


/* -------------------------------------------------------------------------- */
/* HTTP route                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Handle one `POST /connectome/api/graph` request.
 *
 * Order: connection rejection → method → body → workspace selection →
 * (cached) scan → JSON response.
 *
 * @param {import('cordis').Context} ctx plugin context.
 * @param {import('node:http').IncomingMessage} req request.
 * @param {import('node:http').ServerResponse} res response.
 * @param {Map<string, { graph: ScanGraph, at: number }>} cache completed scans.
 * @param {Map<string, Promise<ScanGraph>>} pending in-flight scans.
 * @returns {Promise<void>}
 */
async function handleGraphRequest(ctx, req, res, cache, pending) {
  try {
    // Fence the route exactly like the Harness browser carrier does.
    const rejection = ctx.connection.requestRejection(req)
    if (rejection !== undefined) {
      const unauthorized = rejection === 401
      sendError(res, rejection, unauthorized ? 'unauthorized' : 'forbidden', unauthorized ? 'Authentication is required to read the project graph.' : 'This connection is not allowed to read the project graph.')
      return
    }

    if (req.method !== 'POST') {
      sendError(res, 405, 'method-error', 'method not allowed', { allow: 'POST' })
      return
    }

    let body
    try {
      body = await readJsonBody(req)
    } catch (error) {
      const tooLarge = error && error.code === 'body-too-large'
      sendError(res, tooLarge ? 413 : 400, 'invalid-body', error instanceof Error ? error.message : 'Request body must be a valid JSON object.')
      return
    }

    const requestedRoot = body.root
    if (requestedRoot !== undefined && (typeof requestedRoot !== 'string' || requestedRoot.trim() === '')) {
      sendError(res, 400, 'invalid-root', '`root` must be a non-empty directory path string.')
      return
    }

    const selection = await collectWorkspaceSelection(ctx)

    let root
    if (requestedRoot !== undefined) {
      root = await resolveRequestedRoot(selection.roots, requestedRoot)
      if (root === undefined) {
        sendError(res, 400, 'root-not-allowed', 'That directory is not a registered workspace.')
        return
      }
    } else {
      const chosen = chooseDefaultRoot(selection)
      if (chosen === undefined) {
        sendError(res, 409, 'no-workspace', 'No workspace is registered yet.')
        return
      }
      root = chosen.path
    }

    const graph = await loadGraph(cache, pending, root)
    sendJson(res, 200, {
      ok: true,
      root: graph.root,
      roots: selection.roots.map((entry) => ({ path: entry.path, title: entry.title })),
      nodes: graph.nodes,
      links: graph.links,
      folders: graph.folders,
      stats: graph.stats,
    })
  } catch (error) {
    sendError(res, 500, 'scan-failed', error instanceof Error ? error.message : String(error))
  }
}

/**
 * Read and parse the optional JSON request body (capped at 64 KiB).
 *
 * @param {import('node:http').IncomingMessage} req request.
 * @returns {Promise<Record<string, unknown>>} parsed object ({} when body is empty).
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = []
    let bytes = 0
    let settled = false

    const settle = (callback, value) => {
      if (settled) return
      settled = true
      callback(value)
    }

    req.on('data', (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      bytes += buffer.length
      if (bytes > MAX_REQUEST_BODY_BYTES) {
        const error = new Error(`Request body exceeds ${MAX_REQUEST_BODY_BYTES} bytes.`)
        error.code = 'body-too-large'
        settle(reject, error)
        req.resume()
        return
      }
      chunks.push(buffer)
    })
    req.on('end', () => {
      if (settled) return
      const text = Buffer.concat(chunks).toString('utf8')
      if (text.trim() === '') {
        settle(resolve, {})
        return
      }
      let parsed
      try {
        parsed = JSON.parse(text)
      } catch {
        settle(reject, new Error('Request body must be valid JSON.'))
        return
      }
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        settle(reject, new Error('Request body must be a JSON object.'))
        return
      }
      settle(resolve, parsed)
    })
    req.on('error', (error) => settle(reject, error))
  })
}

/**
 * Write a JSON response, unless headers were already sent.
 *
 * @param {import('node:http').ServerResponse} res response.
 * @param {number} status HTTP status code.
 * @param {unknown} payload serializable payload.
 * @param {Record<string, string>} [extraHeaders] additional response headers.
 * @returns {void}
 */
function sendJson(res, status, payload, extraHeaders) {
  if (res.headersSent || res.writableEnded) return
  res.writeHead(status, extraHeaders === undefined ? JSON_RESPONSE_HEADERS : { ...JSON_RESPONSE_HEADERS, ...extraHeaders })
  res.end(JSON.stringify(payload))
}

/**
 * Write the standard error envelope.
 *
 * @param {import('node:http').ServerResponse} res response.
 * @param {number} status HTTP status code.
 * @param {string} code stable machine-readable error code.
 * @param {string} message human-readable message.
 * @param {Record<string, string>} [extraHeaders] additional response headers.
 * @returns {void}
 */
function sendError(res, status, code, message, extraHeaders) {
  sendJson(res, status, { ok: false, error: { code, message } }, extraHeaders)
}

/* -------------------------------------------------------------------------- */
/* Workspace selection                                                        */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {{ path: string, title: string }} WorkspaceRoot
 * @typedef {{ roots: WorkspaceRoot[], workspaces: WorkspaceRoot[], defaultDirectory: string | undefined }} WorkspaceSelection
 */

/**
 * Read the durable registry and the deployment default directory, if those
 * optional services are mounted. Never throws.
 *
 * @param {import('cordis').Context} ctx plugin context.
 * @returns {{ workspaces: WorkspaceRoot[], defaultDirectory: string | undefined }}
 */
function readRegisteredRoots(ctx) {
  /** @type {WorkspaceRoot[]} */
  const workspaces = []
  const registry = ctx.get('workspaceRegistry')
  if (registry && typeof registry.list === 'function') {
    let listed
    try {
      listed = registry.list()
    } catch {
      listed = []
    }
    if (Array.isArray(listed)) {
      for (const workspace of listed) {
        if (!workspace || typeof workspace.path !== 'string' || workspace.path.trim() === '') continue
        const resolved = path.resolve(workspace.path)
        const title = typeof workspace.title === 'string' && workspace.title.trim() !== '' ? workspace.title : path.basename(resolved)
        workspaces.push({ path: resolved, title })
      }
    }
  }

  const workingDirectory = ctx.get('workingDirectory')
  const rawDefault = workingDirectory && typeof workingDirectory.defaultDirectory === 'string' ? workingDirectory.defaultDirectory : undefined
  const defaultDirectory = rawDefault !== undefined && rawDefault.trim() !== '' ? path.resolve(rawDefault) : undefined

  return { workspaces, defaultDirectory }
}

/**
 * Build the canonical list of roots a request may scan: registered workspace
 * directories (durable order) first, then the default directory when it exists
 * and is not already covered by a workspace.
 *
 * @param {import('cordis').Context} ctx plugin context.
 * @returns {Promise<WorkspaceSelection>} selection used for validation and defaults.
 */
async function collectWorkspaceSelection(ctx) {
  const { workspaces, defaultDirectory } = readRegisteredRoots(ctx)

  /** @type {WorkspaceRoot[]} */
  const availableWorkspaces = []
  const seen = new Set()
  for (const workspace of workspaces) {
    const canonical = await canonicalDirectory(workspace.path)
    if (canonical === undefined) continue
    const key = pathKey(canonical)
    if (seen.has(key)) continue
    seen.add(key)
    availableWorkspaces.push({ path: canonical, title: workspace.title })
  }

  const roots = [...availableWorkspaces]
  let canonicalDefault
  if (defaultDirectory !== undefined) {
    canonicalDefault = await canonicalDirectory(defaultDirectory)
    if (canonicalDefault === undefined) {
      // Preserve the path for containment checks; it cannot become a root
      // because a choice must be an existing directory.
      canonicalDefault = defaultDirectory
    } else if (!roots.some((entry) => isInsideOrEqual(entry.path, canonicalDefault))) {
      roots.push({ path: canonicalDefault, title: CURRENT_DIRECTORY_TITLE })
    }
  }

  return { roots, workspaces: availableWorkspaces, defaultDirectory: canonicalDefault }
}

/**
 * Choose the root used when the request body omits `root`.
 *
 * 1. a registered workspace that contains the default directory,
 * 2. the first registered workspace whose directory exists,
 * 3. the default directory when it is an existing directory,
 * 4. otherwise none (the route answers 409).
 *
 * @param {WorkspaceSelection} selection current selection.
 * @returns {WorkspaceRoot | undefined} default root.
 */
function chooseDefaultRoot(selection) {
  const { roots, workspaces, defaultDirectory } = selection
  if (defaultDirectory !== undefined) {
    const container = workspaces.find((workspace) => isInsideOrEqual(workspace.path, defaultDirectory))
    if (container !== undefined) return container
  }
  if (workspaces.length > 0) return workspaces[0]
  return roots.find((entry) => entry.title === CURRENT_DIRECTORY_TITLE)
}

/**
 * Validate an explicit `root` from the request body against the allowed roots.
 *
 * @param {WorkspaceRoot[]} roots canonical, existing allowed roots.
 * @param {string} requestedRoot client-supplied directory path.
 * @returns {Promise<string | undefined>} canonical root, or undefined when not allowed.
 */
async function resolveRequestedRoot(roots, requestedRoot) {
  let canonical
  try {
    canonical = await fs.realpath(path.resolve(requestedRoot))
    const stats = await fs.stat(canonical)
    if (!stats.isDirectory()) return undefined
  } catch {
    return undefined
  }
  return roots.some((entry) => isInsideOrEqual(entry.path, canonical)) ? canonical : undefined
}

/**
 * Canonicalize a directory path when it exists and is a directory.
 *
 * @param {string} candidate absolute path.
 * @returns {Promise<string | undefined>} canonical path, or undefined.
 */
async function canonicalDirectory(candidate) {
  try {
    const canonical = await fs.realpath(candidate)
    const stats = await fs.stat(canonical)
    return stats.isDirectory() ? canonical : undefined
  } catch {
    return undefined
  }
}

/**
 * Case-normalized path for comparison keys (Windows paths are case-insensitive).
 *
 * @param {string} candidate path.
 * @returns {string} comparison key.
 */
function pathKey(candidate) {
  const resolved = path.resolve(candidate)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

/**
 * Test whether `child` equals or lives inside `parent`, case-insensitively on
 * Windows.
 *
 * @param {string} parent candidate ancestor directory.
 * @param {string} child candidate descendant directory.
 * @returns {boolean} true when contained.
 */
function isInsideOrEqual(parent, child) {
  const relative = path.relative(pathKey(parent), pathKey(child))
  if (relative === '') return true
  if (path.isAbsolute(relative)) return false
  return relative !== '..' && !relative.startsWith(`..${path.sep}`)
}

/* -------------------------------------------------------------------------- */
/* Scan cache                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Return a cached scan when fresh, otherwise join or start the scan for `root`.
 *
 * @param {Map<string, { graph: ScanGraph, at: number }>} cache completed scans.
 * @param {Map<string, Promise<ScanGraph>>} pending in-flight scans.
 * @param {string} root canonical absolute directory.
 * @returns {Promise<ScanGraph>} graph for the root.
 */
async function loadGraph(cache, pending, root) {
  const key = pathKey(root)

  const cached = cache.get(key)
  if (cached !== undefined && Date.now() - cached.at < GRAPH_CACHE_TTL_MS) return cached.graph

  const running = pending.get(key)
  if (running !== undefined) return running

  const scan = scanWorkspace(root)
    .then((graph) => {
      cache.delete(key)
      cache.set(key, { graph, at: Date.now() })
      while (cache.size > GRAPH_CACHE_MAX_ENTRIES) {
        const oldest = cache.keys().next().value
        if (oldest === undefined) break
        cache.delete(oldest)
      }
      return graph
    })
    .finally(() => {
      pending.delete(key)
    })

  pending.set(key, scan)
  return scan
}

/* -------------------------------------------------------------------------- */
/* Scanner                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {{ id: string, label: string, ext: string, size: number, dir: string, kind: string }} GraphNode
 * @typedef {{ source: string, target: string, kind: string }} GraphLink
 * @typedef {{ id: string, parent: string | null, depth: number, files: number, total: number }} GraphFolder
 * @typedef {{ files: number, folders: number, scanned: number, links: number, truncated: boolean, durationMs: number, kinds: Record<string, number> }} GraphStats
 * @typedef {{ root: string, nodes: GraphNode[], links: GraphLink[], folders: GraphFolder[], stats: GraphStats }} ScanGraph
 * @typedef {{ maxFiles: number, maxEntries: number, maxParseFiles: number, maxTextBytes: number, maxDurationMs: number }} ScanLimits
 */

/**
 * Scan a directory and return its file/dependency graph.
 *
 * Pure and deterministic: ids are POSIX paths relative to the canonical root,
 * nodes are sorted by id, folders by id, and links by source then target. Every
 * regular file becomes a node; only relative, root-relative and `@/`/`~/`
 * specifiers become links (bare package names and anything escaping the root are
 * ignored), and the resolver accepts any scanned file type, so documents,
 * images, PDFs and other assets appear whenever a text file references them.
 * Unreadable files or directories are skipped instead of failing the scan.
 *
 * @param {string} root workspace directory (absolute or relative to `cwd`).
 * @param {{ maxFiles?: number, maxEntries?: number, maxParseFiles?: number, maxTextBytes?: number, maxDurationMs?: number }} [options]
 *   optional budget overrides, primarily for tests.
 * @returns {Promise<ScanGraph>} graph with canonical `root`.
 * @throws {Error} when the root does not exist or is not a directory.
 */
export async function scanWorkspace(root, options = {}) {
  const startedAt = Date.now()
  if (typeof root !== 'string' || root.trim() === '') {
    throw new TypeError('scanWorkspace(root): root must be a non-empty directory path.')
  }

  const resolvedRoot = path.resolve(root)
  let canonicalRoot
  try {
    canonicalRoot = await fs.realpath(resolvedRoot)
  } catch {
    throw new Error(`Workspace root does not exist: ${resolvedRoot}`)
  }
  let rootStats
  try {
    rootStats = await fs.stat(canonicalRoot)
  } catch {
    throw new Error(`Workspace root is not readable: ${canonicalRoot}`)
  }
  if (!rootStats.isDirectory()) {
    throw new Error(`Workspace root is not a directory: ${canonicalRoot}`)
  }

  const limits = resolveScanLimits(options)
  /** @type {{ root: string, deadline: number, files: Array<{ id: string, absolutePath: string, size: number, ext: string }>, fileEntriesSeen: number, truncated: boolean, halted: boolean, limits: ScanLimits }} */
  const state = {
    root: canonicalRoot,
    deadline: startedAt + limits.maxDurationMs,
    files: [],
    fileEntriesSeen: 0,
    truncated: false,
    halted: false,
    limits,
  }
  await walkDirectory(state, canonicalRoot, '')

  state.files.sort((left, right) => compareIds(left.id, right.id))

  /** @type {GraphNode[]} */
  const nodes = state.files.map((file) => ({
    id: file.id,
    label: path.posix.basename(file.id),
    ext: file.ext,
    size: file.size,
    dir: path.posix.dirname(file.id),
    kind: kindOfFile(file.id),
  }))

  const nodeIds = new Set(state.files.map((file) => file.id))
  const folders = buildFolderIndex(state.files)

  /** @type {Array<{ id: string, absolutePath: string, size: number, ext: string }>} */
  const parseTargets = state.files.filter((file) => PARSE_EXTENSIONS.has(file.ext) && file.size <= MAX_NODE_BYTES)
  if (parseTargets.length > limits.maxParseFiles) {
    state.truncated = true
    parseTargets.length = limits.maxParseFiles
  }

  /** @type {Map<string, GraphLink>} */
  const linkMap = new Map()
  let scanned = 0
  for (const file of parseTargets) {
    // Cold/cloud filesystems can turn one read into a multi-second hydration;
    // return the links gathered so far rather than hanging the dialog.
    if (Date.now() > state.deadline) {
      state.truncated = true
      break
    }
    const text = await readTextPrefix(file.absolutePath, limits.maxTextBytes)
    if (text === null) continue
    scanned += 1
    for (const { rawSpecifier, kind } of collectSpecifiers(file.ext, text)) {
      const target = resolveSpecifierToId(file.id, rawSpecifier, nodeIds, kind)
      if (target === null || target === file.id) continue
      const linkKey = `${file.id}\u0000${target}`
      if (!linkMap.has(linkKey)) linkMap.set(linkKey, { source: file.id, target, kind })
    }
  }

  /** @type {GraphLink[]} */
  const links = [...linkMap.values()].sort((left, right) => {
    const bySource = compareIds(left.source, right.source)
    return bySource !== 0 ? bySource : compareIds(left.target, right.target)
  })

  return {
    root: canonicalRoot,
    nodes,
    links,
    folders,
    stats: {
      files: nodes.length,
      folders: folders.length,
      scanned,
      links: links.length,
      truncated: state.truncated,
      durationMs: Date.now() - startedAt,
      kinds: countKinds(nodes),
    },
  }
}

/**
 * Count nodes per coarse file kind, keeping every declared kind so the Client
 * legend shape is stable across scans.
 *
 * @param {GraphNode[]} nodes scanned nodes.
 * @returns {Record<string, number>} kind → count.
 */
function countKinds(nodes) {
  /** @type {Record<string, number>} */
  const counts = {}
  for (const kind of FILE_KINDS) counts[kind] = 0
  for (const node of nodes) {
    const kind = node.kind
    counts[kind] = (counts[kind] || 0) + 1
  }
  return counts
}

/**
 * Build the folder index visible in the graph: every directory that contains at
 * least one scanned file, directly or below it, with its parent and counts.
 *
 * @param {Array<{ id: string }>} files scanned files (POSIX-relative ids).
 * @returns {GraphFolder[]} folders sorted by id.
 */
function buildFolderIndex(files) {
  /** @type {Map<string, GraphFolder>} */
  const folders = new Map()
  for (const file of files) {
    const dir = path.posix.dirname(file.id)
    if (dir === '' || dir === '.') continue
    const parts = dir.split('/')
    let current = ''
    for (let depth = 0; depth < parts.length; depth += 1) {
      current = depth === 0 ? parts[0] : `${current}/${parts[depth]}`
      let folder = folders.get(current)
      if (folder === undefined) {
        folder = {
          id: current,
          parent: depth === 0 ? null : parts.slice(0, depth).join('/'),
          depth: depth + 1,
          files: 0,
          total: 0,
        }
        folders.set(current, folder)
      }
      folder.total += 1
    }
    const leaf = folders.get(dir)
    if (leaf !== undefined) leaf.files += 1
  }
  return [...folders.values()].sort((left, right) => compareIds(left.id, right.id))
}

/**
 * Validate and normalize scanner budget overrides.
 *
 * @param {Record<string, unknown>} options user options.
 * @returns {ScanLimits} effective limits.
 */
function resolveScanLimits(options) {
  const overrides = options !== null && typeof options === 'object' ? options : {}
  return {
    maxFiles: positiveInteger(overrides.maxFiles, MAX_FILES),
    maxEntries: positiveInteger(overrides.maxEntries, MAX_ENTRIES),
    maxParseFiles: positiveInteger(overrides.maxParseFiles, MAX_PARSE_FILES),
    maxTextBytes: positiveInteger(overrides.maxTextBytes, MAX_TEXT_BYTES),
    maxDurationMs: positiveInteger(overrides.maxDurationMs, SCAN_DURATION_LIMIT_MS),
  }
}

/**
 * @param {unknown} candidate candidate value.
 * @param {number} fallback value used when the candidate is not a positive integer.
 * @returns {number} positive integer.
 */
function positiveInteger(candidate, fallback) {
  return Number.isInteger(candidate) && candidate > 0 ? Number(candidate) : fallback
}

/**
 * Recursively walk one directory, skipping symlinks and ignored directories.
 *
 * @param {object} state mutable walk state.
 * @param {string} absoluteDir directory to read.
 * @param {string} relativeDir POSIX-style path relative to the scan root.
 * @returns {Promise<void>}
 */
async function walkDirectory(state, absoluteDir, relativeDir) {
  if (state.halted) return
  if (Date.now() > state.deadline) {
    state.truncated = true
    state.halted = true
    return
  }

  let entries
  try {
    entries = await fs.readdir(absoluteDir, { withFileTypes: true })
  } catch {
    return
  }
  entries.sort((left, right) => compareIds(left.name, right.name))

  for (const entry of entries) {
    if (state.halted) return
    if (entry.isSymbolicLink()) continue

    const relativePath = relativeDir === '' ? entry.name : `${relativeDir}/${entry.name}`
    const absolutePath = path.join(absoluteDir, entry.name)

    if (entry.isDirectory()) {
      if (isIgnoredDirectory(entry.name)) continue
      await walkDirectory(state, absolutePath, relativePath)
      continue
    }

    // Some filesystems report an unknown dirent type; fall back to stat.
    const isFile = entry.isFile() || (!entry.isDirectory() && (await isRegularFile(absolutePath)))
    if (!isFile) continue
    await addFile(state, absolutePath, relativePath)
  }
}

/**
 * Record one file entry (or stop when the entry/node budget is exhausted).
 *
 * @param {object} state mutable walk state.
 * @param {string} absolutePath absolute file path.
 * @param {string} relativePath POSIX-style path relative to the scan root.
 * @returns {Promise<void>}
 */
async function addFile(state, absolutePath, relativePath) {
  if (Date.now() > state.deadline) {
    state.truncated = true
    state.halted = true
    return
  }
  state.fileEntriesSeen += 1
  if (state.fileEntriesSeen > state.limits.maxEntries) {
    state.truncated = true
    state.halted = true
    return
  }

  const name = path.posix.basename(relativePath)
  if (isIgnoredFile(name)) return
  if (state.files.length >= state.limits.maxFiles) {
    state.truncated = true
    state.halted = true
    return
  }

  let stats
  try {
    stats = await fs.stat(absolutePath)
  } catch {
    return
  }
  if (!stats.isFile()) return

  state.files.push({
    id: relativePath,
    absolutePath,
    size: stats.size,
    ext: path.posix.extname(name).toLowerCase(),
  })
}

/**
 * @param {string} candidate absolute path.
 * @returns {Promise<boolean>} true when the path is a regular file.
 */
async function isRegularFile(candidate) {
  try {
    return (await fs.stat(candidate)).isFile()
  } catch {
    return false
  }
}

/**
 * @param {string} directoryName directory basename.
 * @returns {boolean} true when the directory must not be walked.
 */
function isIgnoredDirectory(directoryName) {
  if (directoryName.startsWith('.')) return true
  return IGNORED_DIRECTORY_NAMES.has(directoryName.toLowerCase())
}

/**
 * Classify one file by its name and extension into a coarse kind. Every file
 * that survives {@link isIgnoredFile} becomes a node; unknown suffixes read as
 * `other`.
 *
 * @param {string} fileName POSIX-style file name or relative id.
 * @returns {string} one of {@link FILE_KINDS}.
 */
function kindOfFile(fileName) {
  const base = path.posix.basename(fileName).toLowerCase()
  const named = KIND_BY_NAME.get(base)
  if (named !== undefined) return named
  return KIND_BY_EXTENSION.get(path.posix.extname(base)) || 'other'
}

/**
 * @param {string} fileName file basename.
 * @returns {boolean} true when the file must not become a node.
 */
function isIgnoredFile(fileName) {
  const lower = fileName.toLowerCase()
  if (IGNORED_FILE_NAMES.has(lower)) return true
  // Editor and build-system temporaries that carry no project meaning.
  if (lower.endsWith('~') || /\.(?:tmp|temp|swp|swo|bak|orig|rej)$/.test(lower)) return true
  return lower.endsWith('.min.js') || lower.endsWith('.min.css') || lower.endsWith('.map')
}

/**
 * Read at most `byteLimit` bytes of a UTF-8 file, tolerating every I/O failure.
 *
 * @param {string} absolutePath absolute file path.
 * @param {number} byteLimit maximum bytes to read.
 * @returns {Promise<string | null>} decoded prefix, or null when unreadable.
 */
async function readTextPrefix(absolutePath, byteLimit) {
  let handle
  try {
    handle = await fs.open(absolutePath, 'r')
    const buffer = Buffer.allocUnsafe(byteLimit)
    const { bytesRead } = await handle.read(buffer, 0, byteLimit, 0)
    return buffer.subarray(0, bytesRead).toString('utf8')
  } catch {
    return null
  } finally {
    if (handle !== undefined) await handle.close().catch(() => {})
  }
}

/* -------------------------------------------------------------------------- */
/* Specifier extraction                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Extract candidate specifiers from one file's text.
 *
 * @param {string} ext lowercase file extension (with dot).
 * @param {string} text file text (already capped by the caller).
 * @returns {Array<{ rawSpecifier: string, kind: string }>} candidate specifiers.
 */
function collectSpecifiers(ext, text) {
  /** @type {Array<{ rawSpecifier: string, kind: string }>} */
  const specifiers = []

  if (SCRIPT_EXTENSIONS.has(ext)) {
    const source = stripJsComments(text)
    collectMatches(IMPORT_SOURCE_RE, source, 'import', specifiers)
    collectMatches(EXPORT_FROM_RE, source, 'import', specifiers)
    collectMatches(DYNAMIC_IMPORT_RE, source, 'dynamic-import', specifiers)
    collectMatches(REQUIRE_RE, source, 'require', specifiers)
  }
  if (STYLE_EXTENSIONS.has(ext)) {
    collectMatches(STYLE_IMPORT_RE, text, 'style-import', specifiers)
    collectMatches(CSS_URL_RE, text, 'asset-ref', specifiers)
  }
  if (MARKUP_EXTENSIONS.has(ext)) {
    collectMatches(SCRIPT_SRC_RE, text, 'html-ref', specifiers)
    collectMatches(LINK_HREF_RE, text, 'html-ref', specifiers)
    collectMatches(ASSET_SRC_RE, text, 'html-ref', specifiers)
    collectMatches(ANCHOR_HREF_RE, text, 'html-ref', specifiers)
    collectMatches(OBJECT_DATA_RE, text, 'html-ref', specifiers)
    collectMatches(VIDEO_POSTER_RE, text, 'html-ref', specifiers)
  }
  if (MARKDOWN_EXTENSIONS.has(ext)) {
    collectMatches(MARKDOWN_LINK_RE, text, 'markdown-link', specifiers)
  }
  if (PYTHON_EXTENSIONS.has(ext)) {
    for (const match of text.matchAll(PYTHON_FROM_RE)) {
      const rawSpecifier = pythonModuleSpecifier(match[1])
      if (rawSpecifier !== '') specifiers.push({ rawSpecifier, kind: 'python-import' })
    }
    collectMatches(PYTHON_IMPORT_RE, text, 'python-import', specifiers)
  }

  return specifiers
}

/**
 * Push the first capture group of every match of a global regex.
 *
 * @param {RegExp} regex global regular expression.
 * @param {string} text haystack.
 * @param {string} kind link kind assigned to each match.
 * @param {Array<{ rawSpecifier: string, kind: string }>} output collector.
 * @returns {void}
 */
function collectMatches(regex, text, kind, output) {
  for (const match of text.matchAll(regex)) {
    if (typeof match[1] === 'string' && match[1] !== '') output.push({ rawSpecifier: match[1], kind })
  }
}

/**
 * Remove JS comments cheaply so commented-out imports do not become links.
 *
 * This is intentionally approximate: it runs before regex extraction on files
 * capped at 512 KiB, where precision is worth more than perfect lexing.
 *
 * @param {string} source file text.
 * @returns {string} text with comments blanked.
 */
function stripJsComments(source) {
  return source.replace(BLOCK_COMMENT_RE, ' ').replace(LINE_COMMENT_RE, '$1 ')
}

/**
 * Convert a Python relative module path (`from .helper import x`) into a
 * POSIX-ish relative specifier (`./helper`).
 *
 * @param {string} modulePath raw module path from the `from` clause.
 * @returns {string} relative specifier, or '' for an absolute (bare) module.
 */
function pythonModuleSpecifier(modulePath) {
  const match = /^(\.+)(.*)$/.exec(modulePath)
  if (match === null) return ''
  const prefix = match[1].length === 1 ? './' : '../'.repeat(match[1].length - 1)
  const rest = match[2].split('.').filter(Boolean).join('/')
  return `${prefix}${rest}`
}

/* -------------------------------------------------------------------------- */
/* Specifier resolution                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Resolve one raw specifier to an existing node id inside the scan.
 *
 * Only relative (`./`, `../`), root-relative (`/`), and alias (`@/`, `~/`)
 * specifiers are resolved; bare package names are ignored.
 *
 * @param {string} sourceId node id of the importing file.
 * @param {string} rawSpecifier specifier captured from the parser.
 * @param {Set<string>} nodeIds ids of every node in the scan.
 * @param {string} kind link kind assigned by the parser (decides bare-relative support).
 * @returns {string | null} matched node id, or null.
 */
function resolveSpecifierToId(sourceId, rawSpecifier, nodeIds, kind) {
  const base = basePathForSpecifier(sourceId, rawSpecifier, kind)
  if (base === null) return null

  if (nodeIds.has(base)) return base
  for (const extension of RESOLVE_EXTENSIONS) {
    const candidate = base + extension
    if (nodeIds.has(candidate)) return candidate
  }
  for (const extension of RESOLVE_EXTENSIONS) {
    const candidate = `${base}/index${extension}`
    if (nodeIds.has(candidate)) return candidate
  }
  const pythonPackage = `${base}/__init__.py`
  if (nodeIds.has(pythonPackage)) return pythonPackage
  return null
}

/**
 * Turn a specifier into a root-relative POSIX base path, or null when it is
 * external / escapes the root / carries no path.
 *
 * Bare references (`main.js`, `../style.css`, `url("logo.png")`) are relative by
 * definition in HTML attributes, CSS `url()` and Markdown links, so those kinds
 * accept them; script specifiers stay strict (bare names are packages, not
 * workspace files).
 *
 * @param {string} sourceId node id of the importing file.
 * @param {string} rawSpecifier specifier captured from the parser.
 * @param {string} [kind] link kind assigned by the parser.
 * @returns {string | null} normalized base path.
 */
function basePathForSpecifier(sourceId, rawSpecifier, kind) {
  if (typeof rawSpecifier !== 'string') return null

  let specifier = rawSpecifier.trim()
  if (specifier === '' || specifier.startsWith('#')) return null

  // Protocol-relative references (`//cdn.example/x`) and absolute URLs are not
  // workspace files.
  if (specifier.startsWith('//') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(specifier)) return null

  // Drop query and hash suffixes, but keep a leading '#' (anchor only).
  const hashIndex = specifier.indexOf('#')
  if (hashIndex >= 0) specifier = specifier.slice(0, hashIndex)
  const queryIndex = specifier.indexOf('?')
  if (queryIndex >= 0) specifier = specifier.slice(0, queryIndex)
  specifier = specifier.trim()
  if (specifier === '') return null

  let base
  if (specifier.startsWith('@/') || specifier.startsWith('~/')) {
    base = specifier.slice(2)
  } else if (specifier.startsWith('/')) {
    base = specifier.slice(1)
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    base = path.posix.join(path.posix.dirname(sourceId), specifier)
  } else if (kind === 'html-ref' || kind === 'markdown-link' || kind === 'asset-ref') {
    base = path.posix.join(path.posix.dirname(sourceId), specifier)
  } else {
    return null
  }

  base = path.posix.normalize(base).replace(/^\.\//, '').replace(/^\/+/, '')
  if (base === '' || base === '.' || base === '..' || base.startsWith('../')) return null
  return base
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Compare two ids using code-unit order (locale-independent).
 *
 * @param {string} left first value.
 * @param {string} right second value.
 * @returns {number} -1, 0 or 1.
 */
function compareIds(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}
