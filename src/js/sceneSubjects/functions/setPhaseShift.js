export function setPhaseShift(targetBoneParams, targetBone) {
    const phaseShift = targetBoneParams.PhaseShift;
    const nFrames = Math.floor((targetBone?.New?.QuatAnimTrack?.length || 0) / 4);
    if (nFrames < 1) return;
    const shiftFrames = ((Math.floor(phaseShift * nFrames) % nFrames) + nFrames) % nFrames;

    if (shiftFrames === 0) return;

    targetBone.New.QuatAnimTrack = circularShiftFlat(
        targetBone.New.QuatAnimTrack,
        shiftFrames * 4
    );
    ["PspaceAnimTrack", "MPAngle", "V3Loc", "MPProLen"].forEach(key => {
        const series = targetBone.New[key];
        if (!Array.isArray(series) || series.length !== nFrames) return;
        targetBone.New[key] = circularShiftFlat(series, shiftFrames);
    });
}

function circularShiftFlat(series, shift) {
    if (!series || series.length < 1 || shift === 0) return series;
    return series.slice(series.length - shift).concat(series.slice(0, series.length - shift));
}
