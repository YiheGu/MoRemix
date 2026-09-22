import { recordAnimationMultipleAngles, downloadVideosAsZip } from "../sceneSubjects/functions/videoRecorder";
import { applyCameraAngle } from "./cameraAngleUtils";

export function createExportController({
  sceneManager,
  playback,
  getSceneContexts,
  getSkeletalMotion,
  getPldMotion,
  onAfterFrameUpdate,
} = {}) {
  let isRecording = false;

  async function recordAndDownloadVideos(settings) {
    if (!settings) {
      throw new Error("Missing video settings");
    }
    const { fps, resolution, onProgress } = settings;
    const angles = buildRecordAngles(settings);
    if (angles.length === 0) {
      throw new Error("No valid camera angles selected");
    }

    const sceneContexts = getSceneContexts?.() || {};
    const selectedContexts = {};
    for (const angle of angles) {
      if (sceneContexts[angle.camera]) {
        selectedContexts[angle.camera] = sceneContexts[angle.camera];
      }
    }
    if (Object.keys(selectedContexts).length === 0) {
      throw new Error("No valid camera contexts found");
    }

    const animationDuration = getAnimationDuration();
    const previousPaused = !!playback?.isPaused?.();
    const previousPlaybackTime = Number(playback?.getCurrentTime?.()) || 0;
    playback?.applyPausedState?.(true);
    playback?.seekByTime?.(0, { updateUI: true, wrap: false });
    isRecording = true;

    const cleanupIsolation = isolateRecordingEnvironment(selectedContexts);
    let result;
    try {
      result = await recordAnimationMultipleAngles({
        sceneContexts: selectedContexts,
        angles,
        playAnimation: (currentTime) => playAnimationAtTime(currentTime, animationDuration),
        beforeEachAngle: (angle, context) => applyCameraOrientation(context, angle),
        duration: animationDuration,
        fps,
        resolution,
        onProgress: (anglePercent, angleName, angleIndex, angleTotal) => {
          const total = angleTotal || angles.length || 1;
          const index = angleIndex || 0;
          const overall = ((index + (anglePercent / 100)) / total) * 100;
          if (typeof onProgress === "function") {
            onProgress(overall, angleName);
          }
        },
      });
    } finally {
      cleanupIsolation();
      isRecording = false;
      playback?.seekByTime?.(previousPlaybackTime, { updateUI: true, wrap: false });
      playback?.applyPausedState?.(previousPaused);
    }

    if (!result || result.videos.size === 0) {
      throw new Error("Recording failed: no videos generated");
    }

    if (result.videos.size === 1) {
      const [name, videoData] = result.videos.entries().next().value;
      const url = URL.createObjectURL(videoData.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recording_${name}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    await downloadVideosAsZip(result.videos, "pldvideos.zip");
  }

  function getAnimationDuration() {
    const playbackDuration = Number(playback?.getDuration?.());
    if (Number.isFinite(playbackDuration) && playbackDuration > 0) {
      return playbackDuration;
    }

    const durations = [];
    const skeletalMotion = getSkeletalMotion?.();
    const pldMotion = getPldMotion?.();
    if (skeletalMotion?.currentClip?.duration) {
      durations.push(skeletalMotion.currentClip.duration);
    }
    if (pldMotion?.currentClip?.duration) {
      durations.push(pldMotion.currentClip.duration);
    }
    if (durations.length === 0) {
      return 10;
    }
    return Math.max(...durations);
  }

  function playAnimationAtTime(currentTime, duration) {
    const safeDuration = duration > 0 ? duration : 10;
    const epsilon = 1e-6;
    const clamped = Math.max(0, Math.min(safeDuration - epsilon, Number(currentTime) || 0));
    const ratio = safeDuration > 0 ? clamped / safeDuration : 0;

    const skeletalMotion = getSkeletalMotion?.();
    const pldMotion = getPldMotion?.();

    if (skeletalMotion?.mixer && skeletalMotion?.currentClip) {
      const clipDuration = Number(skeletalMotion.currentClip.duration) || 0;
      const t = clipDuration > 0
        ? Math.max(0, Math.min(clipDuration - epsilon, ratio * clipDuration))
        : 0;
      const oldScale = Number(skeletalMotion.mixer.timeScale);
      if (oldScale === 0) skeletalMotion.mixer.timeScale = 1;
      skeletalMotion.mixer.setTime(t);
      skeletalMotion.mixer.update(0);
      if (oldScale === 0) skeletalMotion.mixer.timeScale = 0;
    }
    if (pldMotion?.mixer && pldMotion?.currentClip) {
      const clipDuration = Number(pldMotion.currentClip.duration) || 0;
      const t = clipDuration > 0
        ? Math.max(0, Math.min(clipDuration - epsilon, ratio * clipDuration))
        : 0;
      const oldScale = Number(pldMotion.mixer.timeScale);
      if (oldScale === 0) pldMotion.mixer.timeScale = 1;
      pldMotion.mixer.setTime(t);
      pldMotion.mixer.update(0);
      if (oldScale === 0) pldMotion.mixer.timeScale = 0;
    }
    if (typeof pldMotion?.updateStickFigureGeometry === "function") {
      pldMotion.updateStickFigureGeometry();
    }
    if (typeof onAfterFrameUpdate === "function") {
      onAfterFrameUpdate();
    }
  }

  function buildRecordAngles(settings) {
    const panes = getTargetPaneIds(settings.targetPane);
    const selectedAngles = Array.isArray(settings.angles) ? settings.angles : [];
    const tasks = [];
    for (const paneId of panes) {
      for (const angle of selectedAngles) {
        const yaw = Number(angle.yaw) || 0;
        const pitch = Number(angle.pitch) || 0;
        const distance = Math.max(0.001, Number(angle.distance) || 30);
        const moveX = Number(angle.moveX) || 0;
        const moveY = Number(angle.moveY) || 0;
        tasks.push({
          name: `${paneId}_y${yaw}_p${pitch}_d${distance}_mx${moveX}_my${moveY}`,
          camera: paneId,
          yaw,
          pitch,
          distance,
          moveX,
          moveY,
        });
      }
    }
    return tasks;
  }

  function getTargetPaneIds(targetPane) {
    if (targetPane === "both") return ["paneA", "paneB"];
    if (targetPane === "paneB") return ["paneB"];
    return ["paneA"];
  }

  function previewCameraAngle({ targetPane, angle }) {
    const paneIds = getTargetPaneIds(targetPane);
    const sceneContexts = getSceneContexts?.() || {};
    for (const paneId of paneIds) {
      const context = sceneContexts[paneId];
      if (!context) continue;
      applyCameraOrientation(context, angle);
      context.renderer.render(context.scene, context.camera);
    }
  }

  function applyCameraOrientation(context, angle) {
    applyCameraAngle(context, angle);
  }

  function isolateRecordingEnvironment(contextMap) {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "10080";
    overlay.style.background = "rgba(0,0,0,0.01)";
    overlay.style.cursor = "wait";
    overlay.style.pointerEvents = "all";
    document.body.appendChild(overlay);

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const previousControlsEnabled = [];
    for (const context of Object.values(contextMap)) {
      if (context?.controls) {
        previousControlsEnabled.push([context.controls, context.controls.enabled]);
        context.controls.enabled = false;
      }
    }

    const canPauseGlobalUpdaters =
      !!sceneManager
      && sceneManager.externalUpdaters instanceof Set;
    const previousUpdaters = canPauseGlobalUpdaters
      ? Array.from(sceneManager.externalUpdaters)
      : null;
    if (canPauseGlobalUpdaters) {
      sceneManager.externalUpdaters.clear();
    }

    return () => {
      if (canPauseGlobalUpdaters) {
        sceneManager.externalUpdaters.clear();
        previousUpdaters.forEach((fn) => {
          if (typeof fn === "function") {
            sceneManager.externalUpdaters.add(fn);
          }
        });
      }
      for (const [controls, enabled] of previousControlsEnabled) {
        controls.enabled = enabled;
      }
      document.body.style.overflow = previousBodyOverflow;
      if (overlay.parentElement) {
        overlay.parentElement.removeChild(overlay);
      }
    };
  }

  return {
    isRecording: () => isRecording,
    previewCameraAngle,
    recordAndDownloadVideos,
  };
}
