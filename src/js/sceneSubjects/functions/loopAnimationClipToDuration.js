import * as THREE from "three";
import { yieldEvery, yieldToMainThread } from "./yieldToMainThread";

export function loopAnimationClipToDuration(sourceClip, targetDuration) {
    const duration = Number(targetDuration);
    if (!sourceClip || !(duration > 0)) return null;
    const tracks = sourceClip.tracks.map(track => loopTrackToDuration(track, duration));
    return new THREE.AnimationClip(sourceClip.name, duration, tracks);
}

export async function loopAnimationClipToDurationAsync(sourceClip, targetDuration) {
    const duration = Number(targetDuration);
    if (!sourceClip || !(duration > 0)) return null;
    const tracks = [];
    for (let index = 0; index < sourceClip.tracks.length; index++) {
        tracks.push(await loopTrackToDurationAsync(sourceClip.tracks[index], duration));
        if (index > 0 && index % 4 === 0) await yieldToMainThread();
    }
    return new THREE.AnimationClip(sourceClip.name, duration, tracks);
}

function loopTrackToDuration(track, targetDuration) {
    const sourceTimes = Array.from(track.times || []);
    if (sourceTimes.length < 2) return track.clone();

    const startTime = sourceTimes[0];
    const sourceDuration = sourceTimes[sourceTimes.length - 1] - startTime;
    if (!(sourceDuration > 0)) return track.clone();

    const outputTimes = createLoopedTimes(sourceTimes, targetDuration);

    const interpolant = track.createInterpolant();
    const valueSize = track.getValueSize();
    const outputValues = [];
    outputTimes.forEach((time, index) => {
        const preserveSourceEnd = index === outputTimes.length - 1
            && targetDuration <= sourceDuration + 1e-9;
        const sourceTime = getLoopedSourceTime(time, sourceDuration, startTime, preserveSourceEnd);
        const value = interpolant.evaluate(sourceTime);
        for (let i = 0; i < valueSize; i++) outputValues.push(value[i]);
    });

    return new track.constructor(
        track.name,
        outputTimes,
        outputValues,
        track.getInterpolation()
    );
}

async function loopTrackToDurationAsync(track, targetDuration) {
    const sourceTimes = Array.from(track.times || []);
    if (sourceTimes.length < 2) return track.clone();
    const startTime = sourceTimes[0];
    const sourceDuration = sourceTimes[sourceTimes.length - 1] - startTime;
    if (!(sourceDuration > 0)) return track.clone();

    const outputTimes = await createLoopedTimesAsync(sourceTimes, targetDuration);
    const interpolant = track.createInterpolant();
    const valueSize = track.getValueSize();
    const outputValues = [];
    for (let index = 0; index < outputTimes.length; index++) {
        const time = outputTimes[index];
        const preserveSourceEnd = index === outputTimes.length - 1
            && targetDuration <= sourceDuration + 1e-9;
        const sourceTime = getLoopedSourceTime(time, sourceDuration, startTime, preserveSourceEnd);
        const value = interpolant.evaluate(sourceTime);
        for (let componentIndex = 0; componentIndex < valueSize; componentIndex++) {
            outputValues.push(value[componentIndex]);
        }
        const pendingYield = yieldEvery(index);
        if (pendingYield) await pendingYield;
    }
    return new track.constructor(track.name, outputTimes, outputValues, track.getInterpolation());
}

export function loopScalarSeriesToDuration(sourceValues, sourceTrackTimes, targetDuration, targetTimes = null) {
    const values = Array.isArray(sourceValues) ? sourceValues : [];
    const sourceTimes = Array.from(sourceTrackTimes || []);
    if (values.length < 2 || values.length !== sourceTimes.length) {
        return { times: sourceTimes, values: [...values] };
    }

    const startTime = sourceTimes[0];
    const sourceDuration = sourceTimes[sourceTimes.length - 1] - startTime;
    if (!(sourceDuration > 0)) return { times: sourceTimes, values: [...values] };

    const outputTimes = targetTimes
        ? Array.from(targetTimes)
        : createLoopedTimes(sourceTimes, targetDuration);
    const outputValues = outputTimes.map((time, index) => {
        const preserveSourceEnd = index === outputTimes.length - 1
            && targetDuration <= sourceDuration + 1e-9;
        const sourceTime = getLoopedSourceTime(
            time,
            sourceDuration,
            startTime,
            preserveSourceEnd
        );
        return interpolateScalar(values, sourceTimes, sourceTime);
    });
    return { times: outputTimes, values: outputValues };
}

function createLoopedTimes(sourceTimes, targetDuration) {
    const startTime = sourceTimes[0];
    const sourceDuration = sourceTimes[sourceTimes.length - 1] - startTime;
    const outputTimes = [];
    for (let offset = 0; offset <= targetDuration + 1e-9; offset += sourceDuration) {
        sourceTimes.forEach(time => {
            const outputTime = time - startTime + offset;
            if (outputTime > targetDuration + 1e-9) return;
            if (outputTimes.length > 0 && Math.abs(outputTime - outputTimes[outputTimes.length - 1]) < 1e-9) return;
            outputTimes.push(Math.min(outputTime, targetDuration));
        });
    }
    if (outputTimes.length < 1 || outputTimes[outputTimes.length - 1] < targetDuration - 1e-9) {
        outputTimes.push(targetDuration);
    }
    return outputTimes;
}

async function createLoopedTimesAsync(sourceTimes, targetDuration) {
    const startTime = sourceTimes[0];
    const sourceDuration = sourceTimes[sourceTimes.length - 1] - startTime;
    const outputTimes = [];
    let appendedCount = 0;
    for (let offset = 0; offset <= targetDuration + 1e-9; offset += sourceDuration) {
        for (const time of sourceTimes) {
            const outputTime = time - startTime + offset;
            if (outputTime > targetDuration + 1e-9) break;
            if (outputTimes.length > 0 && Math.abs(outputTime - outputTimes[outputTimes.length - 1]) < 1e-9) continue;
            outputTimes.push(Math.min(outputTime, targetDuration));
            appendedCount++;
            const pendingYield = yieldEvery(appendedCount);
            if (pendingYield) await pendingYield;
        }
    }
    if (outputTimes.length < 1 || outputTimes[outputTimes.length - 1] < targetDuration - 1e-9) {
        outputTimes.push(targetDuration);
    }
    return outputTimes;
}

function interpolateScalar(values, times, time) {
    let low = 0;
    let high = times.length - 1;
    while (low + 1 < high) {
        const mid = Math.floor((low + high) / 2);
        if (times[mid] <= time) low = mid;
        else high = mid;
    }
    const span = times[high] - times[low];
    const alpha = span > 0 ? (time - times[low]) / span : 0;
    return THREE.MathUtils.lerp(values[low], values[high], alpha);
}

function getLoopedSourceTime(time, sourceDuration, startTime, preserveSourceEnd) {
    const wrapped = ((time % sourceDuration) + sourceDuration) % sourceDuration;
    if (preserveSourceEnd && Math.abs(wrapped) < 1e-9 && time > 0) {
        return startTime + sourceDuration;
    }
    return startTime + wrapped;
}
