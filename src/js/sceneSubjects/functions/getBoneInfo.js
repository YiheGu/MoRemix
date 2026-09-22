
import * as THREE from 'three';
import { plotPspaceLoc } from "./debug/plotPspaceLoc";
import { getPCAResult } from "./getPCAResult";
import { getMPAngleAndV3Loc } from "./getMPAngleAndV3Loc";
import { getFFT } from "./getFFT";
import { testQuat } from "./debug/testQuat";
import { plotAngleTrack } from "./debug/plotAngleTrack";
import { plotSpectrum } from "./debug/plotSpectrum";
import { plotAngleSpectrum3D } from "./debug/plotAngleSpectrum3D";
import { plotValueTrack } from "./debug/plotValueTrack";
import { deepClone } from "./deepClone";
import { getMPAmpRangeDeg } from "./getMPAmpRangeDeg";
import { addAlternativeReferenceData } from "./motionReference";
import { estimateBoneFrequency } from "./estimateBoneFrequency";

const TEMP_MH_MPA_CATEGORY_BONES = [
    {
        name: "body",
        bones: [
            "f_tal_nrw_body_rigspine_01",
            "f_tal_nrw_body_rigspine_02",
            "f_tal_nrw_body_rigspine_03",
            "f_tal_nrw_body_rigspine_04",
            "f_tal_nrw_body_rigspine_05",
        ],
    },
    {
        name: "head",
        bones: [
            "f_tal_nrw_body_rigneck_01",
            "f_tal_nrw_body_rigneck_02",
        ],
    },
    {
        name: "upper arm",
        bones: [
            "f_tal_nrw_body_rigupperarm_l",
            "f_tal_nrw_body_rigupperarm_r",
        ],
    },
    {
        name: "lower arm",
        bones: [
            "f_tal_nrw_body_riglowerarm_l",
            "f_tal_nrw_body_riglowerarm_r",
        ],
    },
    {
        name: "upper leg",
        bones: [
            "f_tal_nrw_body_rigthigh_l",
            "f_tal_nrw_body_rigthigh_r",
        ],
    },
    {
        name: "lower leg",
        bones: [
            "f_tal_nrw_body_rigcalf_l",
            "f_tal_nrw_body_rigcalf_r",
        ],
    },
];

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

function findTrackForBone(originTracks, boneName, property) {
    if (!Array.isArray(originTracks) || !boneName || !property) return null;
    const suffix = `${boneName}.${property}`;
    const escapedName = boneName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[./|:\\[\\]])${escapedName}\\.${property}$`);
    return originTracks.find((track) => track?.name === suffix)
        || originTracks.find((track) => pattern.test(track?.name || ""))
        || null;
}

function logTemporaryMetaHumanMPAmpRangeAnalysis(bones = []) {
    const boneByName = new Map(
        bones
            .filter((bone) => bone?.name)
            .map((bone) => [bone.name, bone])
    );
    const targetBoneNames = TEMP_MH_MPA_CATEGORY_BONES.flatMap((category) => category.bones);

    if (!targetBoneNames.every((name) => boneByName.has(name))) return;

    const result = {};
    TEMP_MH_MPA_CATEGORY_BONES.forEach((category) => {
        const values = category.bones
            .map((boneName) => Number(boneByName.get(boneName)?.Ori?.MPAmpRangeDeg))
            .filter((value) => Number.isFinite(value));

        if (values.length !== category.bones.length) return;
        const average = values.reduce((sum, value) => sum + value, 0) / values.length;
        result[category.name] = average / 2;
    });

    if (Object.keys(result).length < 1) return;
    console.log("Temporary MetaHuman MPAmpRangeDeg category average / 2:", result);
}

export function getBoneInfo(originTracks, AllBoneInfo, BoneInfo) {
    if (!Array.isArray(BoneInfo) || BoneInfo.length < 1) return [];
    const validBones = [];

    // AllBoneInfo.forEach(bone => {
    //     // Save Pos track in boneInfo to calculate bone length
    //     const trackNamePos = bone.name + '.position';
    //     const posTrack = originTracks.find(track => track.name === trackNamePos);
    //     if (posTrack)
    //     {
    //         bone.PosAnimTrack = posTrack;
    //     }
        
    //     // Calculate parent bone length
    //     const pBone = AllBoneInfo.find(pb => pb.id === bone.lenParent);
    //     if (pBone && posTrack && posTrack.values) {
    //         const x = posTrack.values[0];
    //         const y = posTrack.values[1];
    //         const z = posTrack.values[2];
    //         pBone.boneLength = Math.sqrt(x*x + y*y + z*z);
    //         pBone.oriVector.multiplyScalar(pBone.boneLength);
    //         // console.log(`${pBone.id},${pBone.boneLength},${pBone.oriVector.toArray()}`);
    //     } else if (pBone) {
    //         // Use default length
    //         pBone.boneLength = new THREE.Vector3(1,0,0); 
    //     }

    // });

    // Get bone parent space location data
    BoneInfo.forEach(bone => {
        if (!bone.Ori) bone.Ori = {};
        if (!bone.Test) bone.Test = {};

        // Save Quat track in boneInfo
        const quatTrack = findTrackForBone(originTracks, bone.name, "quaternion");
        const frameCount = Math.floor((quatTrack?.values?.length || 0) / 4);

        if (!quatTrack || !quatTrack.values || !bone.oriVector || frameCount <= 1) return;

        // Set upVector to record roll angle
        let upVector = new THREE.Vector3(0, 1, 0);
        const dot = bone.oriVector.clone().normalize().dot(upVector);
        if (dot > 0.9 || dot < -0.9) {
            upVector = new THREE.Vector3(0, 0, 1);
        }

        bone.nFrames = frameCount;
        const pspaceTrack = [];
        const upTrack = [];

        for (let f = 0; f < frameCount; f++) {
            // read quaternion
            const qx = quatTrack.values[f*4 + 0];
            const qy = quatTrack.values[f*4 + 1];
            const qz = quatTrack.values[f*4 + 2];
            const qw = quatTrack.values[f*4 + 3];

            const quat = new THREE.Quaternion(qx, qy, qz, qw);
            const rotatedVec = bone.oriVector.clone().applyQuaternion(quat);
            pspaceTrack.push(rotatedVec.toArray());

            // Roll angle
            const rotatedUp = upVector.clone().applyQuaternion(quat);
            upTrack.push(rotatedUp.toArray());
        }

        // attach parent space loc animation track
        bone.Ori.QuatAnimTrack = quatTrack;
        bone.Ori.PspaceAnimTrack = pspaceTrack;
        bone.Ori.keyBoneLen = getTrackVectorLengths(pspaceTrack);
        bone.QuatUpAnimTrack = upTrack;
        validBones.push(bone);
        // bone.testQuat = testQuat(quatTrack,bone);
    });

    // Do PCA analysis to parent space location
    validBones.forEach(bone => {
        bone.PCAResult = getPCAResult(bone.Ori.PspaceAnimTrack);
        // MP stands for MainPlane composed by V1 and V2

        [bone.Ori.MPAngle,bone.Ori.MPMean,bone.Ori.MPAmp,
            bone.Ori.MPProLen,bone.Ori.V2Ratio,bone.V1Idx,bone.V2Idx,bone.V3Idx,
            bone.Ori.V3Loc,bone.Ori.V3Mean,bone.Ori.V3Amp] = getMPAngleAndV3Loc(bone.PCAResult); 
        bone.Ori.MPAmpRangeDeg = getMPAmpRangeDeg(bone.Ori.MPAmp);
        
        // Plot angle track and save
        const plotTimes = Array.from(bone.Ori.QuatAnimTrack?.times || []);
        const plotStart = Number(plotTimes[0]) || 0;
        const normalizedPlotTimes = plotTimes.map(time => Math.max(0, (Number(time) || 0) - plotStart));
        const plotDuration = normalizedPlotTimes[normalizedPlotTimes.length - 1] || 0;
        bone.Ori.MPAnglePlot = plotAngleTrack(bone.Ori.MPAngle, null, {
            popup: { kind: "skeleton", id: bone.id },
            originTimes: normalizedPlotTimes,
            xMax: plotDuration,
            xLabel: "Time (s)",
        });
        bone.Ori.V3Plot = plotValueTrack(bone.Ori.V3Loc, null, {
            popup: { kind: "skeleton", id: bone.id },
            yLabel: "V3",
            imageType: "v3",
            originTimes: normalizedPlotTimes,
            xMax: plotDuration,
            xLabel: "Time (s)",
        });
    });

    logTemporaryMetaHumanMPAmpRangeAnalysis(validBones);
    
    // Do FFT analysis to PCA angle 
    const sample_freq = 30;
    validBones.forEach(bone => {
        bone.sample_freq = sample_freq;
        bone.FrequencyMaxHz = Number(bone.FrequencyMaxHz) || 5;
        bone.FrequencyMinCorrelation = Number.isFinite(Number(bone.FrequencyMinCorrelation))
            ? Number(bone.FrequencyMinCorrelation)
            : 0.5;
        bone.FrequencyEstimate = estimateBoneFrequency(
            bone.Ori.MPAngle,
            bone.sample_freq,
            bone.FrequencyMaxHz,
            bone.FrequencyMinCorrelation
        );
        bone.Ori.MPFFTResult = getFFT(bone.Ori.MPAmp, bone.sample_freq);
        addAlternativeReferenceData(bone.Ori, bone.sample_freq);
        
        // Plot FFT spectrum and save
        bone.Ori.MPSpectrumPlot = plotSpectrum(bone.Ori.MPFFTResult, {
            popup: { kind: "skeleton", id: bone.id },
            frequencyEstimate: bone.FrequencyEstimate,
        });
        bone.Ori.MPFourierPlot = plotAngleSpectrum3D({
            currentAngleTrack: bone.Ori.MPAngle,
            originAngleTrack: bone.Ori.MPAngle,
            currentFFTResult: bone.Ori.MPFFTResult,
            originFFTResult: bone.Ori.MPFFTResult,
        }, {
            popup: { kind: "skeleton", id: bone.id }
        });
    });

    // Group all newly added properties into BoneInfo.Ori and deep clone to BoneInfo.New
    validBones.forEach(bone => {
        bone.New = deepClone(bone.Ori);
    });

    return validBones;
};
