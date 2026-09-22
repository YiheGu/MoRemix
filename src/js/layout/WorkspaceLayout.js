const STYLE_ID = "workspace-layout-style";

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.innerHTML = `
    .workspace-layout {
      position: absolute;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      display: none;
      background: #0f1117;
      color: #fff;
      font-family: 'Segoe UI', sans-serif;
      overflow: hidden;
      z-index: 9000;
    }
    .workspace-layout.show {
      display: flex;
    }
    .workspace-left {
      display: flex;
      flex-direction: column;
      flex-basis: 50%;
      min-width: 320px;
      position: relative;
    }
    .workspace-right {
      display: flex;
      flex-direction: column;
      flex: 1;
      position: relative;
      min-width: 320px;
    }
    .workspace-pane {
      position: relative;
      flex: 1;
      border: 1px solid rgba(255,255,255,0.05);
      background: #161925;
      overflow: hidden;
      cursor: default;
    }
    .workspace-pane .pane-label {
      position: absolute;
      top: 8px;
      left: 12px;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(0,0,0,0.45);
      font-size: 12px;
      color: #f0f0f0;
      pointer-events: none;
      z-index: 5;
    }
    .workspace-resizer-vertical {
      width: 6px;
      cursor: col-resize;
      background: rgba(255,255,255,0.08);
      position: relative;
      z-index: 5;
    }
    .workspace-resizer-horizontal {
      height: 6px;
      cursor: row-resize;
      background: rgba(255,255,255,0.08);
      position: relative;
      z-index: 5;
    }
    .workspace-layout.workspace-fullscreen .workspace-pane {
      display: none;
    }
    .workspace-layout.workspace-fullscreen .workspace-pane.is-fullscreen {
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: none;
      z-index: 20;
      background: #0c0f1a;
    }
    .workspace-layout.workspace-fullscreen .workspace-resizer-horizontal,
    .workspace-layout.workspace-fullscreen .workspace-resizer-vertical {
      display: none;
    }
    .pane-placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      color: rgba(255,255,255,0.6);
      pointer-events: auto;
      cursor: default;
    }
    .pane-c-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .pane-a-content {
      position: relative;
      width: 100%;
      height: 100%;
    }
    .pane-a-content canvas {
      width: 100% !important;
      height: 100% !important;
    }
    .workspace-pane .pane-motion-gui {
      position: absolute !important;
      top: 12px;
      left: 12px;
      z-index: 4;
      width: min(clamp(260px, 34vw, 420px), calc(100% - 24px));
      min-width: min(260px, calc(100% - 24px));
      max-width: calc(100% - 24px);
      max-height: calc(100% - 24px);
      overflow-y: auto;
      overflow-x: hidden;
      resize: horizontal;
      border: 1px solid rgba(255,255,255,0.16);
      border-radius: 10px;
      background: rgba(8, 12, 20, 0.82);
      box-shadow: 0 12px 24px rgba(0,0,0,0.3);
      color: #f5f6ff;
      padding-right: 2px;
      box-sizing: border-box;
      scrollbar-width: thin;
      scrollbar-color: rgba(141, 212, 255, 0.55) rgba(255,255,255,0.08);
    }
    .workspace-pane .pane-motion-gui.is-collapsed {
      width: auto !important;
      min-width: 0 !important;
      max-height: none;
      overflow: visible;
      padding-right: 0;
      resize: none;
    }
    .workspace-pane .pane-motion-gui.is-collapsed > ul,
    .workspace-pane .pane-motion-gui.is-collapsed > .pane-motion-action-list,
    .workspace-pane .pane-motion-gui.is-collapsed .close-button {
      display: none !important;
    }
    .workspace-pane .pane-motion-gui .pane-motion-gui-toggle {
      display: block;
      width: calc(100% - 10px);
      margin: 6px auto 4px auto;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      background: rgba(255,255,255,0.1);
      color: #f5f6ff;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.2;
      padding: 7px 10px;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
      text-align: center;
    }
    .workspace-pane .pane-motion-gui .pane-motion-gui-toggle:hover {
      background: rgba(141, 212, 255, 0.22);
      border-color: rgba(141, 212, 255, 0.55);
    }
    .workspace-pane .pane-motion-gui.is-collapsed .pane-motion-gui-toggle {
      width: auto;
      margin: 8px;
      white-space: nowrap;
    }
    .workspace-pane .pane-motion-gui::-webkit-scrollbar {
      width: 8px;
    }
    .workspace-pane .pane-motion-gui::-webkit-scrollbar-thumb {
      background: rgba(141, 212, 255, 0.55);
      border-radius: 999px;
    }
    .workspace-pane .pane-motion-gui::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.08);
      border-radius: 999px;
    }
    .workspace-pane .pane-motion-gui .close-button {
      display: none;
    }
    .workspace-pane .pane-motion-gui > ul {
      width: 100%;
      margin: 0;
      padding: 6px;
      box-sizing: border-box;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .workspace-pane .pane-motion-gui li.cr {
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      background: transparent;
      min-height: 32px;
      height: auto;
      line-height: 1.25;
      padding: 6px 8px;
      box-sizing: border-box;
    }
    .workspace-pane .pane-motion-gui li.cr.function {
      background: rgba(255,255,255,0.06);
      border-radius: 8px;
    }
    .workspace-pane .pane-motion-gui li.cr.function:hover {
      background: rgba(255,255,255,0.14);
    }
    .workspace-pane .pane-motion-gui .c {
      float: none;
      width: auto;
      flex: 0 1 min(46%, 190px);
      min-width: 110px;
    }
    .workspace-pane .pane-motion-gui .property-name {
      float: none;
      width: auto;
      flex: 1 1 auto;
      min-width: 0;
      white-space: normal;
      word-break: break-word;
      overflow-wrap: anywhere;
      color: #d2daf1;
      font-size: 12px;
    }
    .workspace-pane .pane-motion-gui .cr.function .property-name {
      color: #f5f6ff;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .workspace-pane .pane-motion-gui .c select,
    .workspace-pane .pane-motion-gui .c input[type="text"],
    .workspace-pane .pane-motion-gui .c input[type="number"] {
      width: 100%;
      min-width: 0;
    }
    .workspace-pane .pane-motion-gui li.folder {
      margin: 8px 0;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 10px;
      overflow: hidden;
      background: rgba(255,255,255,0.05);
      box-shadow: 0 2px 10px rgba(0,0,0,0.18);
    }
    .workspace-pane .pane-motion-gui li.folder > .title {
      margin: 0;
      padding: 8px 10px;
      line-height: 1.25;
      border-left: none;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      background: rgba(111, 149, 255, 0.2) !important;
    }
    .workspace-pane .pane-motion-gui li.folder.closed > .title {
      border-bottom-color: rgba(255,255,255,0.05);
    }
    .workspace-pane .pane-motion-gui li.folder > ul {
      margin-top: 0;
      padding: 0;
    }
    .workspace-pane .pane-motion-gui li.folder > ul > li:last-child {
      border-bottom: none;
    }
    .workspace-pane .pane-motion-gui .title {
      background: rgba(111, 149, 255, 0.26) !important;
      color: #f4f7ff !important;
      border-left: 2px solid rgba(141, 212, 255, 0.95);
      font-weight: 600;
    }
    .workspace-pane .pane-motion-gui .c select,
    .workspace-pane .pane-motion-gui .c input[type="text"],
    .workspace-pane .pane-motion-gui .c input[type="number"] {
      border: 1px solid rgba(255,255,255,0.2);
      background: rgba(255,255,255,0.07);
      color: #f5f6ff;
      border-radius: 6px;
      padding: 4px 6px;
    }
    .workspace-pane .pane-motion-gui .c input[type="checkbox"] {
      accent-color: #6f95ff;
    }
    .workspace-pane .pane-motion-gui .slider {
      background: rgba(255,255,255,0.14);
    }
    .workspace-pane .pane-motion-gui .slider:hover {
      background: rgba(141, 212, 255, 0.45);
    }
    .workspace-pane .pane-motion-action-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px;
      box-sizing: border-box;
    }
    .workspace-pane .pane-motion-action-btn {
      width: 100%;
      border: 1px solid rgba(255,255,255,0.22);
      border-radius: 8px;
      background: rgba(8, 12, 20, 0.76);
      color: #f5f6ff;
      font-size: 12px;
      font-weight: 500;
      padding: 7px 10px;
      text-align: left;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .workspace-pane .pane-motion-action-btn:hover {
      background: rgba(141, 212, 255, 0.16);
      border-color: rgba(141, 212, 255, 0.5);
    }
    .workspace-pane .pane-motion-action-btn.is-all {
      font-weight: 600;
      color: #d7e2ff;
    }
    .workspace-pane .pane-motion-empty {
      font-size: 12px;
      color: #bcc5df;
      padding: 4px 2px;
    }
    .pane-c-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 16px;
      gap: 12px;
    }
    .pane-c-header {
      font-size: 15px;
      font-weight: 600;
      color: #f5f5f5;
      letter-spacing: 0.3px;
    }
    .pane-c-popup-list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-right: 6px;
      scrollbar-width: thin;
      scrollbar-color: rgba(141, 212, 255, 0.55) rgba(255,255,255,0.08);
    }
    .pane-c-popup-list::-webkit-scrollbar {
      width: 8px;
    }
    .pane-c-popup-list::-webkit-scrollbar-thumb {
      background: rgba(141, 212, 255, 0.55);
      border-radius: 999px;
    }
    .pane-c-popup-list::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.08);
      border-radius: 999px;
    }
    .pane-c-popup-card {
      background: #3c414c;
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.3);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .pane-c-popup-pane {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .pane-c-popup-pane:first-of-type > h4 {
      border-top: 2px solid rgba(255,255,255,0.42);
      padding-top: 12px;
    }
    .pane-c-popup-pane-divider {
      border-top: 1px solid rgba(255,255,255,0.34);
      padding-top: 12px;
    }
    .pane-c-popup-card h3 {
      margin: 0;
      font-size: 22px;
      font-weight: 800;
      color: #f4f5fb;
      line-height: 1.2;
    }
    .pane-c-popup-inputs {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
    }
    .pane-c-popup-slider-row,
    .pane-c-popup-select-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
    }
    .pane-c-popup-inputs,
    .pane-c-popup-slider-row,
    .pane-c-popup-select-row {
      margin: 2px 0;
    }
    .pane-c-popup-slider-row span,
    .pane-c-popup-select-row span,
    .pane-c-popup-inputs span {
      color: #bcc5df;
      min-width: 98px;
      font-size: 12px;
      font-weight: 500;
    }
    .pane-c-popup-inputs input {
      flex: 1;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.2);
      background: rgba(0,0,0,0.2);
      color: #fff;
    }
    .pane-c-popup-slider-row input[type="range"] {
      flex: 1;
      accent-color: #6f95ff;
    }
    .pane-c-popup-slider-row input[type="number"],
    .pane-c-popup-select-row select {
      border: 1px solid rgba(255,255,255,0.2);
      background: rgba(255,255,255,0.06);
      color: #f5f6ff;
      border-radius: 8px;
      padding: 6px 8px;
      font-size: 12px;
    }
    .pane-c-popup-pane h4 {
      margin: 0 0 8px 0;
      color: #ffffff;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.2px;
      line-height: 1.25;
    }
    .pane-c-popup-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .pane-c-popup-actions button,
    .pane-c-action-bar button,
    .pane-c-playback-controls button {
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.2);
      background: rgba(255,255,255,0.08);
      color: #fff;
      cursor: pointer;
      font-size: 13px;
      transition: background 0.15s ease;
    }
    .pane-c-popup-actions button:hover,
    .pane-c-action-bar button:hover,
    .pane-c-playback-controls button:hover {
      background: rgba(255,255,255,0.18);
    }
    .pane-c-playback {
      border-top: 1px solid rgba(255,255,255,0.08);
      padding-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .pane-c-playback-controls {
      display: flex;
      gap: 8px;
      justify-content: flex-start;
      align-items: center;
    }
    .pane-c-progress-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .pane-c-progress-row input[type="range"] {
      flex: 1;
      accent-color: #6f95ff;
    }
    .pane-c-progress-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
    }
    .pane-c-progress-frame {
      min-width: 88px;
      text-align: right;
      color: #d7e2ff;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .pane-c-progress-time {
      min-width: 122px;
      text-align: right;
      color: #bcc5df;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .pane-c-action-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid rgba(255,255,255,0.08);
      padding-top: 10px;
      margin-top: auto;
      gap: 12px;
    }
  `;
  document.head.appendChild(style);
}

export function createWorkspaceLayout() {
  injectStyles();

  const container = document.createElement("div");
  container.className = "workspace-layout";

  const leftColumn = document.createElement("div");
  leftColumn.className = "workspace-left";

  const rightColumn = document.createElement("div");
  rightColumn.className = "workspace-right";

  const paneA = createPane("Window A", "A");
  const paneB = createPane("Window B", "B");
  const paneC = createPane("Window C", "C");

  const horizontalResizer = document.createElement("div");
  horizontalResizer.className = "workspace-resizer-horizontal";

  const verticalResizer = document.createElement("div");
  verticalResizer.className = "workspace-resizer-vertical";

  leftColumn.appendChild(paneA);
  leftColumn.appendChild(horizontalResizer);
  leftColumn.appendChild(paneB);

  rightColumn.appendChild(paneC);

  container.appendChild(leftColumn);
  container.appendChild(verticalResizer);
  container.appendChild(rightColumn);

  const paneOrigins = new WeakMap();
  let fullscreenPane = null;
  let leftRatio = 0.68;
  let topRatio = 0.5;

  setupResizer(horizontalResizer, "horizontal");
  setupResizer(verticalResizer, "vertical");

  container.addEventListener("dblclick", (event) => {
    const target =
      event.target instanceof Element
        ? event.target
        : event.target?.parentElement;
    const pane = target?.closest("[data-pane-id]");
    if (!pane || !container.contains(pane)) return;
    if (pane?.dataset?.paneId === "C") return;
    // Prevent fullscreen toggle if the target is inside a popup
    if (target?.closest(".pane-c-popup-card")) return;
    if (target?.closest(".pane-no-fullscreen-toggle")) return;
    if (target?.closest(".pane-motion-gui")) return;
    if (target?.closest("button, input, select, textarea, label")) return;
    event.preventDefault();
    toggleFullscreen(pane);
  });

  function createPane(label, id) {
    const pane = document.createElement("div");
    pane.className = "workspace-pane";
    if (id) {
      pane.dataset.paneId = id;
    }
    const paneLabel = document.createElement("div");
    paneLabel.className = "pane-label";
    paneLabel.innerText = label;
    pane.appendChild(paneLabel);
    return pane;
  }

  function setupResizer(element, type) {
    let isDragging = false;

    const onMouseMove = (event) => {
      if (!isDragging) return;
      if (type === "vertical") {
        const rect = container.getBoundingClientRect();
        let ratio = (event.clientX - rect.left) / rect.width;
        ratio = Math.max(0.25, Math.min(0.75, ratio));
        leftRatio = ratio;
        leftColumn.style.flexBasis = `${leftRatio * 100}%`;
      } else {
        const rect = leftColumn.getBoundingClientRect();
        let ratio = (event.clientY - rect.top) / rect.height;
        ratio = Math.max(0.2, Math.min(0.8, ratio));
        topRatio = ratio;
        paneA.style.flexBasis = `${topRatio * 100}%`;
        paneB.style.flexBasis = `${(1 - topRatio) * 100}%`;
      }
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    element.addEventListener("mousedown", (event) => {
      event.preventDefault();
      isDragging = true;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }

  function toggleFullscreen(targetPane) {
    if (fullscreenPane === targetPane) {
      exitFullscreen(targetPane);
      return;
    }
    if (fullscreenPane) {
      exitFullscreen(fullscreenPane);
    }
    enterFullscreen(targetPane);
  }

  function enterFullscreen(targetPane) {
    paneOrigins.set(targetPane, {
      parent: targetPane.parentElement,
      nextSibling: targetPane.nextSibling,
    });
    container.appendChild(targetPane);
    fullscreenPane = targetPane;
    targetPane.classList.add("is-fullscreen");
    container.classList.add("workspace-fullscreen");
  }

  function exitFullscreen(targetPane) {
    const origin = paneOrigins.get(targetPane);
    if (origin && origin.parent) {
      if (
        origin.nextSibling &&
        origin.nextSibling.parentElement === origin.parent
      ) {
        origin.parent.insertBefore(targetPane, origin.nextSibling);
      } else {
        origin.parent.appendChild(targetPane);
      }
    }
    paneOrigins.delete(targetPane);
    targetPane.classList.remove("is-fullscreen");
    fullscreenPane = null;
    container.classList.remove("workspace-fullscreen");
  }

  const paneMap = {
    A: paneA,
    B: paneB,
    C: paneC,
  };

  function onPaneResize(id, callback) {
    const pane = paneMap[id];
    if (!pane || typeof ResizeObserver === "undefined") return () => {};
    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        callback({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      });
    });
    observer.observe(pane);
    return () => observer.disconnect();
  }

  function refreshLayoutSizes() {
    leftColumn.style.flexBasis = `${leftRatio * 100}%`;
    paneA.style.flexBasis = `${topRatio * 100}%`;
    paneB.style.flexBasis = `${(1 - topRatio) * 100}%`;
  }

  return {
    mount(parent = document.body) {
      parent.appendChild(container);
    },
    show() {
      container.classList.add("show");
      refreshLayoutSizes();
    },
    hide() {
      container.classList.remove("show");
    },
    getPane(id) {
      return paneMap[id] || null;
    },
    onPaneResize,
    refresh: refreshLayoutSizes,
    element: container,
  };
}
