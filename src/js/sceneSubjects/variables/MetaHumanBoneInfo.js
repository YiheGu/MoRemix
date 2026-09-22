import * as THREE from 'three';

export const MHAllBoneInfo = [
    {id:1, name:"f_tal_nrw_body_rigpelvis", parent:0, lenParent:0, child: 2, oriVector:new THREE.Vector3(30,0,0)},
    {id:2, name:"f_tal_nrw_body_rigspine_01", parent:1, lenParent:1, child: 3, oriVector:new THREE.Vector3(30,0,0)},
    {id:3, name:"f_tal_nrw_body_rigspine_02", parent:2, lenParent:2, child: 4, oriVector:new THREE.Vector3(30,0,0)},
    {id:4, name:"f_tal_nrw_body_rigspine_03", parent:3, lenParent:3, child: 5, oriVector:new THREE.Vector3(30,0,0)},
    {id:5, name:"f_tal_nrw_body_rigspine_04", parent:4, lenParent:4, child: 6, oriVector:new THREE.Vector3(30,0,0)},
    {id:6, name:"f_tal_nrw_body_rigspine_05", parent:5, lenParent:5, child: 7, oriVector:new THREE.Vector3(30,0,0)},
    {id:7, name:"f_tal_nrw_body_rigneck_01", parent:6, lenParent:6, child: 8, oriVector:new THREE.Vector3(30,0,0)},
    {id:8, name:"f_tal_nrw_body_rigneck_02", parent:7, lenParent:7, child: 23, oriVector:new THREE.Vector3(30,0,0)},
    {id:9, name:"f_tal_nrw_body_rigclavicle_l", parent:6, child: 10, oriVector:new THREE.Vector3(30,0,0)},
    {id:10, name:"f_tal_nrw_body_rigupperarm_l", parent:9, lenParent:9, child: 11, oriVector:new THREE.Vector3(30,0,0)},
    {id:11, name:"f_tal_nrw_body_riglowerarm_l", parent:10, lenParent:10, child: 21, oriVector:new THREE.Vector3(30,0,0)},
    {id:12, name:"f_tal_nrw_body_rigclavicle_r", parent:6, child: 13, oriVector:new THREE.Vector3(30,0,0)},
    {id:13, name:"f_tal_nrw_body_rigupperarm_r", parent:12, lenParent:12, child: 14, oriVector:new THREE.Vector3(30,0,0)},
    {id:14, name:"f_tal_nrw_body_riglowerarm_r", parent:13, lenParent:13, child: 22, oriVector:new THREE.Vector3(30,0,0)},
    {id:15, name:"f_tal_nrw_body_rigthigh_l", parent:1, child: 16, oriVector:new THREE.Vector3(30,0,0)},
    {id:16, name:"f_tal_nrw_body_rigcalf_l", parent:15, lenParent:15, child: 19, oriVector:new THREE.Vector3(30,0,0)},
    {id:17, name:"f_tal_nrw_body_rigthigh_r", parent:1, child: 18, oriVector:new THREE.Vector3(30,0,0)},
    {id:18, name:"f_tal_nrw_body_rigcalf_r", parent:17, child: 20, lenParent:17, oriVector:new THREE.Vector3(30,0,0)},
    {id:19, name:"f_tal_nrw_body_rigfoot_l", parent:16, child: 0, lenParent:16},
    {id:20, name:"f_tal_nrw_body_rigfoot_r", parent:18, child: 0, lenParent:18},
    {id:21, name:"f_tal_nrw_body_righand_l", parent:11, child: 0, lenParent:11},
    {id:22, name:"f_tal_nrw_body_righand_r", parent:14, child: 0, lenParent:14},
    {id:23, name:"f_tal_nrw_body_righead", parent:8, child: 0, lenParent:8}
];

export const MHBoneInfo = MHAllBoneInfo.filter(bone => bone.id>=1 && bone.id<=18);

// Seems to be unused
export const MHPldUpdateOrder = [
    [1],
    [2,15,17],
    [3,16,18],
    [4],
    [5],
    [6],
    [7,9,12],
    [8,10,13],
    [11,14,23],
    [21,22]
];



