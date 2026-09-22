import * as THREE from 'three';

export const MixamoAllBoneInfo = [
    {id:1, name:"mixamorig4Hips", parent:0, child:2, oriVector:new THREE.Vector3(0,30,0)},
    {id:2, name:"mixamorig4Spine", parent:1, child:3, oriVector:new THREE.Vector3(0,30,0)},
    {id:3, name:"mixamorig4Spine1", parent:2, child:4, oriVector:new THREE.Vector3(0,30,0)},
    {id:4, name:"mixamorig4Spine2", parent:3, child:5, oriVector:new THREE.Vector3(0,30,0)},
    {id:5, name:"mixamorig4Neck", parent:4, child:20, oriVector:new THREE.Vector3(0,30,0)},
    {id:6, name:"mixamorig4LeftShoulder", parent:4, child:7, oriVector:new THREE.Vector3(0,30,0)},
    {id:7, name:"mixamorig4LeftArm", parent:6, child:8, oriVector:new THREE.Vector3(0,30,0)},
    {id:8, name:"mixamorig4LeftForeArm", parent:7, child:18, oriVector:new THREE.Vector3(0,30,0)},
    {id:9, name:"mixamorig4RightShoulder", parent:4, child:10, oriVector:new THREE.Vector3(0,30,0)},
    {id:10, name:"mixamorig4RightArm", parent:9, child:11, oriVector:new THREE.Vector3(0,30,0)},
    {id:11, name:"mixamorig4RightForeArm", parent:10, child:19, oriVector:new THREE.Vector3(0,30,0)},
    {id:12, name:"mixamorig4LeftUpLeg", parent:1, child:13, oriVector:new THREE.Vector3(0,30,0)},
    {id:13, name:"mixamorig4LeftLeg", parent:12, child:16, oriVector:new THREE.Vector3(0,30,0)},
    {id:14, name:"mixamorig4RightUpLeg", parent:1, child:15, oriVector:new THREE.Vector3(0,30,0)},
    {id:15, name:"mixamorig4RightLeg", parent:14, child:17, oriVector:new THREE.Vector3(0,30,0)},
    {id:16, name:"mixamorig4LeftFoot", parent:13, child:0, oriVector:new THREE.Vector3(0,30,0)},
    {id:17, name:"mixamorig4RightFoot", parent:15, child:0, oriVector:new THREE.Vector3(0,30,0)},
    {id:18, name:"mixamorig4LeftHand", parent:8, child:0, oriVector:new THREE.Vector3(0,30,0)},
    {id:19, name:"mixamorig4RightHand", parent:11, child:0, oriVector:new THREE.Vector3(0,30,0)},
    {id:20, name:"mixamorig4Head", parent:5, child:0, oriVector:new THREE.Vector3(0,30,0)}
];

export const MixamoBoneInfo = MixamoAllBoneInfo.filter(bone => bone.id>=1 && bone.id<=15);

export const MixamoPldUpdateOrder = [
    [1],
    [2,12,14],
    [3,13,15],
    [4,16,17],
    [5,6,9],
    [7,10,20],
    [8,11],
    [18,19]
];