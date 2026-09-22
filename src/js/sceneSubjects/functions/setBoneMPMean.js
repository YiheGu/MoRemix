import {
    addReferenceOffset,
    getOriginalMPReference,
    normalizeMotionReferenceMode,
    usesStartEndReference,
    usesStartPointReference,
} from "./motionReference";

export function setBoneMPMean(targetBoneParams, targetBone){
    // Update the selected MP reference value.
    
    const meanAdd = targetBoneParams.MPAmp.meanAdd;

    const referenceValue = addReferenceOffset(
        getOriginalMPReference(targetBone, targetBoneParams),
        meanAdd
    );
    targetBone.New.MPReferenceMode = normalizeMotionReferenceMode(targetBoneParams?.referenceMode);
    targetBone.New.MPReferenceValue = referenceValue;
    if (usesStartEndReference(targetBoneParams)) {
        targetBone.New.MPStartEndBaseline = [...referenceValue];
    } else if (usesStartPointReference(targetBoneParams)) {
        targetBone.New.MPStartPoint = referenceValue;
    } else {
        targetBone.New.MPMean = referenceValue;
    }
    return referenceValue;
}
