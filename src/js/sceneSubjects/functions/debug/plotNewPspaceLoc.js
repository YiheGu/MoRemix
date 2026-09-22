import * as THREE from 'three';

export function plotNewPspaceLoc(scene, boneInfo, boneId) {
    const lineColor = 0xff0000;
    const pointColor = 0x0000ff;
    const pointSize = 0.05;

    const bone = boneInfo.find(b => b.id === boneId);
    if (!bone || !bone.newPspaceLoc || bone.newPspaceLoc.length === 0) {
        console.warn(`Bone ID ${boneId} has no newPspaceLoc`);
        return;
    }

    // Set points
    const points = bone.newPspaceLoc.map(frame => new THREE.Vector3(...frame));

    // Plot line
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const lineMaterial = new THREE.LineBasicMaterial({ color: lineColor });
    const line = new THREE.Line(geometry, lineMaterial);
    scene.add(line);

    // Plot points
    const pointGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const pointMaterial = new THREE.PointsMaterial({ color: pointColor, size: pointSize });
    const pointsMesh = new THREE.Points(pointGeometry, pointMaterial);
    scene.add(pointsMesh);

    console.log(`Bone trajectory for ID ${boneId} plotted with ${points.length} frames.`);
}