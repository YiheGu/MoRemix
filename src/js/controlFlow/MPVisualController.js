import { createPaneDockPanel } from "./CollapsiblePanel";

export function createMPVisualController({
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

  const { root, body } = createPaneDockPanel({
    title: "MP Visual",
    initialCollapsed: true,
    width: "220px",
    minWidth: "190px",
  });

  const subtitle = document.createElement("div");
  subtitle.innerText = "Select a popup in Pane C";
  subtitle.style.fontSize = "11px";
  subtitle.style.color = "#9aa4c3";
  subtitle.style.minHeight = "15px";
  body.appendChild(subtitle);

  const canvas = document.createElement("canvas");
  canvas.width = 196;
  canvas.height = 196;
  canvas.style.width = "196px";
  canvas.style.height = "196px";
  canvas.style.alignSelf = "center";
  canvas.style.borderRadius = "8px";
  canvas.style.background = "rgba(255,255,255,0.82)";
  body.appendChild(canvas);

  const legend = document.createElement("div");
  legend.innerText = "mean: red  min/max: purple  trail: light blue  current: blue";
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

  dock.insertBefore(root, dock.firstChild);

  const ctx = canvas.getContext("2d");
  let lastSelectionKey = "";

  function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function getDisplayName(active, info) {
    return info?.name || (active?.kind === "pld" ? `PLD ${active.id}` : `Bone ${active?.id ?? ""}`);
  }

  function resolveSelectedInfo() {
    const active = getActiveSelection?.();
    if (!active || !Number.isFinite(active.id)) return null;
    if (active.kind === "skeleton") {
      return getSkeletalMotion?.()?.BoneInfo?.find?.((item) => item.id === active.id) || null;
    }
    if (active.kind === "pld") {
      return getPldMotion?.()?.pldInfo?.find?.((item) => item.id === active.id) || null;
    }
    return null;
  }

  function getCurrentFrameIndex(info, kind) {
    const motion = kind === "skeleton" ? getSkeletalMotion?.() : getPldMotion?.();
    const frameCount = Number(info?.nFrames) || info?.New?.MPAngle?.length || info?.Ori?.MPAngle?.length || 0;
    if (frameCount <= 1) return 0;
    const duration = Number(motion?.currentClip?.duration) || 0;
    if (duration <= 0) return 0;
    const t = Number(motion?.mixer?.time) || 0;
    const normalized = ((t % duration) + duration) % duration / duration;
    return Math.max(0, Math.min(frameCount - 1, Math.floor(normalized * frameCount)));
  }

  function normalizeAngle(angle) {
    const tau = Math.PI * 2;
    let value = Number(angle) || 0;
    value %= tau;
    if (value < 0) value += tau;
    return value;
  }

  function drawEmpty(message = "Select a popup in Pane C") {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#6f86ab";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
  }

  function drawRadius(centerX, centerY, radius, angle, color, lineWidth) {
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY - Math.sin(angle) * radius;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function buildSnapshot() {
    const active = getActiveSelection?.();
    const info = resolveSelectedInfo();
    if (!active || !info || !Number.isFinite(active.id)) return null;

    const angleTrack = Array.isArray(info?.New?.MPAngle) && info.New.MPAngle.length
      ? info.New.MPAngle
      : (Array.isArray(info?.Ori?.MPAngle) ? info.Ori.MPAngle : []);
    const proLenTrack = Array.isArray(info?.New?.MPProLen) && info.New.MPProLen.length
      ? info.New.MPProLen
      : (Array.isArray(info?.Ori?.MPProLen) ? info.Ori.MPProLen : []);
    const referenceProLenTrack = Array.isArray(info?.Ori?.MPProLen) && info.Ori.MPProLen.length
      ? info.Ori.MPProLen
      : proLenTrack;
    if (angleTrack.length < 1 || proLenTrack.length < 1) {
      return {
        active,
        info,
        emptyMessage: "No MP data",
      };
    }

    const meanAngle = angleTrack.reduce((sum, value) => sum + (Number(value) || 0), 0) / angleTrack.length;
    const minAngle = Math.min(...angleTrack.map((value) => Number(value) || 0));
    const maxAngle = Math.max(...angleTrack.map((value) => Number(value) || 0));
    const frameIdx = getCurrentFrameIndex(info, active.kind);
    const currentAngle = Number(angleTrack[frameIdx]) || 0;
    const currentLen = Number(proLenTrack[frameIdx]) || 0;
    const maxLen = Math.max(...referenceProLenTrack.map((value) => Number(value) || 0), 1e-6);

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.37;
    const dotRadius = radius * clamp01(currentLen / maxLen);
    const minAngleNorm = normalizeAngle(minAngle);
    const maxAngleNorm = normalizeAngle(maxAngle);
    let arcStart = minAngleNorm;
    let arcEnd = maxAngleNorm;
    if (arcEnd < arcStart) {
      arcEnd += Math.PI * 2;
    }
    const directSpan = arcEnd - arcStart;
    if (directSpan > Math.PI) {
      const temp = arcStart;
      arcStart = arcEnd;
      arcEnd = temp + Math.PI * 2;
    }

    const trailPoints = angleTrack.map((angle, idx) => {
      const len = radius * clamp01((Number(proLenTrack[idx]) || 0) / maxLen);
      const a = Number(angle) || 0;
      return {
        x: cx + Math.cos(a) * len,
        y: cy - Math.sin(a) * len,
      };
    });

    return {
      active,
      info,
      displayName: getDisplayName(active, info),
      frameIdx,
      cx,
      cy,
      radius,
      meanAngle: normalizeAngle(meanAngle),
      minAngleNorm,
      maxAngleNorm,
      arcStart,
      arcEnd,
      dotX: cx + Math.cos(currentAngle) * dotRadius,
      dotY: cy - Math.sin(currentAngle) * dotRadius,
      trailPoints,
    };
  }

  function arcPath(cx, cy, radius, startAngle, endAngle) {
    const startX = cx + Math.cos(startAngle) * radius;
    const startY = cy - Math.sin(startAngle) * radius;
    const endX = cx + Math.cos(endAngle) * radius;
    const endY = cy - Math.sin(endAngle) * radius;
    const sweep = endAngle - startAngle;
    const largeArcFlag = Math.abs(sweep) > Math.PI ? 1 : 0;
    return [
      `M ${formatSvgNumber(cx)} ${formatSvgNumber(cy)}`,
      `L ${formatSvgNumber(startX)} ${formatSvgNumber(startY)}`,
      `A ${formatSvgNumber(radius)} ${formatSvgNumber(radius)} 0 ${largeArcFlag} 0 ${formatSvgNumber(endX)} ${formatSvgNumber(endY)}`,
      "Z",
    ].join(" ");
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

  function escapeXml(text) {
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  function formatSvgNumber(value) {
    return Number(Number(value) || 0).toFixed(3).replace(/\.?0+$/, "");
  }

  function svgFillAttrs(color, opacity = 1) {
    return `fill="${color}" fill-opacity="${formatSvgNumber(opacity)}"`;
  }

  function svgStrokeAttrs(color, width, opacity = 1) {
    return `stroke="${color}" stroke-width="${formatSvgNumber(width)}" stroke-opacity="${formatSvgNumber(opacity)}"`;
  }

  function buildSvg(snapshot, message = "") {
    const w = canvas.width;
    const h = canvas.height;
    const bg = `<rect x="0" y="0" width="${w}" height="${h}" ${svgFillAttrs("#ffffff", 0.82)}/>`;
    if (!snapshot) {
      return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
        bg,
        `<text x="${w / 2}" y="${h / 2}" fill="#6f86ab" font-size="12" text-anchor="middle" dominant-baseline="middle">${escapeXml(message || "Select a popup in Pane C")}</text>`,
        "</svg>",
      ].join("");
    }

    const axisRadius = snapshot.radius;
    const meanX = snapshot.cx + Math.cos(snapshot.meanAngle) * axisRadius;
    const meanY = snapshot.cy - Math.sin(snapshot.meanAngle) * axisRadius;
    const minX = snapshot.cx + Math.cos(snapshot.minAngleNorm) * axisRadius;
    const minY = snapshot.cy - Math.sin(snapshot.minAngleNorm) * axisRadius;
    const maxX = snapshot.cx + Math.cos(snapshot.maxAngleNorm) * axisRadius;
    const maxY = snapshot.cy - Math.sin(snapshot.maxAngleNorm) * axisRadius;
    const trailPointsAttr = snapshot.trailPoints.map((point) => `${formatSvgNumber(point.x)},${formatSvgNumber(point.y)}`).join(" ");
    const sectorPath = arcPath(snapshot.cx, snapshot.cy, snapshot.radius, snapshot.arcStart, snapshot.arcEnd);

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
      bg,
      `<circle cx="${formatSvgNumber(snapshot.cx)}" cy="${formatSvgNumber(snapshot.cy)}" r="${formatSvgNumber(snapshot.radius)}" ${svgFillAttrs("#5dbbff", 0.28)}/>`,
      `<path d="${sectorPath}" ${svgFillAttrs("#4493e2", 0.42)}/>`,
      `<circle cx="${formatSvgNumber(snapshot.cx)}" cy="${formatSvgNumber(snapshot.cy)}" r="${formatSvgNumber(snapshot.radius)}" fill="none" ${svgStrokeAttrs("#8dd4ff", 2, 0.75)}/>`,
      `<line x1="${formatSvgNumber(snapshot.cx - snapshot.radius)}" y1="${formatSvgNumber(snapshot.cy)}" x2="${formatSvgNumber(snapshot.cx + snapshot.radius)}" y2="${formatSvgNumber(snapshot.cy)}" ${svgStrokeAttrs("#ff4040", 2.2)}/>`,
      `<line x1="${formatSvgNumber(snapshot.cx)}" y1="${formatSvgNumber(snapshot.cy - snapshot.radius)}" x2="${formatSvgNumber(snapshot.cx)}" y2="${formatSvgNumber(snapshot.cy + snapshot.radius)}" ${svgStrokeAttrs("#40ff40", 2.2)}/>`,
      trailPointsAttr ? `<polyline points="${trailPointsAttr}" fill="none" ${svgStrokeAttrs("#7ebef4", 1.8, 0.88)}/>` : "",
      `<line x1="${formatSvgNumber(snapshot.cx)}" y1="${formatSvgNumber(snapshot.cy)}" x2="${formatSvgNumber(meanX)}" y2="${formatSvgNumber(meanY)}" ${svgStrokeAttrs("#b32020", 2.4)}/>`,
      `<line x1="${formatSvgNumber(snapshot.cx)}" y1="${formatSvgNumber(snapshot.cy)}" x2="${formatSvgNumber(minX)}" y2="${formatSvgNumber(minY)}" ${svgStrokeAttrs("#a95dff", 2)}/>`,
      `<line x1="${formatSvgNumber(snapshot.cx)}" y1="${formatSvgNumber(snapshot.cy)}" x2="${formatSvgNumber(maxX)}" y2="${formatSvgNumber(maxY)}" ${svgStrokeAttrs("#a95dff", 2)}/>`,
      `<circle cx="${formatSvgNumber(snapshot.dotX)}" cy="${formatSvgNumber(snapshot.dotY)}" r="5.5" ${svgFillAttrs("#2f6fe4")} ${svgStrokeAttrs("#d8ebff", 1.2)}/>`,
      "</svg>",
    ].join("");
  }

  function draw() {
    if (!ctx) return;
    const snapshot = buildSnapshot();
    if (!snapshot?.active || !snapshot?.info || !Number.isFinite(snapshot.active.id)) {
      subtitle.innerText = "Select a popup in Pane C";
      lastSelectionKey = "";
      drawEmpty();
      return;
    }

    if (snapshot.emptyMessage) {
      subtitle.innerText = snapshot.displayName;
      drawEmpty(snapshot.emptyMessage);
      return;
    }

    const selectionKey = `${snapshot.active.kind}:${snapshot.active.id}`;
    if (selectionKey !== lastSelectionKey) {
      subtitle.innerText = snapshot.displayName;
      lastSelectionKey = selectionKey;
    }

    const { cx, cy, radius } = snapshot;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "rgba(93,187,255,0.28)";
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(68, 147, 226, 0.42)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, -snapshot.arcStart, -snapshot.arcEnd, true);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(141,212,255,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "#ff4040";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-radius, 0);
    ctx.lineTo(radius, 0);
    ctx.stroke();

    ctx.strokeStyle = "#40ff40";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.lineTo(0, radius);
    ctx.stroke();

    ctx.strokeStyle = "rgba(126, 190, 244, 0.88)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    snapshot.trailPoints.forEach((point, idx) => {
      const px = point.x - cx;
      const py = point.y - cy;
      if (idx < 1) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    });
    ctx.stroke();
    ctx.restore();

    drawRadius(cx, cy, radius, snapshot.meanAngle, "#b32020", 2.4);
    drawRadius(cx, cy, radius, snapshot.minAngleNorm, "#a95dff", 2);
    drawRadius(cx, cy, radius, snapshot.maxAngleNorm, "#a95dff", 2);

    ctx.fillStyle = "#2f6fe4";
    ctx.beginPath();
    ctx.arc(snapshot.dotX, snapshot.dotY, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d8ebff";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  exportBtn.addEventListener("click", () => {
    const prevText = exportBtn.innerText;
    exportBtn.disabled = true;
    exportBtn.innerText = "Exporting...";
    try {
      const snapshot = buildSnapshot();
      const filenameBase = snapshot?.active
        ? `${snapshot.active.kind}_${snapshot.active.id}_mp_visual_frame_${(snapshot.frameIdx ?? 0) + 1}`
        : "mp_visual";
      const svgMarkup = buildSvg(snapshot, snapshot?.emptyMessage || "Select a popup in Pane C");
      downloadTextAsset(svgMarkup, filenameBase, "image/svg+xml;charset=utf-8", ".svg");
      exportBtn.innerText = "Exported";
    } catch (error) {
      console.error("Failed to export MP visual as SVG:", error);
      exportBtn.innerText = "Export Failed";
    } finally {
      window.setTimeout(() => {
        exportBtn.disabled = false;
        exportBtn.innerText = prevText;
      }, 900);
    }
  });

  draw();

  return {
    element: root,
    update: draw,
    dispose() {
      root.remove();
    },
  };
}
