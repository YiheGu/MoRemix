import {
    addReferenceOffset,
    getOriginalV3Reference,
    normalizeMotionReferenceMode,
    usesStartEndReference,
    usesStartPointReference,
} from "./motionReference";

export function setBoneV3Mean(targetBoneParams, targetBone){
    // Update the selected V3 reference value.

    // Parameters
    const meanAdd = targetBoneParams.V3MeanAdd;
    const boneLen = targetBone.oriVector.length();
    const trueAdd = meanAdd*boneLen;

    const referenceValue = addReferenceOffset(
        getOriginalV3Reference(targetBone, targetBoneParams),
        trueAdd
    );
    targetBone.New.V3ReferenceMode = normalizeMotionReferenceMode(targetBoneParams?.referenceMode);
    targetBone.New.V3ReferenceValue = referenceValue;
    if (usesStartEndReference(targetBoneParams)) {
        targetBone.New.V3StartEndBaseline = [...referenceValue];
    } else if (usesStartPointReference(targetBoneParams)) {
        targetBone.New.V3StartPoint = referenceValue;
    } else {
        targetBone.New.V3Mean = referenceValue;
    }
    return referenceValue;
}
