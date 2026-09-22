import { getIFFT } from "../getIFFT";
import { getFFT, getNormalizedSpectrumAmp } from "../getFFT";
import { applyMPFrequencyFilter } from "../applyMPFrequencyFilter";
import { deepClone } from "../deepClone";
import {
    getOriginalMPFFTResult,
    removeStartEndBaseline,
    usesStartEndReference,
    usesStartPointReference,
} from "../motionReference";

export function setPldMPAmp(targetPldParams, targetPld){
    // This function set New.MPAmp
    
    // Read Parameters
    const mpAmpParams = targetPldParams?.MPAmp || {};
    const ampScaleRaw = Number(mpAmpParams.ampScale);
    const ampScale = Number.isFinite(ampScaleRaw) ? ampScaleRaw : 1;

    // Start every generation from the selected original decomposition.
    const sourceFFT = getOriginalMPFFTResult(targetPld, targetPldParams);
    targetPld.New.MPFFTResult = deepClone(sourceFFT);

    // Amplitude scaling
    targetPld.New.MPFFTResult.Y = sourceFFT.Y.map(([re, im]) => [re * ampScale, im * ampScale]);
    
    // Frequency-domain filtering
    applyMPFrequencyFilter(targetPld.New.MPFFTResult, mpAmpParams);


    // Y manipulation finished
    // Update amp&angle with newY
    targetPld.New.MPFFTResult.amp = getNormalizedSpectrumAmp(
        targetPld.New.MPFFTResult.Y,
        targetPld.New.MPFFTResult.oriTrackLength
    );
    targetPld.New.MPFFTResult.angle = targetPld.New.MPFFTResult.Y.map(([re, im]) => Math.atan2(im, re));
    // IFFT to get new MPAmp
    targetPld.New.MPAmp = getIFFT(targetPld.New.MPFFTResult.Y, targetPld.New.MPFFTResult.oriTrackLength);

    // Filtering can displace reference endpoints; restore the selected anchor.
    if (usesStartPointReference(targetPldParams) && targetPld.New.MPAmp.length > 0) {
        const firstValue = targetPld.New.MPAmp[0];
        targetPld.New.MPAmp = targetPld.New.MPAmp.map(value => value - firstValue);
        targetPld.New.MPFFTResult = getFFT(targetPld.New.MPAmp, targetPld.sample_freq);
    } else if (usesStartEndReference(targetPldParams) && targetPld.New.MPAmp.length > 0) {
        targetPld.New.MPAmp = removeStartEndBaseline(targetPld.New.MPAmp);
        targetPld.New.MPFFTResult = getFFT(targetPld.New.MPAmp, targetPld.sample_freq);
    }
}
