import {
    addReferenceOffset,
    getOriginalV3Reference,
    normalizeMotionReferenceMode,
    usesStartEndReference,
    usesStartPointReference,
} from "../motionReference";

export function setPldV3Mean(targetPldParams, targetPld){
    // Update the selected V3 reference value.
    // Parameters
    const meanAdd = targetPldParams.V3MeanAdd;  // scalar
    const boneLen = targetPld.lenTrack;  // array
    
    // Multiply scalar meanAdd by each element in boneLen array
    const trueAdd = boneLen.map(val => val * meanAdd);

    // Average trueAdd to get a scalar
    const meanTrueAdd = trueAdd.reduce((sum, val) => sum + val, 0) / trueAdd.length;

    const referenceValue = addReferenceOffset(
        getOriginalV3Reference(targetPld, targetPldParams),
        meanTrueAdd
    );
    targetPld.New.V3ReferenceMode = normalizeMotionReferenceMode(targetPldParams?.referenceMode);
    targetPld.New.V3ReferenceValue = referenceValue;
    if (usesStartEndReference(targetPldParams)) {
        targetPld.New.V3StartEndBaseline = [...referenceValue];
    } else if (usesStartPointReference(targetPldParams)) {
        targetPld.New.V3StartPoint = referenceValue;
    } else {
        targetPld.New.V3Mean = referenceValue;
    }
    return referenceValue;
}
