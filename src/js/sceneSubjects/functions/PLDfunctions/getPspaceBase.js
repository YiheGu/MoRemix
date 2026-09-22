import * as THREE from 'three';

export function getPspaceBase(parentPos, method, firstFrameParentPos, isNew, defined_base){
    let pspaceBase = [];
    switch (method){
        case 'FirstFrame':
            pspaceBase = getFirstFrameBase(parentPos, firstFrameParentPos, isNew);
            return pspaceBase;
        
        case 'DefinedOrigin':
            pspaceBase = getDefinedBase(parentPos, defined_base);
            return pspaceBase;
    };
}

function getFirstFrameBase(parentPos, ffParentPos, isNew) {

    const testPV1 = new THREE.Vector3(2.182264, -4.640461, 0.348356);
    const testPV2 = new THREE.Vector3(2.183332, -4.642180, 0.319027);

    // Test

    const frameCount = parentPos.length / 3;
    const baseVector = [];
    const allPV = [];

    let base_vx, base_vy, base_vz;

    for (let f = 0; f < frameCount; f++) {
        const pv = new THREE.Vector3(
            parentPos[f * 3],
            parentPos[f * 3 + 1],
            parentPos[f * 3 + 2]
        );

        const vx_norm = pv.length();
        const vx_hat = pv.clone().divideScalar(vx_norm);

        if (f === 0 & !isNew) {
            let av = new THREE.Vector3(0, 1, 0);
            if (vx_hat.clone().cross(av).length() === 0) {
                av = new THREE.Vector3(0, 0, 1);
            }

            const vy = vx_hat.clone().cross(av).normalize();
            const vz = vx_hat.clone().cross(vy).normalize();

            base_vx = vx_hat.clone();
            base_vy = vy.clone();
            base_vz = vz.clone();

            baseVector.push([base_vx, base_vy, base_vz]);
            
        } else {
            if (f === 0){
                const refPV = new THREE.Vector3(
                    ffParentPos[f * 3],
                    ffParentPos[f * 3 + 1],
                    ffParentPos[f * 3 + 2]
                );

                const ref_vx_norm = refPV.length();
                const ref_vx_hat = refPV.clone().divideScalar(ref_vx_norm);

                let ref_av = new THREE.Vector3(0,1,0);
                if (ref_vx_hat.clone().cross(ref_av).length() === 0) {
                    ref_av = new THREE.Vector3(0,0,1);
                }

                const ref_vy = ref_vx_hat.clone().cross(ref_av).normalize();
                const ref_vz = ref_vx_hat.clone().cross(ref_vy).normalize();

                base_vx = ref_vx_hat.clone();
                base_vy = ref_vy.clone();
                base_vz = ref_vz.clone();
            };
            const R = getRotMatrix(base_vx, vx_hat); 

            const vy_hat = base_vy.clone().applyMatrix3(R);
            const vz_hat = base_vz.clone().applyMatrix3(R);

            baseVector.push([vx_hat, vy_hat, vz_hat]);
        }
        allPV.push(pv);
    }

    return [baseVector, allPV];
}

function getDefinedBase(parentPos, defined_base) {
    const frameCount = parentPos.length / 3;
    const baseVector = [];

    const base_vx = defined_base.vx.clone();
    const base_vy = defined_base.vy.clone();
    const base_vz = defined_base.vz.clone();

    for (let f = 0; f < frameCount; f++) {
        const pv = new THREE.Vector3(
            parentPos[f * 3],
            parentPos[f * 3 + 1],
            parentPos[f * 3 + 2]
        );

        const vx_hat = pv.clone().normalize();
        const R = getRotMatrix(base_vx, vx_hat);

        const vy_hat = base_vy.clone().applyMatrix3(R);
        const vz_hat = base_vz.clone().applyMatrix3(R);

        baseVector.push([vx_hat, vy_hat, vz_hat]);
    }

    return baseVector;
}

function getRotMatrix(origin_vector, new_vector) {
    // Normalize both vectors
    const v1 = origin_vector.clone().normalize();
    const v2 = new_vector.clone().normalize();

    // Compute rotation axis
    let rotation_axis = v1.clone().cross(v2);
    const axis_len = rotation_axis.length();

    // If vectors are parallel or opposite, handle separately
    if (axis_len < 1e-8) {
        const dot = v1.dot(v2);
        // same direction → identity
        if (dot > 0.999999) {
            return new THREE.Matrix3().identity();
        }
        // opposite direction → rotate 180° around any orthogonal axis
        let ortho = new THREE.Vector3(1, 0, 0);
        if (Math.abs(v1.x) > 0.9) ortho.set(0, 1, 0);
        rotation_axis = v1.clone().cross(ortho).normalize();
        const theta = Math.PI;
        const skew_axis = new THREE.Matrix3().set(
            0, -rotation_axis.z, rotation_axis.y,
            rotation_axis.z, 0, -rotation_axis.x,
            -rotation_axis.y, rotation_axis.x, 0
        );
        const skew_axis2 = skew_axis.clone().multiply(skew_axis);
        const I = new THREE.Matrix3().identity();

        const rot_mat = new THREE.Matrix3();
        for (let i = 0; i < 9; i++) {
            rot_mat.elements[i] =
                I.elements[i] +
                Math.sin(theta) * skew_axis.elements[i] +
                (1 - Math.cos(theta)) * skew_axis2.elements[i];
        }
        return rot_mat;
    }

    // Normalize rotation axis
    rotation_axis.divideScalar(axis_len);

    // Calculate rotation angle θ
    const cos_theta = v1.dot(v2);
    const theta = Math.acos(Math.min(Math.max(cos_theta, -1), 1)); // clamp

    // Rodrigues rotation formula
    const skew_axis = new THREE.Matrix3().set(
        0, -rotation_axis.z, rotation_axis.y,
        rotation_axis.z, 0, -rotation_axis.x,
        -rotation_axis.y, rotation_axis.x, 0
    );

    const skew_axis2 = skew_axis.clone().multiply(skew_axis);
    const I = new THREE.Matrix3().identity();

    const rot_mat = new THREE.Matrix3();
    for (let i = 0; i < 9; i++) {
        rot_mat.elements[i] =
            I.elements[i] +
            Math.sin(theta) * skew_axis.elements[i] +
            (1 - Math.cos(theta)) * skew_axis2.elements[i];
    }

    return rot_mat;
}