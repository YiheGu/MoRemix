export function buildNiceAxis(values, targetIntervals = 5, options = {}) {
  const finiteValues = Array.from(values || [], Number).filter(Number.isFinite);
  let dataMin = finiteValues.length > 0 ? Math.min(...finiteValues) : 0;
  let dataMax = finiteValues.length > 0 ? Math.max(...finiteValues) : 1;

  if (options.includeZero) {
    dataMin = Math.min(0, dataMin);
    dataMax = Math.max(0, dataMax);
  }
  if (dataMin === dataMax) {
    const padding = dataMin === 0 ? 0.5 : Math.max(Math.abs(dataMin) * 0.1, 0.1);
    dataMin -= padding;
    dataMax += padding;
  }

  const span = dataMax - dataMin;
  let step = niceStep(span / Math.max(1, targetIntervals), options.stepMode);
  // Academic figures are easier to scan with integer labels. Only use decimal
  // steps when the measured span itself is too small for useful integer ticks.
  if (options.preferInteger !== false && span >= 1 && step < 1) step = 1;

  let min = Math.floor(dataMin / step) * step;
  let max = Math.ceil(dataMax / step) * step;
  if (options.includeZero) min = 0;
  if (max <= min) max = min + step;

  const count = Math.max(1, Math.round((max - min) / step));
  const ticks = Array.from({ length: count + 1 }, (_, index) => normalizeFloat(min + index * step));
  return { min: normalizeFloat(min), max: normalizeFloat(max), step, ticks };
}

export function formatNiceTick(value, step) {
  if (Math.abs(step) >= 1) return String(Math.round(value));
  const decimals = Math.min(6, Math.max(1, Math.ceil(-Math.log10(Math.abs(step)))));
  return Number(value.toFixed(decimals)).toString();
}

export function expandAxisToValues(axis, values, options = {}) {
  const finiteValues = Array.from(values || [], Number).filter(Number.isFinite);
  if (finiteValues.length === 0) return axis;
  let min = Math.min(axis.min, ...finiteValues);
  let max = Math.max(axis.max, ...finiteValues);
  min = options.includeZero ? 0 : Math.floor(min / axis.step) * axis.step;
  max = Math.ceil(max / axis.step) * axis.step;
  const count = Math.max(1, Math.round((max - min) / axis.step));
  return {
    min: normalizeFloat(min),
    max: normalizeFloat(max),
    step: axis.step,
    ticks: Array.from({ length: count + 1 }, (_, index) => normalizeFloat(min + index * axis.step)),
  };
}

export function getAdaptiveTimeMax(originTimes, newTimes, requestedMax, valueCount) {
  const finiteTimes = [...(originTimes || []), ...(newTimes || [])]
    .map(Number)
    .filter(Number.isFinite);
  if (finiteTimes.length > 0) return Math.max(0, ...finiteTimes, 1e-6);
  const configuredMax = Number(requestedMax);
  if (Number.isFinite(configuredMax) && configuredMax >= 0) {
    return Math.max(configuredMax, 1e-6);
  }
  return Math.max(0, Number(valueCount) - 1, 1e-6);
}

function niceStep(rawStep, mode = "ceil") {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const exponent = Math.floor(Math.log10(rawStep));
  const magnitude = 10 ** exponent;
  const fraction = rawStep / magnitude;
  if (mode === "nearest") {
    const candidates = [1, 2, 5, 10];
    const nearest = candidates.reduce((best, candidate) => (
      Math.abs(candidate - fraction) < Math.abs(best - fraction) ? candidate : best
    ), candidates[0]);
    return nearest * magnitude;
  }
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * magnitude;
}

function normalizeFloat(value) {
  return Number(value.toPrecision(12));
}
