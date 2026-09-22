import * as THREE from 'three';
import { deepClone } from "../deepClone";
import { getIFFT } from "../getIFFT";
import { updateQuatTrack } from "../updateQuatTrack";
import { plotAngleTrack } from '../debug/plotAngleTrack';
import { plotSpectrum } from '../debug/plotSpectrum';
import { getFFT } from '../getFFT';
import { plotNewPspaceLoc } from '../debug/plotNewPspaceLoc';
import { updatePosTrack } from './updatePosTrack';

export function setPldAmpScale(allPldParams, pldInfo, originClip, gui, scene, update_order){
    if (allPldParams.length <= 0) return;

    // Get a deep copy of pldInfo
    let newPldInfo = deepClone(pldInfo);

    // Generate new AngleAnimTrack by manipulating FFT Spectrum
    newPldInfo.forEach(pld => {
        const pldID = pld.id;
        const ampScale = allPldParams[pldID].AmplitudeScale;

        // Scale*Spectrum
        pld.FFTResult.newY = pld.FFTResult.Y.map(([re, im]) => [re * ampScale, im * ampScale]);

        // IFFT to get new angle data
        pld.newPCAAngleAnimTrack = getIFFT(pld.FFTResult.newY, pld.FFTResult.oriTrackLength, pld.meanAngleIFFT);
        
        // Plot in GUI
        // Plot new angle
        const sampleFrequency = Number(pld.sample_freq) || 100;
        const plotTimes = pld.pcaAngleAnimTrack.map((_, index) => index / sampleFrequency);
        const plotDuration = plotTimes[plotTimes.length - 1] || 0;
        const newPCAAnglePlot = plotAngleTrack(pld.pcaAngleAnimTrack, pld.newPCAAngleAnimTrack, {
            popup: { kind: "pld", id: pld.id },
            originTimes: plotTimes,
            newTimes: plotTimes,
            xMax: plotDuration,
            xLabel: "Time (s)",
            scale: allPldParams[pldID]?.plotScale?.angle ?? allPldParams[pldID]?.scale !== false,
        });
        // Plot new FFT spectrum (by re-do FFT to newPCAAngleTrack)
        const newMeanAngle = pld.newPCAAngleAnimTrack.reduce((sum, v) => sum + v, 0) / pld.newPCAAngleAnimTrack.length;
        const newFFTAngleAnimTrack = pld.newPCAAngleAnimTrack.map(v => v - newMeanAngle);
        const newFFTResult = getFFT(newFFTAngleAnimTrack, pld.sample_freq);
        const newSpectrumPlot = plotSpectrum(newFFTResult, {
            popup: { kind: "pld", id: pld.id },
            scale: allPldParams[pldID]?.plotScale?.spectrum ?? allPldParams[pldID]?.scale !== false,
        });
    });

    // Get new Global position track
    updatePosTrack(newPldInfo, update_order);

    // Change clip tracks
    originClip.tracks.forEach(track => {
        const pld = newPldInfo.find(b => `${b.id}_PLD.position` === track.name);
        if (pld) {
            console.log(pld)
            track.values.set(pld.newGlobalPosTrack);
        }
    });

    console.log('NewpldInfo:',newPldInfo);
};
