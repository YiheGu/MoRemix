import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getBoneInfo } from './functions/getBoneInfo';
import { setBoneMPAmp } from './functions/setBoneMPAmp';
import { generateBoneClip, updateBoneDiagnosticPlots } from './functions/generateBoneClip';
import { setPhaseShift } from './functions/setPhaseShift';
import { exportSkeletalAnimationGlbBlob } from './functions/exportAnimationModelOnly';
import { loopAnimationClipToDurationAsync } from './functions/loopAnimationClipToDuration';
import { yieldToMainThread } from './functions/yieldToMainThread';
import { estimateBoneFrequency } from './functions/estimateBoneFrequency';

// SkeletalMotion class import animated human model, create animated PLD control rig.
export class SkeletalMotion{     
    constructor(sceneManager) {
        this.scene = null;
        this.sceneManager = sceneManager;
        
        // Model related
        this.assetLoader = new FBXLoader();
        this.gltfLoader = new GLTFLoader();
        this.modelFormat = 'fbx'; // 'fbx' | 'gltf'
        this.model = null;
        this.skeletonHelper = null;
        this.AllBoneInfo = null;
        this.BoneInfo = null;
        this.boneObjectByName = new Map();
        this.meshOpacity = 1;
        this.skeletonHelperVisible = true;

        // Animation related
        this.mixer = null;
        this.clipRepeat = null;
        this.sourceClip = null;
        this.originClip = null;
        // this.originTracks = null;
        this.currentClip = null;
        this.pldMap = null;
        
        // Update function for sceneManager
        this.update = (delta) => {
            if (this.mixer) this.mixer.update(delta);
        };
        // Register in sceneManager update
        if (sceneManager) {
            sceneManager.addExternalUpdate(this.update);
        }

    };

    normalizeMeshOpacity(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return 1;
        return Math.max(0, Math.min(1, parsed));
    }

    setMeshOpacity(opacity = 1) {
        const safeOpacity = this.normalizeMeshOpacity(opacity);
        this.meshOpacity = safeOpacity;
        if (!this.model) return;

        const applyOpacity = (material) => {
            if (!material) return;
            if (!material.userData) material.userData = {};
            if (!Number.isFinite(material.userData.__brmBaseOpacity)) {
                const baseOpacity = Number(material.opacity);
                material.userData.__brmBaseOpacity = Number.isFinite(baseOpacity) ? baseOpacity : 1;
            }
            if (typeof material.userData.__brmBaseTransparent !== "boolean") {
                material.userData.__brmBaseTransparent = !!material.transparent;
            }

            const baseOpacity = material.userData.__brmBaseOpacity;
            material.opacity = Math.max(0, Math.min(1, baseOpacity * safeOpacity));
            material.transparent = safeOpacity < 0.999 ? true : material.userData.__brmBaseTransparent;
            material.needsUpdate = true;
        };

        this.model.traverse((child) => {
            if (!child?.isMesh || !child.material) return;
            if (Array.isArray(child.material)) {
                child.material.forEach((mat) => applyOpacity(mat));
            } else {
                applyOpacity(child.material);
            }
        });
    }

    setSkeletonHelperVisible(visible = true) {
        this.skeletonHelperVisible = visible !== false;
        if (this.skeletonHelper) {
            this.skeletonHelper.visible = this.skeletonHelperVisible;
        }
    }

    // ============= REMOVE AND DISPOSE EXISTING MODEL =============
    disposeCurrentModel() {
        // Model related
        if (this.skeletonHelper && this.scene) {
            this.scene.remove(this.skeletonHelper);
        }
        this.skeletonHelper = null;
        if (this.model){
            if (this.scene) this.scene.remove(this.model);
            this.model.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                    child.material.forEach((mat) => mat?.dispose && mat.dispose());
                    } else if (child.material) {
                    child.material.dispose();
                    }
                }
            });
            this.model = null;
        };
        this.AllBoneInfo = null;
        this.BoneInfo = null;
        this.boneObjectByName = new Map();
        this.pldMap = null;

        // Animation related
        this.mixer = null;
        this.clipRepeat = null;
        this.sourceClip = null;
        this.originclip = null;
        this.currentclip = null;
    };

    resetState() {
        this.disposeCurrentModel();
        this.mixer = null;
        this.clipRepeat = null;
        this.sourceClip = null;
        this.originClip = null;
        this.currentClip = null;
        // Keep compatibility with legacy misspelled fields.
        this.originclip = null;
        this.currentclip = null;
    }

    // ============= SET HUMAN MODEL AND ANIMATION CLIP =============

    // Load animated model from FBX or GLB/GLTF file
    loadSkeletalMotionFromFile(file, onProgress = null) {
        if (!(file instanceof File)) {
            return Promise.reject(new Error("Please select a valid animation file."));
        }
        this.disposeCurrentModel();
        const objectUrl = URL.createObjectURL(file);
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'glb' || ext === 'gltf') {
            this.modelFormat = 'gltf';
            return this._loadFromGLTF(objectUrl, onProgress);
        }
        this.modelFormat = 'fbx';
        return this._loadFromFBX(objectUrl, onProgress);
    }

    _loadFromFBX(objectUrl, onProgress) {
        return new Promise((resolve, reject) => {
            this.assetLoader.load(
                objectUrl,
                (object) => {
                    this._finalizeLoad(object, object.animations || []);
                    URL.revokeObjectURL(objectUrl);
                    resolve(this.model);
                },
                (event) => {
                    if (typeof onProgress !== "function") return;
                    const loaded = Number(event?.loaded) || 0;
                    const total = Number(event?.total) || 0;
                    const percent = total > 0 ? (loaded / total) * 100 : null;
                    onProgress({ loaded, total, percent, event });
                },
                (error) => {
                    URL.revokeObjectURL(objectUrl);
                    reject(error);
                }
            );
        });
    }

    _loadFromGLTF(objectUrl, onProgress) {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                objectUrl,
                (gltf) => {
                    this._finalizeLoad(gltf.scene, gltf.animations || []);
                    URL.revokeObjectURL(objectUrl);
                    resolve(this.model);
                },
                (event) => {
                    if (typeof onProgress !== "function") return;
                    const loaded = Number(event?.loaded) || 0;
                    const total = Number(event?.total) || 0;
                    const percent = total > 0 ? (loaded / total) * 100 : null;
                    onProgress({ loaded, total, percent, event });
                },
                (error) => {
                    URL.revokeObjectURL(objectUrl);
                    reject(error);
                }
            );
        });
    }

    _finalizeLoad(model, animations) {
        this.model = model;
        this.setMeshOpacity(this.meshOpacity);
        const sourceClip = animations[0] || null;
        const { AllBoneInfo, BoneInfo, clipRepeat } = this.inferSkeletonInfo(this.model, sourceClip);
        this.AllBoneInfo = AllBoneInfo;
        this.BoneInfo = BoneInfo;
        this.clipRepeat = clipRepeat;
        this.sourceClip = sourceClip ? sourceClip.clone() : null;
        this.originClip = this.sourceClip
            ? this.extendAnimationClip(this.sourceClip, this.clipRepeat, true)
            : null;
        this.currentClip = this.originClip ? this.originClip.clone() : null;
    }

    buildTrackLookup(tracks = []) {
        const lookup = { quaternion: [], position: [] };
        tracks.forEach((track) => {
            if (!track?.name || typeof track.name !== "string") return;
            if (track.name.endsWith(".quaternion")) lookup.quaternion.push(track);
            if (track.name.endsWith(".position")) lookup.position.push(track);
        });
        return lookup;
    }

    findTrackForBone(trackLookup, boneName, property) {
        if (!boneName || !property) return null;
        const suffix = `${boneName}.${property}`;
        const tracks = trackLookup?.[property] || [];
        const escapedName = boneName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(`(^|[./|:\\[\\]])${escapedName}\\.${property}$`);
        return tracks.find((track) => track.name === suffix)
            || tracks.find((track) => pattern.test(track.name))
            || null;
    }

    findSourceBoneFromTree(bone) {
        if (!bone?.children || bone.children.length < 1) return null;
        const queue = bone.children.filter((child) => child?.isBone);
        while (queue.length > 0) {
            const sourceBone = queue.shift();
            if (!sourceBone) continue;
            if (sourceBone.position?.lengthSq?.() > 1e-10) return sourceBone;
            sourceBone.children?.forEach((child) => {
                if (child?.isBone) queue.push(child);
            });
        }
        return null;
    }

    getBoneObjectByName(name) {
        if (!name || !this.boneObjectByName) return null;
        return this.boneObjectByName.get(name) || null;
    }

    // Build editable bone info directly from skeleton tree and animation tracks.
    inferSkeletonInfo(model, clip = null) {
        if (!model) {
            return { AllBoneInfo: [], BoneInfo: [], clipRepeat: 1 };
        }

        const trackLookup = this.buildTrackLookup(clip?.tracks || []);
        const rawBones = [];
        model.traverse((child) => {
            if (child?.isBone && typeof child.name === "string" && child.name.length > 0) {
                rawBones.push(child);
            }
        });

        const chosenByName = new Map();
        rawBones.forEach((bone, index) => {
            const sourceBone = this.findSourceBoneFromTree(bone);
            const oriVector = sourceBone?.position?.clone?.() || null;
            const hasSource = !!oriVector && oriVector.lengthSq() > 1e-10;
            const quatTrack = this.findTrackForBone(trackLookup, bone.name, "quaternion");
            const quatFrameCount = Math.floor((quatTrack?.values?.length || 0) / 4);
            const hasQuatTrack = quatFrameCount >= 3;
            const score = (hasSource ? 2 : 0) + (hasQuatTrack ? 1 : 0);

            const next = {
                bone,
                name: bone.name,
                oriVector,
                hasSource,
                hasQuatTrack,
                index,
                score,
            };

            const current = chosenByName.get(bone.name);
            if (!current || next.score > current.score) {
                chosenByName.set(bone.name, next);
            }
        });

        const selected = Array.from(chosenByName.values())
            .filter((entry) => entry.hasSource && entry.hasQuatTrack)
            .sort((a, b) => a.index - b.index);

        this.boneObjectByName = new Map(
            selected.map((entry) => [entry.name, entry.bone])
        );

        const idByBone = new Map();
        selected.forEach((entry, idx) => {
            idByBone.set(entry.bone, idx + 1);
        });

        const allBoneInfo = selected.map((entry) => {
            let parentBone = entry.bone.parent;
            while (parentBone?.isBone && !idByBone.has(parentBone)) {
                parentBone = parentBone.parent;
            }

            const parentId = parentBone?.isBone ? (idByBone.get(parentBone) || 0) : 0;
            const directChildBone = (entry.bone.children || []).find(
                (child) => child?.isBone && idByBone.has(child)
            );
            const childId = directChildBone ? (idByBone.get(directChildBone) || 0) : 0;

            return {
                id: idByBone.get(entry.bone),
                name: entry.name,
                parent: parentId,
                lenParent: parentId,
                child: childId,
                oriVector: entry.oriVector.clone(),
            };
        });

        const boneInfo = allBoneInfo.map((bone) => ({
            ...bone,
            oriVector: bone.oriVector?.clone?.() || new THREE.Vector3(1, 0, 0),
        }));

        return { AllBoneInfo: allBoneInfo, BoneInfo: boneInfo, clipRepeat: 1 };
    };

    // Set animation clip
    setAnimClip(clip){
        if (!this.mixer) {
            this.currentClip = clip;
            return;
        }
        this.currentClip = clip;
        this.mixer.stopAllAction();  
        const action = this.mixer.clipAction(this.currentClip);
        action.reset().play(); 
    }

    setClipRepeat(repeatCount, seamless = true) {
        if (!this.sourceClip) {
            console.warn("No source clip available for clipRepeat update.");
            return false;
        }

        const parsed = Number(repeatCount);
        if (!Number.isFinite(parsed)) {
            console.warn("Invalid clipRepeat value:", repeatCount);
            return false;
        }

        const safeRepeat = Math.max(1, Math.round(parsed));
        this.clipRepeat = safeRepeat;
        this.originClip = this.extendAnimationClip(this.sourceClip, safeRepeat, seamless);
        this.currentClip = this.originClip.clone();
        if (this.originClip?.tracks && this.AllBoneInfo && this.BoneInfo) {
            this.BoneInfo = getBoneInfo(this.originClip.tracks, this.AllBoneInfo, this.BoneInfo);
        }

        if (this.mixer) {
            this.setAnimClip(this.currentClip);
        }
        return true;
    }

    // ============= SHOW ANIMATED MODEL =============
    // Do once when first add model to the scene
    configureAnimation(scene) {
        if (!this.model) return;

        if (scene) this.scene = scene;
        if (!this.scene) {
            console.warn("Scene is not provided. Animation will not be added to any scene.");
            return;
        }

        // Add model
        // FBX is in centimeters (×0.1 → ~17 units for a 170cm person).
        // GLTF/GLB is already in meters (×10 → same visual size).
        const scaleFactor = this.modelFormat === 'gltf' ? 10 : 0.1;
        this.model.userData.importDisplayScaleFactor = scaleFactor;
        this.model.userData.glbReimportDisplayScaleFactor = 10;
        if (this.model.userData.importDisplayScaleApplied !== true) {
            this.model.scale.multiplyScalar(scaleFactor);
            this.model.userData.importDisplayScaleApplied = true;
        }
        this.model.position.set(0, 0, 0);
        this.setMeshOpacity(this.meshOpacity);
        this.scene.add(this.model);
        this.skeletonHelper = new THREE.SkeletonHelper(this.model);
        this.skeletonHelper.visible = this.skeletonHelperVisible;
        this.scene.add(this.skeletonHelper);

        // Add animation player and play origin clip
        this.mixer = new THREE.AnimationMixer(this.model);
        if (this.originClip) {
            const action = this.mixer.clipAction(this.originClip);
            action.play();
        }
        
        if (this.originClip?.tracks) {
            this.BoneInfo = getBoneInfo(this.originClip.tracks, this.AllBoneInfo, this.BoneInfo);
        }

        console.log("New Bone Info:", this.BoneInfo);
    };

    // ============= CLIP EDITION =============
    extendAnimationClip(clip, repeatCount, seamless = true){
        const newTracks = [];
        const duration = clip.duration;

        clip.tracks.forEach((track) => {
            const times = Array.from(track.times);
            const values = Array.from(track.values);
            const timeStep = times[times.length - 1] - times[0];
            const valueSize = values.length / times.length;

            const newTimes = [];
            const newValues = [];

            for (let r = 0; r < repeatCount; r++) {
            const offset = r * timeStep;
            if (seamless && r > 0) {
                newTimes.push(...times.slice(1).map((t) => t + offset));
                newValues.push(...values.slice(valueSize));
            } else {
                newTimes.push(...times.map((t) => t + offset));
                newValues.push(...values);
            }
            }

            const newTrack = new track.constructor(track.name, newTimes, newValues);
            newTracks.push(newTrack);
        });

        const newDuration = clip.duration * repeatCount;
        return new THREE.AnimationClip(clip.name + `_extended`, newDuration, newTracks);
    };

    // ============ CLIP EDIT FUNCTIONS ============
    checkBoneInfo(){
        console.log("Checking Bone Info:",this.BoneInfo);
    };

    setBoneFrequencyEstimateConfig(boneId, config = {}) {
        const bone = (this.BoneInfo || []).find(item => String(item.id) === String(boneId));
        if (!bone?.Ori?.MPAngle) return null;
        const estimate = estimateBoneFrequency(
            bone.Ori.MPAngle,
            bone.sample_freq,
            config.maxFundamentalHz ?? bone.FrequencyMaxHz,
            config.minPeakCorrelation ?? bone.FrequencyMinCorrelation
        );
        bone.FrequencyMaxHz = estimate.maxFundamentalHz;
        bone.FrequencyMinCorrelation = estimate.minPeakCorrelation;
        bone.FrequencyEstimate = estimate;
        return estimate;
    }

    generateNewClip(allBoneParams, bone, api){
        if (!this._generationPromise) {
            this._generationPromise = this._generateNewClipAsync(allBoneParams, bone, api)
                .finally(() => { this._generationPromise = null; });
        }
        return this._generationPromise;
    }

    async _generateNewClipAsync(allBoneParams, bone, api){
        const sourceDuration = this.originClip?.duration;
        if (!(sourceDuration > 0)) return;

        const manipulatedClip = this.originClip.clone();
        const diagnosticInputs = [];
        let processedBoneCount = 0;
        for (const targetBone of (this.BoneInfo || [])) {
            if (!allBoneParams?.[targetBone.id]) continue;
            const diagnosticInput = await generateBoneClip(allBoneParams,targetBone,this.BoneInfo,manipulatedClip,api);
            if (diagnosticInput) diagnosticInputs.push(diagnosticInput);
            processedBoneCount++;
            if (processedBoneCount % 4 === 0) await yieldToMainThread();
        }
        manipulatedClip.resetDuration();
        const targetDuration = Math.max(sourceDuration, manipulatedClip.duration);
        this.currentClip = await loopAnimationClipToDurationAsync(manipulatedClip, targetDuration);
        let diagnosticCount = 0;
        for (const input of diagnosticInputs) {
            updateBoneDiagnosticPlots(input, targetDuration);
            diagnosticCount++;
            if (diagnosticCount % 4 === 0) await yieldToMainThread();
        }
        this.setAnimClip(this.currentClip);
        console.log("New Bone Info:", this.BoneInfo);
    }

    // ============= EXPORT =============
    exportGLBBlob() {
        if (!this.model) {
            return Promise.reject(new Error("No human model to export."));
        }
        return exportSkeletalAnimationGlbBlob(this.model, this.currentClip);
    }

    exportGLTF() {
        if (!this.model) {
        console.warn("No human model to export.");
        return;
        }
        this.exportGLBBlob()
            .then((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "HumanWithEditedAnim.glb";
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                console.log("GLTF exported with current animation.");
            })
            .catch((err) => console.error("Error exporting GLTF:", err));
    };
}
