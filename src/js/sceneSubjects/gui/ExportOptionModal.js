export function createExportOptionModal({
  onConfirm,
  onClose,
  onVideoAnglePreview,
  mountTo,
} = {}) {
  const VIDEO_OPTION_ID = "pldVideo";

  const host = mountTo || document.body;
  const inPane = !!mountTo;
  const overlay = document.createElement("div");
  overlay.style.position = inPane ? "absolute" : "fixed";
  overlay.style.inset = "0";
  overlay.style.background = inPane ? "rgba(4, 6, 12, 0.55)" : "rgba(4, 6, 12, 0.7)";
  overlay.style.display = "none";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = inPane ? "50" : "10020";

  const dialog = document.createElement("div");
  dialog.style.background = "#0f1321";
  dialog.style.borderRadius = "18px";
  dialog.style.padding = "28px";
  dialog.style.width = inPane ? "min(760px, 96%)" : "1100px";
  dialog.style.boxShadow = "0 20px 60px rgba(0,0,0,0.6)";
  dialog.style.display = "flex";
  dialog.style.flexDirection = "column";
  dialog.style.gap = "20px";
  dialog.style.position = "relative";
  dialog.style.color = "#f5f6ff";
  dialog.style.maxHeight = "90vh";
  dialog.style.overflowY = "auto";

  const closeBtn = document.createElement("button");
  closeBtn.innerText = "X";
  closeBtn.style.position = "absolute";
  closeBtn.style.top = "14px";
  closeBtn.style.right = "14px";
  closeBtn.style.background = "transparent";
  closeBtn.style.border = "none";
  closeBtn.style.color = "#9aa4c3";
  closeBtn.style.fontSize = "16px";
  closeBtn.style.cursor = "pointer";
  closeBtn.addEventListener("click", handleClose);

  const title = document.createElement("h3");
  title.innerText = "Export Option";
  title.style.margin = "0";
  title.style.fontSize = "20px";
  title.style.fontWeight = "600";

  const optionsContainer = document.createElement("div");
  optionsContainer.style.display = "flex";
  optionsContainer.style.gap = "16px";
  optionsContainer.style.justifyContent = "space-between";

  const options = [
    { id: "animation", label: "Animation File\n(.glb)" },
    { id: "pldCsv", label: "PLD File\n(.csv)" },
    { id: VIDEO_OPTION_ID, label: "Video\n(.webm)" },
  ];

  const optionCards = {};
  let selectedOptionId = null;
  let isBusy = false;

  function createOptionCard(option) {
    const card = document.createElement("button");
    card.type = "button";
    card.style.background = "rgba(255,255,255,0.04)";
    card.style.border = "2px solid rgba(255,255,255,0.15)";
    card.style.borderRadius = "14px";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "12px";
    card.style.padding = "16px";
    card.style.cursor = "pointer";
    card.style.transition = "border 0.15s ease, box-shadow 0.15s ease";
    card.style.flex = "1";

    const label = document.createElement("div");
    label.innerText = option.label;
    label.style.fontSize = "15px";
    label.style.fontWeight = "500";
    label.style.color = "#ffffff";
    label.style.textAlign = "center";

    card.appendChild(label);

    card.addEventListener("click", () => setSelectedOption(option.id));
    optionCards[option.id] = { card, setSelected };

    function setSelected(state) {
      card.style.border = state
        ? "2px solid #6f95ff"
        : "2px solid rgba(255,255,255,0.15)";
      card.style.boxShadow = state ? "0 0 18px rgba(111, 149, 255, 0.4)" : "none";
      if (state) {
        feedback.innerText = "";
      }
    }

    return card;
  }

  for (const option of options) {
    optionsContainer.appendChild(createOptionCard(option));
  }

  function setSelectedOption(optionId) {
    if (selectedOptionId && optionCards[selectedOptionId]) {
      optionCards[selectedOptionId].setSelected(false);
    }
    selectedOptionId = optionId;
    if (optionCards[optionId]) {
      optionCards[optionId].setSelected(true);
    }
    toggleVideoSettings(optionId === VIDEO_OPTION_ID);
  }

  const videoSettingsContainer = document.createElement("div");
  videoSettingsContainer.style.display = "none";
  videoSettingsContainer.style.border = "1px solid rgba(255,255,255,0.12)";
  videoSettingsContainer.style.borderRadius = "12px";
  videoSettingsContainer.style.padding = "16px";
  videoSettingsContainer.style.background = "rgba(255,255,255,0.03)";
  videoSettingsContainer.style.gap = "14px";
  videoSettingsContainer.style.flexDirection = "column";

  const videoSettingsTitle = document.createElement("div");
  videoSettingsTitle.innerText = "Video Export Settings";
  videoSettingsTitle.style.fontSize = "14px";
  videoSettingsTitle.style.fontWeight = "600";
  videoSettingsTitle.style.color = "#9aa4c3";

  const targetLabel = document.createElement("div");
  targetLabel.innerText = "Record Target:";
  targetLabel.style.fontSize = "13px";
  targetLabel.style.color = "#9aa4c3";

  const targetContainer = document.createElement("div");
  targetContainer.style.display = "flex";
  targetContainer.style.gap = "14px";
  targetContainer.style.flexWrap = "wrap";

  const targetOptions = [
    { id: "paneA", label: "Pane A" },
    { id: "paneB", label: "Pane B" },
    { id: "both", label: "Pane A + Pane B" },
  ];

  const targetRadios = {};
  let selectedTarget = "paneA";

  for (const target of targetOptions) {
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "6px";
    label.style.fontSize = "13px";
    label.style.cursor = "pointer";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "recordTarget";
    radio.value = target.id;
    radio.checked = target.id === "paneA";

    radio.addEventListener("change", () => {
      if (radio.checked) {
        selectedTarget = target.id;
        emitPreviewForFirstSelectedAngle();
      }
    });

    const text = document.createElement("span");
    text.innerText = target.label;
    text.style.color = "#f5f6ff";

    label.appendChild(radio);
    label.appendChild(text);
    targetContainer.appendChild(label);
    targetRadios[target.id] = radio;
  }

  const angleLabel = document.createElement("div");
  angleLabel.innerText = "Camera Angles (yaw/pitch + distance + moveX/moveY, one video per selected angle):";
  angleLabel.style.fontSize = "13px";
  angleLabel.style.color = "#9aa4c3";

  const customAngleEditor = document.createElement("div");
  customAngleEditor.style.display = "grid";
  customAngleEditor.style.gridTemplateColumns = "1fr 1fr";
  customAngleEditor.style.gap = "10px";
  customAngleEditor.style.alignItems = "center";

  function createRangeControl({ label, min, max, step, value }) {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "4px";

    const topRow = document.createElement("div");
    topRow.style.display = "flex";
    topRow.style.justifyContent = "space-between";
    topRow.style.alignItems = "center";

    const labelEl = document.createElement("span");
    labelEl.innerText = label;
    labelEl.style.fontSize = "12px";
    labelEl.style.color = "#bcc5df";

    const valueEl = document.createElement("span");
    valueEl.style.fontSize = "12px";
    valueEl.style.color = "#f5f6ff";
    valueEl.innerText = value;

    topRow.appendChild(labelEl);
    topRow.appendChild(valueEl);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener("input", () => {
      valueEl.innerText = input.value;
    });

    wrap.appendChild(topRow);
    wrap.appendChild(input);
    return { wrap, input };
  }

  const yawControl = createRangeControl({
    label: "Yaw (deg)",
    min: -180,
    max: 180,
    step: 0.001,
    value: 0,
  });
  const pitchControl = createRangeControl({
    label: "Pitch (deg)",
    min: -89.999,
    max: 89.999,
    step: 0.001,
    value: 15,
  });
  const distanceControl = createRangeControl({
    label: "Distance",
    min: 1,
    max: 120,
    step: 0.01,
    value: 30,
  });
  const moveXControl = createRangeControl({
    label: "Move Left/Right",
    min: -30,
    max: 30,
    step: 0.01,
    value: 0,
  });
  const moveYControl = createRangeControl({
    label: "Move Up/Down",
    min: -30,
    max: 30,
    step: 0.01,
    value: 0,
  });
  const yawInput = yawControl.input;
  const pitchInput = pitchControl.input;
  const distanceInput = distanceControl.input;
  const moveXInput = moveXControl.input;
  const moveYInput = moveYControl.input;

  const addAngleBtn = document.createElement("button");
  addAngleBtn.type = "button";
  addAngleBtn.innerText = "Add Angle";
  addAngleBtn.style.padding = "7px 12px";
  addAngleBtn.style.borderRadius = "8px";
  addAngleBtn.style.border = "1px solid rgba(255,255,255,0.2)";
  addAngleBtn.style.background = "rgba(255,255,255,0.08)";
  addAngleBtn.style.color = "#fff";
  addAngleBtn.style.cursor = "pointer";

  customAngleEditor.appendChild(yawControl.wrap);
  customAngleEditor.appendChild(pitchControl.wrap);
  customAngleEditor.appendChild(distanceControl.wrap);
  customAngleEditor.appendChild(moveXControl.wrap);
  customAngleEditor.appendChild(moveYControl.wrap);
  addAngleBtn.style.gridColumn = "1 / -1";
  customAngleEditor.appendChild(addAngleBtn);

  const angleValueRow = document.createElement("div");
  angleValueRow.style.fontSize = "12px";
  angleValueRow.style.color = "#9aa4c3";

  function getEditorAngleConfig() {
    return {
      yaw: Number(yawInput.value) || 0,
      pitch: Number(pitchInput.value) || 0,
      distance: Math.max(0.001, Number(distanceInput.value) || 30),
      moveX: Number(moveXInput.value) || 0,
      moveY: Number(moveYInput.value) || 0,
    };
  }

  function updateAngleValueText() {
    const angle = getEditorAngleConfig();
    angleValueRow.innerText = `Current editor view: yaw ${angle.yaw} deg, pitch ${angle.pitch} deg, distance ${angle.distance}, moveX ${angle.moveX}, moveY ${angle.moveY}`;
  }
  updateAngleValueText();

  const angleListContainer = document.createElement("div");
  angleListContainer.style.display = "flex";
  angleListContainer.style.flexDirection = "column";
  angleListContainer.style.gap = "8px";

  let angleCounter = 1;
  const angleItems = [];

  function angleLabelText(angle) {
    return `Angle ${angle.seq}: yaw ${angle.yaw} deg, pitch ${angle.pitch} deg, distance ${angle.distance}, moveX ${angle.moveX}, moveY ${angle.moveY}`;
  }

  function createAngleRow(angle) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "10px";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;

    const text = document.createElement("button");
    text.type = "button";
    text.innerText = angleLabelText(angle);
    text.style.flex = "1";
    text.style.textAlign = "left";
    text.style.background = "transparent";
    text.style.border = "1px solid rgba(255,255,255,0.15)";
    text.style.borderRadius = "8px";
    text.style.padding = "6px 10px";
    text.style.color = "#f5f6ff";
    text.style.cursor = "pointer";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.innerText = "Remove";
    removeBtn.style.padding = "6px 10px";
    removeBtn.style.borderRadius = "8px";
    removeBtn.style.border = "1px solid rgba(255,255,255,0.2)";
    removeBtn.style.background = "rgba(255,255,255,0.08)";
    removeBtn.style.color = "#fff";
    removeBtn.style.cursor = "pointer";

    checkbox.addEventListener("change", () => {
      angle.enabled = checkbox.checked;
      if (checkbox.checked) {
        emitAnglePreview(angle);
      }
    });
    text.addEventListener("click", () => emitAnglePreview(angle));
    removeBtn.addEventListener("click", () => {
      const idx = angleItems.findIndex((a) => a.id === angle.id);
      if (idx >= 0) {
        angleItems.splice(idx, 1);
      }
      if (row.parentElement) {
        row.parentElement.removeChild(row);
      }
      emitPreviewForFirstSelectedAngle();
    });

    row.appendChild(checkbox);
    row.appendChild(text);
    row.appendChild(removeBtn);
    angleListContainer.appendChild(row);
  }

  function addAngle(config) {
    const normalized = {
      yaw: Number(config?.yaw) || 0,
      pitch: Number(config?.pitch) || 0,
      distance: Math.max(0.001, Number(config?.distance) || 30),
      moveX: Number(config?.moveX) || 0,
      moveY: Number(config?.moveY) || 0,
    };
    const angle = {
      id: `custom_${angleCounter}`,
      seq: angleCounter,
      ...normalized,
      enabled: true,
    };
    angleCounter += 1;
    angleItems.push(angle);
    createAngleRow(angle);
    emitAnglePreview(angle);
  }

  addAngleBtn.addEventListener("click", () => {
    addAngle(getEditorAngleConfig());
  });

  function handleEditorInput() {
    updateAngleValueText();
    emitAnglePreview(getEditorAngleConfig());
  }

  yawInput.addEventListener("input", handleEditorInput);
  pitchInput.addEventListener("input", handleEditorInput);
  distanceInput.addEventListener("input", handleEditorInput);
  moveXInput.addEventListener("input", handleEditorInput);
  moveYInput.addEventListener("input", handleEditorInput);

  const videoFormatLabel = document.createElement("div");
  videoFormatLabel.innerText = "Video Quality:";
  videoFormatLabel.style.fontSize = "13px";
  videoFormatLabel.style.color = "#9aa4c3";

  const videoFormatContainer = document.createElement("div");
  videoFormatContainer.style.display = "grid";
  videoFormatContainer.style.gridTemplateColumns = "1fr 1fr";
  videoFormatContainer.style.gap = "10px";

  const fpsInput = document.createElement("input");
  fpsInput.type = "number";
  fpsInput.min = "1";
  fpsInput.max = "120";
  fpsInput.value = "30";
  fpsInput.style.padding = "8px 10px";
  fpsInput.style.borderRadius = "8px";
  fpsInput.style.border = "1px solid rgba(255,255,255,0.2)";
  fpsInput.style.background = "rgba(255,255,255,0.05)";
  fpsInput.style.color = "#f5f6ff";
  fpsInput.style.fontSize = "13px";

  const resSelect = document.createElement("select");
  resSelect.style.padding = "8px 10px";
  resSelect.style.borderRadius = "8px";
  resSelect.style.border = "1px solid rgba(255,255,255,0.2)";
  resSelect.style.background = "rgba(255,255,255,0.05)";
  resSelect.style.color = "#f5f6ff";
  resSelect.style.fontSize = "13px";

  const resOptions = [
    { value: "1080p", label: "1920x1080" },
    { value: "720p", label: "1280x720" },
    { value: "480p", label: "854x480" },
  ];

  for (const opt of resOptions) {
    const option = document.createElement("option");
    option.value = opt.value;
    option.innerText = opt.label;
    resSelect.appendChild(option);
  }
  resSelect.value = "1080p";

  videoFormatContainer.appendChild(fpsInput);
  videoFormatContainer.appendChild(resSelect);

  videoSettingsContainer.appendChild(videoSettingsTitle);
  videoSettingsContainer.appendChild(targetLabel);
  videoSettingsContainer.appendChild(targetContainer);
  videoSettingsContainer.appendChild(angleLabel);
  videoSettingsContainer.appendChild(customAngleEditor);
  videoSettingsContainer.appendChild(angleValueRow);
  videoSettingsContainer.appendChild(angleListContainer);
  videoSettingsContainer.appendChild(videoFormatLabel);
  videoSettingsContainer.appendChild(videoFormatContainer);

  const feedback = document.createElement("div");
  feedback.style.fontSize = "13px";
  feedback.style.color = "#ff7a7a";
  feedback.style.minHeight = "18px";
  feedback.style.textAlign = "center";

  const progressContainer = document.createElement("div");
  progressContainer.style.display = "none";
  progressContainer.style.flexDirection = "column";
  progressContainer.style.gap = "8px";

  const progressText = document.createElement("div");
  progressText.style.fontSize = "12px";
  progressText.style.color = "#b8c0dc";
  progressText.innerText = "Recording 0%";

  const progressTrack = document.createElement("div");
  progressTrack.style.height = "8px";
  progressTrack.style.width = "100%";
  progressTrack.style.borderRadius = "999px";
  progressTrack.style.background = "rgba(255,255,255,0.12)";
  progressTrack.style.overflow = "hidden";

  const progressFill = document.createElement("div");
  progressFill.style.height = "100%";
  progressFill.style.width = "0%";
  progressFill.style.background = "linear-gradient(135deg, #4f6bff 0%, #80a7ff 100%)";
  progressFill.style.transition = "width 0.15s ease";

  progressTrack.appendChild(progressFill);
  progressContainer.appendChild(progressText);
  progressContainer.appendChild(progressTrack);

  const actionButton = document.createElement("button");
  actionButton.type = "button";
  actionButton.innerText = "Export";
  actionButton.style.padding = "10px 0";
  actionButton.style.borderRadius = "999px";
  actionButton.style.border = "none";
  actionButton.style.background = "linear-gradient(135deg, #4f6bff 0%, #80a7ff 100%)";
  actionButton.style.color = "#fff";
  actionButton.style.fontSize = "15px";
  actionButton.style.fontWeight = "600";
  actionButton.style.cursor = "pointer";

  const errorModal = createErrorModal();

  actionButton.addEventListener("click", async () => {
    if (!selectedOptionId) {
      errorModal.show("Please choose an export type.");
      return;
    }

    if (selectedOptionId === VIDEO_OPTION_ID) {
      const selectedAngles = getSelectedAngles();
      if (selectedAngles.length === 0) {
        feedback.innerText = "Please add and select at least one angle.";
        return;
      }
    }

    if (typeof onConfirm !== "function") {
      hide();
      return;
    }

    actionButton.disabled = true;
    actionButton.style.opacity = "0.65";
    setBusyState(selectedOptionId === VIDEO_OPTION_ID);
    feedback.innerText = "";

    const payload = {
      optionId: selectedOptionId,
      videoSettings:
        selectedOptionId === VIDEO_OPTION_ID
          ? {
              targetPane: selectedTarget,
              angles: getSelectedAngles(),
              fps: Math.max(1, Math.min(120, parseInt(fpsInput.value, 10) || 30)),
              resolution: resSelect.value,
              onProgress: (overallPercent, label) => {
                progressContainer.style.display = "flex";
                const safe = Math.max(0, Math.min(100, Math.floor(overallPercent || 0)));
                progressFill.style.width = `${safe}%`;
                progressText.innerText = label
                  ? `Recording ${safe}% - ${label}`
                  : `Recording ${safe}%`;
              },
            }
          : null,
    };

    try {
      await Promise.resolve(onConfirm(payload));
      hide();
    } catch (err) {
      feedback.innerText = `Export failed: ${err?.message || err}`;
    } finally {
      actionButton.disabled = false;
      actionButton.style.opacity = "1";
      setBusyState(false);
      progressContainer.style.display = "none";
      progressFill.style.width = "0%";
      progressText.innerText = "Recording 0%";
    }
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      handleClose();
    }
  });

  function handleClose() {
    if (isBusy) return;
    hide();
    if (typeof onClose === "function") {
      onClose();
    }
  }

  function getSelectedAngles() {
    return angleItems
      .filter((angle) => angle.enabled)
      .map((angle) => ({
        id: angle.id,
        yaw: angle.yaw,
        pitch: angle.pitch,
        distance: angle.distance,
        moveX: angle.moveX,
        moveY: angle.moveY,
      }));
  }

  function emitAnglePreview(angle) {
    if (typeof onVideoAnglePreview === "function") {
      onVideoAnglePreview({
        targetPane: selectedTarget,
        angle: {
          yaw: Number(angle?.yaw) || 0,
          pitch: Number(angle?.pitch) || 0,
          distance: Math.max(0.001, Number(angle?.distance) || 30),
          moveX: Number(angle?.moveX) || 0,
          moveY: Number(angle?.moveY) || 0,
        },
      });
    }
  }

  function emitPreviewForFirstSelectedAngle() {
    const selectedAngles = getSelectedAngles();
    if (selectedAngles.length > 0) {
      emitAnglePreview(selectedAngles[0]);
    } else {
      emitAnglePreview(getEditorAngleConfig());
    }
  }

  function show() {
    feedback.innerText = "";
    overlay.style.display = "flex";
  }

  function hide() {
    overlay.style.display = "none";
  }

  function reset() {
    setSelectedOption(null);
    feedback.innerText = "";
    targetRadios.paneA.checked = true;
    selectedTarget = "paneA";
    fpsInput.value = "30";
    resSelect.value = "1080p";
    yawInput.value = "0";
    pitchInput.value = "15";
    distanceInput.value = "30";
    moveXInput.value = "0";
    moveYInput.value = "0";
    updateAngleValueText();
    angleItems.splice(0, angleItems.length);
    angleCounter = 1;
    angleListContainer.innerHTML = "";
    addAngle({ yaw: 0, pitch: 15, distance: 30, moveX: 0, moveY: 0 });
  }

  function setBusyState(busy) {
    isBusy = !!busy;
    closeBtn.disabled = isBusy;
    closeBtn.style.opacity = isBusy ? "0.35" : "1";
    closeBtn.style.cursor = isBusy ? "not-allowed" : "pointer";
  }

  function toggleVideoSettings(visible) {
    videoSettingsContainer.style.display = visible ? "flex" : "none";
    if (visible) {
      emitPreviewForFirstSelectedAngle();
    }
  }

  dialog.appendChild(closeBtn);
  dialog.appendChild(title);
  dialog.appendChild(optionsContainer);
  dialog.appendChild(videoSettingsContainer);
  dialog.appendChild(feedback);
  dialog.appendChild(progressContainer);
  dialog.appendChild(actionButton);
  overlay.appendChild(dialog);
  host.appendChild(overlay);

  return {
    show,
    hide,
    element: overlay,
  };

  function createErrorModal() {
    const toastOverlay = document.createElement("div");
    toastOverlay.style.position = "fixed";
    toastOverlay.style.inset = "0";
    toastOverlay.style.background = "rgba(0, 0, 0, 0.45)";
    toastOverlay.style.display = "none";
    toastOverlay.style.alignItems = "center";
    toastOverlay.style.justifyContent = "center";
    toastOverlay.style.zIndex = "10040";

    const toast = document.createElement("div");
    toast.style.background = "#181d2c";
    toast.style.border = "1px solid rgba(255,0,0,0.4)";
    toast.style.borderRadius = "14px";
    toast.style.padding = "24px 30px";
    toast.style.minWidth = "300px";
    toast.style.boxShadow = "0 18px 36px rgba(0,0,0,0.45)";
    toast.style.color = "#ff8a8a";
    toast.style.display = "flex";
    toast.style.flexDirection = "column";
    toast.style.gap = "12px";
    toast.style.textAlign = "center";

    const titleEl = document.createElement("h3");
    titleEl.innerText = "Export Error";
    titleEl.style.margin = "0";
    titleEl.style.color = "#ffffff";

    const close = document.createElement("button");
    close.innerText = "Close";
    close.style.padding = "8px 16px";
    close.style.borderRadius = "999px";
    close.style.border = "1px solid rgba(255,255,255,0.2)";
    close.style.background = "rgba(255,255,255,0.08)";
    close.style.color = "#fff";
    close.style.cursor = "pointer";

    close.addEventListener("click", hideToast);
    toastOverlay.addEventListener("click", (event) => {
      if (event.target === toastOverlay) {
        hideToast();
      }
    });

    toast.appendChild(titleEl);
    toast.appendChild(close);
    toastOverlay.appendChild(toast);
    document.body.appendChild(toastOverlay);

    function showToast(customTitle) {
      titleEl.innerText = customTitle || "Export Error";
      toastOverlay.style.display = "flex";
    }

    function hideToast() {
      toastOverlay.style.display = "none";
    }

    return {
      show(message) {
        showToast(message || "Export Error");
      },
      hide: hideToast,
    };
  }

  reset();
}
