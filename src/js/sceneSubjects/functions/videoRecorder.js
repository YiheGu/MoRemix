import JSZip from "jszip";

export function createCanvasRecorder({ canvas, fps = 30 }) {
  const safeFps = Math.max(1, Math.min(120, Math.round(Number(fps) || 30)));
  let stream = canvas.captureStream(0);
  let videoTrack = stream.getVideoTracks()[0] || null;
  let supportsManualFrameRequest = !!videoTrack && typeof videoTrack.requestFrame === "function";

  if (!supportsManualFrameRequest) {
    stream.getTracks().forEach((t) => t.stop());
    stream = canvas.captureStream(safeFps);
    videoTrack = stream.getVideoTracks()[0] || null;
    supportsManualFrameRequest = false;
  }

  const mimeCandidates = [
    "video/webm;codecs=vp8",
    "video/webm;codecs=vp9",
    "video/webm",
  ];
  const chosenMime = mimeCandidates.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch (_err) {
      return false;
    }
  });
  const recorderOptions = {
    videoBitsPerSecond: 2500000,
  };
  if (chosenMime) {
    recorderOptions.mimeType = chosenMime;
  }
  const recorder = new MediaRecorder(stream, recorderOptions);

  const chunks = [];

  recorder.ondataavailable = e => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return {
    start() {
      const timeslice = Math.max(50, Math.round(1000 / safeFps));
      recorder.start(timeslice);
    },
    requestFrame() {
      if (supportsManualFrameRequest && videoTrack) {
        videoTrack.requestFrame();
      }
    },
    stop() {
      return new Promise(resolve => {
        if (recorder.state === "inactive") {
          resolve();
          return;
        }
        recorder.onstop = resolve;
        try {
          recorder.requestData();
        } catch (_err) {
          // Ignore requestData errors and proceed to stop.
        }
        recorder.stop();
      });
    },
    getBlob() {
      return new Blob(chunks, { type: "video/webm" });
    },
    dispose() {
      stream.getTracks().forEach(t => t.stop());
    }
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function nextAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function collectSceneTextures(scene) {
  const textures = new Set();
  const textureKeys = [
    "map",
    "alphaMap",
    "aoMap",
    "bumpMap",
    "displacementMap",
    "emissiveMap",
    "envMap",
    "lightMap",
    "metalnessMap",
    "normalMap",
    "roughnessMap",
    "specularMap",
  ];

  scene?.traverse?.((object) => {
    if (!object?.isMesh || !object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (!material) return;
      material.needsUpdate = true;
      textureKeys.forEach((key) => {
        const texture = material[key];
        if (texture?.isTexture) textures.add(texture);
      });
    });
  });

  return Array.from(textures);
}

async function waitForImageReady(image) {
  if (!image) return;
  const isReady = image.complete === true || image.readyState >= 2;
  if (isReady) {
    if (typeof image.decode === "function") {
      try {
        await image.decode();
      } catch (_err) {
        // Some browser-created image objects reject decode even when usable.
      }
    }
    return;
  }

  await Promise.race([
    new Promise((resolve) => {
      const done = () => resolve();
      image.addEventListener?.("load", done, { once: true });
      image.addEventListener?.("error", done, { once: true });
    }),
    wait(1500),
  ]);
}

async function prepareSceneForRecording({ renderer, scene, camera, playAnimation, warmupFrames, frameIntervalMs }) {
  const textures = collectSceneTextures(scene);
  await Promise.all(textures.map((texture) => waitForImageReady(texture.image)));
  textures.forEach((texture) => {
    texture.needsUpdate = true;
  });

  if (typeof renderer.compile === "function") {
    try {
      renderer.compile(scene, camera);
    } catch (_err) {
      // Compile is an optimization hint; recording can proceed if it fails.
    }
  }

  const safeWarmupFrames = Math.max(0, Math.min(60, Math.round(Number(warmupFrames) || 0)));
  for (let warmup = 0; warmup < safeWarmupFrames; warmup++) {
    playAnimation(0);
    renderer.render(scene, camera);
    await nextAnimationFrame();
    if (frameIntervalMs > 16) await wait(Math.min(frameIntervalMs - 16, 16));
  }
}

export async function recordAnimationMultipleAngles({
  sceneContexts,
  angles,
  playAnimation,
  beforeEachAngle,
  duration = 10,
  fps = 30,
  resolution = "1080p",
  warmupFrames = 12,
  onProgress
}) {

  const resolutionMap = {
    "1080p": { width: 1920, height: 1080 },
    "720p": { width: 1280, height: 720 },
    "480p": { width: 854, height: 480 }
  };

  const resSize = resolutionMap[resolution];
  const videos = new Map();
  const frameIntervalMs = 1000 / fps;

  const totalAngles = angles.length;
  for (let angleIndex = 0; angleIndex < angles.length; angleIndex++) {
    const angle = angles[angleIndex];

    const context = sceneContexts[angle.camera];
    if (!context) {
      continue;
    }
    const { canvas, renderer, scene, camera } = context;

    if (typeof beforeEachAngle === "function") {
      beforeEachAngle(angle, context);
    }

    const originalWidth = canvas.width;
    const originalHeight = canvas.height;

    canvas.width = resSize.width;
    canvas.height = resSize.height;
    renderer.setSize(resSize.width, resSize.height);
    camera.aspect = resSize.width / resSize.height;
    camera.updateProjectionMatrix();

    await prepareSceneForRecording({ renderer, scene, camera, playAnimation, warmupFrames, frameIntervalMs });

    const recorder = createCanvasRecorder({ canvas, fps });
    recorder.start();

    const totalFrames = Math.max(2, Math.ceil(duration * fps) + 1);
    for (let frame = 0; frame < totalFrames; frame++) {
      const progress = totalFrames > 1 ? frame / (totalFrames - 1) : 0;
      const time = progress * duration;
      playAnimation(time);
      renderer.render(scene, camera);
      recorder.requestFrame();

      const percent = Math.min(100, Math.floor(progress * 100));
      if (onProgress) {
        onProgress(percent, angle.name, angleIndex, totalAngles);
      }

      if (frame < totalFrames - 1) {
        await wait(frameIntervalMs);
      }
    }

    // Give the recorder one extra frame interval to flush the tail frame.
    await wait(frameIntervalMs);
    if (onProgress) {
      onProgress(100, angle.name, angleIndex, totalAngles);
    }

    await recorder.stop();

    videos.set(angle.name, {
      blob: recorder.getBlob(),
      resolution
    });

    recorder.dispose();

    canvas.width = originalWidth;
    canvas.height = originalHeight;
    renderer.setSize(originalWidth, originalHeight);
    camera.aspect = originalWidth / originalHeight;
    camera.updateProjectionMatrix();
  }

  return { videos };
}

export async function downloadVideosAsZip(videosMap, zipName = "videos.zip") {
  const zip = new JSZip();
  const folder = zip.folder("videos");

  let index = 1;
  for (const [name, data] of videosMap) {
    folder.file(`${index}_${name}.webm`, data.blob);
    index++;
  }

  const blob = await zip.generateAsync({ type: "blob" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
