// videoRecordModal.js

export function createVideoRecordModal({ sceneContexts, onConfirm, onClose } = {}) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(4, 6, 12, 0.7)";
  overlay.style.display = "none";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "10020";

  const dialog = document.createElement("div");
  dialog.style.background = "#0f1321";
  dialog.style.borderRadius = "18px";
  dialog.style.padding = "28px";
  dialog.style.width = "520px";
  dialog.style.boxShadow = "0 20px 60px rgba(0,0,0,0.6)";
  dialog.style.display = "flex";
  dialog.style.flexDirection = "column";
  dialog.style.gap = "18px";
  dialog.style.color = "#f5f6ff";
  dialog.style.maxHeight = "90vh";
  dialog.style.overflowY = "auto";

  const title = document.createElement("h3");
  title.innerText = "Video Record Settings";
  title.style.margin = "0";

  // -------- Angle Section --------

  const angleLabel = document.createElement("div");
  angleLabel.innerText = "Recording Angles:";
  angleLabel.style.fontWeight = "600";

  const angleContainer = document.createElement("div");
  angleContainer.style.display = "flex";
  angleContainer.style.flexDirection = "column";
  angleContainer.style.gap = "8px";

  const addAngleBtn = document.createElement("button");
  addAngleBtn.innerText = "+ Add Angle";
  addAngleBtn.style.padding = "6px 10px";
  addAngleBtn.style.cursor = "pointer";

  let angleConfigs = [];

  function addAngle() {
    const id = `angle_${Date.now()}`;

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "6px";

    const nameInput = document.createElement("input");
    nameInput.placeholder = "Angle name";
    nameInput.style.flex = "1";

    const cameraSelect = document.createElement("select");
    for (const key of Object.keys(sceneContexts)) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.innerText = key;
      cameraSelect.appendChild(opt);
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.innerText = "✕";
    deleteBtn.onclick = () => {
      row.remove();
      angleConfigs = angleConfigs.filter(a => a.id !== id);
    };

    row.appendChild(nameInput);
    row.appendChild(cameraSelect);
    row.appendChild(deleteBtn);

    angleContainer.appendChild(row);

    angleConfigs.push({
      id,
      get name() { return nameInput.value || id; },
      get camera() { return cameraSelect.value; }
    });
  }

  addAngleBtn.addEventListener("click", addAngle);

  // -------- Video Settings --------

  const fpsInput = document.createElement("input");
  fpsInput.type = "number";
  fpsInput.value = "30";

  const resSelect = document.createElement("select");
  ["1080p", "720p", "480p"].forEach(r => {
    const opt = document.createElement("option");
    opt.value = r;
    opt.innerText = r;
    resSelect.appendChild(opt);
  });

  // -------- Progress --------

  const feedback = document.createElement("div");

  const progressContainer = document.createElement("div");
  progressContainer.style.height = "8px";
  progressContainer.style.background = "rgba(255,255,255,0.1)";
  progressContainer.style.borderRadius = "6px";
  progressContainer.style.overflow = "hidden";

  const progressBar = document.createElement("div");
  progressBar.style.height = "100%";
  progressBar.style.width = "0%";
  progressBar.style.background = "linear-gradient(90deg,#4f6bff,#80a7ff)";
  progressBar.style.transition = "width 0.2s";

  progressContainer.appendChild(progressBar);

  // -------- Buttons --------

  const recordBtn = document.createElement("button");
  recordBtn.innerText = "Start Recording";
  recordBtn.onclick = handleRecord;

  const cancelBtn = document.createElement("button");
  cancelBtn.innerText = "Cancel";
  cancelBtn.onclick = hide;

  function handleRecord() {
    if (angleConfigs.length === 0) {
      feedback.innerText = "Please add at least one angle.";
      return;
    }

    recordBtn.disabled = true;
    recordBtn.innerText = "Recording...";

    const settings = {
      angles: angleConfigs.map(a => ({
        name: a.name,
        camera: a.camera
      })),
      fps: parseInt(fpsInput.value) || 30,
      resolution: resSelect.value
    };

    onConfirm(settings, (percent, angleName) => {
      progressBar.style.width = percent + "%";
      feedback.innerText = `Recording ${angleName} - ${percent}%`;
    }).then(() => {
      hide();
    }).catch(err => {
      feedback.innerText = err.message;
      recordBtn.disabled = false;
      recordBtn.innerText = "Start Recording";
    });
  }

  function show() {
    overlay.style.display = "flex";
    progressBar.style.width = "0%";
    feedback.innerText = "";
  }

  function hide() {
    overlay.style.display = "none";
  }

  dialog.appendChild(title);
  dialog.appendChild(angleLabel);
  dialog.appendChild(angleContainer);
  dialog.appendChild(addAngleBtn);
  dialog.appendChild(fpsInput);
  dialog.appendChild(resSelect);
  dialog.appendChild(progressContainer);
  dialog.appendChild(feedback);
  dialog.appendChild(recordBtn);
  dialog.appendChild(cancelBtn);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  return { show, hide };
}
