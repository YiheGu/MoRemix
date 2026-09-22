import * as THREE from 'three';
import { getPspaceBase } from "./getPspaceBase";
import { getPCAResult } from "../getPCAResult";
import { plotAngleTrack } from '../debug/plotAngleTrack';
import { getFFT } from '../getFFT';
import { plotSpectrum } from '../debug/plotSpectrum';
import { plotAngleSpectrum3D } from '../debug/plotAngleSpectrum3D';
import { getMPAngleAndV3Loc } from '../getMPAngleAndV3Loc';
import { plotValueTrack } from '../debug/plotValueTrack';
import { deepClone } from "../deepClone";
import { getMPAmpRangeDeg } from "../getMPAmpRangeDeg";
import { addAlternativeReferenceData } from "../motionReference";
import { estimateBoneFrequency } from "../estimateBoneFrequency";

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

export function getPLDInfo(pldInfo){

    // Get specialIds from the union of first two layers in updateOrder
    let specialIds = [];
    if (pldInfo.updateOrder && pldInfo.updateOrder.length >= 2) {
        const firstTwoLayers = [...pldInfo.updateOrder[0], ...pldInfo.updateOrder[1]];
        specialIds = [...new Set(firstTwoLayers)];  // Remove duplicates using Set
    } else {
        // Fallback to default if updateOrder is not available
        specialIds = [1, 2, 12, 14];
    }
    let localTrack;
    let lenTrack;
    let frameCount;
    let childPos;
    let parent;
    let parentPos;

    pldInfo.forEach(pld => {
        if (!pld.Ori) pld.Ori = {};
        if (!pld.Test) pld.Test = {};
        
        // Calculate local position
        if (pld.parent === 0) // Pelvis pld's globalPos is its localPos
        {
            localTrack = [];
            const globalTrack = pld.Ori.GlobalAnimTrack.slice();
            frameCount = pld.Ori.GlobalAnimTrack.length / 3;
            for (let f = 0; f < frameCount; f++){
                const x = globalTrack[f * 3];
                const y = globalTrack[f * 3 + 1];
                const z = globalTrack[f * 3 + 2];
                localTrack.push([x, y, z]);
            }
            pld.Ori.LocalAnimTrack = localTrack;
            pld.Ori.PspaceAnimTrack = pld.Ori.LocalAnimTrack;
        }
        else{
            localTrack = [];
            lenTrack = [];  // Should all be the same
            childPos = pld.Ori.GlobalAnimTrack;
            parent = pldInfo.find(term => term.id === pld.parent)
            parentPos = parent.Ori.GlobalAnimTrack;

            frameCount = childPos.length / 3;
            
            // Get local location
            for (let f = 0; f < frameCount; f++){
                const cx = childPos[f * 3];
                const cy = childPos[f * 3 + 1];
                const cz = childPos[f * 3 + 2];

                const px = parentPos[f * 3];
                const py = parentPos[f * 3 + 1];
                const pz = parentPos[f * 3 + 2];

                const rx = cx - px;
                const ry = cy - py;
                const rz = cz - pz;

                const len = Math.sqrt(rx * rx + ry * ry + rz * rz);
                localTrack.push([rx, ry, rz]);
                lenTrack.push(len);
            }

            pld.Ori.LocalAnimTrack = localTrack;
            pld.lenTrack = lenTrack;
        };

    });

    pldInfo.forEach(pld => {
        // Get parent space location base on self-define coordinates
        if (specialIds.includes(pld.id)) {
            const identityBase = Array(frameCount).fill().map(() => [
                new THREE.Vector3(1, 0, 0),
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(0, 0, 1)
            ]);
            pld.Ori.BaseVector = identityBase;
            pld.Ori.PspaceAnimTrack = pld.Ori.LocalAnimTrack;
            pld.Ori.keyBoneLen = getTrackVectorLengths(pld.Ori.PspaceAnimTrack);
        }
        else{
            parent = pldInfo.find(term => term.id === pld.parent)
            parentPos = parent.Ori.LocalAnimTrack.flat();
            let baseVector; 
            [baseVector,] = getPspaceBase(parentPos, 'FirstFrame', parentPos, false);
            pld.Ori.BaseVector = baseVector;
            localTrack = pld.Ori.LocalAnimTrack;

            const pspaceTrack = [];
            for (let f = 0; f < frameCount; f++) {
                const cv = new THREE.Vector3(...localTrack[f]);
                const [vx, vy, vz] = baseVector[f];
                const new_cv_x = cv.dot(vx);
                const new_cv_y = cv.dot(vy);
                const new_cv_z = cv.dot(vz);
                pspaceTrack.push([new_cv_x, new_cv_y, new_cv_z]);
            }

            pld.Ori.PspaceAnimTrack = pspaceTrack;
            pld.Ori.keyBoneLen = getTrackVectorLengths(pspaceTrack);
        }

    });

    // Do PCA analysis to parent space location
    pldInfo.forEach(pld => {
        pld.PCAResult = getPCAResult(pld.Ori.PspaceAnimTrack);
        pld.sample_freq = inferSampleFrequency(pld.Ori.TimeTrack, 100);
        
        [pld.Ori.MPAngle,pld.Ori.MPMean,pld.Ori.MPAmp,
            pld.Ori.MPProLen,,pld.V1Idx,pld.V2Idx,pld.V3Idx,
            pld.Ori.V3Loc,pld.Ori.V3Mean,pld.Ori.V3Amp] = getMPAngleAndV3Loc(pld.PCAResult);
        pld.Ori.MPAmpRangeDeg = getMPAmpRangeDeg(pld.Ori.MPAmp);
        // Plot angle track and save
        const sampleFrequency = Number(pld.sample_freq) || 100;
        const rawTimes = Array.from(pld.Ori.TimeTrack || []);
        const timeStart = Number(rawTimes[0]) || 0;
        const plotTimes = rawTimes.length === pld.Ori.MPAngle.length
            ? rawTimes.map(time => Math.max(0, (Number(time) || 0) - timeStart))
            : pld.Ori.MPAngle.map((_, index) => index / sampleFrequency);
        const plotDuration = plotTimes[plotTimes.length - 1] || 0;
        pld.Ori.MPAnglePlot = plotAngleTrack(pld.Ori.MPAngle, null, {
            popup: { kind: "pld", id: pld.id },
            originTimes: plotTimes,
            xMax: plotDuration,
            xLabel: "Time (s)",
        });
        pld.Ori.V3Plot = plotValueTrack(pld.Ori.V3Loc, null, {
            popup: { kind: "pld", id: pld.id },
            yLabel: "V3",
            imageType: "v3",
            originTimes: plotTimes,
            xMax: plotDuration,
            xLabel: "Time (s)",
        });
    });

    // Do FFT analysis to PCA angle track
    pldInfo.forEach(pld => {
        pld.FrequencyMaxHz = Number(pld.FrequencyMaxHz) || 5;
        pld.FrequencyMinCorrelation = Number.isFinite(Number(pld.FrequencyMinCorrelation))
            ? Number(pld.FrequencyMinCorrelation)
            : 0.5;
        pld.FrequencyEstimate = estimateBoneFrequency(
            pld.Ori.MPAngle,
            pld.sample_freq,
            pld.FrequencyMaxHz,
            pld.FrequencyMinCorrelation
        );
        pld.Ori.MPFFTResult = getFFT(pld.Ori.MPAmp, pld.sample_freq);
        addAlternativeReferenceData(pld.Ori, pld.sample_freq);

        // Plot FFT spectrum and save
        pld.Ori.MPSpectrumPlot = plotSpectrum(pld.Ori.MPFFTResult, {
            popup: { kind: "pld", id: pld.id },
            frequencyEstimate: pld.FrequencyEstimate,
        });
        pld.Ori.MPFourierPlot = plotAngleSpectrum3D({
            currentAngleTrack: pld.Ori.MPAngle,
            originAngleTrack: pld.Ori.MPAngle,
            currentFFTResult: pld.Ori.MPFFTResult,
            originFFTResult: pld.Ori.MPFFTResult,
        }, {
            popup: { kind: "pld", id: pld.id }
        });
    });

    // Deepclone to pldInfo.New
    pldInfo.forEach(pld => {
        pld.New = deepClone(pld.Ori);
    });

    return pldInfo;
}

function inferSampleFrequency(times, fallback = 100) {
    const values = Array.from(times || [], Number).filter(Number.isFinite);
    if (values.length < 2) return fallback;
    const intervals = [];
    for (let index = 1; index < values.length; index++) {
        const interval = values[index] - values[index - 1];
        if (interval > 1e-9) intervals.push(interval);
    }
    if (intervals.length < 1) return fallback;
    intervals.sort((a, b) => a - b);
    const middle = Math.floor(intervals.length / 2);
    const median = intervals.length % 2 === 0
        ? (intervals[middle - 1] + intervals[middle]) / 2
        : intervals[middle];
    return median > 0 ? 1 / median : fallback;
}
