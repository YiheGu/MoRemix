import * as THREE from 'three';
import { plotAngleTrack } from "./debug/plotAngleTrack";
import { plotSpectrum } from "./debug/plotSpectrum";
import { plotAngleSpectrum3D } from "./debug/plotAngleSpectrum3D";
import { getFFT } from "./getFFT";
import { setBoneMPAmp } from './setBoneMPAmp';
import { setBoneMPMean } from './setBoneMPMean';
import { setPhaseShift } from './setPhaseShift';
import { setBoneFrequency } from './setBoneFrequency';
import { setBoneV3Mean } from './setBoneV3Mean';
import { plotValueTrack } from './debug/plotValueTrack';
import { getMPAmpRangeDeg } from './getMPAmpRangeDeg';
import {
    createStartEndBaseline,
    getOriginalV3Amplitude,
    referenceValueAt,
    usesStartEndReference,
    usesStartPointReference,
} from './motionReference';
import { loopScalarSeriesToDuration } from './loopAnimationClipToDuration';
import { yieldEvery } from './yieldToMainThread';

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

export async function generateBoneClip(allBoneParams, bone, BoneInfo, currentClip, api){
    const targetBone = BoneInfo.find(b => b.id === bone.id);
    if (!targetBone) return null;

    // Process only the target bone
    const targetBoneParams = allBoneParams[bone.id];
    if (!targetBoneParams) return null;
    console.log("targetBoneParams:",targetBoneParams);

    const trackIndex = currentClip.tracks.findIndex(t => t.name === `${targetBone.name}.quaternion`);
    if (trackIndex < 0) return null;
    const track = currentClip.tracks[trackIndex];

    // ========= Update Main Plane angle =========
    // Update MP Amp
    setBoneMPAmp(targetBoneParams, targetBone);
    targetBone.New.MPAmpRangeDeg = getMPAmpRangeDeg(targetBone.New.MPAmp);
    // Update MP Mean
    const mpReference = setBoneMPMean(targetBoneParams, targetBone);
    // Generate new MP angle
    targetBone.New.MPAngle = targetBone.New.MPAmp.map(
        (v, index) => v + referenceValueAt(mpReference, index)
    );
    targetBone.New.MPMean = average(targetBone.New.MPAngle);
    targetBone.New.MPStartPoint = targetBone.New.MPAngle[0] ?? mpReference;
    targetBone.New.MPAmpFromStart = targetBone.New.MPAngle.map(v => v - targetBone.New.MPStartPoint);
    targetBone.New.MPStartEndBaseline = createStartEndBaseline(targetBone.New.MPAngle);
    targetBone.New.MPAmpFromStartEnd = targetBone.New.MPAngle.map(
        (v, index) => v - targetBone.New.MPStartEndBaseline[index]
    );

    // ========= Update V3 (i.e. MPProLen) =========
    // Update V3 Mean
    const v3Reference = setBoneV3Mean(targetBoneParams, targetBone);
    // Scale only the V3 amplitude relative to the selected reference.
    const v3ScaleRaw = Number(targetBoneParams.V3Ratio);
    const v3Scale = Number.isFinite(v3ScaleRaw) ? v3ScaleRaw : 1;
    const originalV3Amplitude = getOriginalV3Amplitude(targetBone, targetBoneParams);
    targetBone.New.V3Loc = originalV3Amplitude.map(
        (v, index) => v * v3Scale + referenceValueAt(v3Reference, index)
    );
    const boneLen = targetBone.oriVector.length();
    targetBone.New.V3Loc = targetBone.New.V3Loc.map(v => THREE.MathUtils.clamp(v, -boneLen, boneLen));
    // Calculate new projection length in PCA space for each frame
    targetBone.New.MPProLen = targetBone.New.V3Loc.map(v => Math.sqrt(Math.max(0, boneLen * boneLen - v * v)));
    // Update New.V3Amp & New.V3Mean
    targetBone.New.V3Mean = average(targetBone.New.V3Loc);
    targetBone.New.V3StartPoint = targetBone.New.V3Loc[0] ?? v3Reference;
    targetBone.New.V3AmpFromStart = targetBone.New.V3Loc.map(v => v - targetBone.New.V3StartPoint);
    targetBone.New.V3StartEndBaseline = createStartEndBaseline(targetBone.New.V3Loc);
    targetBone.New.V3AmpFromStartEnd = targetBone.New.V3Loc.map(
        (v, index) => v - targetBone.New.V3StartEndBaseline[index]
    );
    targetBone.New.V3Amp = usesStartEndReference(targetBoneParams)
        ? [...targetBone.New.V3AmpFromStartEnd]
        : usesStartPointReference(targetBoneParams)
            ? [...targetBone.New.V3AmpFromStart]
            : targetBone.New.V3Loc.map(v => v - targetBone.New.V3Mean);

    // ========= Update QuatAnimTrack =========
    const nFrames = targetBone.nFrames;
    const newQuatTrack = [];
    const newPspaceTrack = [];
    const base_v1 = targetBone.PCAResult.coeff.data.map(row => row[targetBone.V1Idx]);
    const base_v2 = targetBone.PCAResult.coeff.data.map(row => row[targetBone.V2Idx]);
    const base_v3 = targetBone.PCAResult.coeff.data.map(row => row[targetBone.V3Idx]);
    for (let i = 0; i < nFrames; i++) {
        // Compute new Main Plane coordinates
        const L1 = targetBone.New.MPProLen[i] * Math.cos(targetBone.New.MPAngle[i]);
        const L2 = targetBone.New.MPProLen[i] * Math.sin(targetBone.New.MPAngle[i]);
        const L3 = targetBone.New.V3Loc[i];

        // Compute new parent space location
        const v1 = base_v1.map(val => val*L1);
        const v2 = base_v2.map(val => val*L2);
        const v3 = base_v3.map(val => val*L3);

        const newPspaceLoc = v1.map((val,i) => val + v2[i] + v3[i]);

        // Compute new quaternion
        const oldDir = new THREE.Vector3(...targetBone.Ori.PspaceAnimTrack[i]).normalize();
        const qx = targetBone.Ori.QuatAnimTrack.values[i*4 + 0];
        const qy = targetBone.Ori.QuatAnimTrack.values[i*4 + 1];
        const qz = targetBone.Ori.QuatAnimTrack.values[i*4 + 2];
        const qw = targetBone.Ori.QuatAnimTrack.values[i*4 + 3];
        const oldQuat = new THREE.Quaternion(qx, qy, qz, qw);

        // Acquire old roll vector (Up vector) and direction
        const newDir = new THREE.Vector3(...newPspaceLoc).normalize();
        
        const newQuat = computeNewQuatKeepRoll(oldDir, oldQuat, newDir);

        // Save new quaternion
        newQuatTrack.push([newQuat.x, newQuat.y, newQuat.z, newQuat.w]);
        newPspaceTrack.push(newPspaceLoc);
        const pendingYield = yieldEvery(i);
        if (pendingYield) await pendingYield;
    }
    
    const quatTrackFlat = [].concat(...newQuatTrack);

    targetBone.New.PspaceAnimTrack = newPspaceTrack;
    targetBone.New.keyBoneLen = getTrackVectorLengths(newPspaceTrack);
    targetBone.New.QuatAnimTrack = quatTrackFlat;

    // ========= Retiming of the complete reconstructed bone track =========
    const localTrackTimes = await setBoneFrequency(targetBoneParams, targetBone);

    // ========= Do Phase Shift for the whole QuatAnim&PspaceTrack =========
    setPhaseShift(targetBoneParams, targetBone);
    targetBone.New.keyBoneLen = getTrackVectorLengths(targetBone.New.PspaceAnimTrack);

    // ========= Update Clip =========
    currentClip.tracks[trackIndex] = new track.constructor(
        track.name,
        localTrackTimes,
        targetBone.New.QuatAnimTrack,
        track.getInterpolation()
    );

    return { targetBone, targetBoneParams, localTrackTimes };
}

export function updateBoneDiagnosticPlots({ targetBone, targetBoneParams, localTrackTimes }, targetDuration) {
    const originTimes = targetBone?.Ori?.QuatAnimTrack?.times || [];
    const originStart = Number(originTimes[0]) || 0;
    const originEnd = Number(originTimes[originTimes.length - 1]);
    const originDuration = Number.isFinite(originEnd) ? Math.max(0, originEnd - originStart) : 0;
    const plotDuration = targetBoneParams?.KeepOriginalLength !== false && originDuration > 0
        ? originDuration
        : targetDuration;
    const originAngleTrack = loopScalarSeriesToDuration(
        targetBone.Ori.MPAngle,
        originTimes,
        plotDuration
    );
    const originV3Track = loopScalarSeriesToDuration(
        targetBone.Ori.V3Loc,
        originTimes,
        plotDuration
    );
    const newAngleTrack = loopScalarSeriesToDuration(
        targetBone.New.MPAngle,
        localTrackTimes,
        plotDuration
    );
    const newV3Track = loopScalarSeriesToDuration(
        targetBone.New.V3Loc,
        localTrackTimes,
        plotDuration
    );
    const originAngle = originAngleTrack.values;
    const originV3 = originV3Track.values;
    const newAngle = newAngleTrack.values;
    const newV3 = newV3Track.values;
    const currentMean = average(newAngle);
    const originMean = average(originAngle);

    targetBone.New.MPFFTResult = getFFT(
        newAngle.map(value => value - currentMean),
        targetBone.sample_freq
    );
    const originFFTResult = getFFT(
        originAngle.map(value => value - originMean),
        targetBone.sample_freq
    );

    targetBone.New.MPAnglePlot = plotAngleTrack(originAngle, newAngle, {
        popup: { kind: "skeleton", id: targetBone.id },
        originTimes: originAngleTrack.times,
        newTimes: newAngleTrack.times,
        xMax: plotDuration,
        xLabel: "Time (s)",
        scale: targetBoneParams?.plotScale?.angle ?? targetBoneParams?.scale !== false,
    });
    targetBone.New.SpectrumPlot = plotSpectrum({
        currentFFTResult: targetBone.New.MPFFTResult,
        originFFTResult,
        mpAmpParams: targetBoneParams?.MPAmp || {},
    }, {
        popup: { kind: "skeleton", id: targetBone.id },
        frequencyEstimate: targetBone.FrequencyEstimate,
        scale: targetBoneParams?.plotScale?.spectrum ?? targetBoneParams?.scale !== false,
    });
    targetBone.New.MPFourierPlot = plotAngleSpectrum3D({
        currentAngleTrack: newAngle,
        originAngleTrack: originAngle,
        currentFFTResult: targetBone.New.MPFFTResult,
        originFFTResult,
    }, {
        popup: { kind: "skeleton", id: targetBone.id },
        scale: targetBoneParams?.plotScale?.fourier ?? targetBoneParams?.scale !== false,
    });
    targetBone.New.V3Plot = plotValueTrack(originV3, newV3, {
        popup: { kind: "skeleton", id: targetBone.id },
        yLabel: "V3",
        imageType: "v3",
        originTimes: originV3Track.times,
        newTimes: newV3Track.times,
        xMax: plotDuration,
        xLabel: "Time (s)",
        scale: targetBoneParams?.plotScale?.v3 ?? targetBoneParams?.scale !== false,
    });
}

function average(values = []) {
    return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function computeNewQuatKeepRoll(oldDir, oldQuat, newDir) {
    // Align with new direction
    const qDir = new THREE.Quaternion().setFromUnitVectors(oldDir, newDir);
    const newQuat = qDir.multiply(oldQuat).normalize();

    return newQuat;
}
