/**
 * Release/package contract checks: this file is what `npm publish` would ship,
 * so it verifies the manifest, the display resources, the bundle patch and the
 * absence of developer-specific leftovers before a public release.
 *
 * Dependency-free (Node builtins only) like the other tests.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'

function readJSON(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function text(file) {
  return readFileSync(file, 'utf8')
}

function exists(file) {
  try {
    return statSync(file).isFile()
  } catch {
    return false
  }
}

const manifest = readJSON('package.json')
const client = text('client.js')
const patch = text('cordis.patch.yml')
const license = text('LICENSE')
const readme = text('README.md')

function expands(pattern) {
  const star = pattern.indexOf('*')
  if (star === -1) return exists(pattern) ? [pattern] : []
  const slash = pattern.lastIndexOf('/', star)
  const directory = slash === -1 ? '.' : pattern.slice(0, slash)
  const suffix = pattern.slice(star + 1)
  return readdirSync(directory)
    .filter((entry) => entry.endsWith(suffix))
    .map((entry) => (directory === '.' ? entry : directory + '/' + entry))
}

/** Every textual file the published package contains (for the leak scan). */
const shippedTextFiles = [
  ...manifest.files.flatMap(expands).filter((file) => /\.(js|mjs|json|yml|md|svg|txt)$/.test(file)),
]

const leaks = []
for (const file of shippedTextFiles) {
  const content = text(file)
  const leakPatterns = [
    /C:\\+Users\\+/i,
    /OneDrive/i,
    /elalamimeded@gmail\.com/i,
    /127\.0\.0\.1/,
    /localhost:\d+/i,
    /TEMP DIAG/i,
    /postDebug/i,
    /cnx-diag/i,
    /connectome\.diag/i,
    /npm_[A-Za-z0-9]{20,}/,
    /gho_[A-Za-z0-9]{20,}/,
    /github_pat_[A-Za-z0-9_]{20,}/,
    /_authToken\s*=/,
  ]
  for (const pattern of leakPatterns) {
    if (pattern.test(content)) leaks.push(file + ': ' + pattern)
  }
}

const checks = {
  'package name': typeof manifest.name === 'string' && manifest.name === 'dsh-connectome',
  'semantic version': typeof manifest.version === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version),
  'not private': manifest.private !== true,
  'MIT license declared': manifest.license === 'MIT',
  'LICENSE file ships': exists('LICENSE') && /MIT License/.test(license) && /Copyright/.test(license),
  'public publish config': manifest.publishConfig && manifest.publishConfig.access === 'public',
  'repository metadata': manifest.repository && /github\.com\/elalamiimed\/dsh-connectome/.test(manifest.repository.url || ''),
  'homepage metadata': /github\.com\/elalamiimed\/dsh-connectome/.test(manifest.homepage || ''),
  'issues metadata': /github\.com\/elalamiimed\/dsh-connectome\/issues/.test((manifest.bugs && manifest.bugs.url) || ''),
  'node engine': /^\s*>=\s*18/.test(manifest.engines && manifest.engines.node ? manifest.engines.node : ''),
  'dsh engine': typeof (manifest.engines && manifest.engines.dsh) === 'string' && manifest.engines.dsh.length > 0,
  'bundle patch': Boolean(manifest.dsh && manifest.dsh.bundle && manifest.dsh.bundle.patch === './cordis.patch.yml'),
  'bundle patch file': exists('cordis.patch.yml'),
  'bundle patch row': patch.indexOf('id: ' + manifest.name) !== -1 && patch.indexOf('name: ' + manifest.name) !== -1,
  'web client platform': Boolean(manifest.dsh && manifest.dsh.client && manifest.dsh.client.platform === 'web'),
  'client inject sidebar preview': Boolean(
    manifest.dsh &&
      manifest.dsh.client &&
      Array.isArray(manifest.dsh.client.inject) &&
      manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-sidebar-right')
  ),
  'client export': Boolean(manifest.exports && manifest.exports['./client'] === './client.js'),
  'client artifact ships': exists('client.js') && client.includes('window.__ModuleLoader__.load({'),
  'client loader id matches manifest': client.includes('id: ' + JSON.stringify(manifest.name) + ','),
  'package.json export': Boolean(manifest.exports && manifest.exports['./package.json'] === './package.json'),
  'icon ships': exists('icon.svg') && /<svg[\s>]/.test(text('icon.svg')),
  'README ships': exists('README.md') && readme.length > 2000,
  'CHANGELOG ships': exists('CHANGELOG.md') && text('CHANGELOG.md').indexOf('1.0.0') !== -1,
  'contributing and security docs ship': exists('CONTRIBUTING.md') && exists('SECURITY.md'),
  'README illustration ships': exists('docs/preview.svg') && /<svg[\s>]/.test(text('docs/preview.svg')),
  'locale dictionaries ship': expands('locale/*.json').length >= 2,
  'display metadata': (() => {
    try {
      const en = readJSON('locale/en.json')
      const zh = readJSON('locale/zh.json')
      return Boolean(en.meta && en.meta.title && en.meta.description && zh.meta && zh.meta.title && zh.meta.description)
    } catch (error) {
      return false
    }
  })(),
  'vendor d3 licenses ship': expands('vendor/*.min.js').length === 4
    && exists('vendor/LICENSE-d3.txt')
    && /ISC/.test(text('vendor/LICENSE-d3.txt')),
  'required shipped files exist': [
    'index.js',
    'client.js',
    'client.source.js',
    'build.mjs',
    'cordis.patch.yml',
    'locale/en.json',
    'locale/zh.json',
    'icon.svg',
    'LICENSE',
    'README.md',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
    'docs/preview.svg',
    'vendor/LICENSE-d3.txt',
  ].every((file) => exists(file)),
  'prepublish gate': typeof manifest.scripts.prepublishOnly === 'string'
    && manifest.scripts.prepublishOnly.includes('build.mjs')
    && manifest.scripts.prepublishOnly.includes('npm test'),
  'no developer-specific leaks': leaks.length === 0,
}

let failed = 0
for (const [label, ok] of Object.entries(checks)) {
  if (!ok) failed += 1
  console.log((ok ? 'ok   ' : 'FAIL ') + label)
}
if (leaks.length) {
  for (const leak of leaks) console.log('  leak: ' + leak)
}
process.exitCode = failed === 0 ? 0 : 1
