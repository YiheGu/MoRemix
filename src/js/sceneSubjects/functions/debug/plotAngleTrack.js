import { updatePlotPopupImage } from "./plotPopupSync";
import { buildNiceAxis, expandAxisToValues, formatNiceTick, getAdaptiveTimeMax } from "./plotAxisUtils";

const RAD_TO_DEG = 180 / Math.PI;

export function plotAngleTrack(angleTrack, newAngleTrack, widthOrOptions = 420, height = 230, popupRef = null) {
  const {
    width,
    height: resolvedHeight,
    popup,
    originTimes,
    newTimes,
    xMax,
    xLabel,
    scale,
  } = resolveConfig(widthOrOptions, height, popupRef, 420, 230);
  if ((!angleTrack || angleTrack.length === 0) && (!newAngleTrack || newAngleTrack.length === 0)) {
    const dataUrl = emptySvg(width, resolvedHeight);
    syncPopupImage(popup, "angle", dataUrl);
    return dataUrl;
  }

  const originData = Array.isArray(angleTrack) ? angleTrack.map(toDegrees) : [];
  const newData = Array.isArray(newAngleTrack) ? newAngleTrack.map(toDegrees) : [];
  const n = Math.max(originData.length, newData.length);
  const combinedData = [...originData, ...newData];
  const baseYAxis = buildNiceAxis(scale && originData.length > 0 ? originData : combinedData, 5);
  const yAxis = scale ? expandAxisToValues(baseYAxis, combinedData) : baseYAxis;
  const minVal = yAxis.min;
  const maxVal = yAxis.max;
  const valueRange = maxVal - minVal;

  const marginLeft = 64;
  const marginRight = 20;
  const marginTop = 28;
  const marginBottom = 60;

  const plotWidth = width - marginLeft - marginRight;
  const basePlotHeight = resolvedHeight - marginTop - marginBottom;
  const baseRange = baseYAxis.max - baseYAxis.min;
  const plotHeight = scale ? basePlotHeight * (valueRange / baseRange) : basePlotHeight;
  const canvasHeight = Math.ceil(marginTop + plotHeight + marginBottom);
  const plotLeft = marginLeft;
  const plotRight = width - marginRight;
  const plotTop = marginTop;
  const plotBottom = marginTop + plotHeight;

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${canvasHeight}" viewBox="0 0 ${width} ${canvasHeight}">`);
  parts.push(`<rect x="0" y="0" width="${width}" height="${canvasHeight}" fill="#ffffff"/>`);
  parts.push(`<rect x="0.5" y="0.5" width="${width - 1}" height="${canvasHeight - 1}" fill="none" stroke="rgba(0,0,0,0.08)"/>`);
  parts.push(`<defs><clipPath id="angle-plot-clip"><rect x="${plotLeft}" y="${plotTop}" width="${plotWidth}" height="${plotHeight}"/></clipPath></defs>`);

  const ySteps = yAxis.ticks.length - 1;
  for (let i = 0; i <= ySteps; i++) {
    const y = plotTop + (plotHeight / ySteps) * i;
    const val = yAxis.ticks[ySteps - i];
    parts.push(`<line x1="${plotLeft}" y1="${y}" x2="${plotRight}" y2="${y}" stroke="rgba(0,0,0,0.12)" stroke-width="1"/>`);
    parts.push(`<line x1="${plotLeft}" y1="${y}" x2="${plotLeft + 6}" y2="${y}" stroke="#2f3650" stroke-width="1"/>`);
    parts.push(`<text x="${plotLeft - 8}" y="${y + 4}" text-anchor="end" fill="#4e5b7d" font-size="11" font-family="Segoe UI, sans-serif">${escapeXml(formatNiceTick(val, yAxis.step))}</text>`);
  }

  const maxXTicks = Math.max(3, Math.floor(plotWidth / 70));
  const dataXMax = getAdaptiveTimeMax(originTimes, newTimes, xMax, n);
  const xAxis = buildNiceAxis([0, dataXMax], maxXTicks, {
    includeZero: true,
    preferInteger: false,
    stepMode: "nearest",
  });
  for (const val of xAxis.ticks) {
    const x = plotLeft + (val / xAxis.max) * plotWidth;
    parts.push(`<line x1="${x}" y1="${plotTop}" x2="${x}" y2="${plotBottom}" stroke="rgba(0,0,0,0.12)" stroke-width="1"/>`);
    parts.push(`<line x1="${x}" y1="${plotBottom}" x2="${x}" y2="${plotBottom - 6}" stroke="#2f3650" stroke-width="1"/>`);
    parts.push(`<text x="${x}" y="${plotBottom + 18}" text-anchor="middle" fill="#4e5b7d" font-size="11" font-family="Segoe UI, sans-serif">${formatNiceTick(val, xAxis.step)}</text>`);
  }

  appendMeanLine(parts, originData, "#2f6fe4", plotLeft, plotRight, plotTop, plotHeight, minVal, valueRange);
  appendMeanLine(parts, newData, "#d9364f", plotLeft, plotRight, plotTop, plotHeight, minVal, valueRange);

  const axisMax = xAxis.max;
  const newPath = buildPolyline(newData, newTimes, axisMax, plotLeft, plotTop, plotWidth, plotHeight, minVal, valueRange);
  const originPath = buildPolyline(originData, originTimes, axisMax, plotLeft, plotTop, plotWidth, plotHeight, minVal, valueRange);
  if (newPath) {
    parts.push(`<polyline points="${newPath}" fill="none" stroke="#d9364f" stroke-width="2" clip-path="url(#angle-plot-clip)"/>`);
  }
  if (originPath) {
    parts.push(`<polyline points="${originPath}" fill="none" stroke="#2f6fe4" stroke-width="2" clip-path="url(#angle-plot-clip)"/>`);
  }

  parts.push(`<line x1="${plotLeft}" y1="${plotTop}" x2="${plotLeft}" y2="${plotBottom}" stroke="#2f3650" stroke-width="1"/>`);
  parts.push(`<line x1="${plotLeft}" y1="${plotBottom}" x2="${plotRight}" y2="${plotBottom}" stroke="#2f3650" stroke-width="1"/>`);
  parts.push(`<text x="${width / 2}" y="${canvasHeight - 14}" text-anchor="middle" fill="#1f2740" font-size="13" font-family="Segoe UI, sans-serif">${escapeXml(xLabel)}</text>`);
  parts.push(`<g transform="translate(18 ${canvasHeight / 2}) rotate(-90)"><text x="0" y="0" text-anchor="middle" dominant-baseline="middle" fill="#1f2740" font-size="13" font-family="Segoe UI, sans-serif">Angle (deg)</text></g>`);

  const legendX = Math.max(plotLeft + 6, width - 160);
  const legendY = plotTop - 10;
  const legendSpacing = 80;
  parts.push(`<rect x="${legendX}" y="${legendY - 10}" width="15" height="10" fill="#2f6fe4"/>`);
  parts.push(`<text x="${legendX + 20}" y="${legendY}" fill="#1f2740" font-size="12" font-family="Segoe UI, sans-serif">original</text>`);
  parts.push(`<rect x="${legendX + legendSpacing}" y="${legendY - 10}" width="15" height="10" fill="#d9364f"/>`);
  parts.push(`<text x="${legendX + legendSpacing + 20}" y="${legendY}" fill="#1f2740" font-size="12" font-family="Segoe UI, sans-serif">new</text>`);

  parts.push(`</svg>`);

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(parts.join(""))}`;
  syncPopupImage(popup, "angle", dataUrl);
  return dataUrl;
}

function toDegrees(value) {
  return (Number(value) || 0) * RAD_TO_DEG;
}

function appendMeanLine(parts, data, strokeColor, plotLeft, plotRight, plotTop, plotHeight, minVal, valueRange) {
  if (!Array.isArray(data) || data.length === 0) return;
  const mean = data.reduce((sum, value) => sum + value, 0) / data.length;
  if (mean < minVal || mean > minVal + valueRange) return;
  const y = plotTop + (1 - (mean - minVal) / valueRange) * plotHeight;
  parts.push(`<line x1="${plotLeft}" y1="${y}" x2="${plotRight}" y2="${y}" stroke="${strokeColor}" stroke-width="1.2" stroke-dasharray="6 4" opacity="0.65"/>`);
  parts.push(`<text x="${plotRight - 2}" y="${y - 4}" text-anchor="end" fill="${strokeColor}" font-size="11" font-family="Segoe UI, sans-serif" opacity="0.9">${escapeXml(`mean=${mean.toFixed(2)}`)}</text>`);
}

function buildPolyline(data, times, axisMax, marginLeft, marginTop, plotWidth, plotHeight, minVal, valueRange) {
  if (!data || data.length === 0) return "";
  if (data.length === 1) {
    const x = marginLeft;
    const y = marginTop + (1 - (data[0] - minVal) / valueRange) * plotHeight;
    return `${x},${y}`;
  }
  const pts = [];
  for (let i = 0; i < data.length; i++) {
    const xValue = Array.isArray(times) && times.length === data.length ? times[i] : i;
    const x = marginLeft + (xValue / Math.max(1e-12, axisMax)) * plotWidth;
    const y = marginTop + (1 - (data[i] - minVal) / valueRange) * plotHeight;
    pts.push(`${x},${y}`);
  }
  return pts.join(" ");
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
      originTimes: Array.from(widthOrOptions.originTimes || []),
      newTimes: Array.from(widthOrOptions.newTimes || []),
      xMax: Number.isFinite(Number(widthOrOptions.xMax)) ? Number(widthOrOptions.xMax) : null,
      xLabel: String(widthOrOptions.xLabel || "Time (s)"),
      scale: widthOrOptions.scale !== false,
    };
  }
  return {
    width: Number(widthOrOptions) || defaultWidth,
    height: Number(height) || defaultHeight,
    popup: popupRef || null,
    originTimes: [],
    newTimes: [],
    xMax: null,
    xLabel: "Time (s)",
    scale: true,
  };
}

function syncPopupImage(popup, imageType, dataUrl) {
  const kind = popup?.kind;
  const id = popup?.id;
  if (!kind || id === undefined || id === null) return;
  updatePlotPopupImage(kind, id, imageType, dataUrl);
}
