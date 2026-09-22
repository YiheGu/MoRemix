import * as THREE from "three";
import { yieldEvery } from "./yieldToMainThread";

export async function setBoneFrequency(targetBoneParams, targetBone) {
    const times = Array.from(targetBone?.Ori?.QuatAnimTrack?.times || []);
    const nFrames = times.length;
    const mapping = await createFrequencyTimeMapping(times, targetBoneParams?.FrequencyScale);
    if (!mapping.changed) return times;
    const { sourceTimes, outputTimes, mappedTimes, startTime } = mapping;

    targetBone.New.QuatAnimTrack = await retimeQuaternions(
        targetBone.New.QuatAnimTrack,
        sourceTimes,
        mappedTimes
    );

    for (const key of ["PspaceAnimTrack", "MPAngle", "V3Loc", "MPProLen"]) {
        const source = targetBone.New[key];
        if (!Array.isArray(source) || source.length !== nFrames) continue;
        targetBone.New[key] = await retimeLinearSeries(source, sourceTimes, mappedTimes);
    }

    return outputTimes.map(time => time + startTime);
}

export async function createFrequencyTimeMapping(trackTimes, frequencyScale = 1) {
    const times = Array.from(trackTimes || [], Number);
    const nFrames = times.length;
    const scale = Number(frequencyScale);
    const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    if (nFrames < 2) {
        return { changed: false, startTime: times[0] || 0, sourceTimes: times, outputTimes: times, mappedTimes: times };
    }

    const startTime = times[0];
    const sourceDuration = times[nFrames - 1] - startTime;
    const sourceTimes = times.map(time => time - startTime);
    if (!(sourceDuration > 0) || Math.abs(safeScale - 1) < 1e-12) {
        return { changed: false, startTime, sourceTimes, outputTimes: sourceTimes, mappedTimes: sourceTimes };
    }

    const localDuration = sourceDuration / safeScale;
    const sampleStep = sourceDuration / (nFrames - 1);
    const outputFrameCount = Math.max(2, Math.round(localDuration / sampleStep) + 1);
    const outputTimes = new Array(outputFrameCount);
    const mappedTimes = new Array(outputFrameCount);
    for (let index = 0; index < outputFrameCount; index++) {
        const time = index * localDuration / (outputFrameCount - 1);
        outputTimes[index] = time;
        const mapped = positiveModulo(safeScale * time, sourceDuration);
        const isFinalKey = index === outputFrameCount - 1;
        mappedTimes[index] = isFinalKey && Math.abs(mapped) < 1e-9 && time > 0 ? sourceDuration : mapped;
        const pendingYield = yieldEvery(index);
        if (pendingYield) await pendingYield;
    }
    return { changed: true, startTime, sourceTimes, outputTimes, mappedTimes };
}

function positiveModulo(value, modulus) {
    return ((value % modulus) + modulus) % modulus;
}

function findInterval(times, time) {
    let low = 0;
    let high = times.length - 1;
    while (low + 1 < high) {
        const mid = Math.floor((low + high) / 2);
        if (times[mid] <= time) low = mid;
        else high = mid;
    }
    const span = times[high] - times[low];
    return [low, high, span > 0 ? (time - times[low]) / span : 0];
}

export async function retimeLinearSeries(source, sourceTimes, mappedTimes) {
    const result = new Array(mappedTimes.length);
    for (let index = 0; index < mappedTimes.length; index++) {
        const time = mappedTimes[index];
        const [from, to, alpha] = findInterval(sourceTimes, time);
        if (Array.isArray(source[from])) {
            result[index] = source[from].map((value, componentIndex) =>
                THREE.MathUtils.lerp(value, source[to][componentIndex], alpha)
            );
        } else {
            result[index] = THREE.MathUtils.lerp(source[from], source[to], alpha);
        }
        const pendingYield = yieldEvery(index);
        if (pendingYield) await pendingYield;
    }
    return result;
}

async function retimeQuaternions(source, sourceTimes, mappedTimes) {
    if (!source || source.length !== sourceTimes.length * 4) return source;
    const result = [];
    const q0 = new THREE.Quaternion();
    const q1 = new THREE.Quaternion();
    const q = new THREE.Quaternion();
    for (let index = 0; index < mappedTimes.length; index++) {
        const time = mappedTimes[index];
        const [from, to, alpha] = findInterval(sourceTimes, time);
        const fromOffset = from * 4;
        const toOffset = to * 4;
        q0.set(
            source[fromOffset], source[fromOffset + 1], source[fromOffset + 2], source[fromOffset + 3]
        );
        q1.set(
            source[toOffset], source[toOffset + 1], source[toOffset + 2], source[toOffset + 3]
        );
        q.slerpQuaternions(q0, q1, alpha).normalize();
        result.push(q.x, q.y, q.z, q.w);
        const pendingYield = yieldEvery(index);
        if (pendingYield) await pendingYield;
    }
    return result;
}
