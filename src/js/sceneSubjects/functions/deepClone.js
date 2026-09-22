import * as THREE from 'three';

export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj; 
    }

    // Array
    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item));
    }

    // Date
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }

    // THREE.js special obj
    if (obj instanceof THREE.Vector3 ||
        obj instanceof THREE.Euler ||
        obj instanceof THREE.Color ||
        obj instanceof THREE.Quaternion ||
        obj instanceof THREE.Matrix4) {
        return obj.clone(); 
    }

    // Mix obj
    const clonedObj = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            clonedObj[key] = deepClone(obj[key]);
        }
    }

    return clonedObj;
}
