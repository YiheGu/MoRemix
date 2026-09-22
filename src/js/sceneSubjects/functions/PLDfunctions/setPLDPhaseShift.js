export function setPLDPhaseShift(targetPldParams, targetPld) {
    const phaseShift = targetPldParams.PhaseShift;
    const nFrames = targetPld.nFrames;
    const shiftFrames = Math.floor(phaseShift * nFrames);

    if (!targetPld.New || !targetPld.New.PspaceAnimTrack) return;
    if (shiftFrames === 0) return;

    const src = targetPld.New.PspaceAnimTrack; // array of per-frame vectors
    const totalFrames = src.length;

    const tail = src.slice(totalFrames - shiftFrames);
    const head = src.slice(0, totalFrames - shiftFrames);
    targetPld.New.PspaceAnimTrack = tail.concat(head);

    targetPld.New.keyBoneLen = targetPld.New.PspaceAnimTrack.map((frame) => {
        if (!Array.isArray(frame) || frame.length < 3) return 0;
        const x = Number(frame[0]) || 0;
        const y = Number(frame[1]) || 0;
        const z = Number(frame[2]) || 0;
        return Math.sqrt(x * x + y * y + z * z);
    });
}
