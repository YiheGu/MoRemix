import { createPaneDockPanel } from "./CollapsiblePanel";

const SVG_WIDTH = 196;
const SVG_HEIGHT = 220;

export function createV3VisualController({
  paneContainer,
  paneId = "paneA",
  getPaneSettingsDock,
  getActiveSelection,
  getSkeletalMotion,
  getPldMotion,
} = {}) {
  if (paneId !== "paneA" || !paneContainer) return null;
  const dock = getPaneSettingsDock?.(paneContainer);
  if (!dock) return null;

  const { root, body, collapsible } = createPaneDockPanel({
    title: "V3 Visual",
    initialCollapsed: true,
    width: "220px",
    minWidth: "190px",
    onToggle: (expanded) => {
      if (expanded) draw(true);
    },
  });

  const subtitle = document.createElement("div");
  subtitle.innerText = "Select a popup in Pane C";
  subtitle.style.fontSize = "11px";
  subtitle.style.color = "#9aa4c3";
  subtitle.style.minHeight = "28px";
  subtitle.style.lineHeight = "1.3";
  body.appendChild(subtitle);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(SVG_WIDTH));
  svg.setAttribute("height", String(SVG_HEIGHT));
  svg.setAttribute("viewBox", `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`);
  svg.style.width = `${SVG_WIDTH}px`;
  svg.style.height = `${SVG_HEIGHT}px`;
  svg.style.alignSelf = "center";
  svg.style.borderRadius = "8px";
  svg.style.background = "rgba(255,255,255,0.9)";
  body.appendChild(svg);

  const legend = document.createElement("div");
  legend.innerText = "V3 mean: red  range: blue  edges: purple";
  legend.style.fontSize = "11px";
  legend.style.color = "#9aa4c3";
  body.appendChild(legend);

  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.innerText = "Export SVG";
  exportBtn.style.alignSelf = "flex-start";
  exportBtn.style.padding = "5px 10px";
  exportBtn.style.fontSize = "11px";
  exportBtn.style.borderRadius = "7px";
  exportBtn.style.border = "1px solid rgba(255,255,255,0.18)";
  exportBtn.style.background = "rgba(16,24,40,0.9)";
  exportBtn.style.color = "#f5f6ff";
  exportBtn.style.cursor = "pointer";
  body.appendChild(exportBtn);

  dock.insertBefore(root, dock.firstChild?.nextSibling || null);

  let latestSvg = buildEmptySvg("Select a popup in Pane C");
  let lastRenderKey = "";

  function resolveSelection() {
    const active = getActiveSelection?.();
    if (!active || !Number.isFinite(active.id)) return null;
    const motion = active.kind === "skeleton" ? getSkeletalMotion?.() : getPldMotion?.();
    const list = active.kind === "skeleton" ? motion?.BoneInfo : motion?.pldInfo;
    const info = list?.find?.((item) => item.id === active.id);
    return info ? { active, motion, info } : null;
  }

  function selectTrack(info, key) {
    const current = info?.New?.[key];
    if (Array.isArray(current) && current.length) return current;
    const original = info?.Ori?.[key];
    return Array.isArray(original) ? original : [];
  }

  function getFrameIndex(info, motion, frameCount) {
    if (frameCount <= 1) return 0;
    const duration = Number(motion?.currentClip?.duration) || 0;
    const rawTime = Number(motion?.mixer?.time) || 0;
    const time = duration > 0 ? ((rawTime % duration) + duration) % duration : 0;
    const sampleFrequency = Number(info?.sample_freq);
    if (sampleFrequency > 0) return Math.floor(time * sampleFrequency) % frameCount;
    if (duration <= 0) return 0;
    return Math.min(frameCount - 1, Math.floor(time / duration * frameCount));
  }

  function buildSnapshot() {
    const selected = resolveSelection();
    if (!selected) return null;
    const { active, motion, info } = selected;
    const angleTrack = selectTrack(info, "MPAngle");
    const proLenTrack = selectTrack(info, "MPProLen");
    const v3Track = selectTrack(info, "V3Loc");
    const frameCount = Math.min(angleTrack.length, proLenTrack.length, v3Track.length);
    if (frameCount < 1) return { active, info, emptyMessage: "No MP/V3 data" };

    const frameIdx = getFrameIndex(info, motion, frameCount);
    const angle = finite(angleTrack[frameIdx]);
    const mpLength = Math.max(0, finite(proLenTrack[frameIdx]));
    const v3 = finite(v3Track[frameIdx]);
    const x = Math.cos(angle) * mpLength;
    const y = Math.sin(angle) * mpLength;
    let maxLength = 1e-6;
    let v3Sum = 0;
    let v3Min = Infinity;
    let v3Max = -Infinity;
    for (let index = 0; index < frameCount; index++) {
      const p = Math.max(0, finite(proLenTrack[index]));
      const v3Value = finite(v3Track[index]);
      v3Sum += v3Value;
      v3Min = Math.min(v3Min, v3Value);
      v3Max = Math.max(v3Max, v3Value);
      maxLength = Math.max(maxLength, Math.hypot(p, v3Value));
    }
    const originalPro = Array.isArray(info?.Ori?.MPProLen) ? info.Ori.MPProLen : [];
    const originalV3 = Array.isArray(info?.Ori?.V3Loc) ? info.Ori.V3Loc : [];
    for (let index = 0; index < Math.min(originalPro.length, originalV3.length); index++) {
      maxLength = Math.max(maxLength, Math.hypot(finite(originalPro[index]), finite(originalV3[index])));
    }

    return {
      active,
      info,
      displayName: info?.name || (active.kind === "pld" ? `PLD ${active.id}` : `Bone ${active.id}`),
      frameIdx,
      frameCount,
      x,
      y,
      z: v3,
      v3Mean: v3Sum / frameCount,
      v3Min,
      v3Max,
      mpLength,
      maxLength,
    };
  }

  function project(x, y, z, scale) {
    return {
      x: SVG_WIDTH / 2 + (x * 0.78 - y * 0.58) * scale,
      y: 146 + (x * 0.22 + y * 0.32 - z * 0.9) * scale,
    };
  }

  function buildSvg(snapshot) {
    if (!snapshot || snapshot.emptyMessage) return buildEmptySvg(snapshot?.emptyMessage || "Select a popup in Pane C");
    const scale = 68 / snapshot.maxLength;
    const planeRadius = snapshot.maxLength * 0.82;
    const origin = project(0, 0, 0, scale);
    const endpoint = project(snapshot.x, snapshot.y, snapshot.z, scale);
    const v3Projection = project(0, 0, snapshot.z, scale);
    const planeCircle = Array.from({ length: 72 }, (_, index) => {
      const angle = index / 72 * Math.PI * 2;
      return project(Math.cos(angle) * planeRadius, Math.sin(angle) * planeRadius, 0, scale);
    });
    const v1Start = project(-planeRadius, 0, 0, scale);
    const v1End = project(planeRadius, 0, 0, scale);
    const v2Start = project(0, -planeRadius, 0, scale);
    const v2End = project(0, planeRadius, 0, scale);
    const v3Bottom = project(0, 0, -snapshot.maxLength * 0.72, scale);
    const v3Top = project(0, 0, snapshot.maxLength * 1.08, scale);
    const v3MeanPoint = project(0, 0, snapshot.v3Mean, scale);
    const v3MinPoint = project(0, 0, snapshot.v3Min, scale);
    const v3MaxPoint = project(0, 0, snapshot.v3Max, scale);

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">`,
      `<defs><linearGradient id="v3-plane" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dff6ff" stop-opacity="0.88"/><stop offset="1" stop-color="#75c7ea" stop-opacity="0.42"/></linearGradient></defs>`,
      `<rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#ffffff" fill-opacity="0.9"/>`,
      `<polygon points="${points(planeCircle)}" fill="url(#v3-plane)" stroke="#5eb6dd" stroke-width="1.5"/>`,
      line(v1Start, v1End, "#d95757", 1.4, 0.82),
      line(v2Start, v2End, "#36a66b", 1.4, 0.82),
      `<line x1="${n(v3MinPoint.x)}" y1="${n(v3MinPoint.y)}" x2="${n(v3MaxPoint.x)}" y2="${n(v3MaxPoint.y)}" stroke="#4493e2" stroke-width="6" stroke-linecap="round" opacity="0.72"/>`,
      `<path d="M ${n(v3Bottom.x)} ${n(v3Bottom.y)} L ${n(v3Top.x)} ${n(v3Top.y)}" fill="none" stroke="#4090ff" stroke-width="2" stroke-linecap="round"/>`,
      `<polygon points="${n(v3Top.x)},${n(v3Top.y)} ${n(v3Top.x - 4.2)},${n(v3Top.y + 8)} ${n(v3Top.x + 4.2)},${n(v3Top.y + 8)}" fill="#4090ff"/>`,
      `<circle cx="${n(v3MinPoint.x)}" cy="${n(v3MinPoint.y)}" r="3.6" fill="#a95dff" stroke="#ffffff" stroke-width="0.8"/>`,
      `<circle cx="${n(v3MaxPoint.x)}" cy="${n(v3MaxPoint.y)}" r="3.6" fill="#a95dff" stroke="#ffffff" stroke-width="0.8"/>`,
      `<circle cx="${n(v3MeanPoint.x)}" cy="${n(v3MeanPoint.y)}" r="4.2" fill="#b32020" stroke="#ffffff" stroke-width="1"/>`,
      `<text x="${n(v3Top.x + 7)}" y="${n(v3Top.y + 3)}" fill="#2873d9" font-size="11" font-family="Segoe UI, sans-serif">V3</text>`,
      `<line x1="${n(endpoint.x)}" y1="${n(endpoint.y)}" x2="${n(v3Projection.x)}" y2="${n(v3Projection.y)}" stroke="#151922" stroke-width="1.2" stroke-dasharray="4 3" opacity="0.78"/>`,
      `<line x1="${n(origin.x)}" y1="${n(origin.y)}" x2="${n(endpoint.x)}" y2="${n(endpoint.y)}" stroke="#151922" stroke-width="2.8" stroke-linecap="round"/>`,
      `<circle cx="${n(endpoint.x)}" cy="${n(endpoint.y)}" r="5.5" fill="#2f6fe4" stroke="#d8ebff" stroke-width="1.2"/>`,
      `<text x="10" y="18" fill="#4e5b7d" font-size="10.5" font-family="Segoe UI, sans-serif">MP projection length = ${escapeXml(snapshot.mpLength.toFixed(3))}</text>`,
      `<text x="10" y="33" fill="#2873d9" font-size="10.5" font-family="Segoe UI, sans-serif">V3 = ${escapeXml(snapshot.z.toFixed(3))}</text>`,
      `</svg>`,
    ].join("");
  }

  function draw(force = false) {
    if (collapsible.isCollapsed() && !force) return;
    const snapshot = buildSnapshot();
    const renderKey = snapshot && !snapshot.emptyMessage
      ? `${snapshot.active.kind}:${snapshot.active.id}:${snapshot.frameIdx}:${n(snapshot.x)}:${n(snapshot.y)}:${n(snapshot.z)}:${n(snapshot.maxLength)}:${n(snapshot.v3Mean)}:${n(snapshot.v3Min)}:${n(snapshot.v3Max)}`
      : `empty:${snapshot?.emptyMessage || "selection"}`;
    if (!force && renderKey === lastRenderKey) return;
    lastRenderKey = renderKey;
    if (snapshot && !snapshot.emptyMessage) {
      subtitle.innerText = `${snapshot.displayName}\nframe ${snapshot.frameIdx + 1}/${snapshot.frameCount}`;
    } else {
      subtitle.innerText = snapshot?.emptyMessage || "Select a popup in Pane C";
    }
    latestSvg = buildSvg(snapshot);
    svg.innerHTML = extractSvgBody(latestSvg);
  }

  exportBtn.addEventListener("click", () => {
    const snapshot = buildSnapshot();
    latestSvg = buildSvg(snapshot);
    const filename = snapshot?.active
      ? `${snapshot.active.kind}_${snapshot.active.id}_v3_visual_frame_${(snapshot.frameIdx ?? 0) + 1}`
      : "v3_visual";
    downloadTextAsset(latestSvg, filename, "image/svg+xml;charset=utf-8", ".svg");
  });

  draw(true);
  return {
    element: root,
    update: draw,
    dispose() {
      root.remove();
    },
  };
}

function buildEmptySvg(message) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}"><rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#ffffff" fill-opacity="0.9"/><text x="${SVG_WIDTH / 2}" y="${SVG_HEIGHT / 2}" fill="#6f86ab" font-size="12" text-anchor="middle" dominant-baseline="middle" font-family="Segoe UI, sans-serif">${escapeXml(message)}</text></svg>`;
}

function line(a, b, color, width, opacity = 1) {
  return `<line x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`;
}

function points(items) {
  return items.map((point) => `${n(point.x)},${n(point.y)}`).join(" ");
}

function n(value) {
  return Number(finite(value).toFixed(3)).toString();
}

function finite(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function escapeXml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function extractSvgBody(markup) {
  return String(markup).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
}

function downloadTextAsset(text, filenameBase, mimeType, extension) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filenameBase}${extension}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}
