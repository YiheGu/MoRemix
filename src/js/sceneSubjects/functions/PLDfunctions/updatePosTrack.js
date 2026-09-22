import * as THREE from 'three';
import { getPspaceBase } from './getPspaceBase';

export function updatePosTrack(pldInfo, update_order){
    // newAngleTrack, projectionLength, coeff, explained, score, update_order
    
    // Update pspaceLoc according to new score angle
    pldInfo.forEach(pld => {
        const newAngleTrack = pld.newPCAAngleAnimTrack;
        const nFrames = newAngleTrack.length;

        const score = pld.PCAResult.score;
        const explained = pld.PCAResult.explained;
        const projectionLength = pld.pcaProjectionLength;
        const coeff = pld.PCAResult.coeff.data;
        const score_loc = score.data;
        const sortedIndices = explained
            .map((v, idx) => [v, idx])
            .sort((a, b) => b[0] - a[0])
            .map(pair => pair[1]);
        const [v1_index, v2_index, v3_index] = sortedIndices;
        
        const newPspaceTrack = [];
        for (let i = 0; i < nFrames; i++) {
            // Compute new PCA2D coordinates
            const L1 = projectionLength[i] * Math.cos(newAngleTrack[i]);
            const L2 = projectionLength[i] * Math.sin(newAngleTrack[i]);
            const L3 = score_loc[i][v3_index];
            
            // Compute new parent space loc
            const base_v1 = coeff.map(row => row[v1_index]);
            const base_v2 = coeff.map(row => row[v2_index]);
            const base_v3 = coeff.map(row => row[v3_index]); 

            const v1 = base_v1.map(val => val*L1);
            const v2 = base_v2.map(val => val*L2);
            const v3 = base_v3.map(val => val*L3);

            const newPspaceLoc = v1.map((val,i) => val + v2[i] + v3[i]);
            newPspaceTrack.push(newPspaceLoc);
        }
        pld.newPspaceAnimTrack = newPspaceTrack;
    })

    // Update local loc according to parent space loc
    update_order.forEach((layer, layerIndex) => {
        const isSpecialLayer = ([1, 2].includes(layerIndex+1)); 

        if (isSpecialLayer){
            for (const id of layer) {
                const pld = pldInfo.find(b => b.id === id);
                // PspaceLoc = LocalLoc for PLDs in layer 2
                pld.newLocalPosTrack = pld.newPspaceAnimTrack;
                // Record new base vector, same as origin
                pld.newBaseVector = pld.baseVector;
            }
        }
        else{
            for (const id of layer) {
                const pld = pldInfo.find(b => b.id === id);
                if (!pld) continue;
                const nFrames = pld.newPspaceAnimTrack.length;
    
                const parentId = pld.parent;
                const parent = pldInfo.find(b => b.id === parentId);
                const newParentPos = parent.localPosTrack.flat();

                // Re-calculate base vector according to new ParentPos
                pld.newBaseVector = getPspaceBase(newParentPos, 'FirstFrame');
                
                // Calculate new local loc according to new pspace base vector
                const newLocalPosTrack = [];
                for (let f = 0; f < nFrames; f++) {
                    const [vx, vy, vz] = pld.newBaseVector[f];
                    const [pcx, pcy, pcz] = pld.newPspaceAnimTrack[f];
                    const local = new THREE.Vector3()
                        .addScaledVector(vx, pcx)
                        .addScaledVector(vy, pcy)
                        .addScaledVector(vz, pcz);

                    newLocalPosTrack.push([local.x, local.y, local.z]);
                }
                pld.newLocalPosTrack = newLocalPosTrack;
            }
        }
    });

    // Update global location according to new parent space loc
    update_order.forEach((layer, layerIndex) => {
        if (layerIndex+1 === 1){
            for (const id of layer) {
                const pld = pldInfo.find(b => b.id === id);
                pld.newGlobalPosTrack = pld.newLocalPosTrack;
            }
        }
        else{
            for (const id of layer) {
                const pld = pldInfo.find(b => b.id === id);
                const nFrames = pld.newPspaceAnimTrack.length;
                const parentId = pld.parent;
                const parent = pldInfo.find(b => b.id === parentId);
                const newParentPos = parent.newGlobalPosTrack;
                const newLocalPos = pld.newLocalPosTrack;

                const newGlobalPosTrack = [];
                for (let f = 0; f < nFrames; f++) {
                    const [px, py, pz] = newParentPos[f];
                    const [lx, ly, lz] = newLocalPos[f];
                    newGlobalPosTrack.push([px + lx, py + ly, pz + lz]);
                }
                pld.newGlobalPosTrack = newGlobalPosTrack;
            }
        }
    });

    // Flatten all newGlobalPosTrack
    pldInfo.forEach(pld => {
        pld.newGlobalPosTrack = pld.newGlobalPosTrack.flat();
    });
}
