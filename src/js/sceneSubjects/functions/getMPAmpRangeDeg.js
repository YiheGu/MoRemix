const RAD_TO_DEG = 180 / Math.PI;

export function getMPAmpRangeDeg(mpAmp = []) {
    if (!Array.isArray(mpAmp) || mpAmp.length < 1) return 0;

    let minAmp = Infinity;
    let maxAmp = -Infinity;

    mpAmp.forEach((value) => {
        const amp = Number(value);
        if (!Number.isFinite(amp)) return;
        minAmp = Math.min(minAmp, amp);
        maxAmp = Math.max(maxAmp, amp);
    });

    if (!Number.isFinite(minAmp) || !Number.isFinite(maxAmp)) return 0;
    return (maxAmp - minAmp) * RAD_TO_DEG;
}
