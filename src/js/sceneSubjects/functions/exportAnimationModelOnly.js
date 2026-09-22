import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const EXCLUDED_SCENE_OBJECT_TYPES = new Set([
    "mainPlaneVisualization",
]);

const MATERIAL_TEXTURE_KEYS = [
    'map',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'emissiveMap',
    'aoMap',
    'alphaMap',
    'bumpMap',
    'displacementMap',
    'lightMap',
    'envMap',
    'specularMap',
    'specularIntensityMap',
    'specularColorMap',
];

export function markExcludedFromAnimationExport(object, sceneObjectType) {
    if (!object) return;
    object.userData.excludeFromAnimationExport = true;
    if (sceneObjectType) {
        object.userData.sceneObjectType = sceneObjectType;
    }
}

function shouldExcludeFromAnimationExport(object) {
    return object?.userData?.excludeFromAnimationExport === true
        || EXCLUDED_SCENE_OBJECT_TYPES.has(object?.userData?.sceneObjectType);
}

export function detachExcludedAnimationExportObjects(root) {
    const detached = [];
    if (!root || typeof root.traverse !== "function") {
        return () => {};
    }

    root.traverse((object) => {
        if (object === root || !shouldExcludeFromAnimationExport(object) || !object.parent) {
            return;
        }
        detached.push({
            object,
            parent: object.parent,
            index: object.parent.children.indexOf(object),
        });
    });

    detached.forEach(({ object, parent }) => {
        parent.remove(object);
    });

    return () => {
        detached.forEach(({ object, parent, index }) => {
            if (object.parent === parent) return;
            if (object.parent) object.parent.remove(object);
            const safeIndex = Math.max(0, Math.min(index, parent.children.length));
            parent.children.splice(safeIndex, 0, object);
            object.parent = parent;
        });
    };
}

export function applyGlbReimportScaleCompensation(root) {
    if (!root?.scale || typeof root.scale.multiplyScalar !== "function") {
        return () => {};
    }

    const glbReimportDisplayScaleFactor = Number(root.userData?.glbReimportDisplayScaleFactor);
    if (!Number.isFinite(glbReimportDisplayScaleFactor) || glbReimportDisplayScaleFactor <= 0) {
        return () => {};
    }

    const originalScale = root.scale.clone();
    root.scale.multiplyScalar(1 / glbReimportDisplayScaleFactor);

    return () => {
        root.scale.copy(originalScale);
    };
}

function hasValidTextureImage(texture) {
    const image = texture?.image;
    if (!image) return false;
    if (image.data && Number.isFinite(image.width) && Number.isFinite(image.height)) return true;
    if (image instanceof HTMLCanvasElement || image instanceof ImageBitmap) return true;
    if (image instanceof HTMLImageElement) return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
    return false;
}

function collectMaterialTextures(root) {
    const textures = [];
    root?.traverse?.((object) => {
        if (!object?.isMesh || !object.material) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
            MATERIAL_TEXTURE_KEYS.forEach((key) => {
                const texture = material?.[key];
                if (texture?.isTexture) textures.push(texture);
            });
        });
    });
    return textures;
}

function waitForImageElement(image) {
    if (!(image instanceof HTMLImageElement) || image.complete) return Promise.resolve();
    return new Promise((resolve) => {
        const done = () => {
            image.removeEventListener("load", done);
            image.removeEventListener("error", done);
            resolve();
        };
        image.addEventListener("load", done, { once: true });
        image.addEventListener("error", done, { once: true });
    });
}

async function waitForPendingTextureImages(root, timeoutMs = 1200) {
    const waits = collectMaterialTextures(root)
        .map((texture) => texture?.image)
        .filter((image) => image instanceof HTMLImageElement && !image.complete)
        .map((image) => waitForImageElement(image));

    if (waits.length < 1) return;

    await Promise.race([
        Promise.allSettled(waits),
        new Promise((resolve) => window.setTimeout(resolve, timeoutMs)),
    ]);
}

export function detachInvalidMaterialTextures(root) {
    const detached = [];
    root?.traverse?.((object) => {
        if (!object?.isMesh || !object.material) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
            MATERIAL_TEXTURE_KEYS.forEach((key) => {
                const texture = material?.[key];
                if (!texture?.isTexture || hasValidTextureImage(texture)) return;
                detached.push({ material, key, texture });
                material[key] = null;
                material.needsUpdate = true;
            });
        });
    });

    return () => {
        detached.forEach(({ material, key, texture }) => {
            material[key] = texture;
            material.needsUpdate = true;
        });
    };
}

function parseGlbBlob(model, clip, { stripInvalidTextures = false } = {}) {
    return new Promise((resolve, reject) => {
        const exporter = new GLTFExporter();
        const restoreExcludedObjects = detachExcludedAnimationExportObjects(model);
        const restoreExportScale = applyGlbReimportScaleCompensation(model);
        const restoreMaterialTextures = stripInvalidTextures ? detachInvalidMaterialTextures(model) : () => {};
        const restoreExportState = () => {
            restoreMaterialTextures();
            restoreExportScale();
            restoreExcludedObjects();
        };

        try {
            exporter.parse(
                model,
                (result) => {
                    restoreExportState();
                    const blob = result instanceof ArrayBuffer
                        ? new Blob([result], { type: "model/gltf-binary" })
                        : new Blob([JSON.stringify(result)], { type: "application/json" });
                    resolve(blob);
                },
                (err) => {
                    restoreExportState();
                    reject(err);
                },
                { binary: true, animations: clip ? [clip] : [] }
            );
        } catch (err) {
            restoreExportState();
            reject(err);
        }
    });
}

export async function exportSkeletalAnimationGlbBlob(model, clip) {
    await waitForPendingTextureImages(model);
    try {
        return await parseGlbBlob(model, clip, { stripInvalidTextures: false });
    } catch (err) {
        const message = String(err?.message || err || "");
        if (!message.includes("No valid image data")) {
            throw err;
        }
        console.warn("GLB export retrying without invalid material textures:", err);
        return parseGlbBlob(model, clip, { stripInvalidTextures: true });
    }
}
