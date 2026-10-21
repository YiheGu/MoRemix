import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import JSZip from 'jszip';

// The browser sources use ESM inside a CommonJS package (Parcel handles this).
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('.') && context.parentURL?.includes('/src/js/') && !specifier.endsWith('.js')) {
            return nextResolve(`${specifier}.js`, context);
        }
        return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
        if (url.includes('/src/js/') && url.endsWith('.js')) {
            // Match Parcel's CommonJS named-import interop for fft-js.
            const source = readFileSync(new URL(url), 'utf8').replace(
                /import\s*\{([^}]+)\}\s*from\s*['"]fft-js['"];?/g,
                "import fftJs from 'fft-js'; const {$1} = fftJs;",
            );
            return { format: 'module', source, shortCircuit: true };
        }
        return nextLoad(url, context);
    },
});
const { exportSkeletalAnimationBlob, animationExportFilename } = await import('../src/js/sceneSubjects/functions/exportSkeletalAnimation.js');
const { SkeletalMotion } = await import('../src/js/sceneSubjects/SkeletalMotion.js');
const { exportTrimmedAnimation } = await import('../src/js/batchWorkflow/BatchTrimUI.js');

// GLTFExporter only needs this browser API to assemble an untextured GLB.
globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
        blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); });
    }
    readAsDataURL(blob) {
        blob.arrayBuffer().then(result => {
            this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;
            this.onloadend?.();
        });
    }
};

function fixture(format) {
    const unit = format === 'fbx' ? 100 : 1;
    const model = new THREE.Group();
    model.name = 'Character';
    const hip = new THREE.Bone(); hip.name = 'Hip';
    const tip = new THREE.Bone(); tip.name = 'Tip'; tip.position.y = unit;
    hip.add(tip); model.add(hip);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, unit, 0, unit / 4, unit, 0], 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
    mesh.name = 'Body'; model.add(mesh);
    model.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton([hip, tip]));
    model.userData.animationExportRootMatrix = model.matrix.toArray();
    model.userData.importDisplayScaleFactor = format === 'fbx' ? 0.1 : 10;
    model.userData.importDisplayScaleApplied = true;
    model.userData.glbReimportDisplayScaleFactor = 10;
    model.scale.multiplyScalar(model.userData.importDisplayScaleFactor);
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.7, 1.1, -0.6));
    const clip = new THREE.AnimationClip('Edited', 1.25, [
        new THREE.VectorKeyframeTrack('Hip.position', [0, 1], [0, 0, 0, unit / 3, 0, 0]),
        new THREE.QuaternionKeyframeTrack(`${tip.uuid}.quaternion`, [0, 1], [0, 0, 0, 1, ...rotation.toArray()]),
    ]);
    const helper = new THREE.Group(); helper.name = 'ExcludedPlane';
    helper.userData.excludeFromAnimationExport = true; model.add(helper);
    return { model, clip, mesh };
}

function animate(model, clip) {
    const mixer = new THREE.AnimationMixer(model);
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
    return time => { mixer.setTime(time); model.updateMatrixWorld(true); };
}

function vertexWorld(mesh, index) {
    return mesh.getVertexPosition(index, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
}

for (const sourceFormat of ['fbx', 'gltf']) {
    test(`${sourceFormat} to FBX preserves duration, animated skin, scale and live state`, async () => {
        const { model, clip, mesh } = fixture(sourceFormat);
        const seek = animate(model, clip);
        seek(0.4);
        const before = model.toJSON();
        const blob = await exportSkeletalAnimationBlob(model, clip, 'fbx');
        assert.deepEqual(model.toJSON(), before, 'export must not mutate live model or bind matrices');
        const bytes = await blob.arrayBuffer();
        assert.equal(Buffer.from(bytes).subarray(0, 23).toString('binary'), 'Kaydara FBX Binary  \0\x1a\0');
        const reloaded = new FBXLoader().parse(bytes, '');
        assert.equal(reloaded.animations.length, 1);
        assert.equal(reloaded.getObjectByName('ExcludedPlane'), undefined);
        assert.ok(Math.abs(reloaded.animations[0].duration - clip.duration) < 1e-5);
        reloaded.scale.multiplyScalar(0.1); // same FBX display conversion as MoRemix
        const replay = animate(reloaded, reloaded.animations[0]);
        const resultMesh = reloaded.getObjectByName('Body');
        assert.ok(resultMesh.isSkinnedMesh);
        assert.equal(resultMesh.skeleton.bones.length, 2);
        for (const time of [0, 0.125, 0.4, 0.75, 1, 1.25]) {
            seek(time); replay(time);
            for (let i = 0; i < 3; i++) {
                const error = vertexWorld(mesh, i).distanceTo(vertexWorld(resultMesh, i));
                assert.ok(error < 0.005, `skin error at ${time}, vertex ${i}: ${error}`);
            }
        }
    });
}

test('GLB path still exports animation and restores exclusions and scale', async () => {
    const { model, clip } = fixture('fbx');
    const scale = model.scale.clone();
    const children = [...model.children];
    const blob = await exportSkeletalAnimationBlob(model, clip);
    const bytes = await blob.arrayBuffer();
    assert.equal(new DataView(bytes).getUint32(0, true), 0x46546c67);
    const gltf = await new GLTFLoader().parseAsync(bytes, '');
    assert.equal(gltf.animations.length, 1);
    assert.ok(gltf.scene.getObjectByName('Body').isSkinnedMesh);
    assert.equal(gltf.scene.getObjectByName('ExcludedPlane'), undefined);
    assert.deepEqual(model.scale, scale);
    assert.deepEqual(model.children, children);
});

test('format validation, filename extensions, and FBX errors are explicit', async () => {
    assert.equal(animationExportFilename('Walk__Amp0.10.GLB', 'fbx'), 'Walk__Amp0.10.fbx');
    assert.equal(animationExportFilename('Walk.fbx', 'glb'), 'Walk.glb');
    const { model, clip } = fixture('gltf');
    await assert.rejects(exportSkeletalAnimationBlob(model, clip, 'obj'), /Unsupported/);
    await assert.rejects(exportSkeletalAnimationBlob(null, clip, 'fbx'), /No human model/);
    clip.tracks[0].name = 'Missing.position';
    const before = model.toJSON();
    await assert.rejects(exportSkeletalAnimationBlob(model, clip, 'fbx'), /cannot resolve track/);
    assert.deepEqual(model.toJSON(), before);
});

test('multi-mesh skin with duplicate bone names keeps the intended animation binding', async () => {
    const { model, clip, mesh } = fixture('fbx');
    const hip = model.getObjectByName('Hip');
    const duplicate = new THREE.Bone(); duplicate.name = 'Hip';
    hip.add(duplicate);
    const secondMesh = new THREE.SkinnedMesh(mesh.geometry, mesh.material);
    secondMesh.name = 'SecondBody'; model.add(secondMesh);
    // The duplicate has the same rest transform, but is only used by one skin.
    secondMesh.bind(new THREE.Skeleton([duplicate, mesh.skeleton.bones[1]], mesh.skeleton.boneInverses.map(m => m.clone())), mesh.bindMatrix);
    const seek = animate(model, clip); seek(0.4);
    const blob = await exportSkeletalAnimationBlob(model, clip, 'fbx');
    const copy = new FBXLoader().parse(await blob.arrayBuffer(), '');
    copy.scale.multiplyScalar(0.1);
    const replay = animate(copy, copy.animations[0]);
    for (const time of [0, 0.4, 0.8]) {
        seek(time); replay(time);
        for (const original of [mesh, secondMesh]) {
            for (let i = 0; i < 3; i++) {
                assert.ok(vertexWorld(original, i).distanceTo(vertexWorld(copy.getObjectByName(original.name), i)) < 0.005);
            }
        }
    }
});

test('valid textures are embedded and missing texture images do not break FBX export', async () => {
    const { model, clip, mesh } = fixture('gltf');
    const texture = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);
    mesh.material.map = texture;
    mesh.material.normalMap = new THREE.Texture();
    const originalNormalMap = mesh.material.normalMap;
    const blob = await exportSkeletalAnimationBlob(model, clip, 'fbx');
    const bytes = Buffer.from(await blob.arrayBuffer());
    assert.ok(bytes.indexOf(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) >= 0, 'embedded PNG');
    assert.equal(mesh.material.map, texture);
    assert.equal(mesh.material.normalMap, originalNormalMap);
});

test('main export downloads the edited clip and propagates failures', async () => {
    const { model, clip } = fixture('fbx');
    const motion = new SkeletalMotion(null);
    motion.model = model;
    motion.currentClip = clip;
    let download;
    const oldDocument = globalThis.document;
    const oldWindow = globalThis.window;
    globalThis.document = {
        body: { appendChild() {} },
        createElement: () => ({ click() { download = { name: this.download, url: this.href }; }, remove() {} }),
    };
    globalThis.window = { setTimeout() {} };
    try {
        await motion.exportAnimation('fbx');
        assert.equal(download.name, 'HumanWithEditedAnim.fbx');
        const bytes = await fetch(download.url).then(response => response.arrayBuffer());
        assert.equal(new FBXLoader().parse(bytes, '').animations[0].name, 'Edited');
        motion.model = null;
        await assert.rejects(motion.exportAnimation('fbx'), /No human model/);
    } finally {
        if (download) URL.revokeObjectURL(download.url);
        globalThis.document = oldDocument;
        globalThis.window = oldWindow;
    }
});

test('batch blobs keep distinct edited clips and repeats inside a readable FBX ZIP', async () => {
    const { model, clip } = fixture('gltf');
    const motion = new SkeletalMotion(null);
    motion.model = model;
    const zip = new JSZip();
    for (const value of ['0.10', '0.50']) {
        const edited = clip.clone();
        edited.tracks[0].values[3] = Number(value);
        motion.currentClip = motion.extendAnimationClip(edited, 2);
        const blob = await motion.exportAnimationBlob('fbx');
        zip.file(`Fixture/Fixture__Amp${value}.fbx`, await blob.arrayBuffer());
    }
    const reloadedZip = await JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' }));
    for (const value of ['0.10', '0.50']) {
        const file = reloadedZip.file(`Fixture/Fixture__Amp${value}.fbx`);
        assert.ok(file);
        const model = new FBXLoader().parse(await file.async('arraybuffer'), '');
        const exportedClip = model.animations[0];
        assert.equal(exportedClip.duration, 2.5);
        const track = exportedClip.tracks.find(track => track.name === 'Hip.position');
        assert.ok(Math.abs(track.createInterpolant().evaluate(2.5)[0] - Number(value)) < 1e-6);
    }
});

test('preprocessing saves the trimmed FBX and reports the correct filename', async () => {
    const { model, clip } = fixture('fbx');
    clip.tracks[0] = new THREE.VectorKeyframeTrack('Hip.position', [0, 0.25, 0.5, 0.75, 1],
        [0, 0, 0, 25, 0, 0, 50, 0, 0, 75, 0, 0, 100, 0, 0]);
    let saved, closed = false;
    const directory = { async getFileHandle(name) {
        assert.equal(name, 'Walk_trim.fbx');
        return { async createWritable() { return {
            async write(blob) { saved = blob; }, async close() { closed = true; },
        }; } };
    } };
    const filename = await exportTrimmedAnimation(model, clip, 0.25, 0.75, 'Walk_trim.GLB', directory, 'fbx');
    assert.equal(filename, 'Walk_trim.fbx');
    assert.ok(closed);
    const reloaded = new FBXLoader().parse(await saved.arrayBuffer(), '');
    assert.equal(reloaded.animations[0].duration, 0.5);
    const position = reloaded.animations[0].tracks.find(t => t.name === 'Hip.position').createInterpolant();
    assert.equal(position.evaluate(0)[0], 25);
    assert.equal(position.evaluate(0.5)[0], 75);
    assert.equal(clip.duration, 1.25);
});

// Optional local-asset checks; animation assets are intentionally not committed.
for (const asset of (process.env.MOREMIX_TEST_ASSETS || '').split(';').filter(Boolean)) {
    test(`local asset round trip: ${asset}`, async () => {
        globalThis.window = { URL: globalThis.URL };
        globalThis.self = globalThis;
        // Geometry/animation test: image decoding is checked separately in browser.
        const manager = new THREE.LoadingManager();
        manager.addHandler(/.*/, { setPath() { return this; }, load: () => new THREE.Texture() });
        const buffer = readFileSync(asset);
        const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        const isFbx = asset.toLowerCase().endsWith('.fbx');
        const loaded = isFbx ? new FBXLoader(manager).parse(bytes, '') : await new GLTFLoader(manager).parseAsync(bytes, '');
        const model = isFbx ? loaded : loaded.scene;
        const clip = loaded.animations[0];
        assert.ok(clip);
        model.traverse(node => { if (node.isMesh) node.material = new THREE.MeshStandardMaterial(); });
        model.updateMatrix();
        model.userData.animationExportRootMatrix = model.matrix.toArray();
        model.userData.importDisplayScaleFactor = isFbx ? 0.1 : 10;
        model.userData.importDisplayScaleApplied = true;
        model.scale.multiplyScalar(model.userData.importDisplayScaleFactor);
        model.position.set(0, 0, 0);
        const seek = animate(model, clip);
        seek(clip.duration * 0.3);
        const blob = await exportSkeletalAnimationBlob(model, clip, 'fbx');
        const result = new FBXLoader().parse(await blob.arrayBuffer(), '');
        assert.equal(result.animations.length, 1);
        assert.ok(Math.abs(result.animations[0].duration - clip.duration) < 1e-4);
        result.scale.multiplyScalar(0.1);
        const replay = animate(result, result.animations[0]);
        let maxError = 0;
        let diagnostic;
        for (const fraction of [0, 0.17, 0.3, 0.61, 0.99]) {
            seek(clip.duration * fraction); replay(clip.duration * fraction);
            model.traverse(node => {
                if (!node.isSkinnedMesh) return;
                const copy = result.getObjectByName(node.name);
                assert.ok(copy?.isSkinnedMesh, node.name);
                const count = node.geometry.index?.count || node.geometry.attributes.position.count;
                for (let i = 0; i < count; i += Math.max(1, Math.floor(count / 100))) {
                    const originalIndex = node.geometry.index ? node.geometry.index.getX(i) : i;
                    const copyIndex = copy.geometry.index ? copy.geometry.index.getX(i) : i;
                    const error = vertexWorld(node, originalIndex).distanceTo(vertexWorld(copy, copyIndex));
                    if (error > maxError) {
                        maxError = error;
                        diagnostic = { mesh: node.name, time: fraction, originalIndex, copyIndex,
                            original: vertexWorld(node, originalIndex).toArray(), copy: vertexWorld(copy, copyIndex).toArray(),
                            originalBones: node.skeleton.bones.length, copyBones: copy.skeleton.bones.length,
                            boneError: node.skeleton.bones.reduce((max, bone) => Math.max(max,
                                bone.getWorldPosition(new THREE.Vector3()).distanceTo(result.getObjectByName(bone.name).getWorldPosition(new THREE.Vector3()))), 0) };
                    }
                }
            });
        }
        console.log(`Local asset ${asset}: ${blob.size} bytes, max sampled skin error ${maxError}`);
        if (maxError >= 0.05) console.log(diagnostic);
        assert.ok(maxError < 0.05, `skin error: ${maxError}`);
    });
}
