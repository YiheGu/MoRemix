export function createClipRepeatController({
  getTypeSelection,
  getSkeletalMotion,
  getPldMotion,
  getMotionGUI,
  playback,
} = {}) {
  let clipRepeatInput = null;
  let clipRepeatConfirmBtn = null;

  function getCurrentValue() {
    const typeSelection = getTypeSelection?.();
    const skeletalMotion = getSkeletalMotion?.();
    const pldMotion = getPldMotion?.();
    const motionSource = typeSelection === "pld" ? pldMotion : skeletalMotion;
    const value = Number(motionSource?.clipRepeat);
    if (!Number.isFinite(value) || value < 1) return 1;
    return Math.round(value);
  }

  function isEnabled() {
    const typeSelection = getTypeSelection?.();
    const skeletalMotion = getSkeletalMotion?.();
    const pldMotion = getPldMotion?.();
    return (
      (typeSelection === "skeleton" && !!skeletalMotion?.sourceClip) ||
      (typeSelection === "pld" && !!pldMotion?.sourceClip)
    );
  }

  function syncState() {
    if (!clipRepeatInput) return;
    const enabled = isEnabled();
    clipRepeatInput.value = String(getCurrentValue());
    clipRepeatInput.disabled = !enabled;
    if (clipRepeatConfirmBtn) {
      clipRepeatConfirmBtn.disabled = !enabled;
    }
  }

  function applyFromControl() {
    const typeSelection = getTypeSelection?.();
    const skeletalMotion = getSkeletalMotion?.();
    const pldMotion = getPldMotion?.();
    const motionGUI = getMotionGUI?.();

    const isSkeletonMode = typeSelection === "skeleton";
    const isPldMode = typeSelection === "pld";
    if (!isSkeletonMode && !isPldMode) return;

    const parsed = Number(clipRepeatInput?.value);
    if (!Number.isFinite(parsed)) {
      if (clipRepeatInput) {
        clipRepeatInput.value = String(getCurrentValue());
      }
      return;
    }

    const repeatCount = Math.max(1, Math.round(parsed));
    let ok = false;
    if (isSkeletonMode && skeletalMotion) {
      ok = skeletalMotion.setClipRepeat(repeatCount, false);
    } else if (isPldMode && pldMotion?.setClipRepeat) {
      ok = pldMotion.setClipRepeat(repeatCount, false);
    }
    if (!ok) {
      if (clipRepeatInput) {
        clipRepeatInput.value = String(getCurrentValue());
      }
      return;
    }

    if (isSkeletonMode) {
      motionGUI?.resetAllBoneParamsToDefault?.();
      if (pldMotion?.setClipWithSource) {
        pldMotion.setClipWithSource(skeletalMotion, false);
      }
    } else if (isPldMode) {
      motionGUI?.resetAllPldParamsToDefault?.();
    }

    playback?.applyPausedState?.(false);
    playback?.seekByTime?.(0, { updateUI: false, wrap: false });
    playback?.updateUI?.(true);
    syncState();
  }

  function createControls() {
    const clipRepeatWrap = document.createElement("div");
    clipRepeatWrap.style.display = "flex";
    clipRepeatWrap.style.alignItems = "center";
    clipRepeatWrap.style.gap = "6px";

    const clipRepeatLabel = document.createElement("span");
    clipRepeatLabel.innerText = "clipRepeat";
    clipRepeatLabel.style.fontSize = "12px";
    clipRepeatLabel.style.color = "#bcc5df";

    clipRepeatInput = document.createElement("input");
    clipRepeatInput.type = "number";
    clipRepeatInput.min = "1";
    clipRepeatInput.step = "1";
    clipRepeatInput.value = String(getCurrentValue());
    clipRepeatInput.style.width = "68px";
    clipRepeatInput.style.border = "1px solid rgba(255,255,255,0.2)";
    clipRepeatInput.style.background = "rgba(255,255,255,0.06)";
    clipRepeatInput.style.color = "#f5f6ff";
    clipRepeatInput.style.borderRadius = "6px";
    clipRepeatInput.style.padding = "6px 8px";
    clipRepeatInput.style.fontSize = "12px";

    clipRepeatConfirmBtn = document.createElement("button");
    clipRepeatConfirmBtn.type = "button";
    clipRepeatConfirmBtn.innerText = "Confirm and Initialize the Clip";
    clipRepeatConfirmBtn.addEventListener("click", () => {
      applyFromControl();
    });

    clipRepeatInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      applyFromControl();
    });

    clipRepeatWrap.appendChild(clipRepeatLabel);
    clipRepeatWrap.appendChild(clipRepeatInput);
    clipRepeatWrap.appendChild(clipRepeatConfirmBtn);
    syncState();
    return clipRepeatWrap;
  }

  return {
    createControls,
    syncState,
    applyFromControl,
  };
}
