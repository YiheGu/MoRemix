import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';  
import * as THREE from 'three';
import { applyGlbReimportScaleCompensation, detachExcludedAnimationExportObjects } from './exportAnimationModelOnly';

export function exportGltf(humanModel, humanClip, action){
    if (!hasSkinnedMesh(humanModel)) {
        console.warn("humanModel does't contain SkinnedMesh!");
    }
    else{
        console.log("HumanModel contain skinnedMesh!")
    }

    const exporter = new GLTFExporter();
    const restoreExcludedObjects = detachExcludedAnimationExportObjects(humanModel);
    const restoreExportScale = applyGlbReimportScaleCompensation(humanModel);
    const restoreExportState = () => {
        restoreExportScale();
        restoreExcludedObjects();
    };
    try {
        exporter.parse(
            humanModel,
            (result) => {
                restoreExportState();
                if (result instanceof ArrayBuffer) {
                    saveArrayBuffer(result, 'human.glb');
                } else {
                    saveString(JSON.stringify(result, null, 2), 'HumanMotion.gltf');
                }
            },
            (err) => {
                restoreExportState();
                console.error("Error exporting GLTF:", err);
            },
            { binary: true, animations: action ? [action] : []}
        );
    } catch (err) {
        restoreExportState();
        console.error("Error exporting GLTF:", err);
    }
}

function saveString(text, filename) {
    save(new Blob([text], { type: 'text/plain' }), filename);
}

function saveArrayBuffer(buffer, filename) {
    save(new Blob([buffer], { type: 'application/octet-stream' }), filename);
}

function save(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function hasSkinnedMesh(object) {
    let found = false;
    object.traverse(child => {
        if (child.isSkinnedMesh) found = true;
    });
    return found;
}
