import * as THREE from 'three';
import { setPldMPAmp } from "./setPldMPAmp";
import { setPldMPMean } from "./setPldMPMean";
import { setPldV3Mean } from "./setPldV3Mean";
import { plotAngleTrack } from '../debug/plotAngleTrack';
import { plotSpectrum } from '../debug/plotSpectrum';
import { plotAngleSpectrum3D } from '../debug/plotAngleSpectrum3D';
import { plotValueTrack } from '../debug/plotValueTrack';
import { getPspaceBase } from './getPspaceBase';
import { setPLDPhaseShift } from './setPLDPhaseShift';
import { getMPAmpRangeDeg } from '../getMPAmpRangeDeg';
import { getFFT } from '../getFFT';
import {
    createStartEndBaseline,
    getOriginalMPFFTResult,
    getOriginalV3Amplitude,
    referenceValueAt,
    usesStartEndReference,
    usesStartPointReference,
} from '../motionReference';
import { loopScalarSeriesToDuration } from '../loopAnimationClipToDuration';
import { retimeLinearSeries } from '../setBoneFrequency';

function getTrackVectorLengths(track = []) {
    if (!Array.isArray(track)) return [];
    return track.map((frame) => {
        if (!Array.isArray(frame) || frame.length < 3) return 0;
        const x = Number(frame[0]) || 0;
        const y = Number(frame[1]) || 0;
        const z = Number(frame[2]) || 0;
        return Math.sqrt(x * x + y * y + z * z);
    });
}

export function generatePldClip(allPldParams, pld, pldInfo, currentClip, api){
    const targetPld = pldInfo.find(l => l.id === pld.id);
    if (!targetPld) return null;

    // Process only the target pld
    const targetPldParams = allPldParams[pld.id];

    // ========== Update Main Plane angle ==========
    // Update MP Amp
    setPldMPAmp(targetPldParams, targetPld);
    targetPld.New.MPAmpRangeDeg = getMPAmpRangeDeg(targetPld.New.MPAmp);
    // Update Mp Mean
    const mpReference = setPldMPMean(targetPldParams, targetPld);
    // Generate new PLD angle
    targetPld.New.MPAngle = targetPld.New.MPAmp.map(
        (v, index) => v + referenceValueAt(mpReference, index)
    );
    targetPld.New.MPMean = average(targetPld.New.MPAngle);
    targetPld.New.MPStartPoint = targetPld.New.MPAngle[0] ?? mpReference;
    targetPld.New.MPAmpFromStart = targetPld.New.MPAngle.map(v => v - targetPld.New.MPStartPoint);
    targetPld.New.MPStartEndBaseline = createStartEndBaseline(targetPld.New.MPAngle);
    targetPld.New.MPAmpFromStartEnd = targetPld.New.MPAngle.map(
        (v, index) => v - targetPld.New.MPStartEndBaseline[index]
    );
    // ========= Update V3 (i.e. MPProLen) =========
    // Update V3 Mean
    const v3Reference = setPldV3Mean(targetPldParams, targetPld);
    // Scale only the V3 amplitude relative to the selected reference.
    const v3ScaleRaw = Number(targetPldParams.V3Ratio);
    const v3Scale = Number.isFinite(v3ScaleRaw) ? v3ScaleRaw : 1;
    const originalV3Amplitude = getOriginalV3Amplitude(targetPld, targetPldParams);
    targetPld.New.V3Loc = originalV3Amplitude.map(
        (v, index) => v * v3Scale + referenceValueAt(v3Reference, index)
    );
    const boneLen = Array.isArray(targetPld.lenTrack) && targetPld.lenTrack.length
        ? targetPld.lenTrack
        : targetPld.Ori.keyBoneLen;
    targetPld.New.V3Loc = targetPld.New.V3Loc.map((v, index) => {
        const frameLen = boneLen[index];
        return THREE.MathUtils.clamp(v, -frameLen, frameLen);
    });
    // Calculate new projection length in PCA space for each frame
    targetPld.New.MPProLen = targetPld.New.V3Loc.map((v, index) => Math.sqrt(Math.max(0, boneLen[index] * boneLen[index] - v * v)));
    // Update New.V3Amp & New.V3Mean
    targetPld.New.V3Mean = average(targetPld.New.V3Loc);
    targetPld.New.V3StartPoint = targetPld.New.V3Loc[0] ?? v3Reference;
    targetPld.New.V3AmpFromStart = targetPld.New.V3Loc.map(v => v - targetPld.New.V3StartPoint);
    targetPld.New.V3StartEndBaseline = createStartEndBaseline(targetPld.New.V3Loc);
    targetPld.New.V3AmpFromStartEnd = targetPld.New.V3Loc.map(
        (v, index) => v - targetPld.New.V3StartEndBaseline[index]
    );
    targetPld.New.V3Amp = usesStartEndReference(targetPldParams)
        ? [...targetPld.New.V3AmpFromStartEnd]
        : usesStartPointReference(targetPldParams)
            ? [...targetPld.New.V3AmpFromStart]
            : targetPld.New.V3Loc.map(v => v - targetPld.New.V3Mean);

    // ========= Update GlobalAnimTrack =========
    // Update paspaceLoc according to new score angle
    const nFrames = targetPld.nFrames;
    
    const newPspaceTrack = [];
    for (let i = 0; i < nFrames; i++){
        // Compute new Main Plane coordinates
        const L1 = targetPld.New.MPProLen[i] * Math.cos(targetPld.New.MPAngle[i]);
        const L2 = targetPld.New.MPProLen[i] * Math.sin(targetPld.New.MPAngle[i]);
        const L3 = targetPld.New.V3Loc[i];

        // Compute new parent space location
        const base_v1 = targetPld.PCAResult.coeff.data.map(row => row[targetPld.V1Idx]);
        const base_v2 = targetPld.PCAResult.coeff.data.map(row => row[targetPld.V2Idx]);
        const base_v3 = targetPld.PCAResult.coeff.data.map(row => row[targetPld.V3Idx]);

        const v1 = base_v1.map(val => val*L1);
        const v2 = base_v2.map(val => val*L2);
        const v3 = base_v3.map(val => val*L3);

        const newPspaceLoc = v1.map((val,i) => val + v2[i] + v3[i]);
        newPspaceTrack.push(newPspaceLoc);
    }
    targetPld.New.PspaceAnimTrack = newPspaceTrack;
    targetPld.New.keyBoneLen = getTrackVectorLengths(newPspaceTrack);

    // ========= Do Phase Shift for the whole GlobalAnimTrack =========
    setPLDPhaseShift(targetPldParams, targetPld);
    targetPld.New.keyBoneLen = getTrackVectorLengths(targetPld.New.PspaceAnimTrack);

    const shiftedAngle = circularShiftSeries(targetPld.New.MPAngle, targetPldParams.PhaseShift);
    const shiftedV3Loc = circularShiftSeries(targetPld.New.V3Loc, targetPldParams.PhaseShift);
    const sampleFrequency = Number(targetPld.sample_freq) || 100;
    const plotTimes = shiftedAngle.map((_, index) => index / sampleFrequency);
    const plotDuration = plotTimes[plotTimes.length - 1] || 0;

    // Plot new MainPlane angle track
    targetPld.New.MPAnglePlot = plotAngleTrack(targetPld.Ori.MPAngle, shiftedAngle, {
        popup: { kind: "pld", id: targetPld.id },
        originTimes: plotTimes,
        newTimes: plotTimes,
        xMax: plotDuration,
        xLabel: "Time (s)",
        scale: targetPldParams?.plotScale?.angle ?? targetPldParams?.scale !== false,
    });
    // Plot new MPAmp FFT spectrum
    targetPld.New.SpectrumPlot = plotSpectrum({
        currentFFTResult: targetPld.New.MPFFTResult,
        originFFTResult: getOriginalMPFFTResult(targetPld, targetPldParams),
        mpAmpParams: targetPldParams?.MPAmp || {},
    }, {
        popup: { kind: "pld", id: targetPld.id },
        scale: targetPldParams?.plotScale?.spectrum ?? targetPldParams?.scale !== false,
    });
    targetPld.New.MPFourierPlot = plotAngleSpectrum3D({
        currentAngleTrack: shiftedAngle,
        originAngleTrack: targetPld.Ori.MPAngle,
        currentFFTResult: targetPld.New.MPFFTResult,
        originFFTResult: getOriginalMPFFTResult(targetPld, targetPldParams),
        phaseShift: targetPldParams.PhaseShift,
    }, {
        popup: { kind: "pld", id: targetPld.id },
        scale: targetPldParams?.plotScale?.fourier ?? targetPldParams?.scale !== false,
    });
    targetPld.New.V3Plot = plotValueTrack(targetPld.Ori.V3Loc, shiftedV3Loc, {
        popup: { kind: "pld", id: targetPld.id },
        yLabel: "V3",
        imageType: "v3",
        originTimes: plotTimes,
        newTimes: plotTimes,
        xMax: plotDuration,
        xLabel: "Time (s)",
        scale: targetPldParams?.plotScale?.v3 ?? targetPldParams?.scale !== false,
    });

    // Update local loc according to parent space loc
    const updateOrder = pldInfo.updateOrder;
    updateOrder.forEach((layer, layerIndex) => {
        const isSpecialLayer = ([1, 2].includes(layerIndex+1));
        
        if (isSpecialLayer){
            for (const id of layer){
                const pld = pldInfo.find(b => b.id === id);
                console.log("Current PLD:", pld.id);
                pld.New.LocalAnimTrack = pld.New.PspaceAnimTrack;
                pld.New.BaseVector = pld.Ori.BaseVector;
            }
        }
        else{
            for (const id of layer) {
                const pld = pldInfo.find(b => b.id === id);
                if (!pld) continue;
                const parentId = pld.parent;
                const parent = pldInfo.find(b => b.id === parentId);
                const newParentPos = parent.New.LocalAnimTrack.flat();
                const oriParentPos = parent.Ori.LocalAnimTrack.flat();

                // Re-calculate base vector according to new ParentPos
                [pld.New.BaseVector, pld.New.PV] = getPspaceBase(newParentPos, 'FirstFrame', oriParentPos, true);

                // Calculate new local loc according to new pspace base vector
                const newLocalPosTrack = [];
                for (let f = 0; f < nFrames; f++) {
                    const [vx, vy, vz] = pld.Ori.BaseVector[f];
                    const [newVx, newVy, newVz] = pld.New.BaseVector[f];
                    const [pcx, pcy, pcz] = pld.New.PspaceAnimTrack[f];
                    const local = new THREE.Vector3()
                        .addScaledVector(vx, pcx)
                        .addScaledVector(vy, pcy)
                        .addScaledVector(vz, pcz);

                    // Transform local from Ori-base frame to New-base frame.
                    const cx = local.dot(vx);
                    const cy = local.dot(vy);
                    const cz = local.dot(vz);
                    const localInNewFrame = new THREE.Vector3()
                        .addScaledVector(newVx, cx)
                        .addScaledVector(newVy, cy)
                        .addScaledVector(newVz, cz);

                    newLocalPosTrack.push([localInNewFrame.x, localInNewFrame.y, localInNewFrame.z]);
                };
                pld.New.LocalAnimTrack = newLocalPosTrack;
            };
        };
    });

    // Update global location according to new local loc
    updateOrder.forEach((layer, layerIndex) => {
        if (layerIndex+1 === 1){
            for (const id of layer) {
                const pld = pldInfo.find(b => b.id === id);
                pld.New.GlobalAnimTrack = pld.New.LocalAnimTrack;
            }
        }
        else{
            for (const id of layer) {
                const pld = pldInfo.find(b => b.id === id);
                const parentId = pld.parent;
                const parent = pldInfo.find(b => b.id === parentId);
                const newParentPos = parent.New.GlobalAnimTrack;
                const newLocalPos = pld.New.LocalAnimTrack;

                const newGlobalPosTrack = [];
                for (let f = 0; f < nFrames; f++) {
                    const [px, py, pz] = newParentPos[f];
                    const [lx, ly, lz] = newLocalPos[f];
                    newGlobalPosTrack.push([px + lx, py + ly, pz + lz]);
                };
                pld.New.GlobalAnimTrack = newGlobalPosTrack;
            }
        }
    });

    // Flatten GlobalAnimTrack and convert to Float32Array
    pldInfo.forEach(pld => {
        if (pld.New.GlobalAnimTrack) {
            const flatArray = pld.New.GlobalAnimTrack.flat();
            pld.New.GlobalAnimTrack = new Float32Array(flatArray);
        }
    });

    // ========= Update Clip =========
    currentClip.tracks.forEach(track => {
        // console.log("New Track:", track);
        const pld = pldInfo.find(b => [
            `pld${b?.name}.position`,
            `pld${b?.id}.position`,
            `${b?.id}_PLD.position`,
        ].includes(track.name));
        if (pld) {
            track.values.set(pld.New.GlobalAnimTrack);
        };
    }); 
}

export async function updatePldDiagnosticPlots({
    targetPld,
    targetPldParams,
    sourceTimes,
    mapping,
}, targetDuration) {
    const phaseShift = Number(targetPldParams?.PhaseShift) || 0;
    const shiftedAngle = circularShiftSeries(targetPld.New.MPAngle, phaseShift);
    const shiftedV3 = circularShiftSeries(targetPld.New.V3Loc, phaseShift);
    const newAngle = mapping.changed
        ? await retimeLinearSeries(shiftedAngle, mapping.sourceTimes, mapping.mappedTimes)
        : shiftedAngle;
    const newV3 = mapping.changed
        ? await retimeLinearSeries(shiftedV3, mapping.sourceTimes, mapping.mappedTimes)
        : shiftedV3;
    const outputTimes = mapping.outputTimes;
    const sourceDuration = sourceTimes.length > 1
        ? Math.max(0, sourceTimes[sourceTimes.length - 1] - sourceTimes[0])
        : 0;
    const plotDuration = targetPldParams?.KeepOriginalLength !== false && sourceDuration > 0
        ? sourceDuration
        : targetDuration;
    const originAngleTrack = loopScalarSeriesToDuration(targetPld.Ori.MPAngle, sourceTimes, plotDuration);
    const originV3Track = loopScalarSeriesToDuration(targetPld.Ori.V3Loc, sourceTimes, plotDuration);
    const newAngleTrack = loopScalarSeriesToDuration(newAngle, outputTimes, plotDuration);
    const newV3Track = loopScalarSeriesToDuration(newV3, outputTimes, plotDuration);
    const currentMean = average(newAngleTrack.values);
    const originMean = average(originAngleTrack.values);
    targetPld.New.MPFFTResult = getFFT(
        newAngleTrack.values.map(value => value - currentMean),
        targetPld.sample_freq
    );
    const originFFTResult = getFFT(
        originAngleTrack.values.map(value => value - originMean),
        targetPld.sample_freq
    );

    targetPld.New.MPAnglePlot = plotAngleTrack(originAngleTrack.values, newAngleTrack.values, {
        popup: { kind: "pld", id: targetPld.id },
        originTimes: originAngleTrack.times,
        newTimes: newAngleTrack.times,
        xMax: plotDuration,
        xLabel: "Time (s)",
        scale: targetPldParams?.plotScale?.angle ?? targetPldParams?.scale !== false,
    });
    targetPld.New.SpectrumPlot = plotSpectrum({
        currentFFTResult: targetPld.New.MPFFTResult,
        originFFTResult,
        mpAmpParams: targetPldParams?.MPAmp || {},
    }, {
        popup: { kind: "pld", id: targetPld.id },
        frequencyEstimate: targetPld.FrequencyEstimate,
        scale: targetPldParams?.plotScale?.spectrum ?? targetPldParams?.scale !== false,
    });
    targetPld.New.MPFourierPlot = plotAngleSpectrum3D({
        currentAngleTrack: newAngleTrack.values,
        originAngleTrack: originAngleTrack.values,
        currentFFTResult: targetPld.New.MPFFTResult,
        originFFTResult,
    }, {
        popup: { kind: "pld", id: targetPld.id },
        scale: targetPldParams?.plotScale?.fourier ?? targetPldParams?.scale !== false,
    });
    targetPld.New.V3Plot = plotValueTrack(originV3Track.values, newV3Track.values, {
        popup: { kind: "pld", id: targetPld.id },
        yLabel: "V3",
        imageType: "v3",
        originTimes: originV3Track.times,
        newTimes: newV3Track.times,
        xMax: plotDuration,
        xLabel: "Time (s)",
        scale: targetPldParams?.plotScale?.v3 ?? targetPldParams?.scale !== false,
    });
}

function average(values = []) {
    return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function circularShiftSeries(series, phaseShift = 0) {
    if (!Array.isArray(series) || series.length < 1) return [];
    const nFrames = series.length;
    const safeShift = Number(phaseShift) || 0;
    const shiftFrames = ((Math.floor(safeShift * nFrames) % nFrames) + nFrames) % nFrames;
    if (shiftFrames === 0) return [...series];
    return series.slice(nFrames - shiftFrames).concat(series.slice(0, nFrames - shiftFrames));
}
