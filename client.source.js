/*!
 * dsh-connectome — Client half (readable source; build.mjs wraps this file).
 *
 * Registers two slots:
 *   sidebar.panellist.actions : one "🧠 Connectome" menu row that opens the overlay.
 *   shell.overlay             : the frame-wide dialog with the canvas+d3-force graph.
 *
 * In the dialog, dependency edges are drawn with direction arrowheads (solid for
 * code/style imports, dashed for HTML/Markdown references); hovering a node or a
 * link reports the relationship, and clicking a neuron opens that file in the
 * harness' own right-Sidebar preview (`ctx.sidebarRight.openResource` with a
 * `dsh-resource://file/session/…` address).
 *
 * Only `require('react')` and `require('d3-force')` are used. build.mjs inlines the
 * d3-force UMD dist (plus its d3-dispatch / d3-quadtree / d3-timer deps) so the
 * generated client.js runs with no node_modules resolution at runtime.
 *
 * Design tokens: colors are deliberately the host's live --dsw-alias-* theme tokens
 * (light/dark matching is a hard requirement); geometry and type come from a local
 * --ds-* token layer (4px spacing rhythm / fixed type scale) declared once inside
 * the overlay stylesheet. The canvas reads its colors from the live CSS variables at
 * runtime. There is no JSX anywhere: React.createElement (alias `h`) only.
 */
function createConnectome(require) {
  'use strict';

  const React = require('react');
  const d3 = require('d3-force');
  const h = React.createElement;

  const SLOT_MENU = 'sidebar.panellist.actions';
  const SLOT_OVERLAY = 'shell.overlay';
  const LOCALE_NS = 'connectome';
  const TAU = Math.PI * 2;
  /** d3's default phyllotaxis spiral angle: a compact, deterministic seed layout. */
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  /** Seed spiral radius factor (the same 10 * sqrt(0.5 + i) d3 uses for NaN positions). */
  const SEED_RADIUS = 10;
  /** Never let a node paint smaller than this many screen pixels. */
  const MIN_NODE_PX = 1.3;
  const MIN_SCALE = 0.05;
  const MAX_SCALE = 8;
  const FIT_MAX_SCALE = 2.2;
  const FIT_PADDING = 96;
  const NODE_LABEL_LIMIT = 24;
  const NODE_LABEL_GAP = 6;
  /** How many direct relationships the node tooltip lists before summarizing. */
  const NODE_TIP_RELATION_LIMIT = 8;

  // ---------------------------------------------------------------------------
  // Locale dictionaries. The host passes `t` when the slot is registered with
  // `locale: 'connectome'`; these dicts are also the fallback when it does not.
  // ---------------------------------------------------------------------------
  const EN = {
    open: '🧠 Connectome',
    title: 'Connectome',
    loading: 'Scanning workspace…',
    empty: 'No source files found in this workspace.',
    error: 'Could not build the graph.',
    retry: 'Retry',
    rescan: 'Rescan',
    fit: 'Fit to view',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    close: 'Close',
    hint: 'Click a node to open its code · Drag to pan · Scroll to zoom · Hover a node or link to inspect',
    files: 'files',
    links: 'links',
    partial: 'partial scan',
    workspace: 'Workspace',
    clickToOpen: 'Click to open this file in the right sidebar',
    noRelations: 'No links yet',
    moreRelations: 'more links',
    relImport: 'imports',
    relDynamicImport: 'dynamic import',
    relRequire: 'requires',
    relStyleImport: 'styles',
    relHtmlRef: 'HTML reference',
    relMarkdownLink: 'markdown link',
    relPythonImport: 'python import',
    relUnknown: 'reference',
    noPreview: 'The right-sidebar file preview is not available in this window.',
    noSession: 'Open a session first, then click a node to view its code.',
    openFailed: 'Could not open this file in the right sidebar.',
  };

  const ZH = {
    open: '🧠 连接图谱',
    title: '连接图谱',
    loading: '正在扫描工作区…',
    empty: '此工作区中没有可解析的源文件。',
    error: '无法构建关系图。',
    retry: '重试',
    rescan: '重新扫描',
    fit: '适应视图',
    zoomIn: '放大',
    zoomOut: '缩小',
    close: '关闭',
    hint: '点击节点在右侧边栏打开代码 · 拖拽平移 · 滚轮缩放 · 悬停节点或连线查看关系',
    files: '个文件',
    links: '条依赖',
    partial: '部分扫描',
    workspace: '工作区',
    clickToOpen: '点击可在右侧边栏打开此文件',
    noRelations: '暂无连接',
    moreRelations: '更多连接',
    relImport: '导入',
    relDynamicImport: '动态导入',
    relRequire: 'require 引用',
    relStyleImport: '样式引用',
    relHtmlRef: 'HTML 引用',
    relMarkdownLink: 'Markdown 链接',
    relPythonImport: 'Python 导入',
    relUnknown: '引用',
    noPreview: '当前窗口无法使用右侧边栏的文件预览。',
    noSession: '请先打开一个会话，再点击节点查看代码。',
    openFailed: '无法在右侧边栏打开此文件。',
  };

  // ---------------------------------------------------------------------------
  // Overlay stylesheet.
  //
  // The deliverable mandates a fixed design-token scale: geometry/type/spacing are
  // expressed through the local --ds-* layer below (4px rhythm, fixed type scale).
  // Colors are intentionally the host's --dsw-alias-* theme tokens so the dialog
  // matches light/dark mode; a standalone --ds-color palette would break theming.
  // ---------------------------------------------------------------------------
  const STYLES = `
.cnx-root {
  --ds-space-1: 4px;
  --ds-space-2: 8px;
  --ds-space-3: 12px;
  --ds-space-4: 16px;
  --ds-space-5: 20px;
  --ds-space-6: 24px;
  --ds-radius-sm: 4px;
  --ds-radius-md: 8px;
  --ds-radius-lg: 12px;
  --ds-radius-xl: 16px;
  --ds-shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.08);
  --ds-shadow-md: 0 4px 12px rgba(15, 23, 42, 0.10);
  --ds-shadow-lg: 0 12px 32px rgba(15, 23, 42, 0.16);
  --ds-font-size-caption: 12px;
  --ds-font-size-body-sm: 14px;
  --ds-font-size-body: 16px;
  --ds-font-size-h3: 20px;
  --ds-line-caption: 16px;
  --ds-line-body-sm: 20px;
  --ds-line-body: 24px;
  --ds-line-h3: 28px;
  --ds-font-weight-medium: 500;
  --ds-font-weight-semibold: 600;
  --ds-border-width: 1px;
  --ds-card-max-w: 1180px;
  --ds-card-max-h: 820px;
  --ds-card-inset-x: 48px;
  --ds-card-inset-y: 64px;
  --ds-header-height: 52px;
  --ds-footer-height: 32px;
  --ds-control-size: 28px;
  --ds-select-max-w: 260px;
  --ds-tooltip-max-w: 320px;
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  font-family: inherit;
  font-size: var(--ds-font-size-body-sm);
  line-height: var(--ds-line-body-sm);
  color: var(--dsw-alias-label-primary);
}
.cnx-backdrop {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 72%, transparent);
}
.cnx-card {
  position: relative;
  z-index: 1;
  width: min(var(--ds-card-max-w), calc(100vw - var(--ds-card-inset-x)));
  height: min(var(--ds-card-max-h), calc(100vh - var(--ds-card-inset-y)));
  display: flex;
  flex-direction: column;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  border: var(--ds-border-width) solid var(--dsw-alias-border-l1);
  border-radius: var(--ds-radius-xl);
  box-shadow: var(--ds-shadow-lg);
  overflow: hidden;
}
.cnx-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--ds-space-3);
  height: var(--ds-header-height);
  padding: 0 var(--ds-space-4);
  border-bottom: var(--ds-border-width) solid var(--dsw-alias-border-l1);
  min-width: 0;
}
.cnx-title {
  display: flex;
  align-items: center;
  gap: var(--ds-space-2);
  font-size: var(--ds-font-size-h3);
  line-height: var(--ds-line-h3);
  font-weight: var(--ds-font-weight-semibold);
  white-space: nowrap;
}
.cnx-mark {
  font-size: var(--ds-font-size-h3);
  line-height: var(--ds-line-h3);
}
.cnx-meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--ds-font-size-caption);
  line-height: var(--ds-line-caption);
  color: var(--dsw-alias-label-secondary);
}
.cnx-spacer {
  flex: 1 1 auto;
  min-width: var(--ds-space-2);
}
.cnx-busy {
  white-space: nowrap;
  font-size: var(--ds-font-size-caption);
  line-height: var(--ds-line-caption);
  color: var(--dsw-alias-label-secondary);
}
.cnx-select {
  height: var(--ds-control-size);
  max-width: var(--ds-select-max-w);
  padding: 0 var(--ds-space-2);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  border: var(--ds-border-width) solid var(--dsw-alias-border-l1);
  border-radius: var(--ds-radius-md);
  font-family: inherit;
  font-size: var(--ds-font-size-body-sm);
  line-height: var(--ds-line-body-sm);
}
.cnx-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--ds-control-size);
  height: var(--ds-control-size);
  padding: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  border: 0;
  border-radius: var(--ds-radius-md);
  font-family: inherit;
  font-size: var(--ds-font-size-body);
  line-height: 1;
  cursor: pointer;
}
.cnx-icon-btn:hover {
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
}
.cnx-icon-btn:focus-visible {
  outline: var(--ds-border-width) solid var(--dsw-alias-brand-primary);
  outline-offset: 0;
}
.cnx-icon-btn[disabled] {
  opacity: 0.45;
  cursor: default;
}
.cnx-icon-btn[disabled]:hover {
  background: transparent;
  color: var(--dsw-alias-label-secondary);
}
.cnx-body {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  min-width: 0;
  min-height: 0;
}
.cnx-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ds-space-3);
  margin: auto;
  padding: var(--ds-space-6);
  text-align: center;
  color: var(--dsw-alias-label-secondary);
  font-size: var(--ds-font-size-body-sm);
  line-height: var(--ds-line-body-sm);
}
.cnx-state-error {
  max-width: var(--ds-tooltip-max-w);
}
.cnx-state-title {
  font-size: var(--ds-font-size-caption);
  line-height: var(--ds-line-caption);
  color: var(--dsw-alias-label-secondary);
}
.cnx-state-msg {
  word-break: break-word;
  font-size: var(--ds-font-size-body);
  line-height: var(--ds-line-body);
  color: var(--dsw-alias-state-error-primary);
}
.cnx-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: var(--ds-control-size);
  padding: 0 var(--ds-space-3);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  border: var(--ds-border-width) solid var(--dsw-alias-border-l1);
  border-radius: var(--ds-radius-md);
  font-family: inherit;
  font-size: var(--ds-font-size-body-sm);
  line-height: var(--ds-line-body-sm);
  cursor: pointer;
}
.cnx-btn:hover {
  border-color: var(--dsw-alias-brand-primary);
}
.cnx-btn:focus-visible {
  outline: var(--ds-border-width) solid var(--dsw-alias-brand-primary);
  outline-offset: 0;
}
.cnx-canvas-wrap {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.cnx-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
.cnx-tip {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 2;
  pointer-events: none;
  will-change: transform;
  max-width: var(--ds-tooltip-max-w);
  padding: var(--ds-space-2) var(--ds-space-3);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  border: var(--ds-border-width) solid var(--dsw-alias-border-l1);
  border-radius: var(--ds-radius-md);
  box-shadow: var(--ds-shadow-md);
  font-size: var(--ds-font-size-caption);
  line-height: var(--ds-line-caption);
  overflow-wrap: anywhere;
}
.cnx-tip-name {
  font-size: var(--ds-font-size-body-sm);
  line-height: var(--ds-line-body-sm);
  font-weight: var(--ds-font-weight-semibold);
}
.cnx-tip-path {
  color: var(--dsw-alias-label-secondary);
}
.cnx-tip-meta {
  margin-top: var(--ds-space-1);
  color: var(--dsw-alias-label-secondary);
}
.cnx-tip-links {
  display: flex;
  flex-direction: column;
  gap: var(--ds-space-1);
  margin-top: var(--ds-space-2);
}
.cnx-tip-link {
  display: flex;
  align-items: baseline;
  gap: var(--ds-space-2);
  width: 100%;
  min-width: 0;
  padding: 0;
  background: transparent;
  border: 0;
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: var(--ds-font-size-caption);
  line-height: var(--ds-line-caption);
  text-align: left;
  cursor: pointer;
}
.cnx-tip-link:hover {
  color: var(--dsw-alias-brand-primary);
}
.cnx-tip-link:focus-visible {
  outline: var(--ds-border-width) solid var(--dsw-alias-brand-primary);
  outline-offset: 0;
}
.cnx-tip-dir {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-secondary);
}
.cnx-tip-link-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cnx-tip-kind {
  flex: 0 0 auto;
  margin-left: auto;
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
}
.cnx-tip-hint {
  margin-top: var(--ds-space-2);
  color: var(--dsw-alias-label-secondary);
}
.cnx-notice {
  color: var(--dsw-alias-state-error-primary);
}
.cnx-footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ds-space-3);
  height: var(--ds-footer-height);
  padding: 0 var(--ds-space-4);
  border-top: var(--ds-border-width) solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
  font-size: var(--ds-font-size-caption);
  line-height: var(--ds-line-caption);
  min-width: 0;
}
.cnx-foot-left {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cnx-foot-right {
  min-width: 0;
  overflow: hidden;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
  direction: ltr;
}
`;

  // ---------------------------------------------------------------------------
  // Shared open/close store (module scope, no React context). The menu row and
  // the overlay are on opposite sides of the host tree and both drive this.
  // ---------------------------------------------------------------------------
  function createOpenStore() {
    const state = { open: false };
    const listeners = new Set();
    function notify() {
      listeners.forEach(function (listener) {
        try {
          listener();
        } catch (error) {
          /* a listener must not break the store */
        }
      });
    }
    return {
      getOpen: function () {
        return state.open;
      },
      subscribe: function (listener) {
        listeners.add(listener);
        return function unsubscribe() {
          listeners.delete(listener);
        };
      },
      open: function () {
        if (state.open) return;
        state.open = true;
        notify();
      },
      close: function () {
        if (!state.open) return;
        state.open = false;
        notify();
      },
      toggle: function () {
        if (state.open) state.open = false;
        else state.open = true;
        notify();
      },
    };
  }

  const store = createOpenStore();

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function currentLanguage() {
    try {
      let raw = '';
      if (typeof document !== 'undefined' && document && document.documentElement) {
        raw = document.documentElement.getAttribute('lang') || '';
      }
      if (!raw) {
        raw = (typeof navigator !== 'undefined' && navigator && navigator.language) || 'en';
      }
      return String(raw).toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
    } catch (error) {
      return 'en';
    }
  }

  function fallbackDict() {
    return currentLanguage() === 'zh' ? ZH : EN;
  }

  function makeT(props) {
    return function t(key) {
      if (props && typeof props.t === 'function') {
        try {
          const value = props.t(key);
          if (typeof value === 'string' && value) return value;
        } catch (error) {
          /* fall back to the bundled dictionary */
        }
      }
      const dict = fallbackDict();
      const value = dict[key];
      return value === undefined ? key : value;
    };
  }

  function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  function nowMs() {
    return typeof performance !== 'undefined' && performance && performance.now
      ? performance.now()
      : Date.now();
  }

  function radiusOf(node) {
    const degree = node && typeof node.degree === 'number' ? node.degree : 0;
    return 2.6 + Math.min(8, Math.sqrt(degree) * 1.8);
  }

  /**
   * World-space draw radius, floored so a node stays at least a pixel or so on
   * screen even when fit-to-view zooms a large graph far out.
   * @param {object} node layout node.
   * @param {number} scale current world-to-screen scale.
   * @returns {number} world-space radius.
   */
  function effectiveRadius(node, scale) {
    const radius = radiusOf(node);
    if (!(scale > 0)) return radius;
    return Math.max(radius, MIN_NODE_PX / scale);
  }

  function normalizeSlashes(value) {
    return String(value == null ? '' : value).replace(/\\/g, '/');
  }

  function relativeNodePath(node, root) {
    if (!node) return '';
    const rootPath = normalizeSlashes(root || '').replace(/\/+$/, '');
    let id = String(node.id == null ? '' : node.id);
    if (rootPath && id) {
      const normalizedId = normalizeSlashes(id);
      if (normalizedId.toLowerCase().indexOf(rootPath.toLowerCase()) === 0) {
        id = normalizedId.slice(rootPath.length);
      }
    }
    id = normalizeSlashes(id).replace(/^\/+/, '');
    if (!id || /^[A-Za-z]:/.test(id)) {
      let dir = normalizeSlashes(node.dir || '').replace(/\/+$/, '');
      if (rootPath && dir) {
        if (dir.toLowerCase().indexOf(rootPath.toLowerCase()) === 0) {
          dir = dir.slice(rootPath.length).replace(/^\/+/, '');
        }
      }
      id = (dir ? dir + '/' : '') + String(node.label || '');
    }
    return id.replace(/^\/+/, '');
  }

  function resolveHostUrl(route) {
    let base = '';
    try {
      if (typeof document !== 'undefined' && document && document.baseURI) base = document.baseURI;
    } catch (error) {
      base = '';
    }
    if (!base) {
      try {
        base = (typeof location !== 'undefined' && location && location.href) || '';
      } catch (error) {
        base = '';
      }
    }
    if (!base) return route;
    const slash = base.lastIndexOf('/');
    const dir = base.charAt(base.length - 1) === '/' ? base : slash >= 0 ? base.slice(0, slash + 1) : base + '/';
    try {
      return new URL(route, dir).href;
    } catch (error) {
      return route;
    }
  }

  function apiGraphUrl() {
    return resolveHostUrl('connectome/api/graph');
  }

  // ---------------------------------------------------------------------------
  // File opening — click a neuron to read the file in the harness' own right
  // Sidebar document preview (the same surface a file reference opens).
  //
  // The address grammar below mirrors the harness' browser-safe workspace-path
  // utility package (MIT licensed): `dsh-resource://file/session/<id>/<path>`,
  // component-encoded per segment with `:` kept literal for drive letters. The
  // navigation service is `ctx.sidebarRight` (provided by ui-sidebar-right);
  // `mounted` is the observable of the Session on screen and `uiSession` is the
  // fallback that names the selected Session.
  // ---------------------------------------------------------------------------
  let pluginCtx = null;

  function clientService(name) {
    if (!pluginCtx || typeof pluginCtx.get !== 'function') return undefined;
    try {
      return pluginCtx.get(name) || undefined;
    } catch (error) {
      return undefined;
    }
  }

  function snapshotOf(observable) {
    if (!observable) return undefined;
    try {
      if (typeof observable.getSnapshot === 'function') return observable.getSnapshot();
      if (typeof observable.get === 'function') return observable.get();
      if (typeof observable === 'string') return observable;
    } catch (error) {
      return undefined;
    }
    return undefined;
  }

  function sessionIdOf(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      if (typeof value.key === 'string' && value.key) return value.key;
      if (typeof value.sessionId === 'string' && value.sessionId) return value.sessionId;
      if (typeof value.id === 'string' && value.id) return value.id;
    }
    return '';
  }

  /**
   * Resolve the Session whose right Sidebar receives the file. Prefer the
   * navigation face's own "on screen" observable, then the UI Session adapter.
   * @returns {string} Session id, or '' when nothing is selected.
   */
  function currentSessionId(sidebarRight) {
    const mounted = sessionIdOf(snapshotOf(sidebarRight && sidebarRight.mounted));
    if (mounted) return mounted;
    const uiSession = clientService('uiSession');
    const adapter = uiSession && uiSession.adapter;
    const current = adapter && adapter.current;
    return sessionIdOf(snapshotOf(current));
  }

  function encodeAddressSegment(segment) {
    return encodeURIComponent(segment).replace(/%3A/gi, ':');
  }

  function encodeAddressPath(value) {
    return String(value).split('/').map(encodeAddressSegment).join('/');
  }

  /**
   * Build the `dsh-resource://file/session/…` address for one workspace file.
   * The path may be absolute or relative to the Session workspace root.
   * @param {string} sessionId authorizing Session id.
   * @param {string} filePath file path, in either separator spelling.
   * @returns {string} resource address.
   */
  function fileResourceAddress(sessionId, filePath) {
    const normalized = String(filePath == null ? '' : filePath)
      .replace(/\\/g, '/')
      .replace(/^(?:\.\/)+/, '');
    return (
      'dsh-resource://file/session/' +
      encodeAddressSegment(String(sessionId)) +
      '/' +
      encodeAddressPath(normalized)
    );
  }

  /**
   * Absolute host path of a graph node. Falls back to the workspace-relative id
   * when the scan root is unknown, which the preview resolves against the
   * Session's own workspace root.
   * @param {object} node graph node.
   * @param {string} root canonical scan root.
   * @returns {string} path to open.
   */
  function absoluteNodePath(node, root) {
    const relative = relativeNodePath(node, root);
    const rootPath = normalizeSlashes(root || '').replace(/\/+$/, '');
    if (!rootPath) return relative;
    if (!relative) return rootPath;
    return rootPath + '/' + relative;
  }

  /**
   * Open one node's file in the right Sidebar preview.
   * @param {object} node graph node.
   * @param {string} root canonical scan root.
   * @returns {{ ok: boolean, reason?: string, message?: string }} outcome.
   */
  function openNodeInSidebar(node, root) {
    if (!node) return { ok: false, reason: 'missing' };
    const sidebarRight = clientService('sidebarRight');
    if (!sidebarRight || typeof sidebarRight.openResource !== 'function') {
      return { ok: false, reason: 'no-preview' };
    }
    const sessionId = currentSessionId(sidebarRight);
    if (!sessionId) return { ok: false, reason: 'no-session' };
    const filePath = absoluteNodePath(node, root);
    if (!filePath) return { ok: false, reason: 'missing' };
    const address = fileResourceAddress(sessionId, filePath);
    try {
      sidebarRight.openResource(address);
    } catch (error) {
      return {
        ok: false,
        reason: 'error',
        message: error && error.message ? String(error.message) : '',
      };
    }
    return { ok: true };
  }

  /** Relation kind → locale key. Unknown kinds read as a generic reference. */
  const RELATION_KEYS = {
    import: 'relImport',
    'dynamic-import': 'relDynamicImport',
    require: 'relRequire',
    'style-import': 'relStyleImport',
    'html-ref': 'relHtmlRef',
    'markdown-link': 'relMarkdownLink',
    'python-import': 'relPythonImport',
  };

  function relationLabel(t, kind) {
    const key = RELATION_KEYS[kind];
    return key ? t(key) : t('relUnknown');
  }

  /**
   * Documentation references (HTML/Markdown) render dashed; code and style
   * relationships render solid. This keeps the two families legible in one view.
   */
  function isDocumentationLink(kind) {
    return kind === 'html-ref' || kind === 'markdown-link';
  }

  // ---------------------------------------------------------------------------
  // Slot 1 — one row inside the sidebar panel list's "More" menu.
  // This renders outside the overlay subtree, so it carries its own local --ds-*
  // token definitions inline and styles the button through var() references.
  // Hover/focus fills are applied by direct style mutation (no stylesheet there).
  // ---------------------------------------------------------------------------
  function ConnectomeMenuRow(props) {
    const t = makeT(props);
    const rowVars = {
      '--ds-row-height': '34px',
      '--ds-row-pad-y': '6px',
      '--ds-row-pad-x': '8px',
      '--ds-row-gap': '6px',
      '--ds-font-size-row': '13px',
      '--ds-line-height-row': '20px',
      '--ds-radius-md': '8px',
    };
    const wrapperStyle = {
      display: 'block',
      width: '100%',
    };
    for (const tokenName in rowVars) {
      if (Object.prototype.hasOwnProperty.call(rowVars, tokenName)) {
        wrapperStyle[tokenName] = rowVars[tokenName];
      }
    }
    const rowStyle = {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--ds-row-gap)',
      width: '100%',
      minHeight: 'var(--ds-row-height)',
      padding: 'var(--ds-row-pad-y) var(--ds-row-pad-x)',
      boxSizing: 'border-box',
      border: '0',
      borderRadius: 'var(--ds-radius-md)',
      background: 'transparent',
      color: 'var(--dsw-alias-label-primary)',
      fontFamily: 'inherit',
      fontSize: 'var(--ds-font-size-row)',
      lineHeight: 'var(--ds-line-height-row)',
      textAlign: 'left',
      cursor: 'pointer',
    };
    function setHot(event, hot) {
      try {
        event.currentTarget.style.background = hot ? 'var(--dsw-alias-bg-layer-2)' : 'transparent';
      } catch (error) {
        /* ignore */
      }
    }
    function onClick() {
      if (props && typeof props.onDismiss === 'function') {
        try {
          props.onDismiss();
        } catch (error) {
          /* closing the host menu must not block opening the overlay */
        }
      }
      store.open();
    }
    return h(
      'div',
      { style: wrapperStyle },
      h(
        'button',
        {
          type: 'button',
          role: 'menuitem',
          className: 'cnx-menu-row',
          style: rowStyle,
          onClick: onClick,
          onPointerEnter: function (event) {
            setHot(event, true);
          },
          onPointerLeave: function (event) {
            setHot(event, false);
          },
          onFocus: function (event) {
            setHot(event, true);
          },
          onBlur: function (event) {
            setHot(event, false);
          },
        },
        t('open')
      )
    );
  }

  // ---------------------------------------------------------------------------
  // Slot 2 — the frame-wide overlay dialog.
  // ---------------------------------------------------------------------------
  const INITIAL_VIEW = { phase: 'idle', graph: null, roots: [], error: null, busy: false };

  function ConnectomeOverlay(props) {
    const t = makeT(props);
    const open = React.useSyncExternalStore(store.subscribe, store.getOpen);
    const [view, setView] = React.useState(INITIAL_VIEW);
    const abortRef = React.useRef(null);
    const requestSeqRef = React.useRef(0);
    const closeButtonRef = React.useRef(null);
    const canvasApiRef = React.useRef(null);
    const [notice, setNotice] = React.useState(null);

    const runLoad = React.useCallback(function loadGraph(root) {
      const rawRoot = typeof root === 'string' ? root : '';
      const previousController = abortRef.current;
      abortRef.current = null;
      if (previousController) {
        try {
          previousController.abort();
        } catch (error) {
          /* ignore */
        }
      }
      let controller = null;
      try {
        controller = typeof AbortController === 'function' ? new AbortController() : null;
      } catch (error) {
        controller = null;
      }
      abortRef.current = controller;
      requestSeqRef.current += 1;
      const seq = requestSeqRef.current;
      setView(function (previous) {
        return {
          phase: previous.graph ? 'ready' : 'loading',
          graph: previous.graph,
          roots: previous.roots,
          error: null,
          busy: true,
        };
      });
      const init = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(rawRoot ? { root: rawRoot } : {}),
      };
      if (controller) init.signal = controller.signal;
      let request;
      try {
        request = fetch(apiGraphUrl(), init);
      } catch (error) {
        request = Promise.reject(error);
      }
      request
        .then(function (response) {
          return response
            .json()
            .catch(function () {
              return null;
            })
            .then(function (data) {
              return { response: response, data: data };
            });
        })
        .then(function (result) {
          if (requestSeqRef.current !== seq) return;
          const response = result.response;
          const data = result.data;
          if (!response.ok || !data || data.ok !== true) {
            let message = '';
            if (data && data.error && typeof data.error.message === 'string') {
              message = data.error.message;
            }
            if (!message) {
              message = 'HTTP ' + response.status + (response.statusText ? ' ' + response.statusText : '');
            }
            throw new Error(message);
          }
          if (!Array.isArray(data.nodes)) {
            throw new Error('Invalid graph response from connectome/api/graph');
          }
          const roots = Array.isArray(data.roots)
            ? data.roots
                .map(function (entry) {
                  if (typeof entry === 'string') return { path: entry, title: entry };
                  if (entry && typeof entry === 'object') {
                    const path = String(entry.path == null ? '' : entry.path);
                    return { path: path, title: entry.title ? String(entry.title) : path };
                  }
                  return null;
                })
                .filter(function (entry) {
                  return entry && entry.path;
                })
            : [];
          setView({
            phase: 'ready',
            graph: data,
            roots: roots,
            error: null,
            busy: false,
          });
        })
        .catch(function (error) {
          if (requestSeqRef.current !== seq) return;
          if (error && (error.name === 'AbortError' || error.code === 20)) return;
          setView(function (previous) {
            return {
              phase: 'error',
              graph: previous.graph,
              roots: previous.roots,
              error: {
                message: error && error.message ? String(error.message) : 'Request failed',
              },
              busy: false,
            };
          });
        });
    }, []);

    // Every open does a fresh scan with no root (the host picks the workspace).
    // Closing/unmounting aborts the in-flight request and resets the view.
    React.useEffect(
      function () {
        if (!open) return undefined;
        runLoad('');
        return function cleanup() {
          requestSeqRef.current += 1;
          const controller = abortRef.current;
          abortRef.current = null;
          if (controller) {
            try {
              controller.abort();
            } catch (error) {
              /* ignore */
            }
          }
          setView(INITIAL_VIEW);
        };
      },
      [open, runLoad]
    );

    // Focus the Close button on open, restore focus on close, Escape closes.
    React.useEffect(
      function () {
        if (!open) return undefined;
        setNotice(null);
        const doc = typeof document !== 'undefined' ? document : null;
        const previous = doc ? doc.activeElement : null;
        let timer = null;
        if (typeof window !== 'undefined' && window.setTimeout) {
          timer = window.setTimeout(function () {
            const element = closeButtonRef.current;
            if (element && typeof element.focus === 'function') {
              try {
                element.focus({ preventScroll: true });
              } catch (error) {
                try {
                  element.focus();
                } catch (innerError) {
                  /* ignore */
                }
              }
            }
          }, 0);
        }
        function onKeyDown(event) {
          if (!event) return;
          if (event.key === 'Escape' || event.key === 'Esc' || event.keyCode === 27) {
            if (event.defaultPrevented) return;
            if (event.cancelable) event.preventDefault();
            store.close();
          }
        }
        if (doc) doc.addEventListener('keydown', onKeyDown, true);
        return function cleanup() {
          if (timer !== null && typeof window !== 'undefined' && window.clearTimeout) {
            window.clearTimeout(timer);
          }
          if (doc) doc.removeEventListener('keydown', onKeyDown, true);
          if (previous && typeof previous.focus === 'function' && (!doc || previous.isConnected !== false)) {
            try {
              previous.focus({ preventScroll: true });
            } catch (error) {
              try {
                previous.focus();
              } catch (innerError) {
                /* ignore */
              }
            }
          }
        };
      },
      [open]
    );

    // A failed open explains itself in the footer for a few seconds without
    // closing the graph; a successful one closes the overlay in its handler.
    React.useEffect(
      function () {
        if (!notice) return undefined;
        if (typeof window === 'undefined' || !window.setTimeout) return undefined;
        const timer = window.setTimeout(function () {
          setNotice(null);
        }, 6000);
        return function cleanup() {
          window.clearTimeout(timer);
        };
      },
      [notice]
    );

    if (!open) return null;

    const graph = view.graph;
    const stats = graph && graph.stats ? graph.stats : null;
    const currentRoot =
      graph && typeof graph.root === 'string' ? graph.root : view.roots.length ? view.roots[0].path : '';
    const roots = view.roots.slice();
    if (
      currentRoot &&
      !roots.some(function (entry) {
        return entry.path === currentRoot;
      })
    ) {
      roots.unshift({ path: currentRoot, title: currentRoot });
    }
    const nodeCount = graph && Array.isArray(graph.nodes) ? graph.nodes.length : 0;
    // A neuron click is a navigation: the file opens in the harness' own
    // right-Sidebar preview (source lines, copy, theme). Only stay in the graph
    // when navigation is unavailable, and then say why.
    function handleOpenFile(node) {
      const result = openNodeInSidebar(node, currentRoot);
      if (result.ok) {
        setNotice(null);
        store.close();
        return;
      }
      let message = t('openFailed');
      if (result.reason === 'no-preview') {
        message = t('noPreview');
      } else if (result.reason === 'no-session') {
        message = t('noSession');
      } else if (result.reason === 'error' && result.message) {
        message = t('openFailed') + ' ' + result.message;
      }
      setNotice(message);
    }
    const files =
      stats && typeof stats.files === 'number' ? stats.files : graph && Array.isArray(graph.nodes) ? graph.nodes.length : 0;
    const linkCount =
      stats && typeof stats.links === 'number' ? stats.links : graph && Array.isArray(graph.links) ? graph.links.length : 0;
    const busy = view.busy;
    const canUseCanvas = view.phase === 'ready' && nodeCount > 0;
    const metaText = graph
      ? String(files) +
        ' ' +
        t('files') +
        ' · ' +
        String(linkCount) +
        ' ' +
        t('links') +
        (stats && stats.truncated ? ' · ' + t('partial') : '')
      : busy
        ? t('loading')
        : '';

    function onFit() {
      const api = canvasApiRef.current;
      if (api) api.fit();
    }
    function onZoomIn() {
      const api = canvasApiRef.current;
      if (api) api.zoomIn();
    }
    function onZoomOut() {
      const api = canvasApiRef.current;
      if (api) api.zoomOut();
    }
    function onRescan() {
      if (!busy) runLoad(currentRoot);
    }
    function onClose() {
      store.close();
    }
    function onBackdrop() {
      store.close();
    }
    function onSelectRoot(event) {
      const next = event && event.target ? event.target.value : '';
      if (next && next !== currentRoot) runLoad(next);
    }
    function iconButton(key, label, glyph, onClick, disabled, extraProps) {
      const buttonProps = {
        key: key,
        type: 'button',
        className: 'cnx-icon-btn',
        'aria-label': label,
        title: label,
        disabled: !!disabled,
        onClick: onClick,
      };
      if (extraProps) {
        for (const propName in extraProps) {
          if (Object.prototype.hasOwnProperty.call(extraProps, propName)) {
            buttonProps[propName] = extraProps[propName];
          }
        }
      }
      return h('button', buttonProps, glyph);
    }

    let bodyContent;
    if (view.phase === 'error') {
      const message = view.error && view.error.message ? view.error.message : t('error');
      bodyContent = h(
        'div',
        { className: 'cnx-state cnx-state-error', role: 'alert' },
        h('div', { className: 'cnx-state-title' }, t('error')),
        h('div', { className: 'cnx-state-msg' }, message),
        h(
          'button',
          {
            type: 'button',
            className: 'cnx-btn',
            onClick: function () {
              runLoad(currentRoot);
            },
          },
          t('retry')
        )
      );
    } else if (!graph || view.phase === 'idle' || view.phase === 'loading') {
      bodyContent = h('div', { className: 'cnx-state', role: 'status' }, t('loading'));
    } else if (nodeCount === 0) {
      bodyContent = h('div', { className: 'cnx-state' }, t('empty'));
    } else {
      bodyContent = h(GraphCanvas, {
        key: 'cnx-canvas',
        graph: graph,
        root: currentRoot,
        t: t,
        apiRef: canvasApiRef,
        onOpenFile: handleOpenFile,
      });
    }

    return h(
      'div',
      {
        className: 'cnx-root',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': t('title'),
        style: { pointerEvents: 'auto' },
      },
      h('style', { key: 'cnx-styles' }, STYLES),
      h('div', {
        key: 'cnx-backdrop',
        className: 'cnx-backdrop',
        onClick: onBackdrop,
        'aria-hidden': 'true',
      }),
      h(
        'div',
        { key: 'cnx-card', className: 'cnx-card' },
        h(
          'div',
          { className: 'cnx-header' },
          h(
            'div',
            { className: 'cnx-title' },
            h('span', { className: 'cnx-mark', 'aria-hidden': 'true' }, '🧠'),
            t('title')
          ),
          metaText ? h('div', { className: 'cnx-meta', title: metaText }, metaText) : null,
          h('div', { className: 'cnx-spacer' }),
          roots.length > 1
            ? h(
                'select',
                {
                  className: 'cnx-select',
                  'aria-label': t('workspace'),
                  title: t('workspace'),
                  value: currentRoot,
                  disabled: busy,
                  onChange: onSelectRoot,
                },
                roots.map(function (entry) {
                  return h(
                    'option',
                    { key: entry.path, value: entry.path, title: entry.path },
                    entry.title || entry.path
                  );
                })
              )
            : null,
          busy && graph ? h('span', { className: 'cnx-busy', role: 'status' }, t('loading')) : null,
          iconButton('fit', t('fit'), '⛶', onFit, !canUseCanvas),
          iconButton('zoom-in', t('zoomIn'), '＋', onZoomIn, !canUseCanvas),
          iconButton('zoom-out', t('zoomOut'), '−', onZoomOut, !canUseCanvas),
          iconButton('rescan', t('rescan'), '↻', onRescan, !graph || busy),
          iconButton('close', t('close'), '✕', onClose, false, { ref: closeButtonRef })
        ),
        h('div', { className: 'cnx-body' }, bodyContent),
        h(
          'div',
          { className: 'cnx-footer' },
          h(
            'div',
            { className: 'cnx-foot-left', role: notice ? 'status' : undefined },
            notice ? h('span', { className: 'cnx-notice' }, notice) : t('hint')
          ),
          h('div', { className: 'cnx-foot-right', title: currentRoot }, normalizeSlashes(currentRoot))
        )
      )
    );
  }

  // ---------------------------------------------------------------------------
  // Canvas + d3-force graph engine.
  //
  // The simulation is built once per loaded graph with sim.stop(); our own
  // requestAnimationFrame loop calls sim.tick() and then draws. No React state is
  // written per frame: hover changes update state, pointer moves only mutate DOM
  // transforms. The loop stops when sim.alpha() <= sim.alphaMin() and nothing is
  // being dragged, and any interaction kicks it again.
  // ---------------------------------------------------------------------------
  function GraphCanvas(props) {
    const t = makeT(props);
    const tRef = React.useRef(t);
    tRef.current = t;
    const wrapRef = React.useRef(null);
    const canvasRef = React.useRef(null);
    const tipRef = React.useRef(null);
    const pointerRef = React.useRef({ x: 0, y: 0 });
    const positionTipRef = React.useRef(null);
    const tipHoverRef = React.useRef(false);
    const clearHoverRef = React.useRef(null);
    const propsRef = React.useRef(props);
    propsRef.current = props;
    const [tipInfo, setTipInfo] = React.useState(null);
    const graph = props.graph;
    const rootPath = props.root || (graph && graph.root) || '';

    React.useLayoutEffect(
      function () {
        const position = positionTipRef.current;
        if (position) position();
      },
      [tipInfo]
    );

    React.useEffect(
      function () {
        const wrap = wrapRef.current;
        const canvas = canvasRef.current;
        if (!wrap || !canvas || !graph) return undefined;
        let ctx = null;
        try {
          ctx = canvas.getContext('2d');
        } catch (error) {
          ctx = null;
        }
        if (!ctx) return undefined;

        setTipInfo(null);

        // ---- data preparation -------------------------------------------------
        const rawNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
        const nodes = [];
        const byId = new Map();
        for (let i = 0; i < rawNodes.length; i++) {
          const raw = rawNodes[i];
          if (!raw || raw.id == null) continue;
          const id = String(raw.id);
          if (byId.has(id)) continue;
          // A compact deterministic seed layout. Leaving every node at (0,0)
          // makes d3 skip its own spiral initialization; the repulsion then
          // explodes the graph and fit-to-view zooms out until nodes are
          // sub-pixel (an apparently empty canvas).
          const seedIndex = nodes.length;
          const seedAngle = seedIndex * GOLDEN_ANGLE;
          const seedRadius = SEED_RADIUS * Math.sqrt(0.5 + seedIndex);
          const node = {
            id: id,
            label: typeof raw.label === 'string' && raw.label ? raw.label : id,
            ext: raw.ext || '',
            size: typeof raw.size === 'number' ? raw.size : 0,
            dir: typeof raw.dir === 'string' ? raw.dir : '',
            degree: 0,
            adj: [],
            links: [],
            x: Math.cos(seedAngle) * seedRadius,
            y: Math.sin(seedAngle) * seedRadius,
            vx: 0,
            vy: 0,
          };
          byId.set(id, node);
          nodes.push(node);
        }
        const links = [];
        const rawLinks = Array.isArray(graph.links) ? graph.links : [];
        for (let i = 0; i < rawLinks.length; i++) {
          const raw = rawLinks[i];
          if (!raw || raw.source == null || raw.target == null) continue;
          const source = byId.get(String(raw.source));
          const target = byId.get(String(raw.target));
          if (!source || !target || source === target) continue;
          links.push({
            source: source.id,
            target: target.id,
            kind: typeof raw.kind === 'string' && raw.kind ? raw.kind : 'import',
          });
          source.degree += 1;
          target.degree += 1;
        }

        // ---- simulation (stopped; ticked from our rAF loop) -------------------
        const sim = d3
          .forceSimulation(nodes)
          .force(
            'link',
            d3
              .forceLink(links)
              .id(function (node) {
                return node.id;
              })
              .distance(function (link) {
                const source = link.source && typeof link.source === 'object' ? link.source : null;
                const target = link.target && typeof link.target === 'object' ? link.target : null;
                const sourceDegree = source && source.degree ? source.degree : 1;
                const targetDegree = target && target.degree ? target.degree : 1;
                return 18 + Math.min(34, Math.sqrt(sourceDegree * targetDegree) * 5);
              })
              .strength(0.65)
          )
          .force('charge', d3.forceManyBody().strength(-34).distanceMax(420))
          .force('center', d3.forceCenter(0, 0))
          .force(
            'collide',
            d3.forceCollide(function (node) {
              return radiusOf(node) + 1;
            })
          )
          // Weak centering keeps disconnected files (no imports at all) in the
          // same cloud as the connected component instead of drifting out to
          // the many-body cutoff and stretching the viewport.
          .force('x', d3.forceX(0).strength(0.055))
          .force('y', d3.forceY(0).strength(0.055))
          .stop();

        // forceLink has resolved link.source/link.target to node objects by now.
        for (let i = 0; i < links.length; i++) {
          const link = links[i];
          const source = link.source;
          const target = link.target;
          if (source && target && typeof source === 'object' && typeof target === 'object') {
            source.adj.push(target);
            target.adj.push(source);
            source.links.push(link);
            target.links.push(link);
          }
        }

        // ---- pre-warm before the first paint ----------------------------------
        sim.alpha(0.9);
        const prewarmStart = nowMs();
        const prewarmTicks = nodes.length < 300 ? 90 : 40;
        for (let tick = 0; tick < prewarmTicks; tick++) {
          sim.tick();
          if (tick > 8 && tick % 4 === 0 && nowMs() - prewarmStart > 220) break;
        }

        // ---- mutable engine state --------------------------------------------
        let cssW = 0;
        let cssH = 0;
        let dpr = 1;
        const view = { k: 1, tx: 0, ty: 0 };
        let userInteracted = false;
        let drawPending = false;
        let loopActive = false;
        let rafId = 0;
        let dead = false;
        let dragNode = null;
        let dragPan = null;
        let hoverNode = null;
        let hoverLink = null;
        let hoverHideTimer = 0;
        let press = null;
        const hoverIds = new Set();
        let hoverList = [];
        let hoverLinks = [];
        const theme = {
          node: 'Highlight',
          isolated: 'GrayText',
          link: 'GrayText',
          label: 'CanvasText',
          muted: 'GrayText',
          font: '12px sans-serif',
          fontPx: 12,
          labelGap: NODE_LABEL_GAP,
        };

        // ---- helpers ----------------------------------------------------------
        function appendCirclePath(node, scale) {
          if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
          const radius = effectiveRadius(node, scale);
          ctx.moveTo(node.x + radius, node.y);
          ctx.arc(node.x, node.y, radius, 0, TAU);
        }

        function linkKind(link) {
          return link && typeof link.kind === 'string' && link.kind ? link.kind : 'import';
        }

        function linkNodes(link) {
          if (!link) return null;
          const source = link.source;
          const target = link.target;
          if (!source || !target || typeof source !== 'object' || typeof target !== 'object') return null;
          if (
            !Number.isFinite(source.x) ||
            !Number.isFinite(source.y) ||
            !Number.isFinite(target.x) ||
            !Number.isFinite(target.y)
          ) {
            return null;
          }
          return { source: source, target: target };
        }

        /**
         * Screen-space distance from a point to one link segment. Returns
         * Infinity for links whose endpoints are not laid out yet.
         */
        function linkDistanceSq(link, px, py) {
          const ends = linkNodes(link);
          if (!ends) return Infinity;
          const source = ends.source;
          const target = ends.target;
          const scale = view.k;
          const sx = source.x * scale + view.tx;
          const sy = source.y * scale + view.ty;
          const ex = target.x * scale + view.tx;
          const ey = target.y * scale + view.ty;
          const dx = ex - sx;
          const dy = ey - sy;
          const lengthSq = dx * dx + dy * dy;
          if (!(lengthSq > 0)) return Infinity;
          let t = ((px - sx) * dx + (py - sy) * dy) / lengthSq;
          if (t < 0) t = 0;
          else if (t > 1) t = 1;
          const qx = sx + dx * t;
          const qy = sy + dy * t;
          const qdx = px - qx;
          const qdy = py - qy;
          return qdx * qdx + qdy * qdy;
        }

        function hitTestLink(px, py) {
          let best = null;
          let bestDistance = 30; // squared pixels: links are selectable within ~5.5px
          for (let i = 0; i < links.length; i++) {
            const distance = linkDistanceSq(links[i], px, py);
            if (distance < bestDistance) {
              bestDistance = distance;
              best = links[i];
            }
          }
          return best;
        }

        /**
         * Directed arrowhead for every dependency edge, in one fill path. The
         * arrow points at the imported file (link source imports link target),
         * so direction is legible without hovering.
         */
        function drawArrowHeads(list, alpha, color) {
          if (!list.length) return;
          const scale = view.k;
          if (!(scale > 0)) return;
          const length = 6 / scale;
          const half = length * 0.42;
          ctx.beginPath();
          let any = false;
          for (let i = 0; i < list.length; i++) {
            const ends = linkNodes(list[i]);
            if (!ends) continue;
            const source = ends.source;
            const target = ends.target;
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (!(distance > 0)) continue;
            const radius = effectiveRadius(target, scale);
            if (distance <= radius + length) continue;
            const ux = dx / distance;
            const uy = dy / distance;
            const tipX = target.x - ux * radius;
            const tipY = target.y - uy * radius;
            const baseX = tipX - ux * length;
            const baseY = tipY - uy * length;
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(baseX - uy * half, baseY + ux * half);
            ctx.lineTo(baseX + uy * half, baseY - ux * half);
            ctx.closePath();
            any = true;
          }
          if (!any) return;
          ctx.fillStyle = color || theme.link;
          ctx.globalAlpha = alpha;
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        function refreshTheme() {
          let computed = null;
          try {
            computed = getComputedStyle(canvas);
          } catch (error) {
            computed = null;
          }
          function read(name, fallback) {
            if (!computed) return fallback;
            let value = '';
            try {
              value = computed.getPropertyValue(name);
            } catch (error) {
              value = '';
            }
            value = value ? String(value).trim() : '';
            return value || fallback;
          }
          /**
           * Accept only values the canvas actually parses as a color. A custom
           * property that resolves to something else (an unresolved var(), a
           * token that exists only in another theme) would be silently ignored
           * by strokeStyle/fillStyle and leave the default black paint on a
           * dark card, i.e. an apparently empty graph.
           */
          function readColor(name, fallback) {
            const value = read(name, '');
            if (!value) return fallback;
            try {
              const sentinel = 'rgb(1, 2, 3)';
              ctx.fillStyle = sentinel;
              ctx.fillStyle = value;
              if (ctx.fillStyle !== sentinel || value === sentinel) return value;
            } catch (error) {
              return fallback;
            }
            return fallback;
          }
          // The border tokens carry their own alpha (rgba(255,255,255,0.12) in
          // dark mode), so using one as a canvas stroke and then multiplying by
          // globalAlpha makes links all but invisible. Paint solid label tokens
          // instead and control visibility with our own alpha.
          theme.node = readColor('--dsw-alias-brand-primary', 'Highlight');
          theme.isolated = readColor('--dsw-alias-label-secondary', 'GrayText');
          theme.link = readColor('--dsw-alias-label-secondary', 'GrayText');
          theme.label = readColor('--dsw-alias-label-primary', 'CanvasText');
          theme.muted = readColor('--dsw-alias-label-secondary', 'GrayText');
          const family = computed && computed.fontFamily ? computed.fontFamily : 'sans-serif';
          const size = parseFloat(read('--ds-font-size-caption', '12px')) || 12;
          theme.fontPx = size;
          theme.font = size + 'px ' + family;
        }

        function resizeCanvas() {
          const width = Math.max(1, Math.round(wrap.clientWidth || 0));
          const height = Math.max(1, Math.round(wrap.clientHeight || 0));
          cssW = width;
          cssH = height;
          dpr = clamp((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 1, 2);
          const pixelWidth = Math.max(1, Math.round(width * dpr));
          const pixelHeight = Math.max(1, Math.round(height * dpr));
          if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
          if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
          canvas.style.width = '100%';
          canvas.style.height = '100%';
        }

        function schedule() {
          if (dead || loopActive) return;
          loopActive = true;
          rafId = requestAnimationFrame(frame);
        }

        function requestDraw() {
          drawPending = true;
          schedule();
        }

        function frame() {
          rafId = 0;
          loopActive = false;
          if (dead) return;
          const active = dragNode !== null || sim.alpha() > sim.alphaMin();
          if (active) {
            try {
              sim.tick();
            } catch (error) {
              /* one bad link must not kill the loop */
            }
          }
          if (active || drawPending) {
            drawPending = false;
            try {
              draw();
            } catch (error) {
              /* one bad draw must not kill the loop */
            }
          }
          if (active) schedule();
        }

        function drawLabels(scale, tx, ty) {
          ctx.save();
          ctx.font = theme.font;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = theme.label;
          let drawn = 0;
          for (let i = 0; i < hoverList.length && drawn < NODE_LABEL_LIMIT; i++) {
            const node = hoverList[i];
            if (!node || !node.label) continue;
            if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) continue;
            const screenX = node.x * scale + tx;
            const screenY = node.y * scale + ty;
            const radius = effectiveRadius(node, scale) * scale;
            const width = ctx.measureText(node.label).width;
            if (screenX + width < 0 || screenX - width > cssW || screenY < 0 || screenY - radius > cssH) continue;
            ctx.fillText(node.label, screenX, screenY - radius - theme.labelGap);
            drawn += 1;
          }
          ctx.restore();
        }

        function draw() {
          if (dead || !cssW || !cssH) return;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const scale = view.k;
          const tx = view.tx;
          const ty = view.ty;
          const hoverActive = !!(hoverNode || hoverLink);

          ctx.save();
          ctx.translate(tx, ty);
          ctx.scale(scale, scale);

          // Dependency edges: solid for code/style relationships, dashed for
          // documentation references. One stroke call per family.
          ctx.lineCap = 'round';
          const baseLinkAlpha = hoverActive ? 0.12 : 0.3;
          let anySolid = false;
          ctx.beginPath();
          for (let i = 0; i < links.length; i++) {
            const link = links[i];
            if (isDocumentationLink(linkKind(link))) continue;
            const ends = linkNodes(link);
            if (!ends) continue;
            ctx.moveTo(ends.source.x, ends.source.y);
            ctx.lineTo(ends.target.x, ends.target.y);
            anySolid = true;
          }
          if (anySolid) {
            ctx.setLineDash([]);
            ctx.strokeStyle = theme.link;
            ctx.lineWidth = 1 / scale;
            ctx.globalAlpha = baseLinkAlpha;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          let anyDoc = false;
          ctx.beginPath();
          for (let i = 0; i < links.length; i++) {
            const link = links[i];
            if (!isDocumentationLink(linkKind(link))) continue;
            const ends = linkNodes(link);
            if (!ends) continue;
            ctx.moveTo(ends.source.x, ends.source.y);
            ctx.lineTo(ends.target.x, ends.target.y);
            anyDoc = true;
          }
          if (anyDoc) {
            ctx.setLineDash([4 / scale, 4 / scale]);
            ctx.strokeStyle = theme.link;
            ctx.lineWidth = 1 / scale;
            ctx.globalAlpha = hoverActive ? 0.08 : 0.22;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.setLineDash([]);
          }
          // Direction without hovering: each arrow points at the imported file.
          drawArrowHeads(links, hoverActive ? 0.16 : 0.42, theme.link);

          // Highlighted relationship(s): the hovered node's links, or the one
          // link under the pointer.
          if (hoverActive && hoverLinks.length) {
            ctx.beginPath();
            for (let i = 0; i < hoverLinks.length; i++) {
              const ends = linkNodes(hoverLinks[i]);
              if (!ends) continue;
              ctx.moveTo(ends.source.x, ends.source.y);
              ctx.lineTo(ends.target.x, ends.target.y);
            }
            ctx.strokeStyle = theme.node;
            ctx.lineWidth = 1.6 / scale;
            ctx.globalAlpha = 0.9;
            ctx.stroke();
            ctx.globalAlpha = 1;
            drawArrowHeads(hoverLinks, 0.9, theme.node);
          }

          if (hoverActive) {
            // Base nodes dimmed, then hovered node + its neighbors highlighted.
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            for (let i = 0; i < nodes.length; i++) {
              const node = nodes[i];
              if (hoverIds.has(node.id)) continue;
              appendCirclePath(node, scale);
            }
            ctx.fillStyle = theme.isolated;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.beginPath();
            for (let i = 0; i < hoverList.length; i++) appendCirclePath(hoverList[i], scale);
            ctx.fillStyle = theme.node;
            ctx.fill();
          } else {
            // Normal nodes: one path + one fill; isolated nodes: a second path.
            ctx.beginPath();
            let hasNormal = false;
            for (let i = 0; i < nodes.length; i++) {
              const node = nodes[i];
              if (node.degree > 0) {
                appendCirclePath(node, scale);
                hasNormal = true;
              }
            }
            if (hasNormal) {
              ctx.fillStyle = theme.node;
              ctx.fill();
            }
            ctx.beginPath();
            let hasIsolated = false;
            for (let i = 0; i < nodes.length; i++) {
              const node = nodes[i];
              if (node.degree === 0) {
                appendCirclePath(node, scale);
                hasIsolated = true;
              }
            }
            if (hasIsolated) {
              ctx.fillStyle = theme.isolated;
              ctx.fill();
            }
          }

          // Ring on the hovered node, or around both ends of a hovered link
          // (single-node strokes, no per-node stroke loop).
          if (hoverNode) {
            ctx.beginPath();
            ctx.arc(hoverNode.x, hoverNode.y, effectiveRadius(hoverNode, scale) + 2.5 / scale, 0, TAU);
            ctx.strokeStyle = theme.node;
            ctx.lineWidth = 1.5 / scale;
            ctx.globalAlpha = 0.75;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          if (hoverLink) {
            const ends = linkNodes(hoverLink);
            if (ends) {
              const sourceRadius = effectiveRadius(ends.source, scale) + 2.5 / scale;
              const targetRadius = effectiveRadius(ends.target, scale) + 2.5 / scale;
              ctx.beginPath();
              ctx.arc(ends.source.x, ends.source.y, sourceRadius, 0, TAU);
              ctx.moveTo(ends.target.x + targetRadius, ends.target.y);
              ctx.arc(ends.target.x, ends.target.y, targetRadius, 0, TAU);
              ctx.strokeStyle = theme.node;
              ctx.lineWidth = 1.5 / scale;
              ctx.globalAlpha = 0.75;
              ctx.stroke();
              ctx.globalAlpha = 1;
            }
          }

          ctx.restore();

          if (hoverActive) drawLabels(scale, tx, ty);
        }

        function fitView() {
          if (!nodes.length || !cssW || !cssH) {
            view.k = 1;
            view.tx = cssW / 2;
            view.ty = cssH / 2;
            userInteracted = false;
            requestDraw();
            return;
          }
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) continue;
            if (node.x < minX) minX = node.x;
            if (node.y < minY) minY = node.y;
            if (node.x > maxX) maxX = node.x;
            if (node.y > maxY) maxY = node.y;
          }
          if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
            view.k = 1;
            view.tx = cssW / 2;
            view.ty = cssH / 2;
            userInteracted = false;
            requestDraw();
            return;
          }
          const boxWidth = Math.max(maxX - minX, 1);
          const boxHeight = Math.max(maxY - minY, 1);
          const scale = clamp(
            Math.min((cssW - FIT_PADDING) / boxWidth, (cssH - FIT_PADDING) / boxHeight, FIT_MAX_SCALE),
            MIN_SCALE,
            MAX_SCALE
          );
          view.k = scale;
          view.tx = cssW / 2 - scale * ((minX + maxX) / 2);
          view.ty = cssH / 2 - scale * ((minY + maxY) / 2);
          userInteracted = false;
          requestDraw();
        }

        function zoomAt(px, py, nextScale) {
          const previous = view.k;
          const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
          if (scale === previous) return;
          view.tx = px - (px - view.tx) * (scale / previous);
          view.ty = py - (py - view.ty) * (scale / previous);
          view.k = scale;
          requestDraw();
        }

        function zoomBy(factor) {
          userInteracted = true;
          zoomAt(cssW / 2, cssH / 2, view.k * factor);
        }

        function hitTest(px, py) {
          let best = null;
          let bestDistance = Infinity;
          for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) continue;
            const dx = node.x * view.k + view.tx - px;
            const dy = node.y * view.k + view.ty - py;
            const radius = effectiveRadius(node, view.k) * view.k + 4;
            const distance = dx * dx + dy * dy;
            if (distance <= radius * radius && distance < bestDistance) {
              best = node;
              bestDistance = distance;
            }
          }
          return best;
        }

        function updateHover(node, link) {
          const nextNode = node || null;
          const nextLink = link || null;
          const sameNode = (nextNode ? nextNode.id : null) === (hoverNode ? hoverNode.id : null);
          if (sameNode && nextLink === hoverLink) return false;
          hoverNode = nextNode;
          hoverLink = nextLink;
          hoverIds.clear();
          hoverList = [];
          hoverLinks = [];
          if (hoverNode) {
            hoverIds.add(hoverNode.id);
            hoverList.push(hoverNode);
            for (let i = 0; i < hoverNode.adj.length; i++) {
              const neighbor = hoverNode.adj[i];
              if (!neighbor || hoverIds.has(neighbor.id)) continue;
              hoverIds.add(neighbor.id);
              hoverList.push(neighbor);
            }
            hoverLinks = hoverNode.links;
          } else if (hoverLink) {
            const ends = linkNodes(hoverLink);
            if (ends) {
              hoverList = [ends.source, ends.target];
              hoverIds.add(ends.source.id);
              hoverIds.add(ends.target.id);
              hoverLinks = [hoverLink];
            }
          }
          return true;
        }

        /**
         * Direct relationships of one node, outgoing first: what it imports and
         * what imports it, de-duplicated per direction and relation kind.
         */
        function relationsOf(node) {
          const rows = [];
          if (!node || !node.links || !node.links.length) return rows;
          const seen = new Set();
          for (let i = 0; i < node.links.length; i++) {
            const link = node.links[i];
            const ends = linkNodes(link);
            if (!ends) continue;
            const outgoing = ends.source.id === node.id;
            const other = outgoing ? ends.target : ends.source;
            if (!other || other.id === node.id) continue;
            const kind = linkKind(link);
            const key = (outgoing ? 'out:' : 'in:') + other.id + ':' + kind;
            if (seen.has(key)) continue;
            seen.add(key);
            rows.push({ node: other, dir: outgoing ? 'out' : 'in', kind: kind });
          }
          rows.sort(function (left, right) {
            if (left.dir !== right.dir) return left.dir === 'out' ? -1 : 1;
            return String(left.node.label).localeCompare(String(right.node.label));
          });
          return rows;
        }

        function syncTooltip() {
          if (hoverNode) {
            const relations = relationsOf(hoverNode);
            const visible = relations.slice(0, NODE_TIP_RELATION_LIMIT);
            setTipInfo({
              mode: 'node',
              id: hoverNode.id,
              name: hoverNode.label,
              path: relativeNodePath(hoverNode, rootPath),
              degree: hoverNode.degree || 0,
              relations: visible.map(function (row) {
                return {
                  key: row.dir + ':' + row.node.id + ':' + row.kind,
                  node: row.node,
                  dir: row.dir,
                  name: row.node.label,
                  kind: relationLabel(tRef.current, row.kind),
                };
              }),
              more: Math.max(0, relations.length - visible.length),
            });
            return;
          }
          if (hoverLink) {
            const ends = linkNodes(hoverLink);
            if (!ends) {
              setTipInfo(null);
              return;
            }
            setTipInfo({
              mode: 'link',
              name: ends.source.label + ' → ' + ends.target.label,
              path: relativeNodePath(ends.source, rootPath) + ' → ' + relativeNodePath(ends.target, rootPath),
              meta: relationLabel(tRef.current, linkKind(hoverLink)),
            });
            return;
          }
          setTipInfo(null);
        }

        function cancelHoverHide() {
          if (hoverHideTimer) {
            clearTimeout(hoverHideTimer);
            hoverHideTimer = 0;
          }
        }

        function hideHover() {
          cancelHoverHide();
          if (updateHover(null, null)) {
            syncTooltip();
            updateCursor();
            requestDraw();
          }
        }

        function positionTipAt(px, py) {
          const tip = tipRef.current;
          if (!tip) return;
          const padding = 8;
          const width = tip.offsetWidth || 0;
          const height = tip.offsetHeight || 0;
          let left = px + 14;
          let top = py + 16;
          if (left + width + padding > cssW) left = Math.max(padding, px - width - 14);
          if (top + height + padding > cssH) top = Math.max(padding, py - height - 16);
          tip.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(top) + 'px)';
        }

        positionTipRef.current = function () {
          const pointer = pointerRef.current;
          positionTipAt(pointer.x, pointer.y);
        };

        function updateCursor() {
          if (dead) return;
          if (dragNode || dragPan) canvas.style.cursor = 'grabbing';
          else if (hoverNode) canvas.style.cursor = 'pointer';
          else canvas.style.cursor = 'grab';
        }

        function localPoint(event) {
          const rect = canvas.getBoundingClientRect();
          return { x: event.clientX - rect.left, y: event.clientY - rect.top };
        }

        function onPointerDown(event) {
          if (dead) return;
          if (typeof event.button === 'number' && event.button !== 0) return;
          cancelHoverHide();
          const point = localPoint(event);
          pointerRef.current = point;
          const hit = hitTest(point.x, point.y);
          userInteracted = true;
          dragNode = null;
          dragPan = null;
          press = hit ? { node: hit, x: point.x, y: point.y, moved: false } : null;
          if (hit) {
            dragNode = hit;
            hit.fx = hit.x;
            hit.fy = hit.y;
            sim.alphaTarget(0.25);
            if (updateHover(hit, null)) syncTooltip();
          } else {
            dragPan = { x: point.x, y: point.y, tx: view.tx, ty: view.ty };
            if (updateHover(null, null)) syncTooltip();
          }
          try {
            canvas.setPointerCapture(event.pointerId);
          } catch (error) {
            /* pointer capture is a nicety */
          }
          updateCursor();
          requestDraw();
          if (event.cancelable) event.preventDefault();
        }

        function onPointerMove(event) {
          if (dead) return;
          cancelHoverHide();
          const point = localPoint(event);
          pointerRef.current = point;
          if (dragPan) {
            view.tx = dragPan.tx + (point.x - dragPan.x);
            view.ty = dragPan.ty + (point.y - dragPan.y);
            requestDraw();
            positionTipAt(point.x, point.y);
            return;
          }
          if (dragNode) {
            if (press && !press.moved) {
              const dx = point.x - press.x;
              const dy = point.y - press.y;
              if (dx * dx + dy * dy > 16) press.moved = true;
            }
            dragNode.fx = (point.x - view.tx) / view.k;
            dragNode.fy = (point.y - view.ty) / view.k;
            requestDraw();
            positionTipAt(point.x, point.y);
            return;
          }
          const hit = hitTest(point.x, point.y);
          const linkHit = hit ? null : hitTestLink(point.x, point.y);
          if (updateHover(hit, linkHit)) {
            syncTooltip();
            updateCursor();
            requestDraw();
          }
          positionTipAt(point.x, point.y);
        }

        function endDrag(event) {
          if (dead) return;
          const cancelled = !!(event && event.type === 'pointercancel');
          const releasedNode = !cancelled && press && !press.moved ? press.node : null;
          const draggedNode = dragNode;
          if (dragNode) {
            dragNode.fx = null;
            dragNode.fy = null;
            dragNode = null;
            sim.alphaTarget(0);
          }
          dragPan = null;
          press = null;
          if (event && event.pointerId != null) {
            try {
              canvas.releasePointerCapture(event.pointerId);
            } catch (error) {
              /* ignore */
            }
          }
          updateCursor();
          requestDraw();
          // A click (press without movement) on a neuron opens that file; a
          // drag on the same neuron only moves it.
          if (releasedNode && draggedNode === releasedNode) {
            const onOpenFile = propsRef.current && propsRef.current.onOpenFile;
            if (typeof onOpenFile === 'function') onOpenFile(releasedNode);
          }
        }

        function onPointerLeave() {
          if (dead || dragNode || dragPan) return;
          cancelHoverHide();
          // The tooltip is interactive (its relationship rows open files), so
          // leaving the canvas for the tooltip must not dismiss it. A short
          // grace period lets the pointer cross the gap.
          hoverHideTimer = setTimeout(function () {
            hoverHideTimer = 0;
            if (dead || tipHoverRef.current) return;
            if (updateHover(null, null)) {
              syncTooltip();
              updateCursor();
              requestDraw();
            }
          }, 160);
        }

        function onWheel(event) {
          if (dead) return;
          if (event.cancelable) event.preventDefault();
          userInteracted = true;
          const point = localPoint(event);
          const factor = Math.exp(-event.deltaY * 0.0015);
          zoomAt(point.x, point.y, view.k * factor);
        }

        function onDoubleClick(event) {
          if (dead) return;
          const point = localPoint(event);
          if (!hitTest(point.x, point.y)) fitView();
        }

        // ---- boot -------------------------------------------------------------
        resizeCanvas();
        refreshTheme();
        fitView();
        // Paint synchronously once: an occluded/backgrounded Electron window can
        // pause requestAnimationFrame entirely, and the graph must never be
        // invisible just because the frame loop has not started yet.
        try {
          draw();
        } catch (error) {
          /* the rAF loop below retries on the next frame */
        }

        let resizeObserver = null;
        if (typeof ResizeObserver === 'function') {
          resizeObserver = new ResizeObserver(function () {
            if (dead) return;
            resizeCanvas();
            if (!userInteracted) fitView();
            else requestDraw();
          });
          try {
            resizeObserver.observe(wrap);
          } catch (error) {
            /* ignore */
          }
        }

        let themeObserver = null;
        if (
          typeof MutationObserver === 'function' &&
          typeof document !== 'undefined' &&
          document &&
          document.documentElement
        ) {
          themeObserver = new MutationObserver(function () {
            if (dead) return;
            refreshTheme();
            requestDraw();
          });
          try {
            themeObserver.observe(document.documentElement, {
              attributes: true,
              attributeFilter: ['class', 'style', 'data-theme'],
            });
          } catch (error) {
            /* ignore */
          }
        }

        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', endDrag);
        canvas.addEventListener('pointercancel', endDrag);
        canvas.addEventListener('pointerleave', onPointerLeave);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('dblclick', onDoubleClick);

        if (props.apiRef) {
          props.apiRef.current = {
            fit: fitView,
            zoomIn: function () {
              zoomBy(1.25);
            },
            zoomOut: function () {
              zoomBy(1 / 1.25);
            },
          };
        }

        // The tooltip's own pointer-leave uses this to drop the highlight once
        // the pointer really left both the canvas and the tooltip.
        clearHoverRef.current = hideHover;

        requestDraw();

        return function cleanup() {
          dead = true;
          loopActive = false;
          try {
            sim.stop();
          } catch (error) {
            /* ignore */
          }
          if (resizeObserver) {
            try {
              resizeObserver.disconnect();
            } catch (error) {
              /* ignore */
            }
          }
          if (themeObserver) {
            try {
              themeObserver.disconnect();
            } catch (error) {
              /* ignore */
            }
          }
          canvas.removeEventListener('pointerdown', onPointerDown);
          canvas.removeEventListener('pointermove', onPointerMove);
          canvas.removeEventListener('pointerup', endDrag);
          canvas.removeEventListener('pointercancel', endDrag);
          canvas.removeEventListener('pointerleave', onPointerLeave);
          canvas.removeEventListener('wheel', onWheel, { passive: false });
          canvas.removeEventListener('dblclick', onDoubleClick);
          canvas.style.cursor = '';
          positionTipRef.current = null;
          clearHoverRef.current = null;
          cancelHoverHide();
          if (props.apiRef) props.apiRef.current = null;
        };
      },
      [graph]
    );

    return h(
      'div',
      { className: 'cnx-canvas-wrap', ref: wrapRef },
      h('canvas', {
        ref: canvasRef,
        className: 'cnx-canvas',
        role: 'img',
        'aria-label': tRef.current('title'),
      }),
      tipInfo
        ? h(
            'div',
            {
              ref: tipRef,
              className: 'cnx-tip',
              role: 'tooltip',
              style: tipInfo.mode === 'node' ? { pointerEvents: 'auto' } : undefined,
              onPointerEnter: function () {
                tipHoverRef.current = true;
              },
              onPointerLeave: function () {
                tipHoverRef.current = false;
                const clear = clearHoverRef.current;
                if (typeof clear === 'function') clear();
              },
            },
            h('div', { className: 'cnx-tip-name' }, tipInfo.name),
            h('div', { className: 'cnx-tip-path' }, tipInfo.path),
            tipInfo.mode === 'link'
              ? h('div', { className: 'cnx-tip-meta' }, tipInfo.meta)
              : h('div', { className: 'cnx-tip-meta' }, String(tipInfo.degree) + ' ' + tRef.current('links')),
            tipInfo.mode === 'node'
              ? h(
                  'div',
                  { className: 'cnx-tip-links' },
                  tipInfo.relations.length
                    ? tipInfo.relations.map(function (row) {
                        return h(
                          'button',
                          {
                            key: row.key,
                            type: 'button',
                            className: 'cnx-tip-link',
                            title: row.name,
                            onClick: function () {
                              const onOpenFile = propsRef.current && propsRef.current.onOpenFile;
                              if (typeof onOpenFile === 'function') onOpenFile(row.node);
                            },
                          },
                          h(
                            'span',
                            { className: 'cnx-tip-dir', 'aria-hidden': 'true' },
                            row.dir === 'out' ? '→' : '←'
                          ),
                          h('span', { className: 'cnx-tip-link-name' }, row.name),
                          h('span', { className: 'cnx-tip-kind' }, row.kind)
                        );
                      })
                    : h('div', { className: 'cnx-tip-meta' }, tRef.current('noRelations'))
                )
              : null,
            tipInfo.mode === 'node' && tipInfo.more > 0
              ? h(
                  'div',
                  { className: 'cnx-tip-meta' },
                  '+' + String(tipInfo.more) + ' ' + tRef.current('moreRelations')
                )
              : null,
            tipInfo.mode === 'node' ? h('div', { className: 'cnx-tip-hint' }, tRef.current('clickToOpen')) : null
          )
        : null,

    );
  }

  // ---------------------------------------------------------------------------
  // Plugin registration.
  // ---------------------------------------------------------------------------
  return {
    inject: ['slots', 'locale'],
    apply(ctx) {
      const registerLocale = function () {
        const locale = ctx.locale;
        if (!locale || typeof locale.register !== 'function') return undefined;
        const disposers = [];
        disposers.push(locale.register(LOCALE_NS, 'en', EN));
        disposers.push(locale.register(LOCALE_NS, 'zh', ZH));
        return function disposeLocale() {
          for (let i = 0; i < disposers.length; i++) {
            try {
              if (typeof disposers[i] === 'function') disposers[i]();
            } catch (error) {
              /* ignore */
            }
          }
        };
      };

      const registerSlots = function () {
        const slots = ctx.slots;
        if (!slots || typeof slots.inject !== 'function' || typeof slots.register !== 'function') return undefined;
        const disposers = [];
        function add(disposer) {
          if (typeof disposer === 'function') disposers.push(disposer);
        }
        add(
          slots.inject(SLOT_MENU, function () {
            return slots.register(
              {
                name: SLOT_MENU,
                id: 'connectome.open',
                order: 60,
                locale: LOCALE_NS,
                label: function () {
                  return makeT(null)('open');
                },
              },
              ConnectomeMenuRow
            );
          })
        );
        add(
          slots.inject(SLOT_OVERLAY, function () {
            return slots.register(
              {
                name: SLOT_OVERLAY,
                id: 'connectome.overlay',
                order: 90,
                locale: LOCALE_NS,
              },
              ConnectomeOverlay
            );
          })
        );
        return function disposeSlots() {
          for (let i = 0; i < disposers.length; i++) {
            try {
              disposers[i]();
            } catch (error) {
              /* ignore */
            }
          }
        };
      };

      if (typeof ctx.effect === 'function') {
        // The overlay needs `ctx.get('sidebarRight')` / `ctx.get('uiSession')`
        // at click time to open the file preview; keep the live context here.
        ctx.effect(
          function () {
            pluginCtx = ctx;
            return function () {
              if (pluginCtx === ctx) pluginCtx = null;
            };
          },
          'connectome: host bridge'
        );
        ctx.effect(registerLocale, 'connectome: locale dictionaries');
        ctx.effect(registerSlots, 'connectome: slots');
      } else {
        pluginCtx = ctx;
        registerLocale();
        registerSlots();
      }

    },
  };
}
