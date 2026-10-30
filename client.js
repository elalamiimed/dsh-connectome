/*!
 * dsh-connectome — generated browser artifact. DO NOT EDIT.
 * Source: client.source.js (inlined verbatim below, keep it readable).
 * Rebuild with: node build.mjs [--modules <node_modules dir>]
 * d3-force / d3-dispatch / d3-quadtree / d3-timer: ISC, Copyright 2010-2021 Mike Bostock.
 * UMD dist files inlined from vendor/ so no runtime module resolution is required.
 */

/*!
 * dsh-connectome — Client half (readable source; build.mjs wraps this file).
 *
 * Registers two slots:
 *   sidebar.panellist.actions : one "🧠 Connectome" menu row that opens the overlay.
 *   shell.overlay             : the frame-wide dialog with the canvas+d3-force graph.
 *
 * In the dialog every workspace file is a neuron — code, documents (including
 * PDFs and Office files), images, data, media, fonts and archives — colored and
 * shaped by its coarse kind, with folder/subfolder regions outlined behind the
 * graph. Dependency edges carry direction arrowheads (solid for code/style/asset
 * relationships, dashed for HTML/Markdown references); hovering a node or a link
 * reports the relationship, and clicking a neuron opens that file in the harness'
 * own right-Sidebar preview (`ctx.sidebarRight.openResource` with a
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
    empty: 'No files found in this workspace.',
    error: 'Could not build the graph.',
    retry: 'Retry',
    rescan: 'Rescan',
    fit: 'Fit to view',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    close: 'Close',
    hint: 'Click a node to open it · Drag to pan · Scroll to zoom · Hover a node or link to inspect · Folder outlines map the directories',
    files: 'files',
    folders: 'folders',
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
    relAssetRef: 'asset reference',
    relUnknown: 'reference',
    kindCode: 'code',
    kindDoc: 'docs',
    kindData: 'data',
    kindAsset: 'assets',
    kindOther: 'other',
    showFolders: 'Show folder outlines',
    hideFolders: 'Hide folder outlines',
    noPreview: 'The right-sidebar file preview is not available in this window.',
    noSession: 'Open a session first, then click a node to view its file.',
    openFailed: 'Could not open this file in the right sidebar.',
  };

  const ZH = {
    open: '🧠 连接图谱',
    title: '连接图谱',
    loading: '正在扫描工作区…',
    empty: '此工作区中没有文件。',
    error: '无法构建关系图。',
    retry: '重试',
    rescan: '重新扫描',
    fit: '适应视图',
    zoomIn: '放大',
    zoomOut: '缩小',
    close: '关闭',
    hint: '点击节点在右侧边栏打开文件 · 拖拽平移 · 滚轮缩放 · 悬停节点或连线查看关系 · 文件夹轮廓显示目录结构',
    files: '个文件',
    folders: '个文件夹',
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
    relAssetRef: '资源引用',
    relUnknown: '引用',
    kindCode: '代码',
    kindDoc: '文档',
    kindData: '数据',
    kindAsset: '资源',
    kindOther: '其他',
    showFolders: '显示文件夹轮廓',
    hideFolders: '隐藏文件夹轮廓',
    noPreview: '当前窗口无法使用右侧边栏的文件预览。',
    noSession: '请先打开一个会话，再点击节点查看文件。',
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
  --ds-radius-full: 9999px;
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
.cnx-icon-btn[aria-pressed="true"] {
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-brand-primary);
}
.cnx-legend {
  position: absolute;
  left: var(--ds-space-3);
  top: var(--ds-space-3);
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ds-space-1) var(--ds-space-2);
  max-width: calc(100% - var(--ds-space-6));
  pointer-events: none;
}
.cnx-legend-item {
  display: inline-flex;
  align-items: center;
  gap: var(--ds-space-1);
  height: var(--ds-space-5);
  padding: 0 var(--ds-space-2);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 82%, transparent);
  color: var(--dsw-alias-label-secondary);
  border: var(--ds-border-width) solid var(--dsw-alias-border-l1);
  border-radius: var(--ds-radius-full);
  font-size: var(--ds-font-size-caption);
  line-height: var(--ds-line-caption);
  white-space: nowrap;
}
.cnx-legend-shape {
  flex: 0 0 auto;
  width: var(--ds-space-2);
  height: var(--ds-space-2);
}
.cnx-legend-code {
  border-radius: var(--ds-radius-full);
  background: var(--dsw-alias-brand-primary);
}
.cnx-legend-doc {
  border-radius: var(--ds-radius-sm);
  background: var(--dsw-alias-label-secondary);
}
.cnx-legend-data {
  border-radius: 0;
  background: var(--dsw-alias-label-secondary);
  transform: rotate(45deg);
}
.cnx-legend-asset {
  border-radius: var(--ds-radius-full);
  border: var(--ds-border-width) solid var(--dsw-alias-brand-primary);
}
.cnx-legend-other {
  border-radius: var(--ds-radius-full);
  background: var(--dsw-alias-label-secondary);
  opacity: 0.6;
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
    'asset-ref': 'relAssetRef',
  };

  function relationLabel(t, kind) {
    const key = RELATION_KEYS[kind];
    return key ? t(key) : t('relUnknown');
  }

  /**
   * Structural references (HTML/Markdown/asset `url()`) render dashed; code and
   * style dependency relationships render solid. This keeps the two families
   * legible in one view.
   */
  function isDocumentationLink(kind) {
    return kind === 'html-ref' || kind === 'markdown-link' || kind === 'asset-ref';
  }

  // ---------------------------------------------------------------------------
  // File families. The Host tags every node with a coarse `kind`; the canvas
  // groups those kinds into five shapes so a PDF, a PNG and a JS module read
  // differently at a glance. All paint colors still come from the live
  // --dsw-alias-* theme tokens (see the stylesheet note above).
  // ---------------------------------------------------------------------------
  const NODE_GROUPS = ['code', 'doc', 'data', 'asset', 'other'];

  const GROUP_OF_KIND = {
    code: 'code',
    doc: 'doc',
    data: 'data',
    image: 'asset',
    media: 'asset',
    font: 'asset',
    archive: 'asset',
    other: 'other',
  };

  const GROUP_LABEL_KEY = {
    code: 'kindCode',
    doc: 'kindDoc',
    data: 'kindData',
    asset: 'kindAsset',
    other: 'kindOther',
  };

  /**
   * Coarse drawing group of one Host node. Payloads from Host versions before
   * `kind` existed only contained source files, so `code` is the safe fallback.
   * @param {object} node graph node.
   * @returns {string} one of {@link NODE_GROUPS}.
   */
  function nodeGroupOf(node) {
    const kind = node && typeof node.kind === 'string' && node.kind ? node.kind : 'code';
    return GROUP_OF_KIND[kind] || 'other';
  }

  /**
   * Per-group file counts, from `stats.kinds` when the Host provides it and from
   * the nodes themselves otherwise.
   * @param {object} graph graph payload.
   * @returns {Record<string, number>} counts for every group.
   */
  function graphKindCounts(graph) {
    /** @type {Record<string, number>} */
    const counts = { code: 0, doc: 0, data: 0, asset: 0, other: 0 };
    const kinds = graph && graph.stats ? graph.stats.kinds : null;
    if (kinds && typeof kinds === 'object') {
      for (const kind in kinds) {
        if (!Object.prototype.hasOwnProperty.call(kinds, kind)) continue;
        const group = GROUP_OF_KIND[kind] || 'other';
        const value = Number(kinds[kind]);
        if (Number.isFinite(value) && value > 0) counts[group] += value;
      }
      return counts;
    }
    const nodes = graph && Array.isArray(graph.nodes) ? graph.nodes : [];
    for (let i = 0; i < nodes.length; i++) counts[nodeGroupOf(nodes[i])] += 1;
    return counts;
  }

  /**
   * Human-readable byte size for the node tooltip.
   * @param {number} bytes file size in bytes.
   * @returns {string} e.g. `12 B`, `4.2 KB`, `1.3 MB`.
   */
  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    if (bytes < 1024) return Math.round(bytes) + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
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
    const [showFolders, setShowFolders] = React.useState(true);

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
    const folderCount =
      stats && typeof stats.folders === 'number'
        ? stats.folders
        : graph && Array.isArray(graph.folders)
          ? graph.folders.length
          : 0;
    const busy = view.busy;
    const canUseCanvas = view.phase === 'ready' && nodeCount > 0;
    const metaText = graph
      ? String(files) +
        ' ' +
        t('files') +
        ' · ' +
        String(folderCount) +
        ' ' +
        t('folders') +
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
    function onToggleFolders() {
      setShowFolders(function (value) {
        return !value;
      });
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
        showFolders: showFolders,
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
          iconButton(
            'folders',
            showFolders ? t('hideFolders') : t('showFolders'),
            '🗂',
            onToggleFolders,
            !canUseCanvas,
            { 'aria-pressed': showFolders }
          ),
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
            kind: nodeGroupOf(raw),
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

        // ---- drawing buckets + folder index ----------------------------------
        /** @type {Record<string, Array<object>>} */
        const nodesByGroup = { code: [], doc: [], data: [], asset: [], other: [] };
        for (let i = 0; i < nodes.length; i++) nodesByGroup[nodes[i].kind].push(nodes[i]);

        /**
         * Ancestor folder ids of one node directory, root-most first. Cached per
         * directory string: the folder hull pass runs on every frame.
         */
        const folderChainCache = new Map();
        function folderChainOf(dir) {
          const key = typeof dir === 'string' ? dir : '';
          const cached = folderChainCache.get(key);
          if (cached !== undefined) return cached;
          const chain = [];
          if (key && key !== '.') {
            const parts = key.split('/');
            let current = '';
            for (let i = 0; i < parts.length; i++) {
              current = i === 0 ? parts[i] : current + '/' + parts[i];
              chain.push(current);
            }
          }
          folderChainCache.set(key, chain);
          return chain;
        }
        // Host metadata registers folders; deriving from node dirs keeps older
        // payloads (and a truncated folder list) drawing correctly.
        for (let i = 0; i < nodes.length; i++) folderChainOf(nodes[i].dir);

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
          hull: 'GrayText',
          font: '12px sans-serif',
          fontPx: 12,
          labelGap: NODE_LABEL_GAP,
        };

        // ---- helpers ----------------------------------------------------------
        /** Append one rounded rectangle subpath to the current path. */
        function appendRoundRect(x, y, width, height, radius) {
          const r = Math.max(0, Math.min(radius, width / 2, height / 2));
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + width - r, y);
          ctx.arcTo(x + width, y, x + width, y + r, r);
          ctx.lineTo(x + width, y + height - r);
          ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
          ctx.lineTo(x + r, y + height);
          ctx.arcTo(x, y + height, x, y + height - r, r);
          ctx.lineTo(x, y + r);
          ctx.arcTo(x, y, x + r, y, r);
          ctx.closePath();
        }

        /**
         * Append the shape that represents one file family: circles for code,
         * rounded squares for documents, diamonds for data, rings for assets
         * (images, media, fonts, archives) and small dots for anything else.
         */
        function appendNodePath(node, scale, groupName) {
          if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
          const radius = effectiveRadius(node, scale);
          if (groupName === 'doc') {
            const half = radius * 0.9;
            appendRoundRect(node.x - half, node.y - half, half * 2, half * 2, radius * 0.55);
            return;
          }
          if (groupName === 'data') {
            const half = radius * 1.25;
            ctx.moveTo(node.x, node.y - half);
            ctx.lineTo(node.x + half, node.y);
            ctx.lineTo(node.x, node.y + half);
            ctx.lineTo(node.x - half, node.y);
            ctx.closePath();
            return;
          }
          if (groupName === 'asset') {
            ctx.moveTo(node.x + radius, node.y);
            ctx.arc(node.x, node.y, radius, 0, TAU);
            const inner = radius * 0.52;
            ctx.moveTo(node.x + inner, node.y);
            ctx.arc(node.x, node.y, inner, 0, TAU, true);
            return;
          }
          const applied = groupName === 'other' ? radius * 0.78 : radius;
          ctx.moveTo(node.x + applied, node.y);
          ctx.arc(node.x, node.y, applied, 0, TAU);
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
         * Bounding boxes of every directory that contains a laid-out node. Runs
         * per frame on the live positions; linear in nodes × directory depth.
         */
        function computeFolderBoxes() {
          const boxes = new Map();
          for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) continue;
            const chain = folderChainOf(node.dir);
            for (let c = 0; c < chain.length; c++) {
              const id = chain[c];
              let box = boxes.get(id);
              if (box === undefined) {
                box = { id: id, depth: c + 1, minX: node.x, minY: node.y, maxX: node.x, maxY: node.y };
                boxes.set(id, box);
              } else {
                if (node.x < box.minX) box.minX = node.x;
                if (node.y < box.minY) box.minY = node.y;
                if (node.x > box.maxX) box.maxX = node.x;
                if (node.y > box.maxY) box.maxY = node.y;
              }
            }
          }
          return boxes;
        }

        /** Folder label: the last path segment plus a trailing slash. */
        function folderLabelOf(id) {
          const value = String(id);
          const base = value.slice(value.lastIndexOf('/') + 1);
          const text = base + '/';
          return text.length > 28 ? '…' + text.slice(text.length - 27) : text;
        }

        /**
         * Folder/subfolder regions painted behind the graph. Parents draw first,
         * so nested directories read as nested outlines; labels appear once the
         * zoom level makes them legible, and the hovered node's whole folder
         * chain is emphasized.
         */
        function drawFolderHulls(scale) {
          const boxes = computeFolderBoxes();
          if (!boxes.size || !(scale > 0)) return;
          const ordered = [];
          boxes.forEach(function (box) {
            ordered.push(box);
          });
          ordered.sort(function (left, right) {
            if (left.depth !== right.depth) return left.depth - right.depth;
            return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
          });
          const hovered = new Set(hoverNode ? folderChainOf(hoverNode.dir) : []);
          const pad = 12 / scale;
          const labelLine = (theme.fontPx + 6) / scale;
          ctx.save();
          ctx.lineWidth = 1 / scale;
          for (let i = 0; i < ordered.length; i++) {
            const box = ordered[i];
            const x = box.minX - pad;
            const y = box.minY - pad - labelLine;
            const width = box.maxX - box.minX + pad * 2;
            const height = box.maxY - box.minY + pad * 2 + labelLine;
            const hot = hovered.has(box.id);
            if (!hot && (width * scale < 26 || height * scale < 22)) continue;
            ctx.beginPath();
            appendRoundRect(x, y, width, height, Math.min(10 / scale, width / 2, height / 2));
            ctx.fillStyle = theme.node;
            ctx.globalAlpha = hot ? 0.09 : 0.035;
            ctx.fill();
            ctx.globalAlpha = hot ? 0.6 : 0.28;
            ctx.strokeStyle = hot ? theme.node : theme.hull;
            ctx.setLineDash([3 / scale, 3 / scale]);
            ctx.stroke();
            ctx.setLineDash([]);
            if (scale > 0.32 || hot) {
              ctx.globalAlpha = hot ? 0.95 : 0.6;
              ctx.fillStyle = hot ? theme.label : theme.hull;
              ctx.font = theme.font;
              ctx.textAlign = 'left';
              ctx.textBaseline = 'alphabetic';
              ctx.fillText(folderLabelOf(box.id), x + 6 / scale, y + theme.fontPx + 2 / scale);
            }
          }
          ctx.restore();
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
          theme.hull = readColor('--dsw-alias-label-secondary', 'GrayText');
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

          // Folder/subfolder outlines sit behind the graph; they are the
          // directory structure the files come from, not another node family.
          const foldersVisible = !propsRef.current || propsRef.current.showFolders !== false;
          if (foldersVisible) drawFolderHulls(scale);

          // Dependency edges: solid for code/style relationships, dashed for
          // documentation and asset references. One stroke call per family.
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
            // Base nodes dimmed per family shape, then the hovered node and its
            // neighbors highlighted in the brand color.
            for (let g = 0; g < NODE_GROUPS.length; g++) {
              const groupName = NODE_GROUPS[g];
              const list = nodesByGroup[groupName];
              ctx.beginPath();
              let any = false;
              for (let i = 0; i < list.length; i++) {
                const node = list[i];
                if (hoverIds.has(node.id)) continue;
                appendNodePath(node, scale, groupName);
                any = true;
              }
              if (!any) continue;
              ctx.fillStyle = theme.isolated;
              ctx.globalAlpha = 0.35;
              ctx.fill(groupName === 'asset' ? 'evenodd' : 'nonzero');
            }
            ctx.globalAlpha = 1;
            ctx.beginPath();
            for (let i = 0; i < hoverList.length; i++) appendNodePath(hoverList[i], scale, hoverList[i].kind);
            ctx.fillStyle = theme.node;
            ctx.fill('evenodd');
          } else {
            // Normal nodes: one path + one fill per family; assets keep a hole so
            // they read as rings, and isolated files paint at reduced opacity.
            for (let g = 0; g < NODE_GROUPS.length; g++) {
              const groupName = NODE_GROUPS[g];
              const list = nodesByGroup[groupName];
              const rule = groupName === 'asset' ? 'evenodd' : 'nonzero';
              const color = groupName === 'code' || groupName === 'asset' ? theme.node : theme.muted;
              const alpha = groupName === 'asset' ? 0.55 : groupName === 'other' ? 0.6 : 1;
              ctx.beginPath();
              let anyConnected = false;
              for (let i = 0; i < list.length; i++) {
                if (list[i].degree > 0) {
                  appendNodePath(list[i], scale, groupName);
                  anyConnected = true;
                }
              }
              if (anyConnected) {
                ctx.fillStyle = color;
                ctx.globalAlpha = alpha;
                ctx.fill(rule);
              }
              ctx.beginPath();
              let anyIsolated = false;
              for (let i = 0; i < list.length; i++) {
                if (list[i].degree === 0) {
                  appendNodePath(list[i], scale, groupName);
                  anyIsolated = true;
                }
              }
              if (anyIsolated) {
                ctx.fillStyle = color;
                ctx.globalAlpha = alpha * 0.45;
                ctx.fill(rule);
              }
            }
            ctx.globalAlpha = 1;
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
            const t = tRef.current;
            const groupLabel = t(GROUP_LABEL_KEY[hoverNode.kind] || 'kindOther');
            const extPart = hoverNode.ext ? ' · ' + hoverNode.ext : '';
            setTipInfo({
              mode: 'node',
              id: hoverNode.id,
              name: hoverNode.label,
              path: relativeNodePath(hoverNode, rootPath),
              meta:
                groupLabel +
                extPart +
                ' · ' +
                formatBytes(hoverNode.size) +
                ' · ' +
                String(hoverNode.degree || 0) +
                ' ' +
                t('links'),
              relations: visible.map(function (row) {
                return {
                  key: row.dir + ':' + row.node.id + ':' + row.kind,
                  node: row.node,
                  dir: row.dir,
                  name: row.node.label,
                  kind: relationLabel(t, row.kind),
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
            redraw: requestDraw,
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

    // Folder outlines are drawn by the engine (so they follow the simulation),
    // so toggling them only asks for a repaint; it never rebuilds the graph.
    React.useEffect(
      function () {
        const api = props.apiRef && props.apiRef.current;
        if (api && typeof api.redraw === 'function') api.redraw();
      },
      [props.showFolders]
    );

    const kindCounts = graphKindCounts(graph);
    const legendItems = NODE_GROUPS.map(function (group) {
      return { group: group, label: t(GROUP_LABEL_KEY[group]), count: kindCounts[group] || 0 };
    }).filter(function (item) {
      return item.count > 0;
    });

    return h(
      'div',
      { className: 'cnx-canvas-wrap', ref: wrapRef },
      h('canvas', {
        ref: canvasRef,
        className: 'cnx-canvas',
        role: 'img',
        'aria-label': tRef.current('title'),
      }),
      legendItems.length
        ? h(
            'div',
            { className: 'cnx-legend', 'aria-hidden': 'true' },
            legendItems.map(function (item) {
              return h(
                'span',
                { key: item.group, className: 'cnx-legend-item', title: item.label + ' · ' + String(item.count) },
                h('span', { className: 'cnx-legend-shape cnx-legend-' + item.group }),
                item.label + ' ' + String(item.count)
              );
            })
          )
        : null,
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
            h('div', { className: 'cnx-tip-meta' }, tipInfo.meta),
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


window.__ModuleLoader__.load({
  id: "dsh-connectome",
  factory: (require) => {
    var __d3 = (function () {
  var __defs = Object.create(null), __cache = Object.create(null);
  function __load(id) {
    var cached = __cache[id];
    if (cached !== undefined) return cached;
    var def = __defs[id];
    if (def === undefined) throw new Error("dsh-connectome: missing inlined module " + id);
    var module = { exports: {} };
    __cache[id] = module.exports;
    def(module, module.exports, __load);
    __cache[id] = module.exports;
    return module.exports;
  }
  function __define(id, factory) { __defs[id] = factory; }
  __define("d3-dispatch", function (module, exports, require) {
// https://d3js.org/d3-dispatch/ v3.0.1 Copyright 2010-2021 Mike Bostock
!function(n,e){"object"==typeof exports&&"undefined"!=typeof module?e(exports):"function"==typeof define&&define.amd?define(["exports"],e):e((n="undefined"!=typeof globalThis?globalThis:n||self).d3=n.d3||{})}(this,(function(n){"use strict";var e={value:()=>{}};function t(){for(var n,e=0,t=arguments.length,o={};e<t;++e){if(!(n=arguments[e]+"")||n in o||/[\s.]/.test(n))throw new Error("illegal type: "+n);o[n]=[]}return new r(o)}function r(n){this._=n}function o(n,e){return n.trim().split(/^|\s+/).map((function(n){var t="",r=n.indexOf(".");if(r>=0&&(t=n.slice(r+1),n=n.slice(0,r)),n&&!e.hasOwnProperty(n))throw new Error("unknown type: "+n);return{type:n,name:t}}))}function i(n,e){for(var t,r=0,o=n.length;r<o;++r)if((t=n[r]).name===e)return t.value}function f(n,t,r){for(var o=0,i=n.length;o<i;++o)if(n[o].name===t){n[o]=e,n=n.slice(0,o).concat(n.slice(o+1));break}return null!=r&&n.push({name:t,value:r}),n}r.prototype=t.prototype={constructor:r,on:function(n,e){var t,r=this._,l=o(n+"",r),a=-1,u=l.length;if(!(arguments.length<2)){if(null!=e&&"function"!=typeof e)throw new Error("invalid callback: "+e);for(;++a<u;)if(t=(n=l[a]).type)r[t]=f(r[t],n.name,e);else if(null==e)for(t in r)r[t]=f(r[t],n.name,null);return this}for(;++a<u;)if((t=(n=l[a]).type)&&(t=i(r[t],n.name)))return t},copy:function(){var n={},e=this._;for(var t in e)n[t]=e[t].slice();return new r(n)},call:function(n,e){if((t=arguments.length-2)>0)for(var t,r,o=new Array(t),i=0;i<t;++i)o[i]=arguments[i+2];if(!this._.hasOwnProperty(n))throw new Error("unknown type: "+n);for(i=0,t=(r=this._[n]).length;i<t;++i)r[i].value.apply(e,o)},apply:function(n,e,t){if(!this._.hasOwnProperty(n))throw new Error("unknown type: "+n);for(var r=this._[n],o=0,i=r.length;o<i;++o)r[o].value.apply(e,t)}},n.dispatch=t,Object.defineProperty(n,"__esModule",{value:!0})}));
  });
  __define("d3-quadtree", function (module, exports, require) {
// https://d3js.org/d3-quadtree/ v3.0.1 Copyright 2010-2021 Mike Bostock
!function(t,i){"object"==typeof exports&&"undefined"!=typeof module?i(exports):"function"==typeof define&&define.amd?define(["exports"],i):i((t="undefined"!=typeof globalThis?globalThis:t||self).d3=t.d3||{})}(this,(function(t){"use strict";function i(t,i,e,n){if(isNaN(i)||isNaN(e))return t;var r,s,h,o,a,u,l,_,f,c=t._root,x={data:n},y=t._x0,d=t._y0,p=t._x1,v=t._y1;if(!c)return t._root=x,t;for(;c.length;)if((u=i>=(s=(y+p)/2))?y=s:p=s,(l=e>=(h=(d+v)/2))?d=h:v=h,r=c,!(c=c[_=l<<1|u]))return r[_]=x,t;if(o=+t._x.call(null,c.data),a=+t._y.call(null,c.data),i===o&&e===a)return x.next=c,r?r[_]=x:t._root=x,t;do{r=r?r[_]=new Array(4):t._root=new Array(4),(u=i>=(s=(y+p)/2))?y=s:p=s,(l=e>=(h=(d+v)/2))?d=h:v=h}while((_=l<<1|u)==(f=(a>=h)<<1|o>=s));return r[f]=c,r[_]=x,t}function e(t,i,e,n,r){this.node=t,this.x0=i,this.y0=e,this.x1=n,this.y1=r}function n(t){return t[0]}function r(t){return t[1]}function s(t,i,e){var s=new h(null==i?n:i,null==e?r:e,NaN,NaN,NaN,NaN);return null==t?s:s.addAll(t)}function h(t,i,e,n,r,s){this._x=t,this._y=i,this._x0=e,this._y0=n,this._x1=r,this._y1=s,this._root=void 0}function o(t){for(var i={data:t.data},e=i;t=t.next;)e=e.next={data:t.data};return i}var a=s.prototype=h.prototype;a.copy=function(){var t,i,e=new h(this._x,this._y,this._x0,this._y0,this._x1,this._y1),n=this._root;if(!n)return e;if(!n.length)return e._root=o(n),e;for(t=[{source:n,target:e._root=new Array(4)}];n=t.pop();)for(var r=0;r<4;++r)(i=n.source[r])&&(i.length?t.push({source:i,target:n.target[r]=new Array(4)}):n.target[r]=o(i));return e},a.add=function(t){const e=+this._x.call(null,t),n=+this._y.call(null,t);return i(this.cover(e,n),e,n,t)},a.addAll=function(t){var e,n,r,s,h=t.length,o=new Array(h),a=new Array(h),u=1/0,l=1/0,_=-1/0,f=-1/0;for(n=0;n<h;++n)isNaN(r=+this._x.call(null,e=t[n]))||isNaN(s=+this._y.call(null,e))||(o[n]=r,a[n]=s,r<u&&(u=r),r>_&&(_=r),s<l&&(l=s),s>f&&(f=s));if(u>_||l>f)return this;for(this.cover(u,l).cover(_,f),n=0;n<h;++n)i(this,o[n],a[n],t[n]);return this},a.cover=function(t,i){if(isNaN(t=+t)||isNaN(i=+i))return this;var e=this._x0,n=this._y0,r=this._x1,s=this._y1;if(isNaN(e))r=(e=Math.floor(t))+1,s=(n=Math.floor(i))+1;else{for(var h,o,a=r-e||1,u=this._root;e>t||t>=r||n>i||i>=s;)switch(o=(i<n)<<1|t<e,(h=new Array(4))[o]=u,u=h,a*=2,o){case 0:r=e+a,s=n+a;break;case 1:e=r-a,s=n+a;break;case 2:r=e+a,n=s-a;break;case 3:e=r-a,n=s-a}this._root&&this._root.length&&(this._root=u)}return this._x0=e,this._y0=n,this._x1=r,this._y1=s,this},a.data=function(){var t=[];return this.visit((function(i){if(!i.length)do{t.push(i.data)}while(i=i.next)})),t},a.extent=function(t){return arguments.length?this.cover(+t[0][0],+t[0][1]).cover(+t[1][0],+t[1][1]):isNaN(this._x0)?void 0:[[this._x0,this._y0],[this._x1,this._y1]]},a.find=function(t,i,n){var r,s,h,o,a,u,l,_=this._x0,f=this._y0,c=this._x1,x=this._y1,y=[],d=this._root;for(d&&y.push(new e(d,_,f,c,x)),null==n?n=1/0:(_=t-n,f=i-n,c=t+n,x=i+n,n*=n);u=y.pop();)if(!(!(d=u.node)||(s=u.x0)>c||(h=u.y0)>x||(o=u.x1)<_||(a=u.y1)<f))if(d.length){var p=(s+o)/2,v=(h+a)/2;y.push(new e(d[3],p,v,o,a),new e(d[2],s,v,p,a),new e(d[1],p,h,o,v),new e(d[0],s,h,p,v)),(l=(i>=v)<<1|t>=p)&&(u=y[y.length-1],y[y.length-1]=y[y.length-1-l],y[y.length-1-l]=u)}else{var w=t-+this._x.call(null,d.data),N=i-+this._y.call(null,d.data),g=w*w+N*N;if(g<n){var A=Math.sqrt(n=g);_=t-A,f=i-A,c=t+A,x=i+A,r=d.data}}return r},a.remove=function(t){if(isNaN(s=+this._x.call(null,t))||isNaN(h=+this._y.call(null,t)))return this;var i,e,n,r,s,h,o,a,u,l,_,f,c=this._root,x=this._x0,y=this._y0,d=this._x1,p=this._y1;if(!c)return this;if(c.length)for(;;){if((u=s>=(o=(x+d)/2))?x=o:d=o,(l=h>=(a=(y+p)/2))?y=a:p=a,i=c,!(c=c[_=l<<1|u]))return this;if(!c.length)break;(i[_+1&3]||i[_+2&3]||i[_+3&3])&&(e=i,f=_)}for(;c.data!==t;)if(n=c,!(c=c.next))return this;return(r=c.next)&&delete c.next,n?(r?n.next=r:delete n.next,this):i?(r?i[_]=r:delete i[_],(c=i[0]||i[1]||i[2]||i[3])&&c===(i[3]||i[2]||i[1]||i[0])&&!c.length&&(e?e[f]=c:this._root=c),this):(this._root=r,this)},a.removeAll=function(t){for(var i=0,e=t.length;i<e;++i)this.remove(t[i]);return this},a.root=function(){return this._root},a.size=function(){var t=0;return this.visit((function(i){if(!i.length)do{++t}while(i=i.next)})),t},a.visit=function(t){var i,n,r,s,h,o,a=[],u=this._root;for(u&&a.push(new e(u,this._x0,this._y0,this._x1,this._y1));i=a.pop();)if(!t(u=i.node,r=i.x0,s=i.y0,h=i.x1,o=i.y1)&&u.length){var l=(r+h)/2,_=(s+o)/2;(n=u[3])&&a.push(new e(n,l,_,h,o)),(n=u[2])&&a.push(new e(n,r,_,l,o)),(n=u[1])&&a.push(new e(n,l,s,h,_)),(n=u[0])&&a.push(new e(n,r,s,l,_))}return this},a.visitAfter=function(t){var i,n=[],r=[];for(this._root&&n.push(new e(this._root,this._x0,this._y0,this._x1,this._y1));i=n.pop();){var s=i.node;if(s.length){var h,o=i.x0,a=i.y0,u=i.x1,l=i.y1,_=(o+u)/2,f=(a+l)/2;(h=s[0])&&n.push(new e(h,o,a,_,f)),(h=s[1])&&n.push(new e(h,_,a,u,f)),(h=s[2])&&n.push(new e(h,o,f,_,l)),(h=s[3])&&n.push(new e(h,_,f,u,l))}r.push(i)}for(;i=r.pop();)t(i.node,i.x0,i.y0,i.x1,i.y1);return this},a.x=function(t){return arguments.length?(this._x=t,this):this._x},a.y=function(t){return arguments.length?(this._y=t,this):this._y},t.quadtree=s,Object.defineProperty(t,"__esModule",{value:!0})}));
  });
  __define("d3-timer", function (module, exports, require) {
// https://d3js.org/d3-timer/ v3.0.1 Copyright 2010-2021 Mike Bostock
!function(t,n){"object"==typeof exports&&"undefined"!=typeof module?n(exports):"function"==typeof define&&define.amd?define(["exports"],n):n((t="undefined"!=typeof globalThis?globalThis:t||self).d3=t.d3||{})}(this,(function(t){"use strict";var n,e,o=0,i=0,r=0,l=0,u=0,a=0,s="object"==typeof performance&&performance.now?performance:Date,c="object"==typeof window&&window.requestAnimationFrame?window.requestAnimationFrame.bind(window):function(t){setTimeout(t,17)};function f(){return u||(c(_),u=s.now()+a)}function _(){u=0}function m(){this._call=this._time=this._next=null}function p(t,n,e){var o=new m;return o.restart(t,n,e),o}function w(){f(),++o;for(var t,e=n;e;)(t=u-e._time)>=0&&e._call.call(void 0,t),e=e._next;--o}function d(){u=(l=s.now())+a,o=i=0;try{w()}finally{o=0,function(){var t,o,i=n,r=1/0;for(;i;)i._call?(r>i._time&&(r=i._time),t=i,i=i._next):(o=i._next,i._next=null,i=t?t._next=o:n=o);e=t,y(r)}(),u=0}}function h(){var t=s.now(),n=t-l;n>1e3&&(a-=n,l=t)}function y(t){o||(i&&(i=clearTimeout(i)),t-u>24?(t<1/0&&(i=setTimeout(d,t-s.now()-a)),r&&(r=clearInterval(r))):(r||(l=s.now(),r=setInterval(h,1e3)),o=1,c(d)))}m.prototype=p.prototype={constructor:m,restart:function(t,o,i){if("function"!=typeof t)throw new TypeError("callback is not a function");i=(null==i?f():+i)+(null==o?0:+o),this._next||e===this||(e?e._next=this:n=this,e=this),this._call=t,this._time=i,y()},stop:function(){this._call&&(this._call=null,this._time=1/0,y())}},t.interval=function(t,n,e){var o=new m,i=n;return null==n?(o.restart(t,n,e),o):(o._restart=o.restart,o.restart=function(t,n,e){n=+n,e=null==e?f():+e,o._restart((function r(l){l+=i,o._restart(r,i+=n,e),t(l)}),n,e)},o.restart(t,n,e),o)},t.now=f,t.timeout=function(t,n,e){var o=new m;return n=null==n?0:+n,o.restart((e=>{o.stop(),t(e+n)}),n,e),o},t.timer=p,t.timerFlush=w,Object.defineProperty(t,"__esModule",{value:!0})}));
  });
  __define("d3-force", function (module, exports, require) {
// https://d3js.org/d3-force/ v3.0.0 Copyright 2010-2021 Mike Bostock
!function(n,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports,require("d3-quadtree"),require("d3-dispatch"),require("d3-timer")):"function"==typeof define&&define.amd?define(["exports","d3-quadtree","d3-dispatch","d3-timer"],t):t((n="undefined"!=typeof globalThis?globalThis:n||self).d3=n.d3||{},n.d3,n.d3,n.d3)}(this,(function(n,t,e,r){"use strict";function i(n){return function(){return n}}function u(n){return 1e-6*(n()-.5)}function o(n){return n.x+n.vx}function f(n){return n.y+n.vy}function a(n){return n.index}function c(n,t){var e=n.get(t);if(!e)throw new Error("node not found: "+t);return e}const l=4294967296;function h(n){return n.x}function v(n){return n.y}var y=Math.PI*(3-Math.sqrt(5));n.forceCenter=function(n,t){var e,r=1;function i(){var i,u,o=e.length,f=0,a=0;for(i=0;i<o;++i)f+=(u=e[i]).x,a+=u.y;for(f=(f/o-n)*r,a=(a/o-t)*r,i=0;i<o;++i)(u=e[i]).x-=f,u.y-=a}return null==n&&(n=0),null==t&&(t=0),i.initialize=function(n){e=n},i.x=function(t){return arguments.length?(n=+t,i):n},i.y=function(n){return arguments.length?(t=+n,i):t},i.strength=function(n){return arguments.length?(r=+n,i):r},i},n.forceCollide=function(n){var e,r,a,c=1,l=1;function h(){for(var n,i,h,y,d,g,x,s=e.length,p=0;p<l;++p)for(i=t.quadtree(e,o,f).visitAfter(v),n=0;n<s;++n)h=e[n],g=r[h.index],x=g*g,y=h.x+h.vx,d=h.y+h.vy,i.visit(M);function M(n,t,e,r,i){var o=n.data,f=n.r,l=g+f;if(!o)return t>y+l||r<y-l||e>d+l||i<d-l;if(o.index>h.index){var v=y-o.x-o.vx,s=d-o.y-o.vy,p=v*v+s*s;p<l*l&&(0===v&&(p+=(v=u(a))*v),0===s&&(p+=(s=u(a))*s),p=(l-(p=Math.sqrt(p)))/p*c,h.vx+=(v*=p)*(l=(f*=f)/(x+f)),h.vy+=(s*=p)*l,o.vx-=v*(l=1-l),o.vy-=s*l)}}}function v(n){if(n.data)return n.r=r[n.data.index];for(var t=n.r=0;t<4;++t)n[t]&&n[t].r>n.r&&(n.r=n[t].r)}function y(){if(e){var t,i,u=e.length;for(r=new Array(u),t=0;t<u;++t)i=e[t],r[i.index]=+n(i,t,e)}}return"function"!=typeof n&&(n=i(null==n?1:+n)),h.initialize=function(n,t){e=n,a=t,y()},h.iterations=function(n){return arguments.length?(l=+n,h):l},h.strength=function(n){return arguments.length?(c=+n,h):c},h.radius=function(t){return arguments.length?(n="function"==typeof t?t:i(+t),y(),h):n},h},n.forceLink=function(n){var t,e,r,o,f,l,h=a,v=function(n){return 1/Math.min(o[n.source.index],o[n.target.index])},y=i(30),d=1;function g(r){for(var i=0,o=n.length;i<d;++i)for(var a,c,h,v,y,g,x,s=0;s<o;++s)c=(a=n[s]).source,v=(h=a.target).x+h.vx-c.x-c.vx||u(l),y=h.y+h.vy-c.y-c.vy||u(l),v*=g=((g=Math.sqrt(v*v+y*y))-e[s])/g*r*t[s],y*=g,h.vx-=v*(x=f[s]),h.vy-=y*x,c.vx+=v*(x=1-x),c.vy+=y*x}function x(){if(r){var i,u,a=r.length,l=n.length,v=new Map(r.map(((n,t)=>[h(n,t,r),n])));for(i=0,o=new Array(a);i<l;++i)(u=n[i]).index=i,"object"!=typeof u.source&&(u.source=c(v,u.source)),"object"!=typeof u.target&&(u.target=c(v,u.target)),o[u.source.index]=(o[u.source.index]||0)+1,o[u.target.index]=(o[u.target.index]||0)+1;for(i=0,f=new Array(l);i<l;++i)u=n[i],f[i]=o[u.source.index]/(o[u.source.index]+o[u.target.index]);t=new Array(l),s(),e=new Array(l),p()}}function s(){if(r)for(var e=0,i=n.length;e<i;++e)t[e]=+v(n[e],e,n)}function p(){if(r)for(var t=0,i=n.length;t<i;++t)e[t]=+y(n[t],t,n)}return null==n&&(n=[]),g.initialize=function(n,t){r=n,l=t,x()},g.links=function(t){return arguments.length?(n=t,x(),g):n},g.id=function(n){return arguments.length?(h=n,g):h},g.iterations=function(n){return arguments.length?(d=+n,g):d},g.strength=function(n){return arguments.length?(v="function"==typeof n?n:i(+n),s(),g):v},g.distance=function(n){return arguments.length?(y="function"==typeof n?n:i(+n),p(),g):y},g},n.forceManyBody=function(){var n,e,r,o,f,a=i(-30),c=1,l=1/0,y=.81;function d(r){var i,u=n.length,f=t.quadtree(n,h,v).visitAfter(x);for(o=r,i=0;i<u;++i)e=n[i],f.visit(s)}function g(){if(n){var t,e,r=n.length;for(f=new Array(r),t=0;t<r;++t)e=n[t],f[e.index]=+a(e,t,n)}}function x(n){var t,e,r,i,u,o=0,a=0;if(n.length){for(r=i=u=0;u<4;++u)(t=n[u])&&(e=Math.abs(t.value))&&(o+=t.value,a+=e,r+=e*t.x,i+=e*t.y);n.x=r/a,n.y=i/a}else{(t=n).x=t.data.x,t.y=t.data.y;do{o+=f[t.data.index]}while(t=t.next)}n.value=o}function s(n,t,i,a){if(!n.value)return!0;var h=n.x-e.x,v=n.y-e.y,d=a-t,g=h*h+v*v;if(d*d/y<g)return g<l&&(0===h&&(g+=(h=u(r))*h),0===v&&(g+=(v=u(r))*v),g<c&&(g=Math.sqrt(c*g)),e.vx+=h*n.value*o/g,e.vy+=v*n.value*o/g),!0;if(!(n.length||g>=l)){(n.data!==e||n.next)&&(0===h&&(g+=(h=u(r))*h),0===v&&(g+=(v=u(r))*v),g<c&&(g=Math.sqrt(c*g)));do{n.data!==e&&(d=f[n.data.index]*o/g,e.vx+=h*d,e.vy+=v*d)}while(n=n.next)}}return d.initialize=function(t,e){n=t,r=e,g()},d.strength=function(n){return arguments.length?(a="function"==typeof n?n:i(+n),g(),d):a},d.distanceMin=function(n){return arguments.length?(c=n*n,d):Math.sqrt(c)},d.distanceMax=function(n){return arguments.length?(l=n*n,d):Math.sqrt(l)},d.theta=function(n){return arguments.length?(y=n*n,d):Math.sqrt(y)},d},n.forceRadial=function(n,t,e){var r,u,o,f=i(.1);function a(n){for(var i=0,f=r.length;i<f;++i){var a=r[i],c=a.x-t||1e-6,l=a.y-e||1e-6,h=Math.sqrt(c*c+l*l),v=(o[i]-h)*u[i]*n/h;a.vx+=c*v,a.vy+=l*v}}function c(){if(r){var t,e=r.length;for(u=new Array(e),o=new Array(e),t=0;t<e;++t)o[t]=+n(r[t],t,r),u[t]=isNaN(o[t])?0:+f(r[t],t,r)}}return"function"!=typeof n&&(n=i(+n)),null==t&&(t=0),null==e&&(e=0),a.initialize=function(n){r=n,c()},a.strength=function(n){return arguments.length?(f="function"==typeof n?n:i(+n),c(),a):f},a.radius=function(t){return arguments.length?(n="function"==typeof t?t:i(+t),c(),a):n},a.x=function(n){return arguments.length?(t=+n,a):t},a.y=function(n){return arguments.length?(e=+n,a):e},a},n.forceSimulation=function(n){var t,i=1,u=.001,o=1-Math.pow(u,1/300),f=0,a=.6,c=new Map,h=r.timer(g),v=e.dispatch("tick","end"),d=function(){let n=1;return()=>(n=(1664525*n+1013904223)%l)/l}();function g(){x(),v.call("tick",t),i<u&&(h.stop(),v.call("end",t))}function x(e){var r,u,l=n.length;void 0===e&&(e=1);for(var h=0;h<e;++h)for(i+=(f-i)*o,c.forEach((function(n){n(i)})),r=0;r<l;++r)null==(u=n[r]).fx?u.x+=u.vx*=a:(u.x=u.fx,u.vx=0),null==u.fy?u.y+=u.vy*=a:(u.y=u.fy,u.vy=0);return t}function s(){for(var t,e=0,r=n.length;e<r;++e){if((t=n[e]).index=e,null!=t.fx&&(t.x=t.fx),null!=t.fy&&(t.y=t.fy),isNaN(t.x)||isNaN(t.y)){var i=10*Math.sqrt(.5+e),u=e*y;t.x=i*Math.cos(u),t.y=i*Math.sin(u)}(isNaN(t.vx)||isNaN(t.vy))&&(t.vx=t.vy=0)}}function p(t){return t.initialize&&t.initialize(n,d),t}return null==n&&(n=[]),s(),t={tick:x,restart:function(){return h.restart(g),t},stop:function(){return h.stop(),t},nodes:function(e){return arguments.length?(n=e,s(),c.forEach(p),t):n},alpha:function(n){return arguments.length?(i=+n,t):i},alphaMin:function(n){return arguments.length?(u=+n,t):u},alphaDecay:function(n){return arguments.length?(o=+n,t):+o},alphaTarget:function(n){return arguments.length?(f=+n,t):f},velocityDecay:function(n){return arguments.length?(a=1-n,t):1-a},randomSource:function(n){return arguments.length?(d=n,c.forEach(p),t):d},force:function(n,e){return arguments.length>1?(null==e?c.delete(n):c.set(n,p(e)),t):c.get(n)},find:function(t,e,r){var i,u,o,f,a,c=0,l=n.length;for(null==r?r=1/0:r*=r,c=0;c<l;++c)(o=(i=t-(f=n[c]).x)*i+(u=e-f.y)*u)<r&&(a=f,r=o);return a},on:function(n,e){return arguments.length>1?(v.on(n,e),t):v.on(n)}}},n.forceX=function(n){var t,e,r,u=i(.1);function o(n){for(var i,u=0,o=t.length;u<o;++u)(i=t[u]).vx+=(r[u]-i.x)*e[u]*n}function f(){if(t){var i,o=t.length;for(e=new Array(o),r=new Array(o),i=0;i<o;++i)e[i]=isNaN(r[i]=+n(t[i],i,t))?0:+u(t[i],i,t)}}return"function"!=typeof n&&(n=i(null==n?0:+n)),o.initialize=function(n){t=n,f()},o.strength=function(n){return arguments.length?(u="function"==typeof n?n:i(+n),f(),o):u},o.x=function(t){return arguments.length?(n="function"==typeof t?t:i(+t),f(),o):n},o},n.forceY=function(n){var t,e,r,u=i(.1);function o(n){for(var i,u=0,o=t.length;u<o;++u)(i=t[u]).vy+=(r[u]-i.y)*e[u]*n}function f(){if(t){var i,o=t.length;for(e=new Array(o),r=new Array(o),i=0;i<o;++i)e[i]=isNaN(r[i]=+n(t[i],i,t))?0:+u(t[i],i,t)}}return"function"!=typeof n&&(n=i(null==n?0:+n)),o.initialize=function(n){t=n,f()},o.strength=function(n){return arguments.length?(u="function"==typeof n?n:i(+n),f(),o):u},o.y=function(t){return arguments.length?(n="function"==typeof t?t:i(+t),f(),o):n},o},Object.defineProperty(n,"__esModule",{value:!0})}));
  });
  return __load('d3-force');
})();
    var __require = function (specifier) {
      if (specifier === 'd3-force') return __d3;
      return require(specifier);
    };
    return createConnectome(__require);
  },
});
