import * as THREE from "three";

export function plotPspaceLoc(scene, boneInfo, boneId) {
  const lineColor = 0x6f95ff;
  const pointColor = 0xaec5ff;
  const pointSize = 0.085;

  const bone = boneInfo.find((b) => b.id === boneId);
  if (!bone || !bone.PspaceAnimTrack || bone.PspaceAnimTrack.length === 0) {
    console.warn(`Bone ID ${boneId} has no PspaceAnimTrack`);
    return;
  }

  const points = bone.PspaceAnimTrack.map((frame) => new THREE.Vector3(...frame));

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const lineMaterial = new THREE.LineBasicMaterial({
    color: lineColor,
    transparent: true,
    opacity: 0.95,
  });
  const line = new THREE.Line(geometry, lineMaterial);
  scene.add(line);

  const pointGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const pointMaterial = new THREE.PointsMaterial({
    color: pointColor,
    size: pointSize,
    transparent: true,
    opacity: 0.95,
  });
  const pointsMesh = new THREE.Points(pointGeometry, pointMaterial);
  scene.add(pointsMesh);

  points.forEach((pt, idx) => {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "rgba(16, 21, 37, 0.9)";
    ctx.fillRect(10, 22, 76, 52);
    ctx.strokeStyle = "rgba(111, 149, 255, 0.7)";
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 22, 76, 52);
    ctx.fillStyle = "#f1f5ff";
    ctx.font = "bold 24px Segoe UI";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(idx, 48, 48);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(0.48, 0.48, 0.48);
    sprite.position.copy(pt);
    scene.add(sprite);
  });

  console.log(`Bone trajectory for ID ${boneId} plotted with ${points.length} frames.`);
}
