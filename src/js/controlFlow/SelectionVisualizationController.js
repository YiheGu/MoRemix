import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { markExcludedFromAnimationExport } from "../sceneSubjects/functions/exportAnimationModelOnly";

export function createSelectionVisualizationController({
  getPaneAScene,
  getPaneCPopupList,
  getTypeSelection,
  getSkeletalMotion,
  getPldMotion,
  getPaneSelectionCircleRadiusScale,
  getOriginalBoneTrajectoryPointSizeScale,
} = {}) {
  let paneASelectionViz = null;
  let paneAOriginalTrajectoryViz = null;
  let selectedPopupKey = null;
  let showOriginalBoneTrajectory = false;
  const originalTrajectoryCache = new WeakMap();

  function getAveragePositive(values, fallback = 1) {
    if (!Array.isArray(values) || values.length === 0) return fallback;
    const valid = values.map(Number).filter((v) => Number.isFinite(v) && v > 0);
    if (valid.length === 0) return fallback;
    return valid.reduce((sum, v) => sum + v, 0) / valid.length;
  }

  function getVectorLengthSafe(v, fallback = 1) {
    if (!v || typeof v.length !== "function") return fallback;
    const len = Number(v.length());
    return Number.isFinite(len) && len > 0 ? len : fallback;
  }

  function disposeObject3D(root) {
    if (!root) return;
    root.traverse((obj) => {
      if (obj.geometry && typeof obj.geometry.dispose === "function") {
        obj.geometry.dispose();
      }
      if (!obj.material) return;
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => {
          m?.map?.dispose?.();
          m?.dispose?.();
        });
      } else {
        obj.material.map?.dispose?.();
        obj.material.dispose?.();
      }
    });
  }

  function normalizeBasisVectors(v1, v2, v3) {
    const n1 = v1?.clone?.();
    const n2 = v2?.clone?.();
    let n3 = v3?.clone?.();
    if (!n1 || !n2 || !n3) return null;

    if (n1.lengthSq() < 1e-10 || n2.lengthSq() < 1e-10) return null;
    n1.normalize();

    n2.addScaledVector(n1, -n2.dot(n1));
    if (n2.lengthSq() < 1e-10) return null;
    n2.normalize();

    n3.addScaledVector(n1, -n3.dot(n1));
    n3.addScaledVector(n2, -n3.dot(n2));
    if (n3.lengthSq() < 1e-10) {
      n3 = new THREE.Vector3().crossVectors(n1, n2);
      if (n3.lengthSq() < 1e-10) return null;
    }
    n3.normalize();

    const rightHand = new THREE.Vector3().crossVectors(n1, n2);
    if (rightHand.dot(n3) < 0) {
      n3.multiplyScalar(-1);
    }
    return { v1: n1, v2: n2, v3: n3 };
  }

  function getPcaBasisVectors(info) {
    const coeff = info?.PCAResult?.coeff?.data;
    const v1Idx = Number(info?.V1Idx);
    const v2Idx = Number(info?.V2Idx);
    const v3Idx = Number(info?.V3Idx);

    if (!Array.isArray(coeff) || coeff.length < 3) return null;
    if (!Number.isFinite(v1Idx) || !Number.isFinite(v2Idx) || !Number.isFinite(v3Idx)) return null;

    const v1 = new THREE.Vector3(coeff[0]?.[v1Idx], coeff[1]?.[v1Idx], coeff[2]?.[v1Idx]);
    const v2 = new THREE.Vector3(coeff[0]?.[v2Idx], coeff[1]?.[v2Idx], coeff[2]?.[v2Idx]);
    const v3 = new THREE.Vector3(coeff[0]?.[v3Idx], coeff[1]?.[v3Idx], coeff[2]?.[v3Idx]);
    return normalizeBasisVectors(v1, v2, v3);
  }

  function applyBasisToGroup(group, basis) {
    const rot = new THREE.Matrix4().makeBasis(basis.v1, basis.v2, basis.v3);
    group.setRotationFromMatrix(rot);
  }

  function createAxisArrow(localDirection, length, color, shaftRadius) {
    const dir = localDirection.clone().normalize();
    const arrowGroup = new THREE.Group();

    const headLength = Math.max(length * 0.18, shaftRadius * 4);
    const shaftLength = Math.max(length - headLength, length * 0.55);
    const headRadius = shaftRadius * 2.5;

    const shaftGeom = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 12);
    const shaftMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
    const shaft = new THREE.Mesh(shaftGeom, shaftMat);
    shaft.position.y = shaftLength / 2;
    arrowGroup.add(shaft);

    const coneGeom = new THREE.ConeGeometry(headRadius, headLength, 16);
    const coneMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
    const cone = new THREE.Mesh(coneGeom, coneMat);
    cone.position.y = shaftLength + headLength / 2;
    arrowGroup.add(cone);

    const from = new THREE.Vector3(0, 1, 0);
    arrowGroup.quaternion.setFromUnitVectors(from, dir);
    return arrowGroup;
  }

  function createBasisVisualizationGroup(basis, axisLength, circleRadius) {
    const group = new THREE.Group();
    group.name = "mainPlaneVisualization";
    markExcludedFromAnimationExport(group, "mainPlaneVisualization");
    applyBasisToGroup(group, basis);

    const originGeom = new THREE.SphereGeometry(Math.max(circleRadius * 0.07, 0.02), 10, 10);
    const originMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const originDot = new THREE.Mesh(originGeom, originMat);
    group.add(originDot);

    const baseShaftRadius = Math.max(circleRadius * 0.04, axisLength * 0.015, 0.008);
    const v12ShaftRadius = Math.max(baseShaftRadius * 0.65, 0.006);
    const v3ShaftRadius = Math.max(baseShaftRadius * 1.1, v12ShaftRadius + 0.002);
    group.add(createAxisArrow(new THREE.Vector3(1, 0, 0), axisLength, 0xff4040, v12ShaftRadius));
    group.add(createAxisArrow(new THREE.Vector3(0, 1, 0), axisLength, 0x40ff40, v12ShaftRadius));
    group.add(createAxisArrow(new THREE.Vector3(0, 0, 1), axisLength, 0x4090ff, v3ShaftRadius));

    const planeGeom = new THREE.CircleGeometry(circleRadius, 72);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x5dbbff,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const plane = new THREE.Mesh(planeGeom, planeMat);
    group.add(plane);

    const ringGeom = new THREE.RingGeometry(circleRadius * 0.985, circleRadius, 72);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x8dd4ff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    group.add(ring);
    return group;
  }

  function resolveSkeletonPspacePlacement(boneInfo) {
    const skeletalMotion = getSkeletalMotion?.();
    const boneObj = skeletalMotion?.model?.getObjectByName(boneInfo?.name);
    if (!boneObj) return null;
    const anchor = boneObj.parent || boneObj;
    return {
      anchor,
      getLocalOrigin: () => (boneObj.parent ? boneObj.position.clone() : new THREE.Vector3(0, 0, 0)),
    };
  }

  function resolvePldPspacePlacement(pldInfo) {
    const pldMotion = getPldMotion?.();
    const group = pldMotion?.pldGroup;
    if (!group) return null;

    const parentId = Number(pldInfo?.parent) || 0;
    const pldId = Number(pldInfo?.id);
    const parentMesh = parentId > 0
      ? group.children.find((child) => child?.Id === parentId)
      : null;
    const currentMesh = group.children.find((child) => child?.Id === pldId);

    return {
      anchor: group,
      getLocalOrigin: () => {
        if (parentMesh) return parentMesh.position.clone();
        if (currentMesh) return currentMesh.position.clone();
        return new THREE.Vector3(0, 0, 0);
      },
    };
  }

  function getCurrentPldFrameIndex(pldInfo) {
    const frameCount = Number(pldInfo?.nFrames) || 0;
    if (frameCount <= 1) return 0;

    const pldMotion = getPldMotion?.();
    const duration = Number(pldMotion?.currentClip?.duration) || 0;
    if (duration <= 0) return 0;

    const t = Number(pldMotion?.mixer?.time) || 0;
    const normalized = (t % duration) / duration;
    return Math.min(frameCount - 1, Math.max(0, Math.floor(normalized * frameCount)));
  }

  function mapPldPcaBasisToWorldBasis(pldInfo, pcaBasis, frameIdx) {
    const frameBase = pldInfo?.New?.BaseVector?.[frameIdx];
    if (!Array.isArray(frameBase) || frameBase.length < 3) return pcaBasis;

    const [bx, by, bz] = frameBase;
    if (!bx || !by || !bz) return pcaBasis;

    const toWorld = (v) => new THREE.Vector3()
      .addScaledVector(bx, v.x)
      .addScaledVector(by, v.y)
      .addScaledVector(bz, v.z);

    return normalizeBasisVectors(
      toWorld(pcaBasis.v1),
      toWorld(pcaBasis.v2),
      toWorld(pcaBasis.v3)
    ) || pcaBasis;
  }

  function clearPaneASelectionVisualization() {
    clearOriginalBoneTrajectory();
    if (!paneASelectionViz?.group) {
      paneASelectionViz = null;
      return;
    }
    const { group } = paneASelectionViz;
    if (group.parent) {
      group.parent.remove(group);
    }
    disposeObject3D(group);
    paneASelectionViz = null;
  }

  function clearOriginalBoneTrajectory() {
    if (!paneAOriginalTrajectoryViz) return;
    if (paneAOriginalTrajectoryViz.parent) {
      paneAOriginalTrajectoryViz.parent.remove(paneAOriginalTrajectoryViz);
    }
    disposeObject3D(paneAOriginalTrajectoryViz);
    paneAOriginalTrajectoryViz = null;
  }

  function createRoundPointTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, 32, 32);
      context.fillStyle = "#ffffff";
      context.beginPath();
      context.arc(16, 16, 13, 0, Math.PI * 2);
      context.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  function buildOriginalWorldTrajectory(boneInfo) {
    const skeletalMotion = getSkeletalMotion?.();
    const sourceModel = skeletalMotion?.model;
    const sourceClip = skeletalMotion?.originClip;
    const pspaceTrack = boneInfo?.Ori?.PspaceAnimTrack;
    const times = boneInfo?.Ori?.QuatAnimTrack?.times;
    if (!sourceModel || !sourceClip || !Array.isArray(pspaceTrack) || !times?.length) return null;

    const cached = originalTrajectoryCache.get(boneInfo);
    if (cached?.clip === sourceClip && cached?.track === pspaceTrack) return cached;

    const modelClone = cloneSkeleton(sourceModel);
    const clonedBone = modelClone.getObjectByName(boneInfo.name);
    const anchor = clonedBone?.parent;
    if (!clonedBone || !anchor) return null;

    const mixer = new THREE.AnimationMixer(modelClone);
    const action = mixer.clipAction(sourceClip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    const points = [];
    const colors = [];
    let pointSize = 0.01;
    const frameCount = Math.min(pspaceTrack.length, times.length);
    for (let index = 0; index < frameCount; index++) {
      mixer.setTime(Number(times[index]) || 0);
      modelClone.updateMatrixWorld(true);
      const vector = pspaceTrack[index];
      if (!Array.isArray(vector) || vector.length < 3) continue;
      const origin = anchor.localToWorld(clonedBone.position.clone());
      const endpoint = anchor.localToWorld(
        clonedBone.position.clone().add(new THREE.Vector3(
          Number(vector[0]) || 0,
          Number(vector[1]) || 0,
          Number(vector[2]) || 0
        ))
      );
      points.push(endpoint);
      pointSize = Math.max(pointSize, origin.distanceTo(endpoint) * 0.035);
      const ratio = frameCount > 1 ? index / (frameCount - 1) : 0;
      const gray = THREE.MathUtils.lerp(0.28, 0.82, ratio);
      colors.push(gray, gray, gray);
    }
    action.stop();
    mixer.stopAllAction();
    mixer.uncacheRoot(modelClone);

    const result = { clip: sourceClip, track: pspaceTrack, points, colors, pointSize };
    originalTrajectoryCache.set(boneInfo, result);
    return result;
  }

  function showOriginalTrajectoryForBone(boneInfo) {
    clearOriginalBoneTrajectory();
    if (!showOriginalBoneTrajectory) return;
    const scene = getPaneAScene?.()?.scene;
    const trajectory = buildOriginalWorldTrajectory(boneInfo);
    if (!scene || !trajectory?.points?.length) return;

    const geometry = new THREE.BufferGeometry().setFromPoints(trajectory.points);
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(trajectory.colors, 3));
    const material = new THREE.PointsMaterial({
      size: trajectory.pointSize * (getOriginalBoneTrajectoryPointSizeScale?.() || 1),
      map: createRoundPointTexture(),
      vertexColors: true,
      transparent: true,
      alphaTest: 0.2,
      opacity: 0.96,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    points.name = "originalBoneTrajectory";
    points.renderOrder = 4;
    markExcludedFromAnimationExport(points, "originalBoneTrajectory");
    scene.add(points);
    paneAOriginalTrajectoryViz = points;
  }

  function showSelectedBoneBasis(boneId) {
    clearPaneASelectionVisualization();

    const skeletalMotion = getSkeletalMotion?.();
    const boneInfo = skeletalMotion?.BoneInfo?.find((b) => b.id === boneId);
    if (!boneInfo) return;

    const basis = getPcaBasisVectors(boneInfo);
    if (!basis) return;

    const placement = resolveSkeletonPspacePlacement(boneInfo);
    if (!placement?.anchor) return;

    const circleScale = getPaneSelectionCircleRadiusScale?.("paneA") || 1;
    const boneLen = getVectorLengthSafe(boneInfo?.oriVector, 1);
    const circleRadius = Math.max(getAveragePositive(boneInfo?.Ori?.MPProLen, boneLen * 0.7) * circleScale, 0.05);
    const axisLength = Math.max(boneLen, circleRadius * 1.25, 0.1);

    const group = createBasisVisualizationGroup(basis, axisLength, circleRadius);
    group.position.copy(placement.getLocalOrigin());
    placement.anchor.add(group);

    paneASelectionViz = {
      group,
      update: () => {
        group.position.copy(placement.getLocalOrigin());
      },
    };
    paneASelectionViz.update();
    showOriginalTrajectoryForBone(boneInfo);
  }

  function showSelectedPldBasis(pldId) {
    clearPaneASelectionVisualization();

    const pldMotion = getPldMotion?.();
    const pldInfo = pldMotion?.pldInfo?.find((l) => l.id === pldId);
    if (!pldInfo) return;

    const pcaBasis = getPcaBasisVectors(pldInfo);
    if (!pcaBasis) return;

    const placement = resolvePldPspacePlacement(pldInfo);
    if (!placement?.anchor) return;

    const circleScale = getPaneSelectionCircleRadiusScale?.("paneA") || 1;
    const lenRef = getAveragePositive(pldInfo?.lenTrack, 1);
    const circleRadius = Math.max(getAveragePositive(pldInfo?.Ori?.MPProLen, lenRef * 0.7) * circleScale, 0.04);
    const axisLength = Math.max(lenRef, circleRadius * 1.25, 0.08);

    const group = createBasisVisualizationGroup(pcaBasis, axisLength, circleRadius);
    group.position.copy(placement.getLocalOrigin());
    placement.anchor.add(group);

    paneASelectionViz = {
      group,
      update: () => {
        const frameIdx = getCurrentPldFrameIndex(pldInfo);
        group.position.copy(placement.getLocalOrigin());
        const worldBasis = mapPldPcaBasisToWorldBasis(pldInfo, pcaBasis, frameIdx);
        if (worldBasis) {
          applyBasisToGroup(group, worldBasis);
        }
      },
    };
    paneASelectionViz.update();
  }

  function setActivePopupCard(activeKey) {
    const paneCPopupList = getPaneCPopupList?.();
    if (!paneCPopupList) return;
    const typeSelection = getTypeSelection?.();
    const cards = paneCPopupList.querySelectorAll(".pane-c-popup-card");
    cards.forEach((card) => {
      const kind = card.dataset.popupKind || typeSelection;
      const key = `${kind}:${card.dataset.popupId}`;
      const isActive = key === activeKey && card.style.display !== "none";
      card.style.position = "relative";
      card.style.zIndex = isActive ? "2" : "1";
      card.style.borderColor = isActive ? "rgba(141, 212, 255, 0.95)" : "";
      card.style.boxShadow = isActive ? "0 0 0 2px rgba(141, 212, 255, 0.55)" : "";
    });
  }

  function clearPopupCardHighlights() {
    const paneCPopupList = getPaneCPopupList?.();
    if (!paneCPopupList) return;
    const cards = paneCPopupList.querySelectorAll(".pane-c-popup-card");
    cards.forEach((card) => {
      card.style.zIndex = "";
      card.style.borderColor = "";
      card.style.boxShadow = "";
    });
  }

  function activatePopupSelection(kind, item) {
    const key = `${kind}:${item.id}`;
    selectedPopupKey = key;
    setActivePopupCard(key);

    if (kind === "skeleton") {
      showSelectedBoneBasis(item.id);
      return;
    }
    if (kind === "pld") {
      showSelectedPldBasis(item.id);
    }
  }

  function clearActiveSelection() {
    selectedPopupKey = null;
    clearPopupCardHighlights();
    clearPaneASelectionVisualization();
  }

  function refresh() {
    const paneAScene = getPaneAScene?.();
    if (!selectedPopupKey || !paneAScene?.scene) return;
    const [kind, rawId] = String(selectedPopupKey).split(":");
    const id = Number(rawId);
    if (!Number.isFinite(id)) return;
    if (kind === "skeleton") {
      showSelectedBoneBasis(id);
      return;
    }
    if (kind === "pld") {
      showSelectedPldBasis(id);
    }
  }

  function activateByPopupCard(card) {
    const typeSelection = getTypeSelection?.();
    const kind = card.dataset.popupKind || typeSelection;
    const rawId = card.dataset.popupId;
    if (rawId === "all") {
      activatePopupSelection(kind, { id: "all", name: "All" });
      return;
    }

    const id = Number(rawId);
    if (!Number.isFinite(id)) return;

    if (kind === "skeleton") {
      const skeletalMotion = getSkeletalMotion?.();
      const bone = skeletalMotion?.BoneInfo?.find((b) => b.id === id);
      if (bone) activatePopupSelection("skeleton", bone);
      return;
    }
    if (kind === "pld") {
      const pldMotion = getPldMotion?.();
      const pld = pldMotion?.pldInfo?.find((l) => l.id === id);
      if (pld) activatePopupSelection("pld", pld);
    }
  }

  function onPopupShow(kind, item) {
    const paneAScene = getPaneAScene?.();
    if (!item || !paneAScene?.scene) return;
    activatePopupSelection(kind, item);
  }

  function onPopupFocus(kind, item) {
    const paneAScene = getPaneAScene?.();
    if (!item || !paneAScene?.scene) return;
    activatePopupSelection(kind, item);
  }

  function onPopupHide(kind, item) {
    if (!item) return;
  }

  function update() {
    if (paneASelectionViz && typeof paneASelectionViz.update === "function") {
      paneASelectionViz.update();
    }
  }

  function getActiveSelection() {
    if (!selectedPopupKey) return null;
    const [kind, rawId] = String(selectedPopupKey).split(":");
    const id = Number(rawId);
    if (!kind || !Number.isFinite(id)) return null;
    return { kind, id };
  }

  function setShowOriginalBoneTrajectory(visible) {
    showOriginalBoneTrajectory = visible === true;
    if (!showOriginalBoneTrajectory) {
      clearOriginalBoneTrajectory();
      return;
    }
    refresh();
  }

  return {
    update,
    refresh,
    getActiveSelection,
    setShowOriginalBoneTrajectory,
    clearActiveSelection,
    activateByPopupCard,
    onPopupShow,
    onPopupFocus,
    onPopupHide,
  };
}
