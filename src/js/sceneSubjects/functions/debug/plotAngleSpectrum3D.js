import { getIFFT } from "../getIFFT";
import { updatePlotPopupImage } from "./plotPopupSync";

const RAD = 180 / Math.PI;
const DEG = Math.PI / 180;

export function plotAngleSpectrum3D(input, widthOrOptions = 420, height = 320, popupRef = null) {
  const { width, height: h, popup, scale } = resolveConfig(widthOrOptions, height, popupRef, 420, 320);
  const cfg = normalizeInput(input);
  const fftNew = stripDcFromFftResult(cfg.currentFFTResult || cfg.originFFTResult);
  const fftOri = stripDcFromFftResult(cfg.originFFTResult || fftNew);
  const angleNew = toDegTrack(subtractMeanTrack(cfg.currentAngleTrack));
  const angleOri = toDegTrack(subtractMeanTrack(cfg.originAngleTrack));

  if ((!angleNew.length && !angleOri.length) || !fftNew || !Array.isArray(fftNew.amp) || !fftNew.amp.length) {
    const dataUrl = emptySvg(width, h);
    syncPopupImage(popup, dataUrl);
    return dataUrl;
  }

  const half = Math.max(1, Math.floor((fftNew.amp?.length || 0) / 2));
  const freqs = (fftNew.f || []).slice(0, half).map((value) => Math.abs(num(value)));
  const specNew = toDegTrack(fftNew.amp).slice(0, half);
  const specOri = toDegTrack(fftOri.amp).slice(0, half);
  const frames = Math.max(angleNew.length, angleOri.length, fftNew.oriTrackLength || 0, 2);
  const xDen = Math.max(1, frames - 1);
  const maxFreq = Math.max(...freqs, 1);
  const components = buildComponents(fftNew, half, cfg.phaseShift);

  let originalMaxAbs = 1;
  [angleOri, specOri].forEach((arr) => arr.forEach((value) => {
    originalMaxAbs = Math.max(originalMaxAbs, Math.abs(num(value)));
  }));
  let combinedMaxAbs = originalMaxAbs;
  [angleNew, angleOri, specNew, specOri].forEach((arr) => arr.forEach((value) => {
    combinedMaxAbs = Math.max(combinedMaxAbs, Math.abs(num(value)));
  }));
  components.forEach((component) => component.track.forEach((value) => {
    combinedMaxAbs = Math.max(combinedMaxAbs, Math.abs(num(value)));
  }));
  const maxAbs = scale && (angleOri.length || specOri.length) ? originalMaxAbs : combinedMaxAbs;

  const projection = createProjection(cfg.azimuthDeg, cfg.elevationDeg);
  const rawPoints = [];
  const primitives = [];

  const planeXZ = [[0, 0, -1], [1, 0, -1], [1, 0, 1], [0, 0, 1]];
  const planeYZ = [[0, 0, -1], [0, 1, -1], [0, 1, 1], [0, 0, 1]];
  primitives.push({ type: "polygon", points: planeXZ, fill: "rgba(246,248,252,0.96)", stroke: "#687184", width: 1.1, preserveScale: true });
  primitives.push({ type: "polygon", points: planeYZ, fill: "rgba(246,248,252,0.96)", stroke: "#687184", width: 1.1, preserveScale: true });

  if (angleNew.length) {
    primitives.push({
      type: "polyline",
      points: angleNew.map((value, index) => [index / xDen, 0, num(value) / maxAbs]),
      stroke: "#d9364f",
      width: 2.2,
      opacity: 0.5,
    });
  }
  if (angleOri.length) {
    primitives.push({
      type: "polyline",
      points: angleOri.map((value, index) => [index / xDen, 0, num(value) / maxAbs]),
      stroke: "#2f6fe4",
      width: 1.95,
      opacity: 0.42,
      preserveScale: true,
    });
  }

  specOri.forEach((amp, index) => {
    const y = Math.max(0, num(freqs[index])) / maxFreq;
    primitives.push({
      type: "line",
      points: [[0, y, 0], [0, y, num(amp) / maxAbs]],
      stroke: "#2f6fe4",
      width: 2.5,
      opacity: 0.18,
      preserveScale: true,
    });
  });
  specNew.forEach((amp, index) => {
    const y = Math.max(0, num(freqs[index])) / maxFreq;
    primitives.push({
      type: "line",
      points: [[0, y, 0], [0, y, num(amp) / maxAbs]],
      stroke: "#13a4d8",
      width: 2.7,
      opacity: 0.95,
    });
  });

  const maxCompAmp = Math.max(...components.map((component) => component.amp), 0) || 1;
  components.forEach((component) => {
    const sampleCount = Math.min(Math.max(component.track.length, 40), 80);
    const samples = resample(component.track, sampleCount);
    const y = component.freq / maxFreq;
    primitives.push({
      type: "polyline",
      points: samples.map((value, index) => [sampleCount > 1 ? index / (sampleCount - 1) : 0, y, num(value) / maxAbs]),
      stroke: component.color,
      width: component.index === 0 ? 2.15 : 1.7,
      opacity: 0.5 + 0.42 * Math.sqrt(component.amp / maxCompAmp),
    });
  });

  const axes = {
    origin: [0, 0, 0],
    x: [1, 0, 0],
    y: [0, 1, 0],
    z: [0, 0, 1],
    zn: [0, 0, -0.35],
  };
  rawPoints.push(...planeXZ, ...planeYZ, ...Object.values(axes));
  primitives.forEach((primitive) => rawPoints.push(...primitive.points));

  const basePoints = [...planeXZ, ...planeYZ, ...Object.values(axes)];
  primitives.filter((primitive) => primitive.preserveScale).forEach((primitive) => basePoints.push(...primitive.points));
  const baseFitted = fitProjection(basePoints, projection, width, h, 28);
  const fitted = scale
    ? fitProjectionAtScale(rawPoints, projection, baseFitted.scale, width, h, 28)
    : fitProjection(rawPoints, projection, width, h, 28);
  const renderWidth = fitted.width || width;
  const renderHeight = fitted.height || h;
  const P = (point) => toScreen(projection(point), fitted, renderHeight);
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${renderWidth}" height="${renderHeight}" viewBox="0 0 ${renderWidth} ${renderHeight}">`,
    `<rect x="0" y="0" width="${renderWidth}" height="${renderHeight}" fill="#ffffff"/>`,
    `<rect x="0.5" y="0.5" width="${renderWidth - 1}" height="${renderHeight - 1}" fill="none" stroke="rgba(0,0,0,0.08)"/>`,
  ];

  primitives.slice(0, 2).forEach((primitive) => {
    parts.push(`<polygon points="${pts2(primitive.points, P)}" fill="${primitive.fill}" stroke="${primitive.stroke}" stroke-width="${primitive.width}"/>`);
  });
  primitives.slice(2).forEach((primitive) => {
    if (primitive.type === "line") {
      const [a, b] = primitive.points.map(P);
      parts.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${primitive.stroke}" stroke-width="${primitive.width}" opacity="${primitive.opacity}" stroke-linecap="round"/>`);
      return;
    }
    parts.push(`<polyline points="${pts2(primitive.points, P)}" fill="none" stroke="${primitive.stroke}" stroke-width="${primitive.width}" opacity="${primitive.opacity}" stroke-linecap="round"/>`);
  });

  drawAxis(parts, P, axes.origin, axes.zn, axes.z);
  drawAxis(parts, P, axes.origin, null, axes.x);
  drawAxis(parts, P, axes.origin, null, axes.y);
  drawLabels(parts, P, axes, renderWidth, renderHeight);

  parts.push(`</svg>`);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(parts.join(""))}`;
  syncPopupImage(popup, dataUrl);
  return dataUrl;
}

function createProjection(azimuthDeg, elevationDeg) {
  const az = num(azimuthDeg) * DEG;
  const el = Math.max(8, Math.min(82, num(elevationDeg))) * DEG;
  const bx = [-Math.cos(az), -Math.sin(az) * Math.sin(el)];
  const by = [Math.sin(az), -Math.cos(az) * Math.sin(el)];
  const bz = [0, Math.cos(el)];
  return (point) => ({
    x: point[0] * bx[0] + point[1] * by[0] + point[2] * bz[0],
    y: point[0] * bx[1] + point[1] * by[1] + point[2] * bz[1],
  });
}

function fitProjection(points, project, width, height, margin) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  points.forEach((point) => {
    const p = project(point);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  });
  const safeWidth = Math.max(1e-6, maxX - minX);
  const safeHeight = Math.max(1e-6, maxY - minY);
  const scale = Math.min((width - margin * 2) / safeWidth, (height - margin * 2) / safeHeight);
  return { minX, minY, scale, margin };
}

function fitProjectionAtScale(points, project, scale, minWidth, minHeight, margin) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  points.forEach((point) => {
    const p = project(point);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  });
  return {
    minX,
    minY,
    scale,
    margin,
    width: Math.max(minWidth, Math.ceil((maxX - minX) * scale + margin * 2)),
    height: Math.max(minHeight, Math.ceil((maxY - minY) * scale + margin * 2)),
  };
}

function toScreen(raw, fitted, height) {
  return {
    x: fitted.margin + (raw.x - fitted.minX) * fitted.scale,
    y: height - (fitted.margin + (raw.y - fitted.minY) * fitted.scale),
  };
}

function drawAxis(parts, P, originPoint, negativePoint, endPoint) {
  if (negativePoint) {
    const a = P(negativePoint);
    const b = P(endPoint);
    parts.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#2f3650" stroke-width="1.5"/>`);
  } else {
    const a = P(originPoint);
    const b = P(endPoint);
    parts.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#2f3650" stroke-width="1.5"/>`);
  }
  addArrow(parts, P(originPoint), P(endPoint));
}

function drawLabels(parts, P, axes, width, height) {
  const X = P(axes.x);
  const Y = P(axes.y);
  const Z = P(axes.z);
  parts.push(`<text x="${X.x - 4}" y="${X.y + 18}" text-anchor="end" fill="#1f2740" font-size="12" font-family="Segoe UI, sans-serif">frame</text>`);
  parts.push(`<text x="${Y.x + 6}" y="${Y.y + 14}" text-anchor="start" fill="#1f2740" font-size="12" font-family="Segoe UI, sans-serif">frequency (Hz)</text>`);
  parts.push(`<text x="${Z.x + 8}" y="${Z.y - 6}" text-anchor="start" fill="#1f2740" font-size="12" font-family="Segoe UI, sans-serif">deg</text>`);

  const lx = Math.max(20, width - 182);
  const ly = Math.max(22, height * 0.08);
  parts.push(`<rect x="${lx}" y="${ly - 10}" width="15" height="10" fill="#2f6fe4" fill-opacity="0.28"/>`);
  parts.push(`<text x="${lx + 20}" y="${ly}" fill="#1f2740" font-size="11.5" font-family="Segoe UI, sans-serif">original</text>`);
  parts.push(`<rect x="${lx + 72}" y="${ly - 10}" width="15" height="10" fill="#d9364f"/>`);
  parts.push(`<text x="${lx + 92}" y="${ly}" fill="#1f2740" font-size="11.5" font-family="Segoe UI, sans-serif">new angle</text>`);
  parts.push(`<line x1="${lx + 6}" y1="${ly + 16}" x2="${lx + 21}" y2="${ly + 16}" stroke="#13a4d8" stroke-width="2.7"/>`);
  parts.push(`<text x="${lx + 26}" y="${ly + 20}" fill="#1f2740" font-size="11.5" font-family="Segoe UI, sans-serif">new spectrum</text>`);
  parts.push(`<line x1="${lx + 6}" y1="${ly + 34}" x2="${lx + 21}" y2="${ly + 34}" stroke="#176ecb" stroke-width="2.4"/>`);
  parts.push(`<text x="${lx + 26}" y="${ly + 38}" fill="#1f2740" font-size="11.5" font-family="Segoe UI, sans-serif">sine components</text>`);
}

function addArrow(parts, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const size = 7;
  const p1 = { x: b.x - ux * size + nx * size * 0.55, y: b.y - uy * size + ny * size * 0.55 };
  const p2 = { x: b.x - ux * size - nx * size * 0.55, y: b.y - uy * size - ny * size * 0.55 };
  parts.push(`<polygon points="${`${b.x},${b.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`}" fill="#2f3650"/>`);
}

function buildComponents(fft, half, phaseShift) {
  const Y = Array.isArray(fft?.Y) ? fft.Y : [];
  const f = Array.isArray(fft?.f) ? fft.f : [];
  const amp = Array.isArray(fft?.amp) ? fft.amp : [];
  const components = [];

  for (let i = 0; i < half; i++) {
    if (!Y[i]) continue;
    const isolated = Y.map(() => [0, 0]);
    isolated[i] = [...Y[i]];
    const mirror = i === 0 ? 0 : (Y.length - i) % Y.length;
    if (mirror !== i && Y[mirror]) isolated[mirror] = [...Y[mirror]];
    components.push({
      index: i,
      freq: Math.abs(num(f[i])),
      amp: num(amp[i]),
      track: toDegTrack(shift(getIFFT(isolated, fft?.oriTrackLength || Y.length), phaseShift)),
      color: componentColor(i, half),
    });
  }

  return components;
}

function componentColor(index, count) {
  const ratio = count > 1 ? index / (count - 1) : 0;
  const hue = 206 + ratio * 8;
  const lightness = 40 - ratio * 12;
  return hslToHex(hue, 84, lightness);
}

function subtractMeanTrack(track) {
  if (!Array.isArray(track) || !track.length) return [];
  const values = track.map((value) => num(value));
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.map((value) => value - mean);
}

function stripDcFromFftResult(fft) {
  if (!fft) return null;
  const next = {
    ...fft,
    amp: Array.isArray(fft.amp) ? [...fft.amp] : [],
    Y: Array.isArray(fft.Y) ? fft.Y.map((pair) => Array.isArray(pair) ? [...pair] : [0, 0]) : [],
    f: Array.isArray(fft.f) ? [...fft.f] : [],
  };

  if (next.amp.length > 0) {
    next.amp[0] = 0;
  }
  if (next.Y.length > 0) {
    next.Y[0] = [0, 0];
  }
  return next;
}

function hslToHex(h, s, l) {
  const hue = ((Number(h) % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, Number(s))) / 100;
  const light = Math.max(0, Math.min(100, Number(l))) / 100;
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = light - chroma / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hue < 60) {
    r1 = chroma; g1 = x; b1 = 0;
  } else if (hue < 120) {
    r1 = x; g1 = chroma; b1 = 0;
  } else if (hue < 180) {
    r1 = 0; g1 = chroma; b1 = x;
  } else if (hue < 240) {
    r1 = 0; g1 = x; b1 = chroma;
  } else if (hue < 300) {
    r1 = x; g1 = 0; b1 = chroma;
  } else {
    r1 = chroma; g1 = 0; b1 = x;
  }

  const toHex = (value) => Math.round((value + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

function shift(series, phaseShift = 0) {
  if (!Array.isArray(series) || !series.length) return [];
  const n = series.length;
  const frames = ((Math.floor((Number(phaseShift) || 0) * n) % n) + n) % n;
  return frames ? series.slice(n - frames).concat(series.slice(0, n - frames)) : [...series];
}

function resample(track, count) {
  if (!Array.isArray(track) || !track.length) return Array(count).fill(0);
  if (track.length === 1) return Array(count).fill(num(track[0]));
  return Array.from({ length: count }, (_, index) => {
    const pos = (index / Math.max(1, count - 1)) * (track.length - 1);
    const left = Math.floor(pos);
    const right = Math.min(track.length - 1, left + 1);
    const t = pos - left;
    return num(track[left]) * (1 - t) + num(track[right]) * t;
  });
}

function pts2(points, projector) {
  return points.map((point) => {
    const p = projector(point);
    return `${p.x},${p.y}`;
  }).join(" ");
}

function toDegTrack(track) {
  return Array.isArray(track) ? track.map((value) => num(value) * RAD) : [];
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeInput(input) {
  const safeAzimuth = Number.isFinite(Number(input?.azimuthDeg)) ? Number(input.azimuthDeg) : 45;
  const safeElevation = Number.isFinite(Number(input?.elevationDeg)) ? Number(input.elevationDeg) : 28;
  if (input?.currentFFTResult || input?.originFFTResult || input?.currentAngleTrack || input?.originAngleTrack) {
    return {
      currentAngleTrack: Array.isArray(input.currentAngleTrack) ? input.currentAngleTrack : [],
      originAngleTrack: Array.isArray(input.originAngleTrack) ? input.originAngleTrack : [],
      currentFFTResult: input.currentFFTResult || null,
      originFFTResult: input.originFFTResult || null,
      phaseShift: Number(input.phaseShift) || 0,
      azimuthDeg: safeAzimuth,
      elevationDeg: safeElevation,
    };
  }
  return {
    currentAngleTrack: Array.isArray(input) ? input : [],
    originAngleTrack: [],
    currentFFTResult: null,
    originFFTResult: null,
    phaseShift: 0,
    azimuthDeg: safeAzimuth,
    elevationDeg: safeElevation,
  };
}

function emptySvg(width, height) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/><rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="rgba(0,0,0,0.08)"/></svg>`)}`;
}

function resolveConfig(widthOrOptions, height, popupRef, defaultWidth, defaultHeight) {
  if (widthOrOptions && typeof widthOrOptions === "object") {
    return {
      width: Number(widthOrOptions.width) || defaultWidth,
      height: Number(widthOrOptions.height) || defaultHeight,
      popup: widthOrOptions.popup || null,
      scale: widthOrOptions.scale !== false,
    };
  }
  return {
    width: Number(widthOrOptions) || defaultWidth,
    height: Number(height) || defaultHeight,
    popup: popupRef || null,
    scale: true,
  };
}

function syncPopupImage(popup, dataUrl) {
  const kind = popup?.kind;
  const id = popup?.id;
  if (!kind || id === undefined || id === null) return;
  updatePlotPopupImage(kind, id, "fourier", dataUrl);
}
