import * as THREE from 'three';
import { ControlFlow } from "./ControlFlow.js";

export class SceneManager {
    constructor() {
        this.clock = new THREE.Clock();
        this.externalUpdaters = new Set();

        // Start the flow
        this.controlFlow = new ControlFlow(this);

        this.startLoop();
    }

    startLoop() {
        const loop = () => {
            const delta = Math.min(this.clock.getDelta(), 0.1);

            // Update each registered external updaters with same delta
            this.externalUpdaters.forEach(fn => {
                try { fn(delta); }
                catch (err) { console.error("External updater failed:", err); }
            });

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    // Register
    addExternalUpdate(fnUpdate) {
        if (typeof fnUpdate !== "function") return () => {};
        this.externalUpdaters.add(fnUpdate);
        return () => this.externalUpdaters.delete(fnUpdate);
    }
}

