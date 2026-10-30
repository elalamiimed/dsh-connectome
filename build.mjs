#!/usr/bin/env node
/**
 * build.mjs — build script for the dsh-connectome Client artifact.
 *
 * It wraps the readable `client.source.js` in the strict
 * `window.__ModuleLoader__.load({ id, factory })` form and inlines the real
 * d3-force UMD dist (plus its d3-dispatch / d3-quadtree / d3-timer deps) so the
 * generated client.js runs without any node_modules resolution at runtime.
 *
 * Usage:
 *   node build.mjs
 *   node build.mjs --modules "C:\\path\\to\\node_modules"
 *   D3_MODULES_DIR=/path/to/node_modules node build.mjs
 *
 * Resolution order per package: vendor/<pkg>.min.js, then
 * <modulesDir>/<pkg>/dist/<pkg>.min.js. Node builtins only; no network.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = join(ROOT, 'client.source.js');
const OUT_FILE = join(ROOT, 'client.js');
const VENDOR_DIR = join(ROOT, 'vendor');
const PACKAGE_FILE = join(ROOT, 'package.json');
// The browser module table keys a bundle by its package name, so the loader id
// must always equal `package.json#name`; derive it instead of duplicating it.
const PLUGIN_ID = JSON.parse(readFileSync(PACKAGE_FILE, 'utf8')).name;
if (typeof PLUGIN_ID !== 'string' || PLUGIN_ID === '') {
  throw new Error('build.mjs: package.json must declare a non-empty "name"');
}

// Dependency order: dispatch and quadtree and timer first, force last.
const D3_PACKAGES = ['d3-dispatch', 'd3-quadtree', 'd3-timer', 'd3-force'];

function parseArgs(argv) {
  const args = { modulesDir: process.env.D3_MODULES_DIR || '' };
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--modules' || token === '-m') {
      const value = argv[i + 1];
      if (!value) throw new Error('build.mjs: --modules requires a directory argument');
      args.modulesDir = value;
      i += 1;
    } else if (token.indexOf('--modules=') === 0) {
      args.modulesDir = token.slice('--modules='.length);
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else {
      throw new Error('build.mjs: unknown argument ' + JSON.stringify(token));
    }
  }
  return args;
}

function possiblePaths(pkg, modulesDir) {
  const paths = [join(VENDOR_DIR, pkg + '.min.js')];
  if (modulesDir) paths.push(join(resolve(modulesDir), pkg, 'dist', pkg + '.min.js'));
  paths.push(join(ROOT, 'node_modules', pkg, 'dist', pkg + '.min.js'));
  return paths;
}

function locateModules(modulesDir) {
  const found = new Map();
  const missing = [];
  for (const pkg of D3_PACKAGES) {
    const paths = possiblePaths(pkg, modulesDir);
    let hit = '';
    for (const candidate of paths) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        hit = candidate;
        break;
      }
    }
    if (!hit) {
      missing.push({ pkg, paths });
      continue;
    }
    found.set(pkg, hit);
  }
  if (missing.length) {
    const lines = missing.map((entry) => {
      return '  - ' + entry.pkg + ':\n      ' + entry.paths.join('\n      ');
    });
    throw new Error(
      'build.mjs: missing d3 UMD dist file(s). Vendor them into ' +
        VENDOR_DIR +
        ' or pass --modules <node_modules dir> / set D3_MODULES_DIR.\nSearched:\n' +
        lines.join('\n')
    );
  }
  return found;
}

function readText(file) {
  return readFileSync(file, 'utf8');
}

function stripSourceMapComments(code) {
  return code.replace(/^\/\/# sourceMappingURL=.*$/gm, '').replace(/\s+$/, '');
}

function validateSource(source) {
  if (!/^function createConnectome\(require\) \{/m.test(source)) {
    throw new Error('build.mjs: client.source.js must declare a top-level `function createConnectome(require) {`');
  }
  const lines = source.split('\n');
  const offending = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^import[\s{]/.test(line) || /^export[\s{]/.test(line) || /^export default\b/.test(line)) {
      offending.push(i + 1 + ': ' + line.trim());
    }
  }
  if (offending.length) {
    throw new Error(
      'build.mjs: client.source.js must not contain ESM import/export lines (found ' +
        offending.length +
        '):\n' +
        offending.join('\n')
    );
  }
  const allowed = new Set(['react', 'd3-force']);
  const requires = [];
  const requirePattern = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match = requirePattern.exec(source);
  while (match) {
    requires.push(match[1]);
    match = requirePattern.exec(source);
  }
  const illegal = requires.filter((specifier) => !allowed.has(specifier));
  if (illegal.length) {
    throw new Error(
      'build.mjs: client.source.js may only require "react" and "d3-force" (found: ' +
        Array.from(new Set(illegal)).join(', ') +
        ')'
    );
  }
  if (source.indexOf('factory:') !== -1) {
    throw new Error('build.mjs: client.source.js must not contain a "factory:" literal');
  }
  if (/@deepseek-ai\//.test(source)) {
    throw new Error('build.mjs: client.source.js must not reference an @deepseek-ai/* package');
  }
}

/**
 * Shared emit/verify helper: builds the inline CommonJS-ish module registry that
 * evaluates the real UMD dist files. Each UMD file takes the CommonJS branch
 * because `module` / `exports` / `require` exist in the wrapper function scope.
 */
function buildD3Prelude(inlined) {
  const parts = [];
  parts.push('(function () {');
  parts.push('  var __defs = Object.create(null), __cache = Object.create(null);');
  parts.push('  function __load(id) {');
  parts.push('    var cached = __cache[id];');
  parts.push('    if (cached !== undefined) return cached;');
  parts.push('    var def = __defs[id];');
  parts.push(
    '    if (def === undefined) throw new Error(' + JSON.stringify(PLUGIN_ID + ': missing inlined module ') + ' + id);'
  );
  parts.push('    var module = { exports: {} };');
  parts.push('    __cache[id] = module.exports;');
  parts.push('    def(module, module.exports, __load);');
  parts.push('    __cache[id] = module.exports;');
  parts.push('    return module.exports;');
  parts.push('  }');
  parts.push('  function __define(id, factory) { __defs[id] = factory; }');
  for (const entry of inlined) {
    parts.push('  __define(' + JSON.stringify(entry.id) + ', function (module, exports, require) {');
    parts.push(entry.code);
    parts.push('  });');
  }
  parts.push("  return __load('d3-force');");
  parts.push('})()');
  return parts.join('\n');
}

/**
 * Build-time self verification: evaluate the exact prelude that gets emitted and
 * prove it yields working d3-force forces with finite positions. `new Function`
 * is used (not vm.runInNewContext) so Node timer globals are in scope, which
 * d3-timer's feature detection needs when node_modules has no window.
 */
function verifyPrelude(prelude) {
  const evaluate = new Function('return ' + prelude + ';');
  const d3 = evaluate();
  const requiredForces = [
    'forceSimulation',
    'forceLink',
    'forceManyBody',
    'forceCenter',
    'forceCollide',
  ];
  for (const name of requiredForces) {
    if (typeof d3[name] !== 'function') {
      throw new Error('verification failed: require("d3-force").' + name + ' is not a function');
    }
  }
  const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const links = [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
    { source: 'c', target: 'd' },
    { source: 'a', target: 'd' },
  ];
  const sim = d3
    .forceSimulation(nodes)
    .force(
      'link',
      d3
        .forceLink(links)
        .id((node) => node.id)
        .distance(20)
        .strength(0.65)
    )
    .force('charge', d3.forceManyBody().strength(-34).distanceMax(420))
    .force('center', d3.forceCenter(0, 0))
    .force('collide', d3.forceCollide((node) => 4))
    .stop();
  for (let i = 0; i < 20; i++) sim.tick();
  for (const node of nodes) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      throw new Error('verification failed: non-finite position for node ' + node.id);
    }
  }
  for (const link of links) {
    if (!link.source || typeof link.source !== 'object' || !link.target || typeof link.target !== 'object') {
      throw new Error('verification failed: forceLink did not resolve source/target to node objects');
    }
  }
  return d3;
}

function detectVersion(code) {
  const match = /d3-force\/ v(\d+\.\d+\.\d+)/.exec(code);
  return match ? match[1] : 'unknown';
}

function emitArtifact(source, prelude) {
  const banner = [
    '/*!',
    ' * ' + PLUGIN_ID + ' — generated browser artifact. DO NOT EDIT.',
    ' * Source: client.source.js (inlined verbatim below, keep it readable).',
    ' * Rebuild with: node build.mjs [--modules <node_modules dir>]',
    ' * d3-force / d3-dispatch / d3-quadtree / d3-timer: ISC, Copyright 2010-2021 Mike Bostock.',
    ' * UMD dist files inlined from vendor/ so no runtime module resolution is required.',
    ' */',
  ].join('\n');
  const loader = [
    'window.__ModuleLoader__.load({',
    '  id: ' + JSON.stringify(PLUGIN_ID) + ',',
    '  factory: (require) => {',
    '    var __d3 = ' + prelude + ';',
    '    var __require = function (specifier) {',
    "      if (specifier === 'd3-force') return __d3;",
    '      return require(specifier);',
    '    };',
    '    return createConnectome(__require);',
    '  },',
    '});',
  ].join('\n');
  return banner + '\n\n' + source + '\n\n' + loader + '\n';
}

function assertArtifact(artifact) {
  const loaderCount = (artifact.match(/window\.__ModuleLoader__\.load\(\{/g) || []).length;
  const factoryCount = (artifact.match(/factory:/g) || []).length;
  const createCount = (artifact.match(/function createConnectome\(require\)/g) || []).length;
  if (loaderCount !== 1) throw new Error('emitted artifact has ' + loaderCount + ' module-loader calls (expected 1)');
  if (factoryCount !== 1) throw new Error('emitted artifact has ' + factoryCount + ' "factory:" occurrences (expected 1)');
  if (createCount !== 1) {
    throw new Error('emitted artifact has ' + createCount + ' createConnectome declarations (expected 1)');
  }
  if (artifact.indexOf(PLUGIN_ID) === -1) throw new Error('emitted artifact is missing the plugin id');
  if (/\brequire\(\s*['"]@deepseek-ai\//.test(artifact)) {
    throw new Error('emitted artifact must not require an @deepseek-ai/* package');
  }
  if (artifact.indexOf('\r') !== -1) throw new Error('emitted artifact must use \\n line endings');
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Usage: node build.mjs [--modules <node_modules dir>]');
    return;
  }
  const located = locateModules(args.modulesDir);
  const source = readText(SOURCE_FILE);
  validateSource(source);

  const inlined = D3_PACKAGES.map((pkg) => ({
    id: pkg,
    code: stripSourceMapComments(readText(located.get(pkg))),
  }));
  const prelude = buildD3Prelude(inlined);
  verifyPrelude(prelude);

  const artifact = emitArtifact(source, prelude);
  assertArtifact(artifact);
  writeFileSync(OUT_FILE, artifact, 'utf8');

  const bytes = Buffer.byteLength(artifact, 'utf8');
  const version = detectVersion(inlined[inlined.length - 1].code);
  console.log(
    '[build] d3 sources: ' +
      D3_PACKAGES.map((pkg) => {
        const path = located.get(pkg);
        const relative = path.indexOf(ROOT) === 0 ? path.slice(ROOT.length + 1) : path;
        return pkg + ' <- ' + relative;
      }).join(', ')
  );
  console.log('[build] source: client.source.js (' + Buffer.byteLength(source, 'utf8') + ' bytes)');
  console.log('[build] wrote client.js (' + bytes + ' bytes)');
  console.log('built client.js (' + bytes + ' bytes) · d3-force ' + version + ' · verified');
}

try {
  main();
} catch (error) {
  console.error('[build] FAILED: ' + (error && error.message ? error.message : String(error)));
  process.exitCode = 1;
}
