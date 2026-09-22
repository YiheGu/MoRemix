import { getFFT } from "./getFFT";

export const MOTION_REFERENCE_MODE = Object.freeze({
    MEAN: "mean",
    START_POINT: "startPoint",
    START_END: "startEnd",
});

export function normalizeMotionReferenceMode(value) {
    const supportedModes = new Set(Object.values(MOTION_REFERENCE_MODE));
    return supportedModes.has(value) ? value : MOTION_REFERENCE_MODE.MEAN;
}

export function usesStartPointReference(params) {
    return normalizeMotionReferenceMode(params?.referenceMode) === MOTION_REFERENCE_MODE.START_POINT;
}

export function usesStartEndReference(params) {
    return normalizeMotionReferenceMode(params?.referenceMode) === MOTION_REFERENCE_MODE.START_END;
}

function firstFinite(values = [], fallback = 0) {
    const value = Number(values?.[0]);
    return Number.isFinite(value) ? value : fallback;
}

export function createStartEndBaseline(values = [], fallback = 0) {
    if (!Array.isArray(values) || values.length === 0) return [];
    const start = firstFinite(values, fallback);
    const endValue = Number(values[values.length - 1]);
    const end = Number.isFinite(endValue) ? endValue : start;
    if (values.length === 1) return [start];
    return values.map((_, index) => start + (end - start) * index / (values.length - 1));
}

export function removeStartEndBaseline(values = []) {
    const baseline = createStartEndBaseline(values);
    return values.map((value, index) => value - baseline[index]);
}

export function addReferenceOffset(reference, offset = 0) {
    const safeOffset = Number(offset) || 0;
    return Array.isArray(reference)
        ? reference.map(value => value + safeOffset)
        : (Number(reference) || 0) + safeOffset;
}

export function referenceValueAt(reference, index) {
    if (!Array.isArray(reference)) return Number(reference) || 0;
    const value = Number(reference[index]);
    return Number.isFinite(value) ? value : 0;
}

export function addAlternativeReferenceData(data, sampleFreq) {
    if (!data) return data;

    const mpAngle = Array.isArray(data.MPAngle) ? data.MPAngle : [];
    data.MPStartPoint = firstFinite(mpAngle, Number(data.MPMean) || 0);
    data.MPAmpFromStart = mpAngle.map((value) => value - data.MPStartPoint);
    data.MPFFTResultFromStart = getFFT(data.MPAmpFromStart, sampleFreq);
    data.MPStartEndBaseline = createStartEndBaseline(mpAngle, data.MPStartPoint);
    data.MPAmpFromStartEnd = mpAngle.map((value, index) => value - data.MPStartEndBaseline[index]);
    data.MPFFTResultFromStartEnd = getFFT(data.MPAmpFromStartEnd, sampleFreq);

    const v3Loc = Array.isArray(data.V3Loc) ? data.V3Loc : [];
    data.V3StartPoint = firstFinite(v3Loc, Number(data.V3Mean) || 0);
    data.V3AmpFromStart = v3Loc.map((value) => value - data.V3StartPoint);
    data.V3StartEndBaseline = createStartEndBaseline(v3Loc, data.V3StartPoint);
    data.V3AmpFromStartEnd = v3Loc.map((value, index) => value - data.V3StartEndBaseline[index]);

    return data;
}

// Retain the earlier export for compatibility with any external imports.
export const addStartPointReferenceData = addAlternativeReferenceData;

export function getOriginalMPReference(entity, params) {
    const ori = entity?.Ori || {};
    if (usesStartEndReference(params)) return ori.MPStartEndBaseline || [];
    return usesStartPointReference(params)
        ? Number(ori.MPStartPoint) || 0
        : Number(ori.MPMean) || 0;
}

export function getOriginalMPAmplitude(entity, params) {
    const ori = entity?.Ori || {};
    const values = usesStartEndReference(params)
        ? ori.MPAmpFromStartEnd
        : usesStartPointReference(params) ? ori.MPAmpFromStart : ori.MPAmp;
    return Array.isArray(values) ? values : [];
}

export function getOriginalMPFFTResult(entity, params) {
    const ori = entity?.Ori || {};
    if (usesStartEndReference(params)) return ori.MPFFTResultFromStartEnd;
    return usesStartPointReference(params) ? ori.MPFFTResultFromStart : ori.MPFFTResult;
}

export function getOriginalV3Reference(entity, params) {
    const ori = entity?.Ori || {};
    if (usesStartEndReference(params)) return ori.V3StartEndBaseline || [];
    return usesStartPointReference(params)
        ? Number(ori.V3StartPoint) || 0
        : Number(ori.V3Mean) || 0;
}

export function getOriginalV3Amplitude(entity, params) {
    const ori = entity?.Ori || {};
    const values = usesStartEndReference(params)
        ? ori.V3AmpFromStartEnd
        : usesStartPointReference(params) ? ori.V3AmpFromStart : ori.V3Amp;
    return Array.isArray(values) ? values : [];
}
