import {
    addReferenceOffset,
    getOriginalMPReference,
    normalizeMotionReferenceMode,
    usesStartEndReference,
    usesStartPointReference,
} from "../motionReference";

export function setPldMPMean(targetPldParams, targetPld){
    // Update the selected MP reference value.
    
    const meanAdd = targetPldParams.MPAmp.meanAdd;

    const referenceValue = addReferenceOffset(
        getOriginalMPReference(targetPld, targetPldParams),
        meanAdd
    );
    targetPld.New.MPReferenceMode = normalizeMotionReferenceMode(targetPldParams?.referenceMode);
    targetPld.New.MPReferenceValue = referenceValue;
    if (usesStartEndReference(targetPldParams)) {
        targetPld.New.MPStartEndBaseline = [...referenceValue];
    } else if (usesStartPointReference(targetPldParams)) {
        targetPld.New.MPStartPoint = referenceValue;
    } else {
        targetPld.New.MPMean = referenceValue;
    }
    return referenceValue;
}
