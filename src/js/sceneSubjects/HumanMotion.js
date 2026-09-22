import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { getBoneInfo } from './functions/getBoneInfo';
import { MHAllBoneInfo, MHBoneInfo } from './variables/MetaHumanBoneInfo';
import { setBoneAmpScale } from './functions/setBoneAmpScale';
import { exportGltf } from './functions/exportGltf';
import { setBoneFreq } from './functions/setBoneFreq';
import { PLDsphere } from './objects/PLDsphere';
import { deepClone } from './functions/deepClone';
import { getPLDInfo } from './functions/PLDfunctions/getPLDInfo';
import { plotPldPspaceLoc } from './functions/debug/plotPldPspaceLoc';
import { MixamoPldUpdateOrder } from './variables/MixamoBoneInfo';
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { setPldAmpScale } from './functions/PLDfunctions/setPldAmpScale';
import { applyGlbReimportScaleCompensation, detachExcludedAnimationExportObjects } from './functions/exportAnimationModelOnly';

export function HumanMotion(scene){
    // Variables for test
    const testBone = 'f_tal_nrw_body_rigthigh_r';
    let frameIdx = 0;
    
    // Initialize basic components
    let humanMixer;
    let pldMixer;
    let originClip = [];
    let originTracks = [];
    let originPLDClip = [];
    let originPLDTracks = [];
    let pldInfo = [];
    let humanModel;
    let boneSpheres = []; 

    // Initialize PLD group for humanModelIK/pure PLD
    const pldGroup = new THREE.Group();
    scene.add(pldGroup);
    pldGroup.position.set(20, 0, 0); // Move along x axis if this is humanModel mode

    this.loadHumanMotion = function(AllBoneInfo, BoneInfo, AnimURL, clipRepeat, PldUpdateOrder){
    
        // Show original animation
        const assetLoader = new FBXLoader();
        assetLoader.load(AnimURL.href, (object)=>{

            humanModel = object;
            object.scale.set(0.1,0.1,0.1);
            object.userData.importDisplayScaleFactor = 0.1;
            object.userData.glbReimportDisplayScaleFactor = 10;
            object.position.set(-10,0,0);
            scene.add(object);

            // const fbxSkeletonHelper = new THREE.SkeletonHelper(object);
            // scene.add(fbxSkeletonHelper);

            // Create PLD spheres according to humanModel
            const targetBoneNames = AllBoneInfo.map(b => b.name);
            const addedNames = new Set();
            object.traverse(child => {
                if (
                    child.isBone &&
                    targetBoneNames.includes(child.name) &&
                    !addedNames.has(child.name)
                ) {
                    let pldId;
                    let pldParentId;
                    // Get bone id from AllBoneInfo
                    AllBoneInfo.forEach(bone => {
                        if (bone.name === child.name)
                        {
                            pldId = bone.id;
                            pldParentId = bone.parent;
                        }
                    });
                    
                    const plds = new PLDsphere(pldId, child);
                    pldGroup.add(plds.sphere);
                    boneSpheres.push(plds);
                    pldInfo.push({id: pldId, parent: pldParentId});
                    addedNames.add(child.name);
                }
            });

            // Human mixer
            humanMixer = new THREE.AnimationMixer(object);
            originClip = object.animations[0];

            // Extend Clip
            originClip = extendAnimationClip(originClip, clipRepeat, true)

            const humanAction = humanMixer.clipAction(originClip);
            humanAction.play();
            // Save humanModel origin tracks
            originTracks = originClip.tracks.map(track => track.clone());

            // Create world position tracks for boneSpheres

            const allPLDTracks = [];

            boneSpheres.forEach(plds => {
                const quatTrack = originClip.tracks.find(t => t.name === `${plds.bone.name}.quaternion`);
                if (!quatTrack) return;
        
                const times = quatTrack.times;
                const values = new Float32Array(times.length * 3);
                const vec = new THREE.Vector3();
        
                for (let i = 0; i < times.length; i++) {
                    humanMixer.setTime(times[i]);
                    plds.bone.getWorldPosition(vec);
                    values[i * 3] = vec.x;
                    values[i * 3 + 1] = vec.y;
                    values[i * 3 + 2] = vec.z;
                }
        
                const newTrackName = `${plds.sphere.name}.position`;
                const newTrack = new THREE.VectorKeyframeTrack(newTrackName, times, values);
        
                plds.track = newTrack;
                // Save position track in pldInfo
                const target = pldInfo.find(pld => pld.id === plds.sphere.pldId)
                target.globalPosTrack = newTrack.values.slice();
                allPLDTracks.push(newTrack);
            });

            // PLD Mixer
            const pldClip = new THREE.AnimationClip('PLDclip', originClip.duration, allPLDTracks);
            originPLDClip = pldClip;
            pldMixer = new THREE.AnimationMixer(pldGroup);
            const pldAction = pldMixer.clipAction(pldClip);
            pldAction.play();
            // Save PLD origin tracks
            originPLDTracks = originPLDClip.tracks.map(track => track.clone());

            // Save property
            this.humanMixer = humanMixer;
            this.humanModel = humanModel;
            this.humanClip = originClip;
            this.boneInfo = getBoneInfo(scene, originTracks, AllBoneInfo, BoneInfo);

            this.pldMixer = pldMixer;
            this.pldGroup = pldGroup;
            this.pldClip = originPLDClip;
            this.PldUpdateOrder = PldUpdateOrder;
            this.pldInfo = getPLDInfo(pldInfo);
        });
    };

    this.checkBoneInfo = function(){
        console.log(this.humanModel);
    };

    // Function: Change amplitude scale
    this.updateBoneAmpScale = function(allBoneParams, scene){
        console.log("Received Bone Params are:",allBoneParams);
        setBoneAmpScale(allBoneParams, this.boneInfo, originClip, this.gui, scene);
    };
    this.updatePldAmpScale = function(allPldParams, scene){
        console.log("Received PLD Params are:",allPldParams);
        setPldAmpScale(allPldParams, this.pldInfo, originPLDClip, this.gui, scene, this.PldUpdateOrder);
    };
    
    // Function:Filter
    this.updateKeepBoneFreq = function(type){
        setBoneFreq(scene, type, this.boneInfo, originClip, this.gui);
        console.log("Received Keep Freq Type", type);
    };

    this.update = function(delta) {
        if (humanMixer) humanMixer.update(delta);
        if (pldMixer) pldMixer.update(delta);

        // // Plot pld local coordinates
        // if (this.pldInfo && this.pldClip) {
        //     const duration = this.pldClip.duration;
        //     const frameCount = this.pldInfo[0].globalPosTrack.length / 3;
        //     const currentTime = pldMixer.time % duration;
        //     const frameIdx = Math.floor((currentTime / duration) * frameCount);
    
        //     drawPLDBases(scene, this.pldInfo, frameIdx, 1);
        // }
    };

    // Export current model with current (possibly edited) animation to GLB
    this.exportGLTF = function () {
        if (!humanModel) {
        console.warn("No human model to export.");
        return;
        }
        const exporter = new GLTFExporter();

        const options = {
        binary: true,
        animations: this.humanClip ? [this.humanClip] : [],
        };
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
                const blob =
                result instanceof ArrayBuffer
                    ? new Blob([result], { type: "model/gltf-binary" })
                    : new Blob([JSON.stringify(result)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "HumanWithEditedAnim.glb";
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                console.log("GLTF exported with current animation.");
            },
            (err) => {
                restoreExportState();
                console.error("Error exporting GLTF:", err);
            },
            options
            );
        } catch (err) {
            restoreExportState();
            console.error("Error exporting GLTF:", err);
        }
    };

};

function extendAnimationClip(clip, repeatCount = 2, seamless = true) {
    const newTracks = [];
    const duration = clip.duration;

    clip.tracks.forEach(track => {
        const times = Array.from(track.times);
        const values = Array.from(track.values);

        const timeStep = times[times.length - 1] - times[0];
        const valueSize = values.length / times.length; // e.g. 4 for quaternion, 3 for vector

        const newTimes = [];
        const newValues = [];

        for (let r = 0; r < repeatCount; r++) {
            const offset = r * timeStep;

            if (seamless && r > 0) {
                newTimes.push(...times.slice(1).map(t => t + offset));
                newValues.push(...values.slice(valueSize));
            } else {
                newTimes.push(...times.map(t => t + offset));
                newValues.push(...values);
            }
        }

        const newTrack = new track.constructor(track.name, newTimes, newValues);
        newTracks.push(newTrack);
    });

    const newDuration = clip.duration * repeatCount;
    const newClip = new THREE.AnimationClip(
        clip.name + `_extended`,
        newDuration,
        newTracks
    );

    return newClip;
};

export function drawPLDBases(scene, pldInfo, frameIdx, scale = 0.1) {

    const oldAxes = scene.getObjectByName('PLD_BASE_AXES');
    if (oldAxes) scene.remove(oldAxes);

    const group = new THREE.Group();
    group.name = 'PLD_BASE_AXES';

    pldInfo.forEach(pld => {
        if (!pld.baseVector) return;
        if (!pld.globalPosTrack) return;

        const base = pld.baseVector[frameIdx];
        const pos = new THREE.Vector3(
            pld.globalPosTrack[frameIdx * 3] + 20,
            pld.globalPosTrack[frameIdx * 3 + 1],
            pld.globalPosTrack[frameIdx * 3 + 2]
        );

        if (!base) return;

        const vx = base[0].clone().normalize().multiplyScalar(scale);
        const vy = base[1].clone().normalize().multiplyScalar(scale);
        const vz = base[2].clone().normalize().multiplyScalar(scale);

        const axes = [
            { dir: vx, color: 0xff0000 },
            { dir: vy, color: 0x00ff00 },
            { dir: vz, color: 0x0000ff }
        ];

        axes.forEach(a => {
            const points = [pos, pos.clone().add(a.dir)];
            const geom = new THREE.BufferGeometry().setFromPoints(points);
            const mat = new THREE.LineBasicMaterial({ color: a.color });
            const line = new THREE.Line(geom, mat);
            group.add(line);
        });
    });

    scene.add(group);
}
 
  
