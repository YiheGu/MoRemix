import { getIFFT } from "./getIFFT";
import { getFFT, getNormalizedSpectrumAmp } from "./getFFT";
import { applyMPFrequencyFilter } from "./applyMPFrequencyFilter";
import { deepClone } from "./deepClone";
import {
    getOriginalMPFFTResult,
    removeStartEndBaseline,
    usesStartEndReference,
    usesStartPointReference,
} from "./motionReference";

export function setBoneMPAmp(targetBoneParams, targetBone){
    // This function set New.MPAngle

    // Read Parameters
    const mpAmpParams = targetBoneParams?.MPAmp || {};
    const ampScaleRaw = Number(mpAmpParams.ampScale);
    const ampScale = Number.isFinite(ampScaleRaw) ? ampScaleRaw : 1;
    
    // Start every generation from the selected original decomposition.
    const sourceFFT = getOriginalMPFFTResult(targetBone, targetBoneParams);
    targetBone.New.MPFFTResult = deepClone(sourceFFT);

    // Amplitude scaling
    targetBone.New.MPFFTResult.Y = sourceFFT.Y.map(([re, im]) => [re * ampScale, im * ampScale]);

    // Frequency-domain filtering
    applyMPFrequencyFilter(targetBone.New.MPFFTResult, mpAmpParams);

    // Y manipulation finished
    // Update amp&angle with newY
    targetBone.New.MPFFTResult.amp = getNormalizedSpectrumAmp(
        targetBone.New.MPFFTResult.Y,
        targetBone.New.MPFFTResult.oriTrackLength
    );
    targetBone.New.MPFFTResult.angle = targetBone.New.MPFFTResult.Y.map(([re, im]) => Math.atan2(im, re));
    // IFFT to get new MPAmp
    targetBone.New.MPAmp = getIFFT(targetBone.New.MPFFTResult.Y, targetBone.New.MPFFTResult.oriTrackLength);

    // Filtering can displace reference endpoints; restore the selected anchor.
    if (usesStartPointReference(targetBoneParams) && targetBone.New.MPAmp.length > 0) {
        const firstValue = targetBone.New.MPAmp[0];
        targetBone.New.MPAmp = targetBone.New.MPAmp.map(value => value - firstValue);
        targetBone.New.MPFFTResult = getFFT(targetBone.New.MPAmp, targetBone.sample_freq);
    } else if (usesStartEndReference(targetBoneParams) && targetBone.New.MPAmp.length > 0) {
        targetBone.New.MPAmp = removeStartEndBaseline(targetBone.New.MPAmp);
        targetBone.New.MPFFTResult = getFFT(targetBone.New.MPAmp, targetBone.sample_freq);
    }
};
