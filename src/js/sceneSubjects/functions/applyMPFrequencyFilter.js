function rc1to0(x) {
    const clamped = Math.min(1, Math.max(0, Number(x) || 0));
    return 0.5 * (1 + Math.cos(Math.PI * clamped));
}

function toFiniteNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function parseFilterSpec(params = {}) {
    const filterTypeRaw = String(params.filter_type || "").trim().toLowerCase();
    let filterType = filterTypeRaw || "none";
    let f1 = toFiniteNumber(params.f1, 1);
    let f2 = toFiniteNumber(params.f2, 2);
    let transitionBw = Math.max(0, toFiniteNumber(params.transition_bw, 0));
    const attenuationRatio = Math.min(1, Math.max(0, toFiniteNumber(params.attenuation_ratio, 0.001)));
    const supported = new Set(["none", "lowpass", "highpass", "bandpass", "bandstop"]);
    if (!supported.has(filterType)) filterType = "none";

    if (f2 < f1) {
        const t = f1;
        f1 = f2;
        f2 = t;
    }

    return {
        filterType,
        f1: Math.max(0, f1),
        f2: Math.max(0, f2),
        transitionBw,
        attenuationRatio,
    };
}

function applyTransferAtFreq(absFreq, spec) {
    const floor = spec.attenuationRatio;
    const bw = spec.transitionBw;

    switch (spec.filterType) {
        case "lowpass": {
            const fc = spec.f1;
            if (absFreq <= fc) return 1;
            if (bw > 0 && absFreq <= fc + bw) {
                const x = (absFreq - fc) / bw;
                return floor + (1 - floor) * rc1to0(x);
            }
            return floor;
        }
        case "highpass": {
            const fc = spec.f1;
            if (absFreq <= fc) return floor;
            if (bw > 0 && absFreq <= fc + bw) {
                const x = (absFreq - fc) / bw;
                return floor + (1 - floor) * (1 - rc1to0(x));
            }
            return 1;
        }
        case "bandpass": {
            const left = spec.f1;
            const right = spec.f2;
            if (absFreq >= left && absFreq <= right) return 1;

            if (bw > 0 && absFreq >= Math.max(0, left - bw) && absFreq < left) {
                const x = (absFreq - (left - bw)) / bw;
                return floor + (1 - floor) * (1 - rc1to0(x));
            }
            if (bw > 0 && absFreq > right && absFreq <= right + bw) {
                const x = (absFreq - right) / bw;
                return floor + (1 - floor) * rc1to0(x);
            }
            return floor;
        }
        case "bandstop": {
            const left = spec.f1;
            const right = spec.f2;
            if (absFreq >= left && absFreq <= right) return floor;

            if (bw > 0 && absFreq >= Math.max(0, left - bw) && absFreq < left) {
                const x = (absFreq - (left - bw)) / bw;
                return floor + (1 - floor) * rc1to0(x);
            }
            if (bw > 0 && absFreq > right && absFreq <= right + bw) {
                const x = (absFreq - right) / bw;
                return floor + (1 - floor) * (1 - rc1to0(x));
            }
            return 1;
        }
        default:
            return 1;
    }
}

export function applyMPFrequencyFilter(fftResult, mpAmpParams = {}) {
    if (!fftResult?.Y || !Array.isArray(fftResult.Y)) return;
    const spec = parseFilterSpec(mpAmpParams);

    if (spec.filterType === "none") {
        return;
    }

    const f = Array.isArray(fftResult.f) ? fftResult.f : [];
    fftResult.Y = fftResult.Y.map(([re, im], i) => {
        const freq = toFiniteNumber(f[i], 0);
        const gain = applyTransferAtFreq(Math.abs(freq), spec);
        return [re * gain, im * gain];
    });
}
