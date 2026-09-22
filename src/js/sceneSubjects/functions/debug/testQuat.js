import * as THREE from 'three';

export function testQuat(quatTrack, bone) {
    const frameCount = quatTrack.values.length / 4; // assuming [x,y,z,w] per frame
    const pspaceTrack = [];
    const upTrack = [];
    const eulerTrack = [];

    // Set upVector to record roll angle
    let upVector = new THREE.Vector3(0, 1, 0);
    if (Math.abs(bone.oriVector.clone().normalize().dot(upVector)) > 0.9) {
        upVector = new THREE.Vector3(0, 0, 1);
    }

    // Forward
    for (let f = 0; f < frameCount; f++) {
        const qx = quatTrack.values[f*4 + 0];
        const qy = quatTrack.values[f*4 + 1];
        const qz = quatTrack.values[f*4 + 2];
        const qw = quatTrack.values[f*4 + 3];

        const quat = new THREE.Quaternion(qx, qy, qz, qw);
        const euler = new THREE.Euler().setFromQuaternion(quat, 'XYZ');

        // Main vector
        const rotatedVec = bone.oriVector.clone().applyQuaternion(quat);
        pspaceTrack.push(rotatedVec.toArray());

        // Roll angle
        const rotatedUp = upVector.clone().applyQuaternion(quat);
        upTrack.push(rotatedUp.toArray());

        eulerTrack.push([euler.x, euler.y, euler.z]);
    }

    // Inverse
    const quatTrackRecovered = [];
    const eulerTrackRecovered = [];

    for (let f = 0; f < frameCount; f++) {
        const xDir = new THREE.Vector3(...pspaceTrack[f]).normalize();
        const yDir = new THREE.Vector3(...upTrack[f]).normalize();

        const zDir = new THREE.Vector3().crossVectors(xDir, yDir).normalize();
        const yOrtho = new THREE.Vector3().crossVectors(zDir, xDir).normalize();

        const mat = new THREE.Matrix4();
        mat.makeBasis(xDir, yOrtho, zDir); // columns = X,Y,Z

        const quatRecovered = new THREE.Quaternion().setFromRotationMatrix(mat);

        quatTrackRecovered.push([quatRecovered.x, quatRecovered.y, quatRecovered.z, quatRecovered.w]);

        const eulerRecovered = new THREE.Euler().setFromQuaternion(quatRecovered, 'XYZ');
        eulerTrackRecovered.push([eulerRecovered.x, eulerRecovered.y, eulerRecovered.z]);
    }

    return {
        pspaceTrack,
        upTrack,
        eulerTrack,
        quatTrackRecovered,
        eulerTrackRecovered
    };
}
