import * as THREE from 'three';

export function plotPldPspaceLoc(scene, pldInfo, pldId) {
    const lineColor = 0x000000;
    const pointColor = 0x0000ff;
    const pointSize = 0.1;
    const scale = 15;

    const bone = pldInfo.find(b => b.id === pldId);
    if (!bone || !bone.PspaceAnimTrack || bone.PspaceAnimTrack.length === 0) {
        console.warn(`Bone ID ${pldId} has no PspaceAnimTrack`);
        return;
    }

    // Set points
    const points = bone.PspaceAnimTrack.map(frame => {
        const v = new THREE.Vector3(...frame);
        v.multiplyScalar(scale);
        return v;
    });
    
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

    // Add index labels
    points.forEach((pt, idx) => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(idx, 32, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(0.3, 0.3, 0.3); 
        sprite.position.copy(pt);
        scene.add(sprite);
    });

    console.log(`Bone trajectory for ID ${pldId} plotted with ${points.length} frames.`);
}


// import * as THREE from 'three';

// export function plotPspaceLoc(scene, boneInfo, boneId) {
//     const lineColor = 0x000000;
//     const pointColor = 0x0000ff;
//     const pointSize = 0.1;

//     const bone = boneInfo.find(b => b.id === boneId);
//     if (!bone || !bone.PspaceAnimTrack || bone.PspaceAnimTrack.length === 0) {
//         console.warn(`Bone ID ${boneId} has no PspaceAnimTrack`);
//         return;
//     }

//     // Set points
//     const points = bone.PspaceAnimTrack.map(frame => new THREE.Vector3(...frame));

//     // Plot line
//     const geometry = new THREE.BufferGeometry().setFromPoints(points);
//     const lineMaterial = new THREE.LineBasicMaterial({ color: lineColor });
//     const line = new THREE.Line(geometry, lineMaterial);
//     scene.add(line);

//     // Plot points
//     const pointGeometry = new THREE.BufferGeometry().setFromPoints(points);
//     const pointMaterial = new THREE.PointsMaterial({ color: pointColor, size: pointSize });
//     const pointsMesh = new THREE.Points(pointGeometry, pointMaterial);
//     scene.add(pointsMesh);

//     console.log(`Bone trajectory for ID ${boneId} plotted with ${points.length} frames.`);
// }