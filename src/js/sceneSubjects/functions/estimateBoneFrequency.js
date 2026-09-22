export function estimateBoneFrequency(
    angleTrack = [],
    sampleFreq = 30,
    maxFundamentalHz = 5,
    minPeakCorrelation = 0.5
) {
    const values = (Array.isArray(angleTrack) ? angleTrack : [])
        .map(value => Number(value))
        .filter(value => Number.isFinite(value));
    const fs = Number(sampleFreq) || 30;
    const requestedMaxHz = Number(maxFundamentalHz);
    const safeMaxHz = Math.min(
        fs / 2,
        Math.max(Number.EPSILON, Number.isFinite(requestedMaxHz) ? requestedMaxHz : 5)
    );
    const requestedMinCorrelation = Number(minPeakCorrelation);
    const safeMinCorrelation = Math.min(
        1,
        Math.max(0, Number.isFinite(requestedMinCorrelation) ? requestedMinCorrelation : 0.5)
    );

    if (values.length < 8) return createUnavailableResult([], safeMaxHz, safeMinCorrelation);

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const centered = values.map(value => value - mean);
    const energy = centered.reduce((sum, value) => sum + value * value, 0);
    if (energy <= 1e-12) return createUnavailableResult([], safeMaxHz, safeMinCorrelation);

    const minLag = Math.max(2, Math.ceil(fs / safeMaxHz));
    const maxLag = Math.floor((centered.length - 1) / 2);
    if (maxLag < minLag) return createUnavailableResult([], safeMaxHz, safeMinCorrelation);

    const autocorrelation = [];
    for (let lag = 0; lag <= maxLag; lag++) {
        let numerator = 0;
        let energyA = 0;
        let energyB = 0;
        const count = centered.length - lag;
        for (let i = 0; i < count; i++) {
            const a = centered[i];
            const b = centered[i + lag];
            numerator += a * b;
            energyA += a * a;
            energyB += b * b;
        }
        const denominator = Math.sqrt(energyA * energyB);
        autocorrelation.push(denominator > 0 ? numerator / denominator : 0);
    }

    let periodFrames = null;
    let peakCorrelation = null;
    for (let lag = minLag; lag <= maxLag; lag++) {
        const value = autocorrelation[lag];
        if (
            value >= safeMinCorrelation
            && value >= autocorrelation[lag - 1]
            && (lag === maxLag || value > autocorrelation[lag + 1])
        ) {
            periodFrames = lag;
            peakCorrelation = value;
            break;
        }
    }

    if (!periodFrames) {
        return createUnavailableResult(autocorrelation, safeMaxHz, safeMinCorrelation);
    }

    return {
        reliable: true,
        fundamentalHz: fs / periodFrames,
        periodFrames,
        periodSeconds: periodFrames / fs,
        peakCorrelation,
        autocorrelation,
        maxFundamentalHz: safeMaxHz,
        minPeakCorrelation: safeMinCorrelation,
        warning: "",
    };
}

function createUnavailableResult(
    autocorrelation = [],
    maxFundamentalHz = 5,
    minPeakCorrelation = 0.5
) {
    return {
        reliable: false,
        fundamentalHz: null,
        periodFrames: null,
        periodSeconds: null,
        peakCorrelation: null,
        autocorrelation,
        maxFundamentalHz,
        minPeakCorrelation,
        warning: "Fundamental frequency could not be reliably estimated. The motion may be non-periodic.",
    };
}
