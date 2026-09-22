export function createPlaybackController({
  getTypeSelection,
  getSkeletalMotion,
  getPldMotion,
  onAfterSeek,
} = {}) {
  let playbackUI = null;
  let isPlaybackPaused = false;
  let isPlaybackScrubbing = false;
  let playbackCursor = 0;

  function getPrimaryClipInfo() {
    const typeSelection = getTypeSelection?.();
    const skeletalMotion = getSkeletalMotion?.();
    const pldMotion = getPldMotion?.();

    if (typeSelection === "pld") {
      if (pldMotion?.mixer && pldMotion?.currentClip?.duration > 0) {
        return {
          mixer: pldMotion.mixer,
          clip: pldMotion.currentClip,
          duration: pldMotion.currentClip.duration,
        };
      }
    } else if (skeletalMotion?.mixer && skeletalMotion?.currentClip?.duration > 0) {
      return {
        mixer: skeletalMotion.mixer,
        clip: skeletalMotion.currentClip,
        duration: skeletalMotion.currentClip.duration,
      };
    }

    if (skeletalMotion?.mixer && skeletalMotion?.currentClip?.duration > 0) {
      return {
        mixer: skeletalMotion.mixer,
        clip: skeletalMotion.currentClip,
        duration: skeletalMotion.currentClip.duration,
      };
    }
    if (pldMotion?.mixer && pldMotion?.currentClip?.duration > 0) {
      return {
        mixer: pldMotion.mixer,
        clip: pldMotion.currentClip,
        duration: pldMotion.currentClip.duration,
      };
    }
    return null;
  }

  function getPlayableClipInfos() {
    const infos = [];
    const skeletalMotion = getSkeletalMotion?.();
    const pldMotion = getPldMotion?.();
    if (skeletalMotion?.mixer && skeletalMotion?.currentClip?.duration > 0) {
      infos.push({ mixer: skeletalMotion.mixer, clip: skeletalMotion.currentClip });
    }
    if (pldMotion?.mixer && pldMotion?.currentClip?.duration > 0) {
      infos.push({ mixer: pldMotion.mixer, clip: pldMotion.currentClip });
    }
    return infos;
  }

  function getDuration() {
    const primary = getPrimaryClipInfo();
    return Number(primary?.duration) || 0;
  }

  function applyPausedState(paused) {
    isPlaybackPaused = !!paused;
    const timeScale = isPlaybackPaused ? 0 : 1;

    const skeletalMotion = getSkeletalMotion?.();
    const pldMotion = getPldMotion?.();
    if (skeletalMotion?.mixer) skeletalMotion.mixer.timeScale = timeScale;
    if (pldMotion?.mixer) pldMotion.mixer.timeScale = timeScale;

    if (playbackUI?.playPauseBtn) {
      playbackUI.playPauseBtn.innerText = isPlaybackPaused ? "Play" : "Pause";
    }
  }

  function seekByTime(time, options = {}) {
    const { updateUI = true, wrap = false } = options;
    const duration = getDuration();
    if (!Number.isFinite(duration) || duration <= 0) return;

    const numeric = Number(time) || 0;
    const bounded = wrap
      ? ((numeric % duration) + duration) % duration
      : Math.max(0, Math.min(duration, numeric));
    playbackCursor = bounded;

    const ratio = duration > 0 ? bounded / duration : 0;
    const targets = getPlayableClipInfos();
    targets.forEach(({ mixer, clip }) => {
      const clipDuration = Number(clip.duration) || 0;
      const epsilon = 1e-6;
      const t = clipDuration > 0
        ? Math.max(0, Math.min(clipDuration - epsilon, ratio * clipDuration))
        : 0;
      const oldScale = Number(mixer.timeScale);
      if (oldScale === 0) mixer.timeScale = 1;
      mixer.setTime(t);
      mixer.update(0);
      if (oldScale === 0) mixer.timeScale = 0;
    });

    if (typeof onAfterSeek === "function") {
      onAfterSeek();
    }
    if (updateUI) {
      updateUIState(true);
    }
  }

  function seekByRatio(ratio) {
    const duration = getDuration();
    if (!Number.isFinite(duration) || duration <= 0) return;
    const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
    seekByTime(clamped * duration);
  }

  function getFrameStep() {
    const primary = getPrimaryClipInfo();
    const clip = primary?.clip;
    if (!clip?.tracks) return 1 / 30;

    const candidates = [];
    clip.tracks.forEach((track) => {
      const times = track?.times;
      if (!times || times.length < 2) return;
      for (let i = 1; i < times.length; i++) {
        const dt = times[i] - times[i - 1];
        if (dt > 1e-6) candidates.push(dt);
      }
    });

    if (candidates.length === 0) return 1 / 30;
    return Math.min(...candidates);
  }

  function stepByFrame(direction) {
    const dir = direction >= 0 ? 1 : -1;
    const dt = getFrameStep();
    const duration = getDuration();
    if (!Number.isFinite(duration) || duration <= 0) return;

    applyPausedState(true);
    const t = playbackCursor;
    const target = Math.max(0, Math.min(duration, t + dir * dt));
    seekByTime(target);
  }

  function advance(delta) {
    const duration = getDuration();
    if (!Number.isFinite(duration) || duration <= 0) return;
    const dt = Math.max(0, Number(delta) || 0);
    if (dt <= 0) return;
    seekByTime(playbackCursor + dt, { updateUI: false, wrap: true });
  }

  function getCurrentTime() {
    const duration = getDuration();
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    return Math.max(0, Math.min(duration, Number(playbackCursor) || 0));
  }

  function formatTime(sec) {
    const s = Math.max(0, Number(sec) || 0);
    const minutes = Math.floor(s / 60);
    const seconds = s - minutes * 60;
    const secStr = seconds.toFixed(2).padStart(5, "0");
    return `${String(minutes).padStart(2, "0")}:${secStr}`;
  }

  function getFrameDisplay() {
    const primary = getPrimaryClipInfo();
    const clip = primary?.clip;
    const duration = Number(primary?.duration) || 0;
    if (!clip?.tracks || duration <= 0) {
      return { currentFrame: 0, totalFrames: 0 };
    }

    let totalFrames = 0;
    clip.tracks.forEach((track) => {
      const count = Number(track?.times?.length) || 0;
      if (count > totalFrames) totalFrames = count;
    });

    if (totalFrames <= 0) {
      const step = getFrameStep();
      if (Number.isFinite(step) && step > 1e-6) {
        totalFrames = Math.round(duration / step) + 1;
      }
    }

    totalFrames = Math.max(1, Math.round(totalFrames));
    const current = getCurrentTime();
    const ratio = Math.max(0, Math.min(1, current / duration));
    const currentIndex = totalFrames <= 1
      ? 0
      : Math.floor(ratio * (totalFrames - 1) + 1e-6);

    return {
      currentFrame: currentIndex + 1,
      totalFrames,
    };
  }

  function updateUIState(force = false) {
    if (!playbackUI) return;
    const duration = getDuration();
    if (!Number.isFinite(duration) || duration <= 0) {
      playbackUI.progress.value = "0";
      playbackUI.timeText.innerText = "00:00.00 / 00:00.00";
      playbackUI.frameText.innerText = "0 / 0";
      return;
    }

    const current = getCurrentTime();
    const ratio = Math.max(0, Math.min(1, current / duration));
    if (!isPlaybackScrubbing || force) {
      playbackUI.progress.value = String(Math.round(ratio * 1000));
    }
    playbackUI.timeText.innerText = `${formatTime(current)} / ${formatTime(duration)}`;
    const { currentFrame, totalFrames } = getFrameDisplay();
    playbackUI.frameText.innerText = `${currentFrame} / ${totalFrames}`;
    playbackUI.playPauseBtn.innerText = isPlaybackPaused ? "Play" : "Pause";
  }

  function seekFromProgressPointer(progress, event) {
    if (!progress || !event) return;
    const rect = progress.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const x = Number(event.clientX);
    if (!Number.isFinite(x)) return;
    const ratio = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
    progress.value = String(Math.round(ratio * 1000));
    seekByRatio(ratio);
  }

  function createControls() {
    const root = document.createElement("div");
    root.className = "pane-c-playback";

    const controls = document.createElement("div");
    controls.className = "pane-c-playback-controls";

    const backFrameBtn = document.createElement("button");
    backFrameBtn.type = "button";
    backFrameBtn.innerText = "Frame -";
    backFrameBtn.addEventListener("click", () => stepByFrame(-1));

    const playPauseBtn = document.createElement("button");
    playPauseBtn.type = "button";
    playPauseBtn.innerText = "Pause";
    playPauseBtn.addEventListener("click", () => applyPausedState(!isPlaybackPaused));

    const forwardFrameBtn = document.createElement("button");
    forwardFrameBtn.type = "button";
    forwardFrameBtn.innerText = "Frame +";
    forwardFrameBtn.addEventListener("click", () => stepByFrame(1));

    controls.appendChild(backFrameBtn);
    controls.appendChild(playPauseBtn);
    controls.appendChild(forwardFrameBtn);

    const progressRow = document.createElement("div");
    progressRow.className = "pane-c-progress-row";

    const progress = document.createElement("input");
    progress.type = "range";
    progress.min = "0";
    progress.max = "1000";
    progress.step = "1";
    progress.value = "0";

    progress.addEventListener("pointerdown", (event) => {
      isPlaybackScrubbing = true;
      seekFromProgressPointer(progress, event);
    });
    progress.addEventListener("input", () => {
      const ratio = Number(progress.value) / 1000;
      seekByRatio(ratio);
    });
    progress.addEventListener("change", () => {
      isPlaybackScrubbing = false;
      updateUIState(true);
    });
    progress.addEventListener("pointerup", () => {
      isPlaybackScrubbing = false;
    });
    progress.addEventListener("click", (event) => {
      seekFromProgressPointer(progress, event);
      updateUIState(true);
    });

    const timeText = document.createElement("div");
    timeText.className = "pane-c-progress-time";
    timeText.innerText = "00:00.00 / 00:00.00";

    const frameText = document.createElement("div");
    frameText.className = "pane-c-progress-frame";
    frameText.innerText = "0 / 0";

    const progressMeta = document.createElement("div");
    progressMeta.className = "pane-c-progress-meta";
    progressMeta.appendChild(frameText);
    progressMeta.appendChild(timeText);

    progressRow.appendChild(progress);
    progressRow.appendChild(progressMeta);

    root.appendChild(controls);
    root.appendChild(progressRow);

    playbackUI = { root, playPauseBtn, progress, timeText, frameText };
    return playbackUI;
  }

  return {
    createControls,
    applyPausedState,
    seekByTime,
    seekByRatio,
    stepByFrame,
    advance,
    updateUI: updateUIState,
    getDuration,
    getCurrentTime,
    isPaused: () => isPlaybackPaused,
    isScrubbing: () => isPlaybackScrubbing,
  };
}
