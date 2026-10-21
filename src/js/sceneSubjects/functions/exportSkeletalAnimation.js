import { AnimationClip, Group, Matrix4, PropertyBinding } from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { FBXExporter } from '@comfyorg/fbx-exporter-three';
import {
    detachExcludedAnimationExportObjects,
    detachInvalidMaterialTextures,
    exportSkeletalAnimationGlbBlob,
    waitForPendingTextureImages,
} from './exportAnimationModelOnly.js';

export function animationExportFilename(filename, format = 'glb') {
    validateFormat(format);
    return `${filename.replace(/\.(glb|gltf|fbx)$/i, '')}.${format}`;
}

function validateFormat(format) {
    if (format !== 'glb' && format !== 'fbx') {
        throw new Error(`Unsupported animation export format: ${format}`);
    }
}

export async function exportSkeletalAnimationBlob(model, clip, format = 'glb') {
    validateFormat(format);
    if (!model) throw new Error('No human model to export.');
    if (format === 'glb') return exportSkeletalAnimationGlbBlob(model, clip);
    return exportSkeletalAnimationFbxBlob(model, clip);
}

export function downloadAnimationBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// FBX stores Euler curves. Sample the original interpolants so sparse quaternion
// tracks and GLTF cubic splines keep their motion between the original keys.
function prepareFbxClip(model, clip) {
    if (!clip) return null;
    const tracks = clip.tracks.map((track) => {
        const parsed = PropertyBinding.parseTrackName(track.name);
        let node = PropertyBinding.findNode(model, parsed.nodeName);
        if (parsed.objectName === 'bones') {
            node = node?.skeleton?.getBoneByName(parsed.objectIndex)
                || model.getObjectByName(parsed.objectIndex);
        } else if (parsed.objectName) {
            throw new Error(`FBX export does not support track: ${track.name}`);
        }
        if (!node || !['position', 'quaternion', 'scale', 'morphTargetInfluences'].includes(parsed.propertyName)
            || (parsed.propertyIndex !== undefined && parsed.propertyName !== 'morphTargetInfluences')) {
            throw new Error(`FBX export cannot resolve track: ${track.name}`);
        }
        const end = Math.max(0, clip.duration);
        // The writer quantizes times to microseconds; avoid duplicate FBX keys.
        const times = new Map();
        const addTime = time => times.set(Math.round(time * 1e6), time);
        for (let frame = 1; frame / 60 < end; frame++) addTime(frame / 60);
        Array.from(track.times).filter(t => t >= 0 && t <= end).forEach(addTime);
        addTime(0); addTime(end);
        const sampledTimes = Array.from(times.values()).sort((a, b) => a - b);
        const interpolant = track.createInterpolant();
        const values = [];
        sampledTimes.forEach(time => values.push(...interpolant.evaluate(time)));
        const index = parsed.propertyIndex === undefined ? '' : `[${parsed.propertyIndex}]`;
        return new track.constructor(`${node.uuid}.${parsed.propertyName}${index}`, sampledTimes, values);
    });
    return new AnimationClip(clip.name, clip.duration, tracks);
}

async function exportSkeletalAnimationFbxBlob(model, clip) {
    // Work on an isolated hierarchy; playback can continue during texture encoding.
    const root = cloneSkeleton(model);
    const originals = [];
    model.traverse(object => originals.push(object));
    let index = 0;
    root.traverse(object => {
        object.uuid = originals[index++].uuid;
        if (object.material) {
            object.material = Array.isArray(object.material)
                ? object.material.map(material => material.clone()) : object.material.clone();
        }
    });
    detachExcludedAnimationExportObjects(root);

    // MoRemix displays FBX centimeters at x0.1 and GLTF meters at x10.
    // Export centimeters (UnitScaleFactor=1), including matching bind matrices.
    const displayScale = root.userData.importDisplayScaleApplied === true
        ? Number(root.userData.importDisplayScaleFactor) : 1;
    const configured = Number.isFinite(displayScale) && displayScale > 0
        && root.userData.importDisplayScaleApplied === true;
    root.updateMatrix();
    const importedRoot = root.userData.animationExportRootMatrix
        ? new Matrix4().fromArray(root.userData.animationExportRootMatrix) : root.matrix.clone();
    const container = new Group();
    container.name = 'MoRemixExport';
    if (configured) {
        root.scale.multiplyScalar(1 / displayScale);
        container.scale.setScalar(displayScale * 10);
    }
    // A GLTF root can be a Scene, whose transform FBX exporters otherwise omit.
    root.isScene = false;
    container.add(root);
    container.updateMatrixWorld(true);
    const bindTransform = root.matrixWorld.clone().multiply(importedRoot.invert());
    const inverseBindTransform = bindTransform.clone().invert();
    root.traverse(object => {
        if (!object.isSkinnedMesh) return;
        object.bindMatrix.premultiply(bindTransform);
        object.bindMatrixInverse.copy(object.bindMatrix).invert();
        object.skeleton.boneInverses = object.skeleton.boneInverses.map(matrix =>
            matrix.clone().multiply(inverseBindTransform));
    });
    const exportClip = prepareFbxClip(root, clip);
    // FBXLoader can introduce same-name bones for multi-mesh skins. FBX animation
    // bindings use names on reimport, so keep the first name and disambiguate copies.
    const names = new Set();
    container.traverse(object => {
        const base = PropertyBinding.sanitizeNodeName(object.name || 'Node');
        let name = base;
        for (let suffix = 2; names.has(name); suffix++) name = `${base}_${suffix}`;
        object.name = name;
        names.add(name);
    });
    // Recover bind transforms across ALL skins. A bone's parent may belong to a
    // different skin; its current animated matrix must not become the bind pose.
    const bindWorld = new Map();
    root.traverse(object => {
        if (!object.isSkinnedMesh) return;
        object.skeleton.bones.forEach((bone, i) => {
            if (!bindWorld.has(bone)) bindWorld.set(bone, object.skeleton.boneInverses[i].clone().invert());
        });
    });
    root.traverse(object => {
        const world = bindWorld.get(object);
        if (world) {
            const local = object.parent.matrixWorld.clone().invert().multiply(world);
            local.decompose(object.position, object.quaternion, object.scale);
            object.updateMatrix();
        }
        object.updateWorldMatrix(false, false);
    });
    await waitForPendingTextureImages(root);
    detachInvalidMaterialTextures(root);
    const bytes = await new FBXExporter().parseAsync(container, {
        animations: exportClip ? [exportClip] : [],
        unitScale: 1,
        fps: 60,
        bakeSpaceTransform: false,
        embedTextures: true,
    });
    return new Blob([bytes], { type: 'application/octet-stream' });
}
