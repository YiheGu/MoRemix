import * as THREE from 'three';
import { PLDsphere } from './objects/PLDsphere';
import { getPLDInfo } from './functions/PLDfunctions/getPLDInfo';
import { generatePldClip, updatePldDiagnosticPlots } from './functions/PLDfunctions/generatePldClip';
import { loopAnimationClipToDurationAsync } from './functions/loopAnimationClipToDuration';
import { createFrequencyTimeMapping, retimeLinearSeries } from './functions/setBoneFrequency';
import { yieldToMainThread } from './functions/yieldToMainThread';
import { estimateBoneFrequency } from './functions/estimateBoneFrequency';

export class PLDMotion {
    constructor(sceneManager) {
        this.scene = null;
        this.sceneManager = sceneManager;
        
        // Model related
        this.pldGroup = new THREE.Group();  // Only store sphere
        this.bonePLD = [];
        this.pldInfo = [];

        // Animation related
        this.mixer = null;
        this.pldTracks = [];
        this.sourceClip = null;
        this.clipRepeat = 1;
        this.orginClip = null;
        this.originClip = null;
        this.currentClip = null;
        this.shouldAnalyzePldInfo = false;
        this.showStickFigure = true;
        this.stickThickness = 7;
        this.stickColor = "#c9c9c9";
        this.sphereColor = "#3875bb";
        this.labelColor = "#ffffff";
        this.sphereOutlineColor = "#ffffff";
        this.sphereSize = 2.5;
        this.showSphereLabels = true;
        this.showSphereOutline = false;
        this.useHierarchySphereColoring = true;
        this.visibleSphereIdSet = null;
        this.stickFigureLine = null;
        this.stickFigureBaseRadius = 0.01;
        this._stickUpAxis = new THREE.Vector3(0, 1, 0);
        this._stickDir = new THREE.Vector3();
        this._stickMid = new THREE.Vector3();

        //update function for sceneManager
        this.update = (delta) => {
            if (this.mixer) this.mixer.update(delta);
            this.updateStickFigureGeometry();
        }; 
        // Register in sceneManager update
        if (sceneManager) {
            sceneManager.addExternalUpdate(this.update);
        }
    }

    setPldInfoAnalysisEnabled(enabled) {
        this.shouldAnalyzePldInfo = !!enabled;
    }

    findTrackForBone(tracks, boneName, property) {
        if (!Array.isArray(tracks) || !boneName || !property) return null;
        const suffix = `${boneName}.${property}`;
        const escapedName = boneName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(`(^|[./|:\\[\\]])${escapedName}\\.${property}$`);
        return tracks.find((track) => track?.name === suffix)
            || tracks.find((track) => pattern.test(track?.name || ""))
            || null;
    }

    resetState() {
        this.mixer?.stopAllAction?.();
        this.mixer = null;

        if (this.stickFigureLine) {
            this.pldGroup?.remove?.(this.stickFigureLine);
            this.disposeStickFigureObject?.(this.stickFigureLine);
            this.stickFigureLine = null;
        }

        if (this.pldGroup) {
            this.pldGroup.traverse((child) => {
                if (!child?.isMesh) return;
                if (child.geometry?.dispose) child.geometry.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach((mat) => mat?.dispose?.());
                } else if (child.material?.dispose) {
                    child.material.dispose();
                }
            });
        }

        if (this.scene && this.pldGroup?.parent === this.scene) {
            this.scene.remove(this.pldGroup);
        }
        this.pldGroup?.clear?.();

        this.bonePLD = [];
        this.pldInfo = [];
        this.pldTracks = [];
        this.clipRepeat = 1;
        this.sourceClip = null;
        this.orginClip = null;
        this.originClip = null;
        this.currentClip = null;
        this.visibleSphereIdSet = null;
    }

    // ============= SET PLD SPHERES AND ANIMATION CLIP =============
    
    // Load PLD motion from a CSV file.
    // CSV assumed format (with header): name,frame,x,y,z
    // Returns a THREE.AnimationClip and stores pld tracks in this.pldTracks as [name, track].
    async loadPLDMotionFromFile(file, options = {}) {
        const fps = options.fps || 100; // default fps if not provided

        // read text
        const text = await file.text();
        const lines = text.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return null;

        // remove header if present (detect non-numeric frame in first data column)
        let startIndex = 0;
        const firstLineParts = lines[0].split(',');
        if (firstLineParts.length >= 5 && isNaN(Number(firstLineParts[1]))) {
            // assume header
            startIndex = 1;
        }

        const records = [];
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(',');
            if (parts.length < 5) continue;
            const name = parts[0].trim();
            const frame = Number(parts[1]);
            const x = Number(parts[2])/100;
            const z = Number(parts[3])/100;
            const y = Number(parts[4])/100;
            if (Number.isNaN(frame) || Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) continue;
            records.push({ name, frame, x, y, z });
        }

        if (records.length === 0) return null;

        // group records by name, and within each name keep latest value for a frame (map frame->record)
        const groups = new Map();
        let globalMinFrame = Infinity;
        let globalMaxFrame = -Infinity;
        for (const r of records) {
            if (!groups.has(r.name)) groups.set(r.name, new Map());
            const frameMap = groups.get(r.name);
            frameMap.set(r.frame, r); // overwrites duplicates for same frame
            if (r.frame < globalMinFrame) globalMinFrame = r.frame;
            if (r.frame > globalMaxFrame) globalMaxFrame = r.frame;
        }

        const tracks = [];
        this.pldTracks = [];

        // create VectorKeyframeTrack per group
        for (const [name, frameMap] of groups.entries()) {
            // get sorted frames
            const frames = Array.from(frameMap.keys()).sort((a, b) => a - b);
            if (frames.length === 0) continue;

            // generate times aligned to globalMinFrame so all tracks share same timebase
            const times = frames.map(f => (f - globalMinFrame) / fps);

            // collect values [x,y,z,...]
            const values = [];
            for (const f of frames) {
                const rec = frameMap.get(f);
                values.push(rec.x, rec.y, rec.z);
            }

            // track name: use objectName.position so it can be applied to objects named by 'name'
            const trackName = `pld${name}.position`;
            const track = new THREE.VectorKeyframeTrack(trackName, times, values);
            tracks.push(track);
            // console.log("Original Track:",track);
            // store [name, track]
            this.pldTracks.push([name, track]);
        }

        // compute clip duration
        const duration = (globalMaxFrame - globalMinFrame) / fps;

        const clip = new THREE.AnimationClip('PLDClip', duration, tracks);
        this.sourceClip = clip.clone();
        this.clipRepeat = 1;
        this.originClip = this.extendAnimationClip(this.sourceClip, this.clipRepeat, true);
        this.currentClip = this.originClip.clone();

        // Create PLD spheres model
        let pldId = 1;
        for (const [name, frameMap] of groups.entries()) {

            const pldS = new PLDsphere(pldId);  // Set pldS.sphere.id
            pldS.sphere.name = `pld${name}`;
            this.pldGroup.add(pldS.sphere);

            const newPldEntry = {id:pldId, name:name};
            newPldEntry.Ori = {};
            newPldEntry.Test = {};

            // store the corresponding global position track (pld<name>.position)
            // find track created earlier in this.pldTracks
            const found = this.pldTracks.find(t => t[0] === name);
            if (found) {
                const track = found[1];
                // attach GlobalAnimTrack to the recently pushed pldInfo entry
                // newPldEntry.GlobalAnimTrack = track.values.slice();
                newPldEntry.Ori.GlobalAnimTrack = track.values.slice();
                newPldEntry.Ori.TimeTrack = track.times.slice();
                // Calculate and store the number of frames
                newPldEntry.nFrames = track.values.length / 3;
            }
            
            this.pldInfo.push(newPldEntry);

            pldId++;
        }

        if (this.visibleSphereIdSet !== null) {
            const allIdSet = new Set(this.getAllSphereIds());
            this.visibleSphereIdSet = new Set(
                Array.from(this.visibleSphereIdSet).filter((id) => allIdSet.has(id))
            );
        }
    }

    // Load PLD motion from Skeletal Motion AnimSource
    async loadPLDMotionFromSkeletalMotion(AnimSource){
        if (!AnimSource?.model || !Array.isArray(AnimSource?.AllBoneInfo)) return;

        // Rebuild from scratch to avoid duplicated spheres/info when workspace is re-initialized.
        this.pldGroup.clear();
        this.bonePLD = [];
        this.pldInfo = [];
        this.stickFigureLine = null;

        // Generate PLDs
        const model = AnimSource.model;
        const allBoneInfo = AnimSource.AllBoneInfo;

        allBoneInfo.forEach((bone) => {
            const boneObj = AnimSource.getBoneObjectByName?.(bone.name) || model.getObjectByName(bone.name);
            if (!boneObj?.isBone) return;

            const pldS = new PLDsphere(bone.id, boneObj);
            this.pldGroup.add(pldS.sphere);
            this.bonePLD.push(pldS);
            this.pldInfo.push({
                id: bone.id,
                name: bone.name,
                parent: bone.parent ?? 0,
                Ori: {},
                Test: {},
            });
        });

        this.setClipWithSource(AnimSource, true);
        this.syncPldInfoFromClip(this.originClip || this.sourceClip);
        if (this.visibleSphereIdSet !== null) {
            const allIdSet = new Set(this.getAllSphereIds());
            this.visibleSphereIdSet = new Set(
                Array.from(this.visibleSphereIdSet).filter((id) => allIdSet.has(id))
            );
        }
    }

    setClipWithSource(AnimSource,isOrigin){
        const model = AnimSource.model;
        // Set PLDs animation from AnimSource.currentClip
        const originClip = AnimSource.currentClip;
        const allPLDTracks = [];
        
        // Create a temporary mixer for the model to get world positions at each frame
        const humanMixer = new THREE.AnimationMixer(model);
        const action = humanMixer.clipAction(originClip);
        action.play();

        this.bonePLD.forEach(pldS => {
            const quatTrack = this.findTrackForBone(originClip.tracks, pldS.bone.name, "quaternion");
            if (!quatTrack) return;

            const times = quatTrack.times;
            const values = new Float32Array(times.length * 3);
            const vec = new THREE.Vector3();

            for (let i = 0; i < times.length; i++) {
                humanMixer.setTime(times[i]);
                pldS.bone.getWorldPosition(vec);
                values[i * 3] = vec.x;
                values[i * 3 + 1] = vec.y;
                values[i * 3 + 2] = vec.z;
            }

            const newTrackName = `${pldS.sphere.name}.position`
            
            const newTrack = new THREE.VectorKeyframeTrack(newTrackName, times, values);

            pldS.track = newTrack;
            allPLDTracks.push(newTrack);
        });

        // Create PLD animation clip
        const pldClip = new THREE.AnimationClip('PLDclip', originClip.duration, allPLDTracks);
        if (isOrigin){
            this.sourceClip = pldClip.clone();
            this.clipRepeat = 1;
            this.originClip = this.extendAnimationClip(this.sourceClip, this.clipRepeat, true);
            this.currentClip = this.originClip.clone();
            this.syncPldInfoFromClip(this.originClip || this.sourceClip);
        }
        else{
            this.currentClip = pldClip;
            this.setAnimClip(this.currentClip);
        }
    }

    syncPldInfoFromClip(clip) {
        if (!clip?.tracks || !Array.isArray(this.pldInfo) || this.pldInfo.length < 1) return;
        const trackByName = new Map(
            clip.tracks
                .filter((track) => typeof track?.name === "string")
                .map((track) => [track.name, track])
        );
        this.pldInfo.forEach((pld) => {
            const candidates = [
                `pld${pld?.name}.position`,
                `pld${pld?.id}.position`,
                `${pld?.id}_PLD.position`,
            ];
            const track = candidates.map((name) => trackByName.get(name)).find(Boolean);
            if (!track?.values) return;

            if (!pld.Ori) pld.Ori = {};
            pld.Ori.GlobalAnimTrack = track.values.slice();
            pld.Ori.TimeTrack = track.times.slice();
            pld.nFrames = track.values.length / 3;
        });
    }

    

    // ============= SHOW ANIMATED MODEL =============
    configureAnimation(scene) {
        if (!this.pldGroup) return;

        if (scene) this.scene = scene;
        if (!this.scene) {
            console.warn("Scene is not provided. Animation will not be added to any scene.");
            return;
        }
        // Add PLD group
        this.pldGroup.position.set(0, 0, 0);
        this.scene.add(this.pldGroup);

        // Add animation player and play current clip
        this.mixer = new THREE.AnimationMixer(this.pldGroup);
        const action = this.mixer.clipAction(this.currentClip);
        action.play();

        if (this.shouldAnalyzePldInfo) {
            this.pldInfo = getPLDInfo(this.pldInfo);
        }
        this.applySphereVisuals();
        this.ensureStickFigureLine(true);
        this.updateStickFigureGeometry();
    };

    setAnimClip(clip){
        this.currentClip = clip;
        if (!this.mixer) return;
        this.mixer.stopAllAction();  
        const action = this.mixer.clipAction(this.currentClip);
        action.reset().play();
    }

    getPldSphereById(pldId) {
        if (!this.pldGroup) return null;
        return this.pldGroup.children.find((child) => child?.Id === pldId) || null;
    }

    isSphereVisible(pldId) {
        const id = Number(pldId);
        if (!Number.isFinite(id) || id <= 0) return false;
        return this.visibleSphereIdSet === null || this.visibleSphereIdSet.has(id);
    }

    findVisibleAncestorId(parentId, parentById) {
        let currentId = Number(parentId);
        if (!Number.isFinite(currentId) || currentId <= 0) return 0;

        const visited = new Set();
        while (Number.isFinite(currentId) && currentId > 0) {
            if (visited.has(currentId)) return 0;
            visited.add(currentId);

            if (this.isSphereVisible(currentId)) return currentId;

            const nextParent = Number(parentById.get(currentId) ?? 0);
            currentId = Number.isFinite(nextParent) ? nextParent : 0;
        }
        return 0;
    }

    getStickFigurePairs() {
        if (!Array.isArray(this.pldInfo) || this.pldInfo.length < 1) return [];

        const parentById = new Map();
        this.pldInfo.forEach((pld) => {
            const childId = Number(pld?.id);
            const parentId = Number(pld?.parent);
            if (!Number.isFinite(childId) || childId <= 0) return;
            parentById.set(childId, Number.isFinite(parentId) ? parentId : 0);
        });

        const pairs = [];
        this.pldInfo.forEach((pld) => {
            const childId = Number(pld?.id);
            if (!Number.isFinite(childId) || childId <= 0) return;
            // Rule 1: when this sphere is hidden as child joint, its incoming stick is hidden.
            if (!this.isSphereVisible(childId)) return;

            // Rule 2: when parent is hidden, skip upward to nearest visible ancestor.
            const resolvedParentId = this.findVisibleAncestorId(pld?.parent, parentById);
            if (resolvedParentId <= 0) return;

            const parentSphere = this.getPldSphereById(resolvedParentId);
            const childSphere = this.getPldSphereById(childId);
            if (!parentSphere || !childSphere) return;
            pairs.push([parentSphere, childSphere]);
        });
        return pairs;
    }

    ensureStickFigureLine(forceRebuild = false) {
        if (!this.pldGroup) return;
        const pairs = this.getStickFigurePairs();
        const segmentCount = pairs.length;
        if (segmentCount < 1) {
            if (this.stickFigureLine) {
                this.pldGroup.remove(this.stickFigureLine);
                this.disposeStickFigureObject(this.stickFigureLine);
                this.stickFigureLine = null;
            }
            return;
        }

        const currentCount = this.stickFigureLine?.children?.length || 0;
        const needRecreate = forceRebuild || !this.stickFigureLine || currentCount !== segmentCount;
        if (!needRecreate) return;

        if (this.stickFigureLine) {
            this.pldGroup.remove(this.stickFigureLine);
            this.disposeStickFigureObject(this.stickFigureLine);
        }

        const group = new THREE.Group();
        const geometry = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
        const material = new THREE.MeshBasicMaterial({
            color: this.stickColor,
        });

        for (let i = 0; i < segmentCount; i++) {
            const seg = new THREE.Mesh(geometry, material);
            seg.frustumCulled = false;
            group.add(seg);
        }

        group.userData.stickGeometry = geometry;
        group.userData.stickMaterial = material;
        this.stickFigureLine = group;
        this.stickFigureLine.visible = !!this.showStickFigure;
        this.pldGroup.add(this.stickFigureLine);
    }

    updateStickFigureGeometry() {
        if (!this.showStickFigure || !this.pldGroup) {
            if (this.stickFigureLine) this.stickFigureLine.visible = false;
            return;
        }

        this.ensureStickFigureLine();
        if (!this.stickFigureLine) return;

        const pairs = this.getStickFigurePairs();
        const segments = this.stickFigureLine.children || [];
        const radius = this.getStickRadius();
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const pair = pairs[i];
            if (!pair || !seg) continue;

            const p = pair[0].position;
            const c = pair[1].position;
            this._stickDir.subVectors(c, p);
            const length = this._stickDir.length();
            if (length < 1e-6) {
                seg.visible = false;
                continue;
            }

            seg.visible = true;
            this._stickMid.copy(p).add(c).multiplyScalar(0.5);
            seg.position.copy(this._stickMid);
            this._stickDir.multiplyScalar(1 / length);
            seg.quaternion.setFromUnitVectors(this._stickUpAxis, this._stickDir);
            seg.scale.set(radius, length, radius);
        }

        this.stickFigureLine.visible = true;
        const stickMaterial = this.stickFigureLine.userData?.stickMaterial;
        if (stickMaterial?.color?.set) {
            stickMaterial.color.set(this.stickColor);
        }
    }

    getStickRadius() {
        const thickness = Number(this.stickThickness) || 1;
        return Math.min(0.35, Math.max(0.006, thickness * this.stickFigureBaseRadius));
    }

    disposeStickFigureObject(obj) {
        if (!obj) return;
        const stickGeometry = obj.userData?.stickGeometry;
        const stickMaterial = obj.userData?.stickMaterial;
        if (stickGeometry?.dispose) stickGeometry.dispose();
        if (stickMaterial?.dispose) stickMaterial.dispose();
    }

    getHierarchyLevelBySphereId() {
        const levelById = new Map();
        const updateOrder = Array.isArray(this.pldInfo?.updateOrder)
            ? this.pldInfo.updateOrder
            : Array.isArray(this.pldInfo) && this.pldInfo.length > 0 && Array.isArray(this.pldInfo[0]?.updateOrder)
                ? this.pldInfo[0].updateOrder
                : null;

        if (!Array.isArray(updateOrder) || updateOrder.length < 1) return levelById;

        updateOrder.forEach((layer, layerIndex) => {
            if (!Array.isArray(layer)) return;
            layer.forEach((id) => {
                const numericId = Number(id);
                if (!Number.isFinite(numericId) || numericId <= 0) return;
                if (!levelById.has(numericId)) {
                    levelById.set(numericId, layerIndex);
                }
            });
        });

        return levelById;
    }

    getHierarchySphereColor(levelIndex, levelCount) {
        if (!Number.isFinite(levelIndex) || !Number.isFinite(levelCount) || levelCount <= 1) {
            return this.sphereColor;
        }

        const palette = [
            "#03192a",
            "#063b5b",
            "#1e5784",
            "#3875bb",
            "#659ed5",
            "#bedaf2",
            "#e2f0f9",
        ];
        const clampedLevel = Math.max(0, Math.min(levelCount - 1, levelIndex));

        if (levelCount <= palette.length) {
            const paletteIndex = Math.round((clampedLevel / Math.max(1, levelCount - 1)) * (palette.length - 1));
            return palette[paletteIndex];
        }

        if (clampedLevel < palette.length) {
            return palette[clampedLevel];
        }

        const overflowIndex = clampedLevel - (palette.length - 1);
        const overflowCount = levelCount - palette.length;
        const normalizedOverflow = overflowCount > 0 ? overflowIndex / overflowCount : 1;
        const lastPaletteColor = new THREE.Color(palette[palette.length - 1]);
        const fadeTargetColor = new THREE.Color("#f8fcff");
        const blendedColor = lastPaletteColor.clone().lerp(fadeTargetColor, Math.min(1, normalizedOverflow * 0.85));
        return `#${blendedColor.getHexString()}`;
    }

    applySphereVisuals() {
        if (!this.pldGroup) return;
        const sphereScale = Number(this.sphereSize) || 1;
        const useHierarchyColoring = this.useHierarchySphereColoring !== false;
        const levelById = useHierarchyColoring ? this.getHierarchyLevelBySphereId() : new Map();
        const hierarchyLevels = levelById.size > 0 ? Math.max(...levelById.values()) + 1 : 0;
        this.pldGroup.children.forEach((child) => {
            if (!child?.isMesh || child?.Id === undefined) return;
            const sphereId = Number(child.Id);
            const visible = this.visibleSphereIdSet === null || this.visibleSphereIdSet.has(sphereId);
            child.visible = visible;
            if (child.material) {
                const levelIndex = levelById.get(sphereId);
                const resolvedColor = useHierarchyColoring && Number.isFinite(levelIndex)
                    ? this.getHierarchySphereColor(levelIndex, hierarchyLevels)
                    : this.sphereColor;
                if (child.material.color?.set) {
                    child.material.color.set(resolvedColor);
                }
                child.material.opacity = 1;
                child.material.transparent = false;
                child.material.depthWrite = true;
            }
            child.scale.setScalar(Math.max(0.05, sphereScale));
            (child.children || []).forEach((node) => {
                if (node?.isSprite) {
                    if (node.userData?.pldSpriteRole === "label") {
                        node.visible = !!this.showSphereLabels && visible;
                        const canvas = node.material.map.image;
                        const ctx = typeof canvas?.getContext === "function" ? canvas.getContext("2d") : null;
                        if (ctx) {
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            ctx.fillStyle = this.labelColor || "#ffffff";
                            ctx.textAlign = "center";
                            ctx.textBaseline = "middle";
                            ctx.font = "bold 48px Arial";
                            ctx.fillText(String(sphereId), canvas.width / 2, canvas.height / 2);
                            node.material.map.needsUpdate = true;
                        }
                    } else if (node.userData?.pldSpriteRole === "outline") {
                        node.visible = !!this.showSphereOutline && visible;
                        const canvas = node.material?.map?.image;
                        const ctx = typeof canvas?.getContext === "function" ? canvas.getContext("2d") : null;
                        if (ctx) {
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            ctx.beginPath();
                            ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width * 0.34, 0, Math.PI * 2);
                            ctx.strokeStyle = this.sphereOutlineColor || "#ffffff";
                            ctx.lineWidth = canvas.width * 0.08;
                            ctx.stroke();
                            node.material.map.needsUpdate = true;
                        }
                    }
                }
            });
        });
    }

    getAllSphereIds() {
        if (Array.isArray(this.pldInfo) && this.pldInfo.length > 0) {
            return this.pldInfo
                .map((pld) => Number(pld?.id))
                .filter((id) => Number.isFinite(id));
        }
        if (!this.pldGroup) return [];
        return this.pldGroup.children
            .map((child) => Number(child?.Id))
            .filter((id) => Number.isFinite(id));
    }

    getVisibleSphereIds() {
        const allIds = this.getAllSphereIds();
        if (this.visibleSphereIdSet === null) return [...allIds];
        const allIdSet = new Set(allIds);
        return Array.from(this.visibleSphereIdSet).filter((id) => allIdSet.has(id));
    }

    setVisibleSphereIds(ids) {
        if (!Array.isArray(ids)) {
            this.visibleSphereIdSet = null;
            this.applySphereVisuals();
            this.ensureStickFigureLine(true);
            this.updateStickFigureGeometry();
            return;
        }
        const allIdSet = new Set(this.getAllSphereIds());
        this.visibleSphereIdSet = new Set(
            ids
                .map((id) => Number(id))
                .filter((id) => Number.isFinite(id) && allIdSet.has(id))
        );
        this.applySphereVisuals();
        this.ensureStickFigureLine(true);
        this.updateStickFigureGeometry();
    }

    setStickFigureVisible(visible) {
        this.showStickFigure = !!visible;
        this.ensureStickFigureLine();
        if (this.stickFigureLine) {
            this.stickFigureLine.visible = this.showStickFigure;
        }
        if (this.showStickFigure) this.updateStickFigureGeometry();
    }

    setStickFigureThickness(thickness) {
        const parsed = Number(thickness);
        if (!Number.isFinite(parsed)) return;
        this.stickThickness = Math.max(1, Math.round(parsed));
        this.updateStickFigureGeometry();
    }

    setStickFigureColor(color) {
        if (typeof color !== "string") return;
        this.stickColor = color;
        const stickMaterial = this.stickFigureLine?.userData?.stickMaterial;
        if (stickMaterial?.color?.set) {
            stickMaterial.color.set(color);
        }
    }

    setSphereColor(color) {
        if (typeof color !== "string") return;
        this.sphereColor = color;
        this.applySphereVisuals();
    }

    setHierarchySphereColoringEnabled(enabled) {
        this.useHierarchySphereColoring = !!enabled;
        this.applySphereVisuals();
    }

    setSphereSize(size) {
        const parsed = Number(size);
        if (!Number.isFinite(parsed)) return;
        this.sphereSize = Math.max(0.1, Math.min(3, parsed));
        this.applySphereVisuals();
    }

    setSphereLabelVisible(visible) {
        this.showSphereLabels = !!visible;
        this.applySphereVisuals();
    }

    setSphereLabelColor(color) {
        if (typeof color !== "string") return;
        this.labelColor = color;
        this.applySphereVisuals();
    }

    setSphereOutlineVisible(visible) {
        this.showSphereOutline = !!visible;
        this.applySphereVisuals();
    }

    setSphereOutlineColor(color) {
        if (typeof color !== "string") return;
        this.sphereOutlineColor = color;
        this.applySphereVisuals();
    }

    // ============= CLIP EDIT FUNCTION =============
    extendAnimationClip(clip, repeatCount, seamless = true){
        if (!clip) return null;
        const newTracks = [];

        clip.tracks.forEach((track) => {
            const times = Array.from(track.times);
            const values = Array.from(track.values);
            if (times.length < 1) return;

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
        return new THREE.AnimationClip(`${clip.name}_extended`, newDuration, newTracks);
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
        this.currentClip = this.originClip ? this.originClip.clone() : null;

        if (this.originClip?.tracks && Array.isArray(this.pldInfo) && this.pldInfo.length > 0) {
            this.syncPldInfoFromClip(this.originClip);
            this.pldInfo = getPLDInfo(this.pldInfo);
            this.ensureStickFigureLine(true);
            this.updateStickFigureGeometry();
        }

        if (this.currentClip) {
            this.setAnimClip(this.currentClip);
        }
        return true;
    }

    checkPLDInfo(){
        getPLDInfo(this.pldInfo);
        console.log(this.pldInfo);
    } 

    setPldFrequencyEstimateConfig(pldId, config = {}) {
        const pld = (this.pldInfo || []).find(item => String(item.id) === String(pldId));
        if (!pld?.Ori?.MPAngle) return null;
        const estimate = estimateBoneFrequency(
            pld.Ori.MPAngle,
            pld.sample_freq,
            config.maxFundamentalHz ?? pld.FrequencyMaxHz,
            config.minPeakCorrelation ?? pld.FrequencyMinCorrelation
        );
        pld.FrequencyMaxHz = estimate.maxFundamentalHz;
        pld.FrequencyMinCorrelation = estimate.minPeakCorrelation;
        pld.FrequencyEstimate = estimate;
        return estimate;
    }

    generateNewClip(allPldParams, pld, api){
        if (!this._generationPromise) {
            this._generationPromise = this._generateNewClipAsync(allPldParams, pld, api)
                .finally(() => { this._generationPromise = null; });
        }
        return this._generationPromise;
    }

    async _generateNewClipAsync(allPldParams, requestedPld, api) {
        const sourceDuration = Number(this.originClip?.duration) || 0;
        if (!(sourceDuration > 0)) return;

        const manipulatedClip = this.originClip.clone();
        const targetPld = (this.pldInfo || []).find(
            item => String(item.id) === String(requestedPld?.id)
        );
        if (!targetPld || !allPldParams?.[targetPld.id]) return;
        const requestedPldParams = allPldParams[targetPld.id];
        const frequencySubtreeIds = collectPldSubtreeIds(this.pldInfo, targetPld.id);
        generatePldClip(allPldParams, targetPld, this.pldInfo, manipulatedClip, api);
        await yieldToMainThread();

        const diagnosticInputs = [];
        for (let trackIndex = 0; trackIndex < manipulatedClip.tracks.length; trackIndex++) {
            const track = manipulatedClip.tracks[trackIndex];
            const targetPld = findPldForPositionTrack(this.pldInfo, track?.name);
            const ownPldParams = targetPld ? allPldParams?.[targetPld.id] : null;
            const inheritsRequestedFrequency = targetPld
                && frequencySubtreeIds.has(String(targetPld.id));
            const targetPldParams = ownPldParams && inheritsRequestedFrequency
                ? {
                    ...ownPldParams,
                    FrequencyScale: requestedPldParams.FrequencyScale,
                    KeepOriginalLength: requestedPldParams.KeepOriginalLength,
                }
                : ownPldParams;
            if (!targetPld || !targetPldParams || !track?.times?.length || track.getValueSize?.() !== 3) continue;

            const sourceTimes = Array.from(track.times);
            const mapping = await createFrequencyTimeMapping(sourceTimes, targetPldParams.FrequencyScale);
            const sourceFrames = [];
            for (let index = 0; index < sourceTimes.length; index++) {
                const offset = index * 3;
                sourceFrames.push([track.values[offset], track.values[offset + 1], track.values[offset + 2]]);
            }
            const outputFrames = mapping.changed
                ? await retimeLinearSeries(sourceFrames, mapping.sourceTimes, mapping.mappedTimes)
                : sourceFrames;
            const outputTimes = mapping.outputTimes.map(time => time + mapping.startTime);
            manipulatedClip.tracks[trackIndex] = new track.constructor(
                track.name,
                outputTimes,
                outputFrames.flat(),
                track.getInterpolation()
            );
            diagnosticInputs.push({ targetPld, targetPldParams, sourceTimes: mapping.sourceTimes, mapping });
        }

        manipulatedClip.resetDuration();
        const targetDuration = Math.max(sourceDuration, manipulatedClip.duration);
        this.currentClip = await loopAnimationClipToDurationAsync(manipulatedClip, targetDuration);
        for (let index = 0; index < diagnosticInputs.length; index++) {
            await updatePldDiagnosticPlots(diagnosticInputs[index], targetDuration);
            if ((index + 1) % 4 === 0) await yieldToMainThread();
        }
        this.setAnimClip(this.currentClip);
        console.log("New PLD Info:", this.pldInfo);
    }

    exportAsCSV(options = {}) {
        if (!this.currentClip || !Array.isArray(this.currentClip.tracks) || this.currentClip.tracks.length === 0) {
            console.warn("No current PLD clip to export.");
            return;
        }

        const fps = Number.isFinite(options.fps) ? options.fps : 100;
        const filename = options.filename || "PLD_CurrentClip.csv";

        const positionTracks = this.currentClip.tracks.filter((track) => {
            return typeof track?.name === "string" && track.name.endsWith(".position");
        });

        if (positionTracks.length === 0) {
            console.warn("No position tracks found in current PLD clip.");
            return;
        }

        const lines = ["name,frame,x,y,z"];

        for (const track of positionTracks) {
            const objectName = track.name.split(".")[0] || "";
            const exportedName = objectName.startsWith("pld") ? objectName.slice(3) : objectName;
            const times = track.times || [];
            const values = track.values || [];

            for (let i = 0; i < times.length; i++) {
                const base = i * 3;
                if (base + 2 >= values.length) break;

                const frame = Math.round(times[i] * fps);
                const x = values[base] * 100;
                const y = values[base + 1] * 100;
                const z = values[base + 2] * 100;

                // Keep column order compatible with loadPLDMotionFromFile() parsing convention.
                lines.push([
                    exportedName,
                    frame,
                    formatCsvNumber(x),
                    formatCsvNumber(z),
                    formatCsvNumber(y)
                ].join(","));
            }
        }

        const csvContent = lines.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        function formatCsvNumber(num) {
            if (!Number.isFinite(num)) return "0";
            return Number(num.toFixed(6)).toString();
        }
    }
}

function findPldForPositionTrack(pldInfo, trackName) {
    if (typeof trackName !== "string" || !trackName.endsWith(".position")) return null;
    return (pldInfo || []).find((pld) => [
        `pld${pld?.name}.position`,
        `pld${pld?.id}.position`,
        `${pld?.id}_PLD.position`,
    ].includes(trackName)) || null;
}

function collectPldSubtreeIds(pldInfo, rootId) {
    const subtreeIds = new Set([String(rootId)]);
    let added = true;
    while (added) {
        added = false;
        (pldInfo || []).forEach((pld) => {
            const id = String(pld?.id);
            const parentId = String(pld?.parent);
            if (subtreeIds.has(id) || !subtreeIds.has(parentId)) return;
            subtreeIds.add(id);
            added = true;
        });
    }
    return subtreeIds;
}
