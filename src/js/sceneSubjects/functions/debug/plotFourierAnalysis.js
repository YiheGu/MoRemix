import { getIFFT } from "../getIFFT";
import { updatePlotPopupImage } from "./plotPopupSync";

const RAD_TO_DEG = 180 / Math.PI;
const COMPONENT_COLORS = ["#d4487f", "#8d4be0", "#5d5ac7", "#3d78c9"];
const BASE_WIDTH = 420;
const BASE_HEIGHT = 290;

export function plotFourierAnalysis(input, widthOrOptions = 420, height = 290, popupRef = null) {
  const { width, height: resolvedHeight, popup } = resolveConfig(widthOrOptions, height, popupRef, 420, 290);
  const {
    currentTimeTrack,
    originTimeTrack,
    currentFFTResult,
    originFFTResult,
  } = normalizeInput(input);

  const currentTime = toDegreesTrack(currentTimeTrack);
  const originTime = toDegreesTrack(originTimeTrack);
  const fftResult = currentFFTResult || originFFTResult;
  const currentAmp = toDegreesTrack(currentFFTResult?.amp);
  const originAmp = toDegreesTrack(originFFTResult?.amp);

  if ((!currentTime.length && !originTime.length) || !fftResult || !Array.isArray(fftResult.amp) || fftResult.amp.length === 0) {
    const dataUrl = emptySvg(width, resolvedHeight);
    syncPopupImage(popup, "fourier", dataUrl);
    return dataUrl;
  }

  const halfLength = Math.max(1, Math.floor(fftResult.amp.length / 2));
  const currentAmpHalf = currentAmp.slice(0, halfLength);
  const originAmpHalf = originAmp.slice(0, halfLength);
  const timeCombined = [...originTime, ...currentTime];
  const timeMin = Math.min(...timeCombined, 0);
  const timeMax = Math.max(...timeCombined, 0);
  const timeRange = timeMax - timeMin || 1;
  const ampMax = Math.max(...currentAmpHalf, ...originAmpHalf, 0) || 1;

  const sx = width / BASE_WIDTH;
  const sy = resolvedHeight / BASE_HEIGHT;
  const scalePoint = (x, y) => ({ x: x * sx, y: y * sy });

  const leftBL = scalePoint(34, 224);
  const leftBR = scalePoint(154, 264);
  const leftTL = scalePoint(34, 108);
  const rightBL = scalePoint(266, 232);
  const rightBR = scalePoint(404, 198);
  const rightTL = scalePoint(266, 106);

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${resolvedHeight}" viewBox="0 0 ${width} ${resolvedHeight}">`);
  parts.push(`<rect x="0" y="0" width="${width}" height="${resolvedHeight}" fill="#ffffff"/>`);
  parts.push(`<rect x="0.5" y="0.5" width="${width - 1}" height="${resolvedHeight - 1}" fill="none" stroke="rgba(0,0,0,0.08)"/>`);

  drawPlaneGrid(parts, leftBL, leftBR, leftTL, 6, 5, {
    fill: "#fbfbfd",
    stroke: "#6d727f",
    grid: "rgba(64,74,99,0.22)",
  });
  drawPlaneGrid(parts, rightBL, rightBR, rightTL, 8, 5, {
    fill: "#fbfbfd",
    stroke: "#6d727f",
    grid: "rgba(64,74,99,0.22)",
  });

  if (originTime.length) {
    drawPlaneTrace(parts, originTime, leftBL, leftBR, leftTL, timeMin, timeRange, {
      stroke: "#2f6fe4",
      opacity: 0.28,
      width: 1.7,
    });
  }
  if (currentTime.length) {
    drawPlaneTrace(parts, currentTime, leftBL, leftBR, leftTL, timeMin, timeRange, {
      stroke: "#e43d48",
      opacity: 0.96,
      width: 2.1,
    });
  }

  if (originAmpHalf.length) {
    drawPlaneBars(parts, originAmpHalf, rightBL, rightBR, rightTL, ampMax, {
      fill: "#2f6fe4",
      opacity: 0.22,
    });
  }
  drawPlaneBars(parts, currentAmpHalf, rightBL, rightBR, rightTL, ampMax, {
    fill: "#14a1e6",
    opacity: 0.96,
  });

  const topComponents = getTopComponents(fftResult, 4);
  topComponents.forEach((component, index) => {
    const start = scalePoint(178, 184 - index * 28);
    const end = scalePoint(256, 168 - index * 30);
    drawFloatingComponent(parts, component, start, end, COMPONENT_COLORS[index % COMPONENT_COLORS.length], scalePoint);
  });

  drawAxisArrow(parts, scalePoint(62, 250), scalePoint(130, 282), "time");
  drawAxisArrow(parts, scalePoint(312, 262), scalePoint(382, 242), "frequency");
  parts.push(`<text x="${scalePoint(212, 42).x}" y="${scalePoint(212, 42).y}" text-anchor="middle" fill="#3d4360" font-size="${12 * sy}" font-family="Segoe UI, sans-serif">sinusoidal components</text>`);

  parts.push(`</svg>`);

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(parts.join(""))}`;
  syncPopupImage(popup, "fourier", dataUrl);
  return dataUrl;
}

function drawPlaneGrid(parts, bottomLeft, bottomRight, topLeft, xSteps, ySteps, style) {
  const topRight = addPoints(bottomRight, subtractPoints(topLeft, bottomLeft));
  parts.push(`<polygon points="${polygonPoints([bottomLeft, bottomRight, topRight, topLeft])}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="1.1"/>`);

  for (let i = 1; i < xSteps; i++) {
    const u = i / xSteps;
    const start = planePoint(bottomLeft, bottomRight, topLeft, u, 0);
    const end = planePoint(bottomLeft, bottomRight, topLeft, u, 1);
    parts.push(`<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${style.grid}" stroke-width="0.9"/>`);
  }
  for (let i = 1; i < ySteps; i++) {
    const v = i / ySteps;
    const start = planePoint(bottomLeft, bottomRight, topLeft, 0, v);
    const end = planePoint(bottomLeft, bottomRight, topLeft, 1, v);
    parts.push(`<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${style.grid}" stroke-width="0.9"/>`);
  }
}

function drawPlaneTrace(parts, data, bottomLeft, bottomRight, topLeft, minVal, range, style) {
  if (!Array.isArray(data) || data.length === 0) return;
  const points = [];
  const denom = Math.max(1, data.length - 1);
  for (let i = 0; i < data.length; i++) {
    const u = i / denom;
    const normalized = clamp01((toFiniteNumber(data[i]) - minVal) / range);
    const point = planePoint(bottomLeft, bottomRight, topLeft, u, normalized);
    points.push(`${point.x},${point.y}`);
  }
  parts.push(`<polyline points="${points.join(" ")}" fill="none" stroke="${style.stroke}" stroke-width="${style.width}" opacity="${style.opacity}"/>`);
}

function drawPlaneBars(parts, ampData, bottomLeft, bottomRight, topLeft, maxAmp, style) {
  if (!Array.isArray(ampData) || ampData.length === 0) return;
  for (let i = 0; i < ampData.length; i++) {
    const u0 = i / ampData.length;
    const u1 = (i + 0.84) / ampData.length;
    const normalized = clamp01((toFiniteNumber(ampData[i]) || 0) / maxAmp);
    if (normalized <= 0) continue;

    const p1 = planePoint(bottomLeft, bottomRight, topLeft, u0, 0);
    const p2 = planePoint(bottomLeft, bottomRight, topLeft, u1, 0);
    const p3 = planePoint(bottomLeft, bottomRight, topLeft, u1, normalized);
    const p4 = planePoint(bottomLeft, bottomRight, topLeft, u0, normalized);
    parts.push(`<polygon points="${polygonPoints([p1, p2, p3, p4])}" fill="${style.fill}" fill-opacity="${style.opacity}"/>`);
  }
}

function drawFloatingComponent(parts, component, start, end, color, scalePoint) {
  const samples = resampleTrack(component.track, 96);
  const maxAbs = Math.max(...samples.map((value) => Math.abs(value)), 0) || 1;
  const direction = subtractPoints(end, start);
  const length = Math.hypot(direction.x, direction.y) || 1;
  const tangent = { x: direction.x / length, y: direction.y / length };
  const normal = { x: -tangent.y, y: tangent.x };
  const amplitudePx = Math.max(scalePoint(0, 10).y, 8);
  const points = [];

  for (let i = 0; i < samples.length; i++) {
    const t = i / Math.max(1, samples.length - 1);
    const base = lerpPoint(start, end, t);
    const offset = (samples[i] / maxAbs) * amplitudePx;
    points.push(`${base.x + normal.x * offset},${base.y + normal.y * offset}`);
  }

  parts.push(`<polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="1.8" opacity="0.96"/>`);
  parts.push(`<text x="${end.x + scalePoint(6, 0).x}" y="${end.y + scalePoint(0, 4).y}" text-anchor="start" fill="${color}" font-size="${11 * (scalePoint(0, 1).y || 1)}" font-family="Segoe UI, sans-serif">${escapeXml(`${component.freq.toFixed(2)} Hz`)}</text>`);
}

function drawAxisArrow(parts, start, end, label) {
  const direction = subtractPoints(end, start);
  const length = Math.hypot(direction.x, direction.y) || 1;
  const tangent = { x: direction.x / length, y: direction.y / length };
  const normal = { x: -tangent.y, y: tangent.x };
  const arrowSize = 6;
  const arrowP1 = {
    x: end.x - tangent.x * arrowSize + normal.x * arrowSize * 0.6,
    y: end.y - tangent.y * arrowSize + normal.y * arrowSize * 0.6,
  };
  const arrowP2 = {
    x: end.x - tangent.x * arrowSize - normal.x * arrowSize * 0.6,
    y: end.y - tangent.y * arrowSize - normal.y * arrowSize * 0.6,
  };
  parts.push(`<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#4a4f5d" stroke-width="1.5"/>`);
  parts.push(`<polygon points="${polygonPoints([end, arrowP1, arrowP2])}" fill="#4a4f5d"/>`);
  parts.push(`<text x="${end.x + 6}" y="${end.y + 4}" text-anchor="start" fill="#3d4360" font-size="12" font-family="Segoe UI, sans-serif">${escapeXml(label)}</text>`);
}

function getTopComponents(fftResult, maxComponents) {
  const half = Math.floor((fftResult?.Y?.length || 0) / 2);
  const candidates = [];
  for (let k = 1; k < half; k++) {
    const amplitude = Number(fftResult?.amp?.[k]) || 0;
    if (amplitude <= 0) continue;
    candidates.push({
      index: k,
      amplitude,
      freq: Math.abs(Number(fftResult?.f?.[k]) || 0),
      track: toDegreesTrack(getComponentTrack(fftResult, k)),
    });
  }
  candidates.sort((a, b) => b.amplitude - a.amplitude);
  return candidates.slice(0, maxComponents);
}

function getComponentTrack(fftResult, index) {
  const Y = Array.isArray(fftResult?.Y) ? fftResult.Y : [];
  const isolated = Y.map(() => [0, 0]);
  if (!Y[index]) return [];
  isolated[index] = [...Y[index]];
  const mirroredIndex = (Y.length - index) % Y.length;
  if (mirroredIndex !== index && Y[mirroredIndex]) {
    isolated[mirroredIndex] = [...Y[mirroredIndex]];
  }
  return getIFFT(isolated, fftResult?.oriTrackLength || Y.length);
}

function normalizeInput(input) {
  if (input?.currentFFTResult || input?.originFFTResult || input?.currentTimeTrack || input?.originTimeTrack) {
    return {
      currentTimeTrack: Array.isArray(input.currentTimeTrack) ? input.currentTimeTrack : [],
      originTimeTrack: Array.isArray(input.originTimeTrack) ? input.originTimeTrack : [],
      currentFFTResult: input.currentFFTResult || null,
      originFFTResult: input.originFFTResult || null,
    };
  }
  return {
    currentTimeTrack: Array.isArray(input) ? input : [],
    originTimeTrack: [],
    currentFFTResult: null,
    originFFTResult: null,
  };
}

function planePoint(bottomLeft, bottomRight, topLeft, u, v) {
  return {
    x: bottomLeft.x + (bottomRight.x - bottomLeft.x) * u + (topLeft.x - bottomLeft.x) * v,
    y: bottomLeft.y + (bottomRight.y - bottomLeft.y) * u + (topLeft.y - bottomLeft.y) * v,
  };
}

function polygonPoints(points) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function addPoints(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subtractPoints(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function lerpPoint(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function resampleTrack(track, targetLength) {
  if (!Array.isArray(track) || track.length === 0) return Array(targetLength).fill(0);
  if (track.length === 1) return Array(targetLength).fill(toFiniteNumber(track[0]));
  const samples = [];
  for (let i = 0; i < targetLength; i++) {
    const pos = (i / Math.max(1, targetLength - 1)) * (track.length - 1);
    const left = Math.floor(pos);
    const right = Math.min(track.length - 1, left + 1);
    const t = pos - left;
    const value = toFiniteNumber(track[left]) * (1 - t) + toFiniteNumber(track[right]) * t;
    samples.push(value);
  }
  return samples;
}

function toDegreesTrack(track) {
  return Array.isArray(track) ? track.map((value) => toFiniteNumber(value) * RAD_TO_DEG) : [];
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function emptySvg(width, height) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>
    <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="rgba(0,0,0,0.08)"/>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function resolveConfig(widthOrOptions, height, popupRef, defaultWidth, defaultHeight) {
  if (widthOrOptions && typeof widthOrOptions === "object") {
    return {
      width: Number(widthOrOptions.width) || defaultWidth,
      height: Number(widthOrOptions.height) || defaultHeight,
      popup: widthOrOptions.popup || null,
    };
  }
  return {
    width: Number(widthOrOptions) || defaultWidth,
    height: Number(height) || defaultHeight,
    popup: popupRef || null,
  };
}

function syncPopupImage(popup, imageType, dataUrl) {
  const kind = popup?.kind;
  const id = popup?.id;
  if (!kind || id === undefined || id === null) return;
  updatePlotPopupImage(kind, id, imageType, dataUrl);
}
