import * as THREE from "three";

const BASE_TARGET = new THREE.Vector3(0, 8, 0);

export function applyCameraAngle(context, angle) {
  if (!context?.camera) return null;
  const safeYaw = Number(angle?.yaw) || 0;
  const safePitch = Math.max(-89.999, Math.min(89.999, Number(angle?.pitch) || 0));
  const distance = Math.max(0.001, Number(angle?.distance) || 30);
  const moveX = Number(angle?.moveX) || 0;
  const moveY = Number(angle?.moveY) || 0;

  const yawRad = THREE.MathUtils.degToRad(safeYaw);
  const pitchRad = THREE.MathUtils.degToRad(safePitch);
  const cosPitch = Math.cos(pitchRad);

  const target = BASE_TARGET.clone();
  const cameraPos = new THREE.Vector3(
    target.x + distance * Math.sin(yawRad) * cosPitch,
    target.y + distance * Math.sin(pitchRad),
    target.z + distance * Math.cos(yawRad) * cosPitch
  );

  const forward = new THREE.Vector3().subVectors(target, cameraPos);
  if (forward.lengthSq() > 1e-10) {
    forward.normalize();
  } else {
    forward.set(0, 0, -1);
  }

  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
  if (right.lengthSq() > 1e-10) {
    right.normalize();
  } else {
    right.set(1, 0, 0);
  }

  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  const panOffset = new THREE.Vector3()
    .addScaledVector(right, moveX)
    .addScaledVector(up, moveY);

  const shiftedTarget = target.clone().add(panOffset);
  const shiftedCameraPos = cameraPos.clone().add(panOffset);

  context.camera.position.copy(shiftedCameraPos);
  context.camera.lookAt(shiftedTarget);
  if (context.controls) {
    context.controls.target.copy(shiftedTarget);
    context.controls.update();
  }

  return {
    yaw: safeYaw,
    pitch: safePitch,
    distance,
    moveX,
    moveY,
  };
}

export function readCameraAngle(context) {
  if (!context?.camera) {
    return {
      yaw: 0,
      pitch: 0,
      distance: 30,
      moveX: 0,
      moveY: 0,
    };
  }

  const target = context.controls?.target?.clone?.() || BASE_TARGET.clone();
  const offset = context.camera.position.clone().sub(target);
  const distance = Math.max(0.001, offset.length());
  const horizontal = Math.sqrt(offset.x * offset.x + offset.z * offset.z);
  const yaw = THREE.MathUtils.radToDeg(Math.atan2(offset.x, offset.z));
  const pitch = THREE.MathUtils.radToDeg(Math.atan2(offset.y, horizontal));

  const baseTarget = BASE_TARGET.clone();
  const yawRad = THREE.MathUtils.degToRad(yaw);
  const pitchRad = THREE.MathUtils.degToRad(pitch);
  const cosPitch = Math.cos(pitchRad);
  const baseCameraPos = new THREE.Vector3(
    baseTarget.x + distance * Math.sin(yawRad) * cosPitch,
    baseTarget.y + distance * Math.sin(pitchRad),
    baseTarget.z + distance * Math.cos(yawRad) * cosPitch
  );

  const forward = new THREE.Vector3().subVectors(baseTarget, baseCameraPos);
  if (forward.lengthSq() > 1e-10) {
    forward.normalize();
  } else {
    forward.set(0, 0, -1);
  }
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
  if (right.lengthSq() > 1e-10) {
    right.normalize();
  } else {
    right.set(1, 0, 0);
  }
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();

  const deltaTarget = target.clone().sub(baseTarget);
  const moveX = deltaTarget.dot(right);
  const moveY = deltaTarget.dot(up);

  return {
    yaw,
    pitch,
    distance,
    moveX,
    moveY,
  };
}
