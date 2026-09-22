import { updatePlotPopupImage } from "./plotPopupSync";
import { buildNiceAxis, expandAxisToValues, formatNiceTick } from "./plotAxisUtils";

const RAD_TO_DEG = 180 / Math.PI;

export function plotSpectrum(FFTResult, widthOrOptions = 420, height = 240, popupRef = null) {
  const { width, height: resolvedHeight, popup, frequencyEstimate, scale } = resolveConfig(widthOrOptions, height, popupRef, 420, 240);
  const { currentFFTResult, originFFTResult, mpAmpParams } = normalizeSpectrumInput(FFTResult);
  const { f, amp } = currentFFTResult;
  const ampDisplay = Array.isArray(amp) ? amp.map(toDegrees) : [];
  const originAmpDisplay = Array.isArray(originFFTResult?.amp) ? originFFTResult.amp.map(toDegrees) : [];
  if (!ampDisplay || ampDisplay.length === 0) {
    const dataUrl = emptySvg(width, resolvedHeight);
    syncPopupImage(popup, "spectrum", dataUrl);
    return dataUrl;
  }

  const n = Math.floor(ampDisplay.length / 2);
  const fHalf = f.slice(0, n);
  const ampHalf = ampDisplay.slice(0, n);
  const originAmpHalf = originAmpDisplay.slice(0, n);

  const marginLeft = 66;
  const marginRight = 20;
  const marginTop = 24;
  const marginBottom = 64;

  const plotWidth = width - marginLeft - marginRight;
  const combinedAmplitudes = [...ampHalf, ...originAmpHalf];
  const baseYAxis = buildNiceAxis(scale && originAmpHalf.length > 0 ? originAmpHalf : combinedAmplitudes, 6, { includeZero: true });
  const yAxis = scale ? expandAxisToValues(baseYAxis, combinedAmplitudes, { includeZero: true }) : baseYAxis;
  const maxAmp = yAxis.max;
  const basePlotHeight = resolvedHeight - marginTop - marginBottom;
  const plotHeight = scale ? basePlotHeight * (yAxis.max / baseYAxis.max) : basePlotHeight;
  const canvasHeight = Math.ceil(marginTop + plotHeight + marginBottom);
  const plotLeft = marginLeft;
  const plotRight = width - marginRight;
  const plotTop = marginTop;
  const plotBottom = marginTop + plotHeight;

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${canvasHeight}" viewBox="0 0 ${width} ${canvasHeight}">`);
  parts.push(`<rect x="0" y="0" width="${width}" height="${canvasHeight}" fill="#ffffff"/>`);
  parts.push(`<rect x="0.5" y="0.5" width="${width - 1}" height="${canvasHeight - 1}" fill="none" stroke="rgba(0,0,0,0.08)"/>`);
  parts.push(`<defs><clipPath id="spectrum-plot-clip"><rect x="${plotLeft}" y="${plotTop}" width="${plotWidth}" height="${plotHeight}"/></clipPath></defs>`);

  const ySteps = yAxis.ticks.length - 1;
  for (let i = 0; i <= ySteps; i++) {
    const y = plotTop + (plotHeight / ySteps) * i;
    const val = yAxis.ticks[ySteps - i];
    parts.push(`<line x1="${plotLeft}" y1="${y}" x2="${plotRight}" y2="${y}" stroke="rgba(0,0,0,0.12)" stroke-width="1"/>`);
    parts.push(`<line x1="${plotLeft}" y1="${y}" x2="${plotLeft + 6}" y2="${y}" stroke="#2f3650" stroke-width="1"/>`);
    parts.push(`<text x="${plotLeft - 8}" y="${y + 4}" text-anchor="end" fill="#4e5b7d" font-size="11" font-family="Segoe UI, sans-serif">${escapeXml(formatNiceTick(val, yAxis.step))}</text>`);
  }

  const maxFrequency = fHalf[fHalf.length - 1] ?? 1;
  const maxXTicks = Math.max(3, Math.floor(plotWidth / 70));
  const xAxis = buildNiceAxis([0, maxFrequency], maxXTicks, { includeZero: true });
  for (const val of xAxis.ticks) {
    const x = plotLeft + (val / xAxis.max) * plotWidth;
    parts.push(`<line x1="${x}" y1="${plotTop}" x2="${x}" y2="${plotBottom}" stroke="rgba(0,0,0,0.12)" stroke-width="1"/>`);
    parts.push(`<line x1="${x}" y1="${plotBottom}" x2="${x}" y2="${plotBottom - 6}" stroke="#2f3650" stroke-width="1"/>`);
    parts.push(`<text x="${x}" y="${plotBottom + 18}" text-anchor="middle" fill="#4e5b7d" font-size="10" font-family="Segoe UI, sans-serif">${escapeXml(formatNiceTick(val, xAxis.step))}</text>`);
  }

  const barWidth = (plotWidth * maxFrequency / xAxis.max) / Math.max(fHalf.length, 1);
  parts.push(`<g clip-path="url(#spectrum-plot-clip)">`);
  if (originAmpHalf.length > 0) {
    for (let i = 0; i < fHalf.length; i++) {
      const x = plotLeft + i * barWidth;
      const barHeight = ((originAmpHalf[i] || 0) / maxAmp) * plotHeight;
      parts.push(`<rect x="${x}" y="${plotBottom - barHeight}" width="${barWidth * 0.9}" height="${barHeight}" fill="#2f6fe4" fill-opacity="0.25"/>`);
    }
  }
  for (let i = 0; i < fHalf.length; i++) {
    const x = plotLeft + i * barWidth;
    const barHeight = (ampHalf[i] / maxAmp) * plotHeight;
    parts.push(`<rect x="${x}" y="${plotBottom - barHeight}" width="${barWidth * 0.9}" height="${barHeight}" fill="#2f6fe4"/>`);
  }
  parts.push(`</g>`);

  const peakIndex = findPeakFrequencyIndex(ampHalf);
  const spectrumLabels = [];
  if (peakIndex >= 0 && Number.isFinite(fHalf[peakIndex])) {
    const peakFrequency = String(fHalf[peakIndex]);
    spectrumLabels.push(`Peak frequency: ${peakFrequency} Hz`);
  }
  const estimatedFundamental = Number(frequencyEstimate?.fundamentalHz);
  if (frequencyEstimate?.reliable === true && Number.isFinite(estimatedFundamental)) {
    spectrumLabels.push(`Estimated f0: ${String(estimatedFundamental)} Hz`);
  }
  if (spectrumLabels.length > 0) {
    const labelWidth = Math.max(
      142,
      ...spectrumLabels.map(label => label.length * 6.4 + 14)
    );
    const labelHeight = spectrumLabels.length * 17 + 8;
    const labelX = plotRight - labelWidth;
    const labelY = plotTop + 8;
    parts.push(`<rect x="${labelX}" y="${labelY}" width="${labelWidth}" height="${labelHeight}" rx="5" fill="rgba(255,255,255,0.9)" stroke="rgba(47,54,80,0.28)"/>`);
    spectrumLabels.forEach((label, index) => {
      parts.push(`<text x="${plotRight - 7}" y="${labelY + 16 + index * 17}" text-anchor="end" fill="#1f2740" font-size="11" font-family="Segoe UI, sans-serif">${escapeXml(label)}</text>`);
    });
  }

  const boundaryDefs = buildFilterBoundaryDefs(mpAmpParams);
  boundaryDefs.forEach(({ key, value, color }) => {
    const maxFreq = xAxis.max;
    if (!Number.isFinite(maxFreq) || maxFreq <= 0) return;
    if (!Number.isFinite(value) || value < 0 || value > maxFreq) return;
    const x = plotLeft + (value / maxFreq) * plotWidth;
    parts.push(`<line x1="${x}" y1="${plotTop}" x2="${x}" y2="${plotBottom}" stroke="${color}" stroke-width="1.4" stroke-dasharray="6 4" opacity="0.9"/>`);
    parts.push(`<text x="${x + 4}" y="${plotTop + 14}" text-anchor="start" fill="${color}" font-size="11" font-family="Segoe UI, sans-serif">${escapeXml(`${key}=${value.toFixed(2)}`)}</text>`);
  });

  parts.push(`<line x1="${plotLeft}" y1="${plotTop}" x2="${plotLeft}" y2="${plotBottom}" stroke="#2f3650" stroke-width="1"/>`);
  parts.push(`<line x1="${plotLeft}" y1="${plotBottom}" x2="${plotRight}" y2="${plotBottom}" stroke="#2f3650" stroke-width="1"/>`);

  parts.push(`<text x="${width / 2}" y="${canvasHeight - 14}" text-anchor="middle" fill="#1f2740" font-size="13" font-family="Segoe UI, sans-serif">Frequency (Hz)</text>`);
  parts.push(`<g transform="translate(18 ${canvasHeight / 2}) rotate(-90)"><text x="0" y="0" text-anchor="middle" dominant-baseline="middle" fill="#1f2740" font-size="13" font-family="Segoe UI, sans-serif">Amplitude (deg)</text></g>`);

  parts.push(`</svg>`);

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(parts.join(""))}`;
  syncPopupImage(popup, "spectrum", dataUrl);
  return dataUrl;
}

function findPeakFrequencyIndex(amplitudes) {
  if (!Array.isArray(amplitudes) || amplitudes.length < 2) return -1;
  let peakIndex = 1;
  for (let i = 2; i < amplitudes.length; i++) {
    if (amplitudes[i] > amplitudes[peakIndex]) peakIndex = i;
  }
  return peakIndex;
}

function toDegrees(value) {
  return (Number(value) || 0) * RAD_TO_DEG;
}

function normalizeSpectrumInput(input) {
  if (input?.currentFFTResult) {
    return {
      currentFFTResult: input.currentFFTResult,
      originFFTResult: input.originFFTResult || null,
      mpAmpParams: input.mpAmpParams || null,
    };
  }
  return {
    currentFFTResult: input,
    originFFTResult: null,
    mpAmpParams: null,
  };
}

function buildFilterBoundaryDefs(mpAmpParams) {
  const filterType = String(mpAmpParams?.filter_type || "").trim().toLowerCase();
  const f1 = Number(mpAmpParams?.f1);
  const f2 = Number(mpAmpParams?.f2);
  if (filterType === "lowpass" || filterType === "highpass") {
    return Number.isFinite(f1) ? [{ key: "f1", value: f1, color: "#d9364f" }] : [];
  }
  if (filterType === "bandpass" || filterType === "bandstop") {
    const defs = [];
    if (Number.isFinite(f1)) defs.push({ key: "f1", value: f1, color: "#d9364f" });
    if (Number.isFinite(f2)) defs.push({ key: "f2", value: f2, color: "#8b3fe0" });
    return defs;
  }
  return [];
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
      frequencyEstimate: widthOrOptions.frequencyEstimate || null,
      scale: widthOrOptions.scale !== false,
    };
  }
  return {
    width: Number(widthOrOptions) || defaultWidth,
    height: Number(height) || defaultHeight,
    popup: popupRef || null,
    frequencyEstimate: null,
    scale: true,
  };
}

function syncPopupImage(popup, imageType, dataUrl) {
  const kind = popup?.kind;
  const id = popup?.id;
  if (!kind || id === undefined || id === null) return;
  updatePlotPopupImage(kind, id, imageType, dataUrl);
}
