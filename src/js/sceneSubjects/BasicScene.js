import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { StaticObjects } from "./StaticObjects";

export class BasicScene {
  constructor(container, sceneManager) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(-5, 15, 30);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    // this.controls.enableDamping = true;
    // this.controls.dampingFactor = 0.05;
    // this.controls.enablePan = true;
    // this.controls.minDistance = 5;
    // this.controls.maxDistance = 120;
    // this.controls.target.set(0, 0, 0);

    this.parentElement = container;
    this.sceneSubjects = []; 
    
    // Add basic static scene subjects
    this.staticObjects = StaticObjects(this.scene) || {};

    if (sceneManager) {
      sceneManager.addExternalUpdate((delta) => this.update(delta));
    }
  }

  update(delta) {
    if (this._disposed) return;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  resize(width, height) {
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  getGroundPlane() {
    if (this.staticObjects?.plane) return this.staticObjects.plane;
    return this.scene.getObjectByName("groundPlane") || null;
  }

  setGroundPlaneVisible(visible) {
    const plane = this.getGroundPlane();
    if (!plane) return;
    plane.visible = !!visible;
  }

  isGroundPlaneVisible() {
    const plane = this.getGroundPlane();
    return plane ? plane.visible !== false : true;
  }

  setBackgroundColor(colorValue) {
    if (!colorValue) return;
    this.scene.background = new THREE.Color(colorValue);
  }

  getBackgroundColorHex() {
    const bg = this.scene.background;
    if (bg && bg.isColor) {
      return `#${bg.getHexString()}`;
    }
    return "#a0a0a0";
  }

  setDirectionalLightAzimuth(degrees) {
    const light = this.staticObjects?.dirLight;
    if (!light) return;

    const angleDeg = Number.isFinite(Number(degrees)) ? Number(degrees) : 0;
    const angleRad = THREE.MathUtils.degToRad(angleDeg);
    const horizontalRadius = Math.hypot(light.position.x, light.position.z) || 1;
    light.position.x = Math.sin(angleRad) * horizontalRadius;
    light.position.z = Math.cos(angleRad) * horizontalRadius;
  }

  getDirectionalLightAzimuth() {
    const light = this.staticObjects?.dirLight;
    if (!light) return 0;
    const angle = THREE.MathUtils.radToDeg(Math.atan2(light.position.x, light.position.z));
    return (angle + 360) % 360;
  }

  dispose() {
    this._disposed = true;
    this.renderer.dispose();
  }
}
