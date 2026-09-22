import { deepClone } from "../functions/deepClone";
import { registerPlotPopupUpdater } from "../functions/debug/plotPopupSync";
import { createGeneralPopupTargetSelector } from "./GeneralPopupTargetSelector";
import {
  MOTION_REFERENCE_MODE,
  normalizeMotionReferenceMode,
} from "../functions/motionReference";

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;
let floatingPopupZIndex = 9500;
const FLOATING_POPUP_MARGIN = 8;
const FLOATING_POPUP_MIN_WIDTH = 320;
const FLOATING_POPUP_MIN_HEIGHT = 160;

function escapeDataAttr(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function stylePreviewImage(img, styleOptions = {}) {
  img.style.borderRadius = "10px";
  img.style.border = "1px solid rgba(255,255,255,0.1)";
  img.style.background = "rgba(7,10,18,0.45)";
  img.style.objectFit = "contain";
  if (styleOptions.displayBlock) img.style.display = "block";
  if (styleOptions.autoHeight) img.style.height = "auto";
  if (styleOptions.minWidth) img.style.minWidth = styleOptions.minWidth;
}

function styleField(input, compact = false) {
  input.style.border = "1px solid rgba(255,255,255,0.2)";
  input.style.background = "rgba(255,255,255,0.06)";
  input.style.color = "#f5f6ff";
  input.style.borderRadius = "8px";
  input.style.padding = compact ? "4px 6px" : "7px 9px";
  input.style.fontSize = "12px";
  input.style.outline = "none";
}

function styleSlider(slider) {
  slider.style.flex = "1";
  slider.style.accentColor = "#6f95ff";
}

function styleSelect(select) {
  styleField(select, false);
}

function toFiniteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function radiansToDegrees(value) {
  return toFiniteNumber(value, 0) * RAD_TO_DEG;
}

function degreesToRadians(value) {
  return toFiniteNumber(value, 0) * DEG_TO_RAD;
}

function ensureMPAmpFilterParams(params) {
  if (params.scale === undefined) params.scale = true;
  if (params.KeepOriginalLength === undefined) params.KeepOriginalLength = true;
  const legacyScale = params.scale !== false;
  if (!params.plotScale || typeof params.plotScale !== "object") params.plotScale = {};
  ["angle", "spectrum", "fourier", "v3"].forEach((key) => {
    if (params.plotScale[key] === undefined) params.plotScale[key] = legacyScale;
  });
  params.referenceMode = normalizeMotionReferenceMode(params.referenceMode);
  if (!params.MPAmp) params.MPAmp = {};
  const mp = params.MPAmp;

  const supported = new Set(["none", "lowpass", "highpass", "bandpass", "bandstop"]);
  if (!supported.has(mp.filter_type)) {
    mp.filter_type = "none";
  }

  mp.ampScale = toFiniteNumber(mp.ampScale, 1);
  mp.meanAdd = toFiniteNumber(mp.meanAdd, 0);
  mp.f1 = Math.max(0, toFiniteNumber(mp.f1, 1));
  mp.f2 = Math.max(0, toFiniteNumber(mp.f2, 2));
  mp.transition_bw = Math.max(0, toFiniteNumber(mp.transition_bw, 0));
  mp.attenuation_ratio = Math.min(1, Math.max(0, toFiniteNumber(mp.attenuation_ratio, 0.001)));
}

function createZoomablePlot(imgEl, styleOptions = {}) {
  const wrap = document.createElement("div");
  wrap.style.position = "relative";
  wrap.style.overflowX = "auto";
  wrap.style.overflowY = "visible";
  wrap.style.height = "auto";
  wrap.style.maxHeight = "none";
  wrap.style.minHeight = "0";
  wrap.style.borderRadius = "10px";
  if (styleOptions.padding) wrap.style.padding = styleOptions.padding;
  if (styleOptions.boxSizing) wrap.style.boxSizing = styleOptions.boxSizing;

  const zoomBar = document.createElement("div");
  zoomBar.style.position = "absolute";
  zoomBar.style.top = "8px";
  zoomBar.style.right = "8px";
  zoomBar.style.display = "flex";
  zoomBar.style.gap = "4px";
  zoomBar.style.zIndex = "2";

  const zoomOut = document.createElement("button");
  zoomOut.type = "button";
  zoomOut.innerText = "-";
  const zoomIn = document.createElement("button");
  zoomIn.type = "button";
  zoomIn.innerText = "+";
  const zoomReset = document.createElement("button");
  zoomReset.type = "button";
  zoomReset.innerText = "1:1";

  [zoomOut, zoomIn, zoomReset].forEach((btn) => {
    btn.style.padding = "2px 7px";
    btn.style.fontSize = "11px";
    btn.style.borderRadius = "6px";
    btn.style.border = "1px solid rgba(255,255,255,0.2)";
    btn.style.background = "rgba(8,12,20,0.72)";
    btn.style.color = "#fff";
    btn.style.cursor = "pointer";
  });

  let zoom = 1;
  const applyZoom = () => {
    imgEl.style.transform = `scale(${zoom})`;
  };
  zoomOut.addEventListener("click", () => {
    zoom = Math.max(0.5, +(zoom - 0.1).toFixed(2));
    applyZoom();
  });
  zoomIn.addEventListener("click", () => {
    zoom = Math.min(4, +(zoom + 0.1).toFixed(2));
    applyZoom();
  });
  zoomReset.addEventListener("click", () => {
    zoom = 1;
    applyZoom();
  });

  wrap.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const delta = event.deltaY < 0 ? 0.1 : -0.1;
      zoom = Math.min(4, Math.max(0.5, +(zoom + delta).toFixed(2)));
      applyZoom();
    },
    { passive: false }
  );

  zoomBar.appendChild(zoomOut);
  zoomBar.appendChild(zoomIn);
  zoomBar.appendChild(zoomReset);
  wrap.appendChild(zoomBar);
  wrap.appendChild(imgEl);
  return wrap;
}

function createCaptionedZoomablePlot(imgEl, captionText, styleOptions = {}) {
  const figureWrap = document.createElement("div");
  figureWrap.style.display = "flex";
  figureWrap.style.flexDirection = "column";
  figureWrap.style.gap = "6px";

  const plotWrap = createZoomablePlot(imgEl, styleOptions);
  figureWrap.plotWrap = plotWrap;
  figureWrap.appendChild(plotWrap);

  const caption = document.createElement("div");
  caption.innerText = captionText;
  caption.style.fontSize = "12px";
  caption.style.color = "#aeb8d6";
  caption.style.lineHeight = "1.25";
  caption.style.textAlign = "left";
  caption.style.paddingLeft = "2px";
  figureWrap.appendChild(caption);

  return figureWrap;
}

function styleExportPdfButton(button) {
  button.style.alignSelf = "flex-start";
  button.style.padding = "5px 10px";
  button.style.fontSize = "11px";
  button.style.borderRadius = "7px";
  button.style.border = "1px solid rgba(255,255,255,0.18)";
  button.style.background = "rgba(16,24,40,0.9)";
  button.style.color = "#f5f6ff";
  button.style.cursor = "pointer";
}

function createPdfExportFigure(imgEl, captionText, filenameBase, styleOptions = {}, scaleOptions = null) {
  const figureWrap = document.createElement("div");
  figureWrap.style.display = "flex";
  figureWrap.style.flexDirection = "column";
  figureWrap.style.gap = "6px";

  const plotWrap = createZoomablePlot(imgEl, styleOptions);
  figureWrap.appendChild(plotWrap);

  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.innerText = "Export SVG";
  styleExportPdfButton(exportBtn);
  exportBtn.addEventListener("click", async () => {
    const prevText = exportBtn.innerText;
    exportBtn.disabled = true;
    exportBtn.innerText = "Exporting...";
    try {
      await exportImageElementAsSvg(imgEl, filenameBase);
      exportBtn.innerText = "Exported";
    } catch (error) {
      console.error("Failed to export popup image as SVG:", error);
      exportBtn.innerText = "Export Failed";
    } finally {
      window.setTimeout(() => {
        exportBtn.disabled = false;
        exportBtn.innerText = prevText;
      }, 900);
    }
  });
  const actionRow = document.createElement("div");
  actionRow.style.display = "flex";
  actionRow.style.alignItems = "center";
  actionRow.style.justifyContent = "space-between";
  actionRow.style.gap = "8px";
  actionRow.appendChild(exportBtn);

  if (scaleOptions) {
    const scaleLabel = document.createElement("label");
    scaleLabel.style.display = "inline-flex";
    scaleLabel.style.alignItems = "center";
    scaleLabel.style.gap = "4px";
    scaleLabel.style.marginLeft = "auto";
    scaleLabel.style.color = "#bcc5df";
    scaleLabel.style.cursor = "pointer";
    scaleLabel.style.fontSize = "11px";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = scaleOptions.checked !== false;
    checkbox.addEventListener("change", () => scaleOptions.onChange?.(checkbox.checked));
    scaleLabel.appendChild(checkbox);
    scaleLabel.appendChild(document.createTextNode("scale"));
    actionRow.appendChild(scaleLabel);
    figureWrap.scaleCheckbox = checkbox;
  }
  figureWrap.appendChild(actionRow);

  const caption = document.createElement("div");
  caption.innerText = captionText;
  caption.style.fontSize = "12px";
  caption.style.color = "#aeb8d6";
  caption.style.lineHeight = "1.25";
  caption.style.textAlign = "left";
  caption.style.paddingLeft = "2px";
  figureWrap.appendChild(caption);

  return figureWrap;
}

async function exportImageElementAsSvg(imgEl, filenameBase = "plot") {
  const src = String(imgEl?.currentSrc || imgEl?.src || "").trim();
  if (!src) {
    throw new Error("No image source available for export.");
  }

  let svgMarkup = "";
  if (isSvgDataUrl(src)) {
    svgMarkup = decodeSvgDataUrl(src);
  } else {
    const response = await fetch(src);
    if (!response.ok) {
      throw new Error(`Unable to fetch SVG source: ${response.status}`);
    }
    svgMarkup = await response.text();
  }

  downloadTextAsset(svgMarkup, filenameBase, "image/svg+xml;charset=utf-8", ".svg");
}

async function exportImageElementAsPdf(imgEl, filenameBase = "plot") {
  const src = String(imgEl?.currentSrc || imgEl?.src || "").trim();
  if (!src) {
    throw new Error("No image source available for export.");
  }

  if (isSvgDataUrl(src)) {
    const svgMarkup = decodeSvgDataUrl(src);
    const pdfBytes = buildPdfFromSvgMarkup(svgMarkup);
    downloadPdfBytes(pdfBytes, filenameBase);
    return;
  }

  const loadedImage = await loadImageForPdfExport(src, imgEl);
  const width = Math.max(1, loadedImage.naturalWidth || loadedImage.width || imgEl.naturalWidth || 1);
  const height = Math.max(1, loadedImage.naturalHeight || loadedImage.height || imgEl.naturalHeight || 1);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(loadedImage, 0, 0, width, height);

  const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.96);
  const jpegBytes = dataUrlToBytes(jpegDataUrl);
  const pageWidthPt = Math.max(1, (width * 72) / 96);
  const pageHeightPt = Math.max(1, (height * 72) / 96);
  const pdfBytes = buildSingleImagePdf(jpegBytes, {
    imageWidthPx: width,
    imageHeightPx: height,
    pageWidthPt,
    pageHeightPt,
  });
  downloadPdfBytes(pdfBytes, filenameBase);
}

function loadImageForPdfExport(src, fallbackImgEl) {
  if (fallbackImgEl?.complete && fallbackImgEl?.naturalWidth > 0 && fallbackImgEl.src === src) {
    return Promise.resolve(fallbackImgEl);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to load image for PDF export."));
    img.src = src;
  });
}

function dataUrlToBytes(dataUrl) {
  const parts = String(dataUrl || "").split(",");
  if (parts.length < 2) {
    throw new Error("Invalid image data URL.");
  }
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function buildSingleImagePdf(jpegBytes, {
  imageWidthPx,
  imageHeightPx,
  pageWidthPt,
  pageHeightPt,
}) {
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [0];
  let offset = 0;

  const pushBytes = (bytes) => {
    chunks.push(bytes);
    offset += bytes.length;
  };
  const pushText = (text) => pushBytes(encoder.encode(text));
  const registerObject = (index) => {
    offsets[index] = offset;
  };

  const pageWidthStr = formatPdfNumber(pageWidthPt);
  const pageHeightStr = formatPdfNumber(pageHeightPt);
  const imageWidthStr = formatPdfNumber(imageWidthPx);
  const imageHeightStr = formatPdfNumber(imageHeightPx);
  const contentStream = `q\n${pageWidthStr} 0 0 ${pageHeightStr} 0 0 cm\n/Im0 Do\nQ\n`;

  pushText("%PDF-1.4\n");
  pushBytes(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  registerObject(1);
  pushText("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  registerObject(2);
  pushText("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  registerObject(3);
  pushText(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthStr} ${pageHeightStr}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  registerObject(4);
  pushText(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidthStr} /Height ${imageHeightStr} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
  );
  pushBytes(jpegBytes);
  pushText("\nendstream\nendobj\n");

  registerObject(5);
  pushText(`5 0 obj\n<< /Length ${encoder.encode(contentStream).length} >>\nstream\n${contentStream}endstream\nendobj\n`);

  const xrefOffset = offset;
  pushText("xref\n0 6\n");
  pushText("0000000000 65535 f \n");
  for (let i = 1; i <= 5; i++) {
    pushText(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  pushText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return concatUint8Arrays(chunks);
}

function buildPdfFromSvgMarkup(svgMarkup) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgMarkup, "image/svg+xml");
  const svgRoot = doc.documentElement;
  if (!svgRoot || svgRoot.nodeName.toLowerCase() !== "svg") {
    throw new Error("Invalid SVG content.");
  }

  const svgWidthPx = resolveSvgDimension(svgRoot.getAttribute("width"), 420);
  const svgHeightPx = resolveSvgDimension(svgRoot.getAttribute("height"), 240);
  const pageWidthPt = Math.max(1, (svgWidthPx * 72) / 96);
  const pageHeightPt = Math.max(1, (svgHeightPx * 72) / 96);
  const scale = 72 / 96;

  const contentParts = [];
  appendSvgNodePdfCommands(svgRoot, contentParts, {
    scale,
    pageHeightPt,
    transform: identityMatrix(),
  });
  const contentStream = contentParts.join("");

  return buildVectorPdfDocument(contentStream, pageWidthPt, pageHeightPt);
}

function appendSvgNodePdfCommands(node, output, context) {
  if (!node?.childNodes) return;
  node.childNodes.forEach((childNode) => {
    if (childNode.nodeType !== 1) return;
    const tag = childNode.nodeName.toLowerCase();
    if (tag === "defs") return;

    const childTransform = multiplyMatrices(
      context.transform,
      parseSvgTransform(childNode.getAttribute("transform"))
    );
    const childContext = {
      ...context,
      transform: childTransform,
    };

    switch (tag) {
      case "g":
      case "svg":
        appendSvgNodePdfCommands(childNode, output, childContext);
        break;
      case "rect":
        output.push(buildRectPdfCommand(childNode, childContext));
        break;
      case "line":
        output.push(buildLinePdfCommand(childNode, childContext));
        break;
      case "polyline":
        output.push(buildPolylinePdfCommand(childNode, childContext));
        break;
      case "text":
        output.push(buildTextPdfCommand(childNode, childContext));
        break;
      default:
        appendSvgNodePdfCommands(childNode, output, childContext);
        break;
    }
  });
}

function buildRectPdfCommand(node, context) {
  const x = parseSvgNumber(node.getAttribute("x"), 0);
  const y = parseSvgNumber(node.getAttribute("y"), 0);
  const width = parseSvgNumber(node.getAttribute("width"), 0);
  const height = parseSvgNumber(node.getAttribute("height"), 0);
  if (width <= 0 || height <= 0) return "";

  const p1 = transformSvgPointToPdf(x, y, context);
  const p2 = transformSvgPointToPdf(x + width, y, context);
  const p3 = transformSvgPointToPdf(x + width, y + height, context);
  const p4 = transformSvgPointToPdf(x, y + height, context);
  return buildPathPaintCommand([p1, p2, p3, p4], true, node, context);
}

function buildLinePdfCommand(node, context) {
  const x1 = parseSvgNumber(node.getAttribute("x1"), 0);
  const y1 = parseSvgNumber(node.getAttribute("y1"), 0);
  const x2 = parseSvgNumber(node.getAttribute("x2"), 0);
  const y2 = parseSvgNumber(node.getAttribute("y2"), 0);
  const p1 = transformSvgPointToPdf(x1, y1, context);
  const p2 = transformSvgPointToPdf(x2, y2, context);
  return buildPathPaintCommand([p1, p2], false, node, context);
}

function buildPolylinePdfCommand(node, context) {
  const pointsAttr = String(node.getAttribute("points") || "").trim();
  if (!pointsAttr) return "";
  const coords = pointsAttr.split(/[\s,]+/).map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (coords.length < 4) return "";
  const points = [];
  for (let i = 0; i < coords.length - 1; i += 2) {
    points.push(transformSvgPointToPdf(coords[i], coords[i + 1], context));
  }
  return buildPathPaintCommand(points, false, node, context);
}

function buildTextPdfCommand(node, context) {
  const text = String(node.textContent || "");
  if (!text) return "";

  const x = parseSvgNumber(node.getAttribute("x"), 0);
  const y = parseSvgNumber(node.getAttribute("y"), 0);
  const fillColor = parseSvgColor(node.getAttribute("fill"));
  if (!fillColor) return "";

  const fontSizePx = parseSvgNumber(node.getAttribute("font-size"), 12);
  const fontSizePt = fontSizePx * context.scale;
  const textAnchor = String(node.getAttribute("text-anchor") || "start").trim().toLowerCase();
  const escapedText = escapePdfText(text);
  const estimatedTextWidthPt = estimatePdfTextWidth(text, fontSizePt);
  const anchorShiftPt =
    textAnchor === "middle" ? -estimatedTextWidthPt / 2
      : textAnchor === "end" ? -estimatedTextWidthPt
        : 0;
  const anchorShiftSvg = anchorShiftPt / context.scale;
  const textTransform = multiplyMatrices(
    context.transform,
    translationMatrix(x + anchorShiftSvg, y)
  );
  const finalMatrix = svgMatrixToPdfTextMatrix(textTransform, context.scale, context.pageHeightPt);

  const parts = [];
  parts.push("q\n");
  parts.push(`${formatRgbForPdf(fillColor)} rg\n`);
  parts.push("BT\n");
  parts.push(`/F1 ${formatPdfNumber(fontSizePt)} Tf\n`);
  parts.push(`${formatMatrixForPdf(finalMatrix)} Tm\n`);
  parts.push(`(${escapedText}) Tj\n`);
  parts.push("ET\n");
  parts.push("Q\n");
  return parts.join("");
}

function buildPathPaintCommand(points, closed, node, context) {
  if (!Array.isArray(points) || points.length < 2) return "";
  const fillColor = parseSvgColor(node.getAttribute("fill"));
  const strokeColor = parseSvgColor(node.getAttribute("stroke"));
  const strokeWidth = parseSvgNumber(node.getAttribute("stroke-width"), 1) * context.scale;
  const hasFill = !!fillColor && fillColor.alpha > 0;
  const hasStroke = !!strokeColor && strokeColor.alpha > 0;
  if (!hasFill && !hasStroke) return "";

  const parts = [];
  parts.push("q\n");
  if (hasFill) {
    parts.push(`${formatRgbForPdf(fillColor)} rg\n`);
  }
  if (hasStroke) {
    parts.push(`${formatRgbForPdf(strokeColor)} RG\n`);
    parts.push(`${formatPdfNumber(Math.max(0.1, strokeWidth))} w\n`);
  }
  parts.push(`${formatPdfNumber(points[0].x)} ${formatPdfNumber(points[0].y)} m\n`);
  for (let i = 1; i < points.length; i++) {
    parts.push(`${formatPdfNumber(points[i].x)} ${formatPdfNumber(points[i].y)} l\n`);
  }
  if (closed) {
    parts.push("h\n");
  }
  parts.push(hasFill && hasStroke ? "B\n" : hasFill ? "f\n" : "S\n");
  parts.push("Q\n");
  return parts.join("");
}

function buildVectorPdfDocument(contentStream, pageWidthPt, pageHeightPt) {
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [0];
  let offset = 0;

  const pushBytes = (bytes) => {
    chunks.push(bytes);
    offset += bytes.length;
  };
  const pushText = (text) => pushBytes(encoder.encode(text));
  const registerObject = (index) => {
    offsets[index] = offset;
  };

  pushText("%PDF-1.4\n");
  pushBytes(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  registerObject(1);
  pushText("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  registerObject(2);
  pushText("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  registerObject(3);
  pushText(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${formatPdfNumber(pageWidthPt)} ${formatPdfNumber(pageHeightPt)}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  registerObject(4);
  pushText("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  registerObject(5);
  pushText(`5 0 obj\n<< /Length ${encoder.encode(contentStream).length} >>\nstream\n${contentStream}endstream\nendobj\n`);

  const xrefOffset = offset;
  pushText("xref\n0 6\n");
  pushText("0000000000 65535 f \n");
  for (let i = 1; i <= 5; i++) {
    pushText(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  pushText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return concatUint8Arrays(chunks);
}

function isSvgDataUrl(src) {
  return /^data:image\/svg\+xml/i.test(String(src || "").trim());
}

function decodeSvgDataUrl(src) {
  const text = String(src || "");
  const commaIndex = text.indexOf(",");
  if (commaIndex < 0) {
    throw new Error("Invalid SVG data URL.");
  }
  const header = text.slice(0, commaIndex);
  const data = text.slice(commaIndex + 1);
  if (/;base64/i.test(header)) {
    return atob(data);
  }
  return decodeURIComponent(data);
}

function resolveSvgDimension(attrValue, fallback) {
  const parsed = parseFloat(String(attrValue || ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSvgNumber(value, fallback = 0) {
  const parsed = parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseSvgColor(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.toLowerCase() === "none") return null;

  if (raw.startsWith("#")) {
    const hex = raw.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return { r, g, b, alpha: 1 };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        alpha: 1,
      };
    }
  }

  const rgbaMatch = raw.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(",").map((part) => part.trim());
    if (parts.length >= 3) {
      const alpha = parts.length >= 4 ? Math.max(0, Math.min(1, Number(parts[3]) || 0)) : 1;
      return {
        r: Math.max(0, Math.min(255, Number(parts[0]) || 0)),
        g: Math.max(0, Math.min(255, Number(parts[1]) || 0)),
        b: Math.max(0, Math.min(255, Number(parts[2]) || 0)),
        alpha,
      };
    }
  }

  return null;
}

function formatRgbForPdf(color) {
  const alpha = Number.isFinite(color?.alpha) ? color.alpha : 1;
  const blend = (channel) => ((alpha * channel) + ((1 - alpha) * 255)) / 255;
  return `${formatPdfNumber(blend(color.r))} ${formatPdfNumber(blend(color.g))} ${formatPdfNumber(blend(color.b))}`;
}

function transformSvgPointToPdf(x, y, context) {
  const transformed = applyMatrixToPoint(context.transform, { x, y });
  return {
    x: transformed.x * context.scale,
    y: context.pageHeightPt - (transformed.y * context.scale),
  };
}

function parseSvgTransform(transformValue) {
  const text = String(transformValue || "").trim();
  if (!text) return identityMatrix();

  const pattern = /(\w+)\(([^)]+)\)/g;
  let match;
  let matrix = identityMatrix();
  while ((match = pattern.exec(text))) {
    const fn = match[1].toLowerCase();
    const values = match[2]
      .split(/[\s,]+/)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    if (fn === "translate") {
      matrix = multiplyMatrices(matrix, translationMatrix(values[0] || 0, values[1] || 0));
    } else if (fn === "rotate") {
      const angle = (values[0] || 0) * Math.PI / 180;
      const cx = values[1] || 0;
      const cy = values[2] || 0;
      matrix = multiplyMatrices(
        matrix,
        multiplyMatrices(
          translationMatrix(cx, cy),
          multiplyMatrices(rotationMatrix(angle), translationMatrix(-cx, -cy))
        )
      );
    } else if (fn === "matrix" && values.length >= 6) {
      matrix = multiplyMatrices(matrix, [values[0], values[1], values[2], values[3], values[4], values[5]]);
    }
  }
  return matrix;
}

function identityMatrix() {
  return [1, 0, 0, 1, 0, 0];
}

function translationMatrix(tx, ty) {
  return [1, 0, 0, 1, tx, ty];
}

function rotationMatrix(angleRad) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return [cos, sin, -sin, cos, 0, 0];
}

function multiplyMatrices(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function applyMatrixToPoint(matrix, point) {
  return {
    x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
    y: matrix[1] * point.x + matrix[3] * point.y + matrix[5],
  };
}

function svgMatrixToPdfTextMatrix(svgMatrix, scale, pageHeightPt) {
  return [
    svgMatrix[0] * scale,
    -svgMatrix[1] * scale,
    -svgMatrix[2] * scale,
    svgMatrix[3] * scale,
    svgMatrix[4] * scale,
    pageHeightPt - (svgMatrix[5] * scale),
  ];
}

function formatMatrixForPdf(matrix) {
  return matrix.map((value) => formatPdfNumber(value)).join(" ");
}

function estimatePdfTextWidth(text, fontSizePt) {
  return String(text || "").length * fontSizePt * 0.52;
}

function escapePdfText(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function concatUint8Arrays(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.length;
  });
  return merged;
}

function formatPdfNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return Number(numeric.toFixed(3)).toString();
}

function sanitizePdfFilename(value) {
  const normalized = String(value || "plot").trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  return normalized.length > 0 ? normalized : "plot";
}

function downloadPdfBytes(pdfBytes, filenameBase) {
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitizePdfFilename(filenameBase)}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function downloadTextAsset(text, filenameBase, mimeType, extension) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitizePdfFilename(filenameBase)}${extension}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function createInlineMotionPopup({
  entity,
  paramsMap,
  originalParamsMap,
  mountTarget,
  popupEvents = {},
  popupKindDefault,
  titleAll,
  titleItem,
  imageStyleOptions = {},
  zoomWrapStyleOptions = {},
  generalTargetSelectorOptions = null,
  assignParamsOnSet = false,
  onGenerateSingle,
  onInitializeSingle,
  onRenew,
}) {
  const isAllTarget = entity?.id === "all";
  const id = entity?.id;
  if (paramsMap[id]) ensureMPAmpFilterParams(paramsMap[id]);
  if (originalParamsMap[id]) ensureMPAmpFilterParams(originalParamsMap[id]);

  const notifyAllParamChange = () => {
    if (!isAllTarget) return;
    popupEvents.onBroadcastParams?.(deepClone(paramsMap[id]));
  };
  let hasPendingParamChanges = false;
  let paramsChangedHint = null;
  const updateParamsChangedHint = () => {
    if (!paramsChangedHint) return;
    paramsChangedHint.style.display = hasPendingParamChanges ? "inline" : "none";
  };
  const markParamsChanged = () => {
    hasPendingParamChanges = true;
    updateParamsChangedHint();
  };
  const clearParamsChanged = () => {
    hasPendingParamChanges = false;
    updateParamsChangedHint();
  };

  const popupKind = popupEvents.popupKind || popupKindDefault;
  const selector = `.pane-c-popup-card[data-popup-id="${escapeDataAttr(id)}"][data-popup-kind="${escapeDataAttr(popupKind)}"]`;
  const existing = mountTarget.querySelector(selector) || document.body.querySelector(selector);
  if (existing?.api) {
    if (!isAllTarget) {
      registerPlotPopupUpdater(popupKind, id, {
        setAngleImage: existing.api.setAngleImage,
        setSpectrumImage: existing.api.setSpectrumImage,
        setFourierImage: existing.api.setFourierImage,
        setV3Image: existing.api.setV3Image,
      });
    }
    existing.style.display = "";
    return existing.api;
  }

  const card = document.createElement("div");
  card.className = "pane-c-popup-card";
  card.style.position = "relative";
  card.dataset.popupId = id;
  card.dataset.popupKind = popupKind;
  const focusPopup = () => {
    if (card.style.display !== "none") popupEvents.onFocus?.(entity);
  };
  card.addEventListener("pointerdown", focusPopup, true);
  card.addEventListener("click", focusPopup, true);

  let isFloating = false;
  let listPlaceholder = null;
  let previousOrder = "";
  let floatingHeight = null;

  const rememberListPosition = () => {
    if (card.parentElement !== mountTarget || listPlaceholder) return;
    listPlaceholder = document.createComment(`popup:${popupKind}:${id}`);
    mountTarget.insertBefore(listPlaceholder, card.nextSibling);
    previousOrder = card.style.order || "";
  };

  const restoreToList = () => {
    if (!isFloating) return;
    isFloating = false;
    card.classList.remove("is-floating");
    card.style.position = "relative";
    card.style.left = "";
    card.style.top = "";
    card.style.width = "";
    card.style.maxWidth = "";
    card.style.minWidth = "";
    card.style.maxHeight = "";
    card.style.minHeight = "";
    card.style.height = "";
    card.style.overflow = "";
    card.style.resize = "";
    card.style.zIndex = "";
    card.style.order = previousOrder;
    if (listPlaceholder?.parentElement === mountTarget) {
      mountTarget.insertBefore(card, listPlaceholder);
      listPlaceholder.remove();
    } else {
      mountTarget.appendChild(card);
    }
    listPlaceholder = null;
    floatingHeight = null;
    updateFloatingResizeHandles();
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const clampFloatingRect = (left, top, width, height) => {
    const safeWidth = Math.max(
      FLOATING_POPUP_MIN_WIDTH,
      Math.min(width, window.innerWidth - FLOATING_POPUP_MARGIN * 2)
    );
    const safeHeight = Math.max(
      FLOATING_POPUP_MIN_HEIGHT,
      Math.min(height, window.innerHeight - FLOATING_POPUP_MARGIN * 2)
    );
    const maxLeft = Math.max(
      FLOATING_POPUP_MARGIN,
      window.innerWidth - safeWidth - FLOATING_POPUP_MARGIN
    );
    const maxTop = Math.max(
      FLOATING_POPUP_MARGIN,
      window.innerHeight - safeHeight - FLOATING_POPUP_MARGIN
    );
    return {
      left: Math.max(FLOATING_POPUP_MARGIN, Math.min(left, maxLeft)),
      top: Math.max(FLOATING_POPUP_MARGIN, Math.min(top, maxTop)),
      width: safeWidth,
      height: safeHeight,
    };
  };

  const applyFloatingRect = ({ left, top, width, height }) => {
    card.style.position = "fixed";
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.style.width = `${width}px`;
    card.style.height = `${height}px`;
    card.style.minWidth = `${FLOATING_POPUP_MIN_WIDTH}px`;
    card.style.minHeight = `${FLOATING_POPUP_MIN_HEIGHT}px`;
    card.style.maxWidth = `calc(100vw - ${FLOATING_POPUP_MARGIN * 2}px)`;
    card.style.maxHeight = `calc(100vh - ${FLOATING_POPUP_MARGIN * 2}px)`;
    card.style.overflow = "auto";
    card.style.resize = "none";
    card.style.zIndex = String(++floatingPopupZIndex);
  };

  const detachAt = (left, top, width, height = null) => {
    if (!isFloating) {
      isFloating = true;
      card.classList.add("is-floating");
      rememberListPosition();
      document.body.appendChild(card);
      updateFloatingResizeHandles();
    }
    const rect = card.getBoundingClientRect();
    floatingHeight = height ?? floatingHeight ?? rect.height ?? FLOATING_POPUP_MIN_HEIGHT;
    const nextRect = clampFloatingRect(left, top, width, floatingHeight);
    floatingHeight = nextRect.height;
    applyFloatingRect(nextRect);
  };

  const moveFloatingByPointer = (event, offsetX, offsetY, width, height) => {
    const nextRect = clampFloatingRect(
      event.clientX - offsetX,
      event.clientY - offsetY,
      width,
      height
    );
    floatingHeight = nextRect.height;
    applyFloatingRect(nextRect);
  };

  const updateFloatingResizeHandles = () => {
    if (!topResizeHandle || !bottomResizeHandle || !leftResizeHandle || !rightResizeHandle) return;
    const display = isFloating ? "block" : "none";
    topResizeHandle.style.display = display;
    bottomResizeHandle.style.display = display;
    leftResizeHandle.style.display = display;
    rightResizeHandle.style.display = display;
  };

  const startFloatingResize = (edge, event) => {
    if (!isFloating || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    card.style.zIndex = String(++floatingPopupZIndex);

    const startRect = card.getBoundingClientRect();
    const startRight = startRect.right;
    const startBottom = startRect.bottom;

    const handleMove = (moveEvent) => {
      moveEvent.preventDefault();
      let nextLeft = startRect.left;
      let nextTop = startRect.top;
      let nextWidth = startRect.width;
      let nextHeight = startRect.height;

      if (edge === "top") {
        nextTop = Math.max(
          FLOATING_POPUP_MARGIN,
          Math.min(moveEvent.clientY, startBottom - FLOATING_POPUP_MIN_HEIGHT)
        );
        nextHeight = startBottom - nextTop;
      } else if (edge === "bottom") {
        nextHeight = Math.max(
          FLOATING_POPUP_MIN_HEIGHT,
          Math.min(
            moveEvent.clientY - startRect.top,
            window.innerHeight - startRect.top - FLOATING_POPUP_MARGIN
          )
        );
      } else if (edge === "left") {
        nextLeft = Math.max(
          FLOATING_POPUP_MARGIN,
          Math.min(moveEvent.clientX, startRight - FLOATING_POPUP_MIN_WIDTH)
        );
        nextWidth = startRight - nextLeft;
      } else if (edge === "right") {
        nextWidth = Math.max(
          FLOATING_POPUP_MIN_WIDTH,
          Math.min(
            moveEvent.clientX - startRect.left,
            window.innerWidth - startRect.left - FLOATING_POPUP_MARGIN
          )
        );
      }

      const nextRect = clampFloatingRect(
        nextLeft,
        nextTop,
        nextWidth,
        nextHeight
      );
      floatingHeight = nextRect.height;
      applyFloatingRect(nextRect);
    };

    const handleUp = () => {
      event.currentTarget?.releasePointerCapture?.(event.pointerId);
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.removeEventListener("pointercancel", handleUp);
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    document.addEventListener("pointercancel", handleUp);
  };

  const createFloatingResizeHandle = (edge) => {
    const handle = document.createElement("div");
    handle.className = `pane-c-popup-resize-handle pane-c-popup-resize-${edge}`;
    handle.style.position = "absolute";
    handle.style.display = "none";
    handle.style.zIndex = "4";
    handle.style.touchAction = "none";
    handle.style.background = "transparent";
    if (edge === "top") {
      handle.style.left = "0";
      handle.style.right = "0";
      handle.style.height = "10px";
      handle.style.top = "-5px";
      handle.style.cursor = "ns-resize";
    } else if (edge === "bottom") {
      handle.style.left = "0";
      handle.style.right = "0";
      handle.style.height = "10px";
      handle.style.bottom = "-5px";
      handle.style.cursor = "ns-resize";
    } else if (edge === "left") {
      handle.style.top = "0";
      handle.style.bottom = "0";
      handle.style.left = "-5px";
      handle.style.width = "10px";
      handle.style.cursor = "ew-resize";
    } else {
      handle.style.top = "0";
      handle.style.bottom = "0";
      handle.style.right = "-5px";
      handle.style.width = "10px";
      handle.style.cursor = "ew-resize";
    }
    handle.addEventListener("pointerdown", (event) => startFloatingResize(edge, event));
    return handle;
  };

  const topResizeHandle = createFloatingResizeHandle("top");
  const bottomResizeHandle = createFloatingResizeHandle("bottom");
  const leftResizeHandle = createFloatingResizeHandle("left");
  const rightResizeHandle = createFloatingResizeHandle("right");
  card.appendChild(topResizeHandle);
  card.appendChild(bottomResizeHandle);
  card.appendChild(leftResizeHandle);
  card.appendChild(rightResizeHandle);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.innerText = "×";
  closeBtn.title = "Close";
  closeBtn.textContent = "x";
  closeBtn.innerText = "×";
  closeBtn.textContent = "x";
  closeBtn.innerHTML = "&times;";
  closeBtn.style.position = "absolute";
  closeBtn.style.top = "8px";
  closeBtn.style.right = "8px";
  closeBtn.style.width = "24px";
  closeBtn.style.height = "24px";
  closeBtn.style.borderRadius = "999px";
  closeBtn.style.border = "1px solid rgba(255,255,255,0.24)";
  closeBtn.style.background = "rgba(8,12,20,0.7)";
  closeBtn.style.color = "#fff";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontSize = "16px";
  closeBtn.style.lineHeight = "20px";
  closeBtn.style.padding = "0";
  closeBtn.style.display = "inline-flex";
  closeBtn.style.alignItems = "center";
  closeBtn.style.justifyContent = "center";
  closeBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (isFloating) {
      restoreToList();
    } else {
      api.hide();
    }
  });
  card.appendChild(closeBtn);

  const title = document.createElement("h3");
  title.innerText = isAllTarget ? titleAll : titleItem(entity);
  title.title = "Drag to create a floating card";
  title.style.cursor = "grab";
  title.style.userSelect = "none";
  title.style.paddingRight =
    isAllTarget && generalTargetSelectorOptions?.items?.length ? "200px" : "28px";
  card.appendChild(title);

  title.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    title.setPointerCapture?.(event.pointerId);
    const startRect = card.getBoundingClientRect();
    const offsetX = event.clientX - startRect.left;
    const offsetY = event.clientY - startRect.top;
    const startWidth = Math.max(420, startRect.width);
    const startHeight = floatingHeight ?? startRect.height;
    let moved = false;

    const handleMove = (moveEvent) => {
      moveEvent.preventDefault();
      if (!moved) {
        const distance = Math.hypot(
          moveEvent.clientX - event.clientX,
          moveEvent.clientY - event.clientY
        );
        if (distance < 4) return;
        moved = true;
      }
      title.style.cursor = "grabbing";
      if (!isFloating) {
        detachAt(moveEvent.clientX - offsetX, moveEvent.clientY - offsetY, startWidth, startHeight);
      } else {
        moveFloatingByPointer(moveEvent, offsetX, offsetY, startWidth, startHeight);
      }
    };
    const handleUp = () => {
      title.style.cursor = "grab";
      title.releasePointerCapture?.(event.pointerId);
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.removeEventListener("pointercancel", handleUp);
    };
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    document.addEventListener("pointercancel", handleUp);
  });

  let generalTargetSelectorApi = null;
  if (isAllTarget && generalTargetSelectorOptions?.items?.length) {
    generalTargetSelectorApi = createGeneralPopupTargetSelector(generalTargetSelectorOptions);
    if (generalTargetSelectorApi?.element) {
      generalTargetSelectorApi.element.style.position = "absolute";
      generalTargetSelectorApi.element.style.top = "8px";
      generalTargetSelectorApi.element.style.right = "38px";
      card.appendChild(generalTargetSelectorApi.element);
    }
  }

  const referencePane = document.createElement("div");
  referencePane.className = "pane-c-popup-pane";
  referencePane.innerHTML = "<h4>Reference Value</h4>";

  const referenceRow = document.createElement("div");
  referenceRow.style.display = "flex";
  referenceRow.style.flexWrap = "wrap";
  referenceRow.style.gap = "8px";
  referenceRow.style.margin = "8px 0 4px";
  const referenceGroupName = `motion-reference-${popupEvents.popupKind || popupKindDefault}-${id}`;
  const referenceInputs = [];

  const addReferenceOption = (labelText, value) => {
    const label = document.createElement("label");
    label.style.display = "inline-flex";
    label.style.alignItems = "center";
    label.style.gap = "6px";
    label.style.padding = "6px 10px";
    label.style.border = "1px solid rgba(255,255,255,0.2)";
    label.style.borderRadius = "8px";
    label.style.cursor = "pointer";
    label.style.fontSize = "12px";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = referenceGroupName;
    radio.value = value;
    radio.style.accentColor = "#6f95ff";
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      paramsMap[id].referenceMode = value;
      updateReferenceLabels();
      markParamsChanged();
      notifyAllParamChange();
    });
    label.appendChild(radio);
    label.appendChild(document.createTextNode(labelText));
    referenceInputs.push(radio);
    referenceRow.appendChild(label);
  };

  addReferenceOption("Keep StartPoint", MOTION_REFERENCE_MODE.START_POINT);
  addReferenceOption("Keep Start-End", MOTION_REFERENCE_MODE.START_END);
  addReferenceOption("Keep Mean Value", MOTION_REFERENCE_MODE.MEAN);
  referencePane.appendChild(referenceRow);
  card.appendChild(referencePane);

  const pane1 = document.createElement("div");
  pane1.className = "pane-c-popup-pane";
  pane1.innerHTML = "<h4>Main Plane (MP) Angle</h4>";

  let angleImg = null;
  let fftImg = null;
  let fourierImg = null;
  let v3Img = null;
  const scaleCheckboxes = {};
  const imageVisibilityControls = document.createElement("div");
  imageVisibilityControls.style.display = isAllTarget ? "none" : "flex";
  imageVisibilityControls.style.flexWrap = "wrap";
  imageVisibilityControls.style.gap = "6px";
  imageVisibilityControls.style.marginTop = "2px";
  const addImageVisibilityControl = (labelText, figure, visible = true) => {
    const label = document.createElement("label");
    label.style.display = "inline-flex";
    label.style.alignItems = "center";
    label.style.gap = "4px";
    label.style.padding = "4px 7px";
    label.style.border = "1px solid rgba(255,255,255,0.16)";
    label.style.borderRadius = "6px";
    label.style.color = "#bcc5df";
    label.style.cursor = "pointer";
    label.style.fontSize = "11px";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = visible;
    figure.style.display = visible ? "flex" : "none";
    checkbox.addEventListener("change", () => {
      figure.style.display = checkbox.checked ? "flex" : "none";
    });
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(labelText));
    imageVisibilityControls.appendChild(label);
  };
  pane1.appendChild(imageVisibilityControls);
  if (!isAllTarget) {
    const getScaleOptions = (key) => ({
      checked: paramsMap[id]?.plotScale?.[key] !== false,
      onChange: (checked) => {
        ensureMPAmpFilterParams(paramsMap[id]);
        paramsMap[id].plotScale[key] = checked;
        markParamsChanged();
      },
    });
    angleImg = document.createElement("img");
    angleImg.style.width = "100%";
    angleImg.style.maxHeight = "none";
    angleImg.style.marginTop = "8px";
    angleImg.style.transformOrigin = "top left";
    angleImg.src = entity?.Ori?.MPAnglePlot || "";
    stylePreviewImage(angleImg, imageStyleOptions);
    const angleFigure = createPdfExportFigure(
      angleImg,
      "Fig.1 MP Angle Curve",
      `${popupEvents.popupKind || popupKindDefault}_${id}_main_plane_angle`,
      zoomWrapStyleOptions,
      getScaleOptions("angle")
    );
    scaleCheckboxes.angle = angleFigure.scaleCheckbox;
    pane1.appendChild(angleFigure);
    addImageVisibilityControl("Angle", angleFigure);

    fftImg = document.createElement("img");
    fftImg.style.width = "100%";
    fftImg.style.maxHeight = "none";
    fftImg.style.marginTop = "8px";
    fftImg.style.transformOrigin = "top left";
    fftImg.src = entity?.Ori?.MPSpectrumPlot || "";
    stylePreviewImage(fftImg, imageStyleOptions);
    const spectrumFigure = createPdfExportFigure(
      fftImg,
      "Fig.2 MP Angle Spectrum (FFT)",
      `${popupEvents.popupKind || popupKindDefault}_${id}_main_plane_spectrum`,
      zoomWrapStyleOptions,
      getScaleOptions("spectrum")
    );
    scaleCheckboxes.spectrum = spectrumFigure.scaleCheckbox;
    pane1.appendChild(spectrumFigure);
    addImageVisibilityControl("Spectrum", spectrumFigure);

    fourierImg = document.createElement("img");
    fourierImg.style.width = "100%";
    fourierImg.style.maxHeight = "none";
    fourierImg.style.marginTop = "8px";
    fourierImg.style.transformOrigin = "top left";
    fourierImg.src = entity?.Ori?.MPFourierPlot || "";
    stylePreviewImage(fourierImg, imageStyleOptions);
    const fourierFigure = createPdfExportFigure(
      fourierImg,
      "Fig.3 MP Amplitude Fourier Analysis",
      `${popupEvents.popupKind || popupKindDefault}_${id}_mp_amplitude_fourier_analysis`,
      zoomWrapStyleOptions,
      getScaleOptions("fourier")
    );
    scaleCheckboxes.fourier = fourierFigure.scaleCheckbox;
    pane1.appendChild(fourierFigure);
    addImageVisibilityControl("Fourier", fourierFigure, false);
  }

  const ampScaleRow = document.createElement("div");
  ampScaleRow.className = "pane-c-popup-inputs";
  const ampScaleLabel = document.createElement("span");
  ampScaleLabel.innerText = "Amplitude Scale:";
  const input = document.createElement("input");
  input.type = "number";
  input.step = "any";
  input.min = "0";
  input.value =
    paramsMap[id]?.MPAmp?.ampScale !== undefined ? paramsMap[id].MPAmp.ampScale : 1;
  styleField(input);
  input.addEventListener("input", () => {
    paramsMap[id].MPAmp.ampScale = parseFloat(input.value);
    markParamsChanged();
    notifyAllParamChange();
  });
  ampScaleRow.appendChild(ampScaleLabel);
  ampScaleRow.appendChild(input);
  pane1.appendChild(ampScaleRow);

  const meanAddRow = document.createElement("div");
  meanAddRow.className = "pane-c-popup-slider-row";
  const meanAddLabel = document.createElement("span");
  meanAddLabel.innerText = "Mean Addition (deg):";
  const meanAddSlider = document.createElement("input");
  meanAddSlider.type = "range";
  meanAddSlider.min = "0";
  meanAddSlider.max = "360";
  meanAddSlider.step = "0.1";
  meanAddSlider.value = radiansToDegrees(
    paramsMap[id]?.MPAmp?.meanAdd !== undefined ? paramsMap[id].MPAmp.meanAdd : 0
  );
  styleSlider(meanAddSlider);

  const meanAddValueInput = document.createElement("input");
  meanAddValueInput.type = "number";
  meanAddValueInput.step = "0.1";
  meanAddValueInput.min = "0";
  meanAddValueInput.max = "360";
  meanAddValueInput.value = meanAddSlider.value;
  meanAddValueInput.style.width = "50px";
  meanAddValueInput.style.marginLeft = "6px";
  styleField(meanAddValueInput, true);

  meanAddSlider.addEventListener("input", () => {
    const valDeg = parseFloat(meanAddSlider.value);
    paramsMap[id].MPAmp.meanAdd = degreesToRadians(valDeg);
    meanAddValueInput.value = valDeg;
    markParamsChanged();
    notifyAllParamChange();
  });

  meanAddValueInput.addEventListener("input", () => {
    let valDeg = parseFloat(meanAddValueInput.value);
    if (Number.isNaN(valDeg)) valDeg = 0;
    valDeg = Math.min(Math.max(valDeg, 0), 360);
    paramsMap[id].MPAmp.meanAdd = degreesToRadians(valDeg);
    meanAddSlider.value = valDeg;
    markParamsChanged();
    notifyAllParamChange();
  });

  meanAddRow.appendChild(meanAddLabel);
  meanAddRow.appendChild(meanAddSlider);
  meanAddRow.appendChild(meanAddValueInput);
  pane1.appendChild(meanAddRow);

  const filterSectionTitle = document.createElement("div");
  filterSectionTitle.innerText = "MP Filter";
  filterSectionTitle.style.fontSize = "15px";
  filterSectionTitle.style.fontWeight = "600";
  filterSectionTitle.style.letterSpacing = "0.2px";
  filterSectionTitle.style.color = "#ffffff";
  filterSectionTitle.style.lineHeight = "1.25";
  filterSectionTitle.style.marginTop = "6px";
  filterSectionTitle.style.marginBottom = "8px";
  pane1.appendChild(filterSectionTitle);

  const filterTypeRow = document.createElement("div");
  filterTypeRow.className = "pane-c-popup-select-row";
  const filterTypeLabel = document.createElement("span");
  filterTypeLabel.innerText = "Filter Type:";
  const filterTypeSelect = document.createElement("select");
  ["none", "lowpass", "highpass", "bandpass", "bandstop"].forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt;
    option.text = opt;
    filterTypeSelect.appendChild(option);
  });
  filterTypeSelect.value = paramsMap[id]?.MPAmp?.filter_type || "none";
  styleSelect(filterTypeSelect);
  filterTypeSelect.style.background = "rgba(8,12,20,0.92)";
  filterTypeSelect.style.borderColor = "rgba(255,255,255,0.24)";
  filterTypeSelect.style.color = "#f5f6ff";
  filterTypeSelect.addEventListener("change", () => {
    paramsMap[id].MPAmp.filter_type = filterTypeSelect.value;
    updateF2InputState();
    markParamsChanged();
    notifyAllParamChange();
  });
  filterTypeRow.appendChild(filterTypeLabel);
  filterTypeRow.appendChild(filterTypeSelect);
  pane1.appendChild(filterTypeRow);

  const f1Row = document.createElement("div");
  f1Row.className = "pane-c-popup-inputs";
  const f1Label = document.createElement("span");
  f1Label.innerText = "f1:";
  const f1Input = document.createElement("input");
  f1Input.type = "number";
  f1Input.step = "any";
  f1Input.min = "0";
  f1Input.value = paramsMap[id]?.MPAmp?.f1 ?? 1;
  styleField(f1Input);
  f1Input.addEventListener("input", () => {
    paramsMap[id].MPAmp.f1 = Math.max(0, toFiniteNumber(f1Input.value, 1));
    markParamsChanged();
    notifyAllParamChange();
  });
  f1Row.appendChild(f1Label);
  f1Row.appendChild(f1Input);
  pane1.appendChild(f1Row);

  const f2Row = document.createElement("div");
  f2Row.className = "pane-c-popup-inputs";
  const f2Label = document.createElement("span");
  f2Label.innerText = "f2:";
  const f2Input = document.createElement("input");
  f2Input.type = "number";
  f2Input.step = "any";
  f2Input.min = "0";
  f2Input.value = paramsMap[id]?.MPAmp?.f2 ?? 2;
  styleField(f2Input);
  f2Input.addEventListener("input", () => {
    paramsMap[id].MPAmp.f2 = Math.max(0, toFiniteNumber(f2Input.value, 2));
    markParamsChanged();
    notifyAllParamChange();
  });
  f2Row.appendChild(f2Label);
  f2Row.appendChild(f2Input);
  pane1.appendChild(f2Row);

  function updateF2InputState() {
    const t = String(filterTypeSelect.value || "").toLowerCase();
    const enabled = t === "bandpass" || t === "bandstop";
    f2Input.disabled = !enabled;
    f2Input.style.opacity = enabled ? "1" : "0.58";
    f2Input.style.cursor = enabled ? "text" : "not-allowed";
    f2Input.style.background = enabled ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)";
    f2Label.style.opacity = enabled ? "1" : "0.72";
  }

  updateF2InputState();

  const transitionBwRow = document.createElement("div");
  transitionBwRow.className = "pane-c-popup-inputs";
  const transitionBwLabel = document.createElement("span");
  transitionBwLabel.innerText = "Transition Bandwidth:";
  const transitionBwInput = document.createElement("input");
  transitionBwInput.type = "number";
  transitionBwInput.step = "any";
  transitionBwInput.min = "0";
  transitionBwInput.value = paramsMap[id]?.MPAmp?.transition_bw ?? 0;
  styleField(transitionBwInput);
  transitionBwInput.addEventListener("input", () => {
    paramsMap[id].MPAmp.transition_bw = Math.max(
      0,
      toFiniteNumber(transitionBwInput.value, 0)
    );
    markParamsChanged();
    notifyAllParamChange();
  });
  transitionBwRow.appendChild(transitionBwLabel);
  transitionBwRow.appendChild(transitionBwInput);
  pane1.appendChild(transitionBwRow);

  const attenuationRow = document.createElement("div");
  attenuationRow.className = "pane-c-popup-inputs";
  const attenuationLabel = document.createElement("span");
  attenuationLabel.innerText = "Remaining Amplitude Ratio:";
  const attenuationInput = document.createElement("input");
  attenuationInput.type = "number";
  attenuationInput.step = "0.01";
  attenuationInput.min = "0";
  attenuationInput.max = "1";
  attenuationInput.value = paramsMap[id]?.MPAmp?.attenuation_ratio ?? 0.001;
  styleField(attenuationInput);
  attenuationInput.addEventListener("input", () => {
    paramsMap[id].MPAmp.attenuation_ratio = Math.min(
      1,
      Math.max(0, toFiniteNumber(attenuationInput.value, 0.001))
    );
    markParamsChanged();
    notifyAllParamChange();
  });
  attenuationRow.appendChild(attenuationLabel);
  attenuationRow.appendChild(attenuationInput);
  pane1.appendChild(attenuationRow);
  card.appendChild(pane1);

  const pane2 = document.createElement("div");
  pane2.className = "pane-c-popup-pane pane-c-popup-pane-divider";
  pane2.innerHTML = "<h4>V3</h4>";

  if (!isAllTarget) {
    v3Img = document.createElement("img");
    v3Img.style.width = "100%";
    v3Img.style.maxHeight = "none";
    v3Img.style.marginTop = "8px";
    v3Img.style.transformOrigin = "top left";
    v3Img.src = entity?.Ori?.V3Plot || "";
    stylePreviewImage(v3Img, imageStyleOptions);
    const v3Figure = createPdfExportFigure(
      v3Img,
      "Fig.4 V3 Axis Curve",
      `${popupEvents.popupKind || popupKindDefault}_${id}_v3_axis`,
      zoomWrapStyleOptions,
      {
        checked: paramsMap[id]?.plotScale?.v3 !== false,
        onChange: (checked) => {
          ensureMPAmpFilterParams(paramsMap[id]);
          paramsMap[id].plotScale.v3 = checked;
          markParamsChanged();
        },
      }
    );
    scaleCheckboxes.v3 = v3Figure.scaleCheckbox;
    pane2.appendChild(v3Figure);
    addImageVisibilityControl("V3", v3Figure);
  }

  const v3Row = document.createElement("div");
  v3Row.className = "pane-c-popup-inputs";
  const v3Label = document.createElement("span");
  v3Label.innerText = "Amplitude Scale";
  const v3Ratio = document.createElement("input");
  v3Ratio.type = "number";
  v3Ratio.step = "any";
  v3Ratio.min = "0";
  v3Ratio.value = paramsMap[id]?.V3Ratio !== undefined ? paramsMap[id].V3Ratio : 1;
  styleField(v3Ratio);
  v3Ratio.addEventListener("input", () => {
    paramsMap[id].V3Ratio = parseFloat(v3Ratio.value);
    markParamsChanged();
    notifyAllParamChange();
  });

  const v3MeanAddRow = document.createElement("div");
  v3MeanAddRow.className = "pane-c-popup-slider-row";
  const v3MeanAddLabel = document.createElement("span");
  v3MeanAddLabel.innerText = "Mean Addition (V3/BoneLen):";
  const v3MeanAddSlider = document.createElement("input");
  v3MeanAddSlider.type = "range";
  v3MeanAddSlider.min = "-1";
  v3MeanAddSlider.max = "1";
  v3MeanAddSlider.step = "0.01";
  v3MeanAddSlider.value =
    paramsMap[id]?.V3MeanAdd !== undefined ? paramsMap[id].V3MeanAdd : 0;
  styleSlider(v3MeanAddSlider);

  const v3MeanAddValueInput = document.createElement("input");
  v3MeanAddValueInput.type = "number";
  v3MeanAddValueInput.step = "0.01";
  v3MeanAddValueInput.min = "-1";
  v3MeanAddValueInput.max = "1";
  v3MeanAddValueInput.value = v3MeanAddSlider.value;
  v3MeanAddValueInput.style.width = "50px";
  v3MeanAddValueInput.style.marginLeft = "6px";
  styleField(v3MeanAddValueInput, true);

  v3MeanAddSlider.addEventListener("input", () => {
    const val = parseFloat(v3MeanAddSlider.value);
    paramsMap[id].V3MeanAdd = val;
    v3MeanAddValueInput.value = val;
    markParamsChanged();
    notifyAllParamChange();
  });

  v3MeanAddValueInput.addEventListener("input", () => {
    let val = parseFloat(v3MeanAddValueInput.value);
    if (Number.isNaN(val)) val = 0;
    val = Math.min(Math.max(val, -1), 1);
    paramsMap[id].V3MeanAdd = val;
    v3MeanAddSlider.value = val;
    markParamsChanged();
    notifyAllParamChange();
  });

  v3MeanAddRow.appendChild(v3MeanAddLabel);
  v3MeanAddRow.appendChild(v3MeanAddSlider);
  v3MeanAddRow.appendChild(v3MeanAddValueInput);
  v3Row.appendChild(v3Label);
  v3Row.appendChild(v3Ratio);
  pane2.appendChild(v3Row);
  pane2.appendChild(v3MeanAddRow);
  card.appendChild(pane2);

  const pane3 = document.createElement("div");
  pane3.className = "pane-c-popup-pane pane-c-popup-pane-divider";
  pane3.innerHTML = "<h4>Other Functions</h4>";

  const phaseShiftRow = document.createElement("div");
  phaseShiftRow.className = "pane-c-popup-slider-row";
  const phaseShiftLabel = document.createElement("span");
  phaseShiftLabel.innerText = "All Phase Shift:";
  const phaseShiftSlider = document.createElement("input");
  phaseShiftSlider.type = "range";
  phaseShiftSlider.min = "0";
  phaseShiftSlider.max = "1";
  phaseShiftSlider.step = "0.01";
  phaseShiftSlider.value =
    paramsMap[id]?.PhaseShift !== undefined ? paramsMap[id].PhaseShift : 0;
  styleSlider(phaseShiftSlider);

  const phaseShiftValueInput = document.createElement("input");
  phaseShiftValueInput.type = "number";
  phaseShiftValueInput.step = "0.01";
  phaseShiftValueInput.min = "0";
  phaseShiftValueInput.max = "1";
  phaseShiftValueInput.value = phaseShiftSlider.value;
  phaseShiftValueInput.style.width = "50px";
  phaseShiftValueInput.style.marginLeft = "6px";
  styleField(phaseShiftValueInput, true);

  phaseShiftSlider.addEventListener("input", () => {
    const val = parseFloat(phaseShiftSlider.value);
    paramsMap[id].PhaseShift = val;
    phaseShiftValueInput.value = val;
    markParamsChanged();
    notifyAllParamChange();
  });

  phaseShiftValueInput.addEventListener("input", () => {
    let val = parseFloat(phaseShiftValueInput.value);
    if (Number.isNaN(val)) val = 0;
    val = Math.min(Math.max(val, 0), 1);
    paramsMap[id].PhaseShift = val;
    phaseShiftSlider.value = val;
    markParamsChanged();
    notifyAllParamChange();
  });

  phaseShiftRow.appendChild(phaseShiftLabel);
  phaseShiftRow.appendChild(phaseShiftSlider);
  phaseShiftRow.appendChild(phaseShiftValueInput);
  pane3.appendChild(phaseShiftRow);

  const supportsFrequency = popupKind === "skeleton" || popupKind === "pld";
  let frequencyScaleInput = null;
  let frequencyHzInput = null;
  let frequencyMaxHzInput = null;
  let frequencyMinCorrelationInput = null;
  let keepOriginalLengthInput = null;
  let frequencyWarning = null;
  if (supportsFrequency) {
    const frequencyScaleRow = document.createElement("div");
    frequencyScaleRow.className = "pane-c-popup-inputs";
    const frequencyScaleLabel = document.createElement("span");
    frequencyScaleLabel.innerText = "Frequency Scale:";
    frequencyScaleInput = document.createElement("input");
    frequencyScaleInput.type = "number";
    frequencyScaleInput.step = "any";
    frequencyScaleInput.min = "0.01";
    styleField(frequencyScaleInput);

    const frequencyMaxHzButton = document.createElement("button");
    frequencyMaxHzButton.type = "button";
    frequencyMaxHzButton.innerText = "Max Detect Hz";
    frequencyMaxHzButton.title = "Show or hide the maximum fundamental frequency used by autocorrelation.";
    frequencyMaxHzInput = document.createElement("input");
    frequencyMaxHzInput.type = "number";
    frequencyMaxHzInput.step = "0.1";
    frequencyMaxHzInput.min = "0.01";
    frequencyMaxHzInput.max = "15";
    frequencyMaxHzInput.style.display = "none";
    frequencyMaxHzInput.style.width = "68px";
    styleField(frequencyMaxHzInput, true);
    frequencyMaxHzButton.addEventListener("click", () => {
      frequencyMaxHzInput.style.display = frequencyMaxHzInput.style.display === "none" ? "" : "none";
    });

    const frequencyMinCorrelationButton = document.createElement("button");
    frequencyMinCorrelationButton.type = "button";
    frequencyMinCorrelationButton.innerText = "Min Corr";
    frequencyMinCorrelationButton.title = "Show or hide the minimum normalized autocorrelation peak.";
    frequencyMinCorrelationInput = document.createElement("input");
    frequencyMinCorrelationInput.type = "number";
    frequencyMinCorrelationInput.step = "0.01";
    frequencyMinCorrelationInput.min = "0";
    frequencyMinCorrelationInput.max = "1";
    frequencyMinCorrelationInput.style.display = "none";
    frequencyMinCorrelationInput.style.width = "62px";
    styleField(frequencyMinCorrelationInput, true);
    frequencyMinCorrelationButton.addEventListener("click", () => {
      frequencyMinCorrelationInput.style.display = frequencyMinCorrelationInput.style.display === "none" ? "" : "none";
    });

    const frequencyHzRow = document.createElement("div");
    frequencyHzRow.className = "pane-c-popup-inputs";
    const frequencyHzLabel = document.createElement("span");
    frequencyHzLabel.innerText = "Frequency (Hz):";
    frequencyHzInput = document.createElement("input");
    frequencyHzInput.type = "number";
    frequencyHzInput.step = "any";
    frequencyHzInput.min = "0.01";
    styleField(frequencyHzInput);

    const keepOriginalLengthRow = document.createElement("label");
    keepOriginalLengthRow.className = "pane-c-popup-inputs";
    keepOriginalLengthRow.style.cursor = "pointer";
    const keepOriginalLengthText = document.createElement("span");
    keepOriginalLengthText.innerText = "KeepOriginalLength";
    keepOriginalLengthInput = document.createElement("input");
    keepOriginalLengthInput.type = "checkbox";
    keepOriginalLengthInput.checked = paramsMap[id]?.KeepOriginalLength !== false;
    keepOriginalLengthInput.style.accentColor = "#6f95ff";

    frequencyWarning = document.createElement("div");
    frequencyWarning.style.color = "#ffb86c";
    frequencyWarning.style.fontSize = "12px";
    frequencyWarning.style.lineHeight = "1.35";

    const getFrequencyEstimate = () => entity?.FrequencyEstimate;
    const notifyFrequencyEstimateConfigChange = () => {
      popupEvents.onFrequencyEstimateConfigChange?.({
        maxFundamentalHz: paramsMap[id].FrequencyMaxHz ?? 5,
        minPeakCorrelation: paramsMap[id].FrequencyMinCorrelation ?? 0.5,
      });
    };
    const updateFrequencyHz = () => {
      const estimate = getFrequencyEstimate();
      const f0 = Number(estimate?.fundamentalHz);
      const reliable = !isAllTarget && estimate?.reliable === true && Number.isFinite(f0) && f0 > 0;
      frequencyHzInput.disabled = !reliable;
      frequencyHzInput.style.opacity = reliable ? "1" : "0.58";
      frequencyHzInput.style.cursor = reliable ? "text" : "not-allowed";
      frequencyWarning.style.display = reliable ? "none" : "block";
      frequencyWarning.innerText = reliable
        ? ""
        : (estimate?.warning || "Frequency is non-periodic or unreliable; use Frequency Scale.");
      frequencyHzInput.value = reliable
        ? String((Number(paramsMap[id]?.FrequencyScale) || 1) * f0)
        : "";
    };

    frequencyScaleInput.addEventListener("input", () => {
      const scale = Number(frequencyScaleInput.value);
      if (!Number.isFinite(scale) || scale <= 0) return;
      paramsMap[id].FrequencyScale = scale;
      updateFrequencyHz();
      markParamsChanged();
      notifyAllParamChange();
    });
    frequencyHzInput.addEventListener("input", () => {
      const f0 = Number(getFrequencyEstimate()?.fundamentalHz);
      const targetHz = Number(frequencyHzInput.value);
      if (!(f0 > 0) || !(targetHz > 0)) return;
      const scale = targetHz / f0;
      paramsMap[id].FrequencyScale = scale;
      frequencyScaleInput.value = String(scale);
      markParamsChanged();
      notifyAllParamChange();
    });
    keepOriginalLengthInput.addEventListener("change", () => {
      paramsMap[id].KeepOriginalLength = keepOriginalLengthInput.checked;
      markParamsChanged();
      notifyAllParamChange();
    });
    frequencyMaxHzInput.addEventListener("input", () => {
      const maxHz = Math.min(15, Math.max(0.01, Number(frequencyMaxHzInput.value) || 5));
      paramsMap[id].FrequencyMaxHz = maxHz;
      notifyFrequencyEstimateConfigChange();
      updateFrequencyHz();
      markParamsChanged();
      notifyAllParamChange();
    });
    frequencyMinCorrelationInput.addEventListener("input", () => {
      const threshold = Math.min(
        1,
        Math.max(0, Number(frequencyMinCorrelationInput.value) || 0)
      );
      paramsMap[id].FrequencyMinCorrelation = threshold;
      notifyFrequencyEstimateConfigChange();
      updateFrequencyHz();
      markParamsChanged();
      notifyAllParamChange();
    });

    frequencyScaleRow.appendChild(frequencyScaleLabel);
    frequencyScaleRow.appendChild(frequencyScaleInput);
    frequencyScaleRow.appendChild(frequencyMaxHzButton);
    frequencyScaleRow.appendChild(frequencyMaxHzInput);
    frequencyScaleRow.appendChild(frequencyMinCorrelationButton);
    frequencyScaleRow.appendChild(frequencyMinCorrelationInput);
    frequencyHzRow.appendChild(frequencyHzLabel);
    frequencyHzRow.appendChild(frequencyHzInput);
    keepOriginalLengthRow.appendChild(keepOriginalLengthText);
    keepOriginalLengthRow.appendChild(keepOriginalLengthInput);
    pane3.appendChild(frequencyScaleRow);
    pane3.appendChild(frequencyHzRow);
    pane3.appendChild(frequencyWarning);
    frequencyHzInput.updateFromEstimate = updateFrequencyHz;
  }
  card.appendChild(pane3);

  function updateReferenceLabels() {
    const mode = normalizeMotionReferenceMode(paramsMap[id]?.referenceMode);
    const additionName = mode === MOTION_REFERENCE_MODE.START_POINT
      ? "StartPoint Addition"
      : mode === MOTION_REFERENCE_MODE.START_END
        ? "Start-End Addition"
        : "Mean Addition";
    meanAddLabel.innerText = `${additionName} (deg):`;
    v3MeanAddLabel.innerText = `${additionName} (V3/BoneLen):`;
  }

  function syncControlsFromCurrentParams() {
    const p = paramsMap[id];
    if (!p) return;
    ensureMPAmpFilterParams(p);
    Object.entries(scaleCheckboxes).forEach(([key, checkbox]) => {
      if (checkbox) checkbox.checked = p.plotScale?.[key] !== false;
    });
    referenceInputs.forEach((radio) => {
      radio.checked = radio.value === p.referenceMode;
    });
    updateReferenceLabels();
    input.value = p.MPAmp.ampScale;
    meanAddSlider.value = radiansToDegrees(p.MPAmp.meanAdd);
    meanAddValueInput.value = meanAddSlider.value;
    filterTypeSelect.value = p.MPAmp.filter_type;
    f1Input.value = p.MPAmp.f1;
    f2Input.value = p.MPAmp.f2;
    updateF2InputState();
    transitionBwInput.value = p.MPAmp.transition_bw;
    attenuationInput.value = p.MPAmp.attenuation_ratio;
    v3Ratio.value = p.V3Ratio;
    v3MeanAddSlider.value = p.V3MeanAdd;
    v3MeanAddValueInput.value = v3MeanAddSlider.value;
    phaseShiftSlider.value = p.PhaseShift;
    phaseShiftValueInput.value = phaseShiftSlider.value;
    if (frequencyScaleInput) {
      frequencyScaleInput.value = p.FrequencyScale ?? 1;
      frequencyMaxHzInput.value = p.FrequencyMaxHz ?? 5;
      frequencyMinCorrelationInput.value = p.FrequencyMinCorrelation ?? 0.5;
      keepOriginalLengthInput.checked = p.KeepOriginalLength !== false;
      frequencyHzInput.updateFromEstimate();
    }
  }

  function resetPreviewToOrigin() {
    if (isAllTarget) return;
    if (angleImg) angleImg.src = entity?.Ori?.MPAnglePlot || "";
    if (fftImg) fftImg.src = entity?.Ori?.MPSpectrumPlot || "";
    if (fourierImg) fourierImg.src = entity?.Ori?.MPFourierPlot || "";
    if (v3Img) v3Img.src = entity?.Ori?.V3Plot || "";
  }

  function refreshPreviewFromEntity(preferOrigin = false) {
    if (isAllTarget) return;

    const angleDataUrl = preferOrigin
      ? (entity?.Ori?.MPAnglePlot || "")
      : (entity?.New?.MPAnglePlot || entity?.Ori?.MPAnglePlot || "");
    const spectrumDataUrl = preferOrigin
      ? (entity?.Ori?.MPSpectrumPlot || "")
      : (entity?.New?.SpectrumPlot || entity?.New?.MPSpectrumPlot || entity?.Ori?.MPSpectrumPlot || "");
    const fourierDataUrl = preferOrigin
      ? (entity?.Ori?.MPFourierPlot || "")
      : (entity?.New?.MPFourierPlot || entity?.Ori?.MPFourierPlot || "");
    const v3DataUrl = preferOrigin
      ? (entity?.Ori?.V3Plot || "")
      : (entity?.New?.V3Plot || entity?.Ori?.V3Plot || "");

    if (angleImg && angleDataUrl) angleImg.src = angleDataUrl;
    if (fftImg && spectrumDataUrl) fftImg.src = spectrumDataUrl;
    if (fourierImg && fourierDataUrl) fourierImg.src = fourierDataUrl;
    if (v3Img && v3DataUrl) v3Img.src = v3DataUrl;
  }

  const pane4 = document.createElement("div");
  pane4.className = "pane-c-popup-actions";
  paramsChangedHint = document.createElement("span");
  paramsChangedHint.innerText = "*Params have been changed.";
  paramsChangedHint.style.color = "#ff6b6b";
  paramsChangedHint.style.fontSize = "12px";
  paramsChangedHint.style.marginRight = "auto";
  paramsChangedHint.style.display = "none";

  const generateBtn = document.createElement("button");
  generateBtn.innerText = "Generate";
  let isGenerating = false;
  generateBtn.addEventListener("click", async () => {
    if (isGenerating) return;
    isGenerating = true;
    generateBtn.disabled = true;
    generateBtn.innerText = "Generating...";
    try {
      if (isAllTarget) {
        await popupEvents.onGenerateAll?.();
        clearParamsChanged();
        return;
      }
      await api.generate();
    } catch (error) {
      console.error("Failed to generate motion:", error);
    } finally {
      isGenerating = false;
      generateBtn.disabled = false;
      generateBtn.innerText = "Generate";
    }
  });

  const initializeBtn = document.createElement("button");
  initializeBtn.innerText = "Initialize";
  initializeBtn.addEventListener("click", () => {
    if (isAllTarget) {
      paramsMap[id] = deepClone(originalParamsMap[id]);
      syncControlsFromCurrentParams();
      notifyAllParamChange();
      popupEvents.onInitializeAll?.();
      clearParamsChanged();
      return;
    }
    api.initialize();
  });

  pane4.appendChild(paramsChangedHint);
  pane4.appendChild(generateBtn);
  pane4.appendChild(initializeBtn);
  card.appendChild(pane4);
  mountTarget.appendChild(card);

  const api = {
    element: card,
    input,
    show: () => {
      syncControlsFromCurrentParams();
      card.style.display = "";
      generalTargetSelectorApi?.refresh?.();
      if (isAllTarget && mountTarget) {
        card.style.order = "-999";
        if (card.parentElement === mountTarget) {
          mountTarget.prepend(card);
        }
      }
      if (!isFloating) card.scrollIntoView({ behavior: "smooth", block: "start" });
      popupEvents.onShow?.(entity);
    },
    hide: () => {
      card.style.display = "none";
      popupEvents.onHide?.(entity);
    },
    renew: () => {
      if (typeof onRenew === "function") {
        onRenew({ entity, paramsMap, input, syncControlsFromCurrentParams });
        return;
      }
      input.value = 1;
      paramsMap[id].AmplitudeScale = 1;
      syncControlsFromCurrentParams();
    },
    setParams: (params) => {
      if (!params) return;
      if (assignParamsOnSet) {
        paramsMap[id] = deepClone(params);
      }
      syncControlsFromCurrentParams();
    },
    generate: async () => {
      if (isAllTarget) return;
      await onGenerateSingle?.({ entity, paramsMap, api });
      refreshPreviewFromEntity(false);
      clearParamsChanged();
    },
    initialize: async () => {
      paramsMap[id] = deepClone(originalParamsMap[id]);
      if (frequencyMaxHzInput) {
        popupEvents.onFrequencyEstimateConfigChange?.({
          maxFundamentalHz: paramsMap[id].FrequencyMaxHz ?? 5,
          minPeakCorrelation: paramsMap[id].FrequencyMinCorrelation ?? 0.5,
        });
      }
      syncControlsFromCurrentParams();
      resetPreviewToOrigin();
      await onInitializeSingle?.({
        entity,
        paramsMap,
        originalParamsMap,
        api,
        syncControlsFromCurrentParams,
        resetPreviewToOrigin,
      });
      refreshPreviewFromEntity(false);
      clearParamsChanged();
    },
    getValue: () => parseFloat(input.value),
    setAngleImage: (dataUrl) => {
      if (angleImg) angleImg.src = dataUrl;
    },
    setSpectrumImage: (dataUrl) => {
      if (fftImg) fftImg.src = dataUrl;
    },
    setFourierImage: (dataUrl) => {
      if (fourierImg) fourierImg.src = dataUrl;
    },
    setV3Image: (dataUrl) => {
      if (v3Img) v3Img.src = dataUrl;
    },
    restoreToList,
    destroy: () => {
      generalTargetSelectorApi?.destroy?.();
      card.remove();
    },
  };

  if (!isAllTarget) {
    registerPlotPopupUpdater(popupEvents.popupKind || popupKindDefault, id, {
      setAngleImage: api.setAngleImage,
      setSpectrumImage: api.setSpectrumImage,
      setFourierImage: api.setFourierImage,
      setV3Image: api.setV3Image,
    });
  }

  syncControlsFromCurrentParams();
  card.api = api;
  return api;
}
