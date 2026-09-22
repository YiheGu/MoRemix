import { applyCameraAngle, readCameraAngle } from "./cameraAngleUtils";
import { createPaneDockPanel } from "./CollapsiblePanel";

const paneScenePerspectiveInstances = new Map();
let syncPaneScenePerspective = true;

export function createPaneSceneAngleUI({
  paneContainer,
  basicScene,
  paneId = "paneA",
  initialAngle = null,
  getPaneSettingsDock,
} = {}) {
  if (!paneContainer || !basicScene?.camera || !basicScene?.controls) return null;

  const dock = getPaneSettingsDock?.(paneContainer);
  if (!dock) return null;

  const { root, body } = createPaneDockPanel({
    title: `Scene Perspective (${paneId === "paneA" ? "A" : "B"})`,
    initialCollapsed: true,
    width: "220px",
    minWidth: "190px",
  });

  const syncRow = document.createElement("label");
  syncRow.style.display = "flex";
  syncRow.style.alignItems = "center";
  syncRow.style.gap = "6px";
  syncRow.style.cursor = "pointer";
  const syncInput = document.createElement("input");
  syncInput.type = "checkbox";
  syncInput.checked = syncPaneScenePerspective;
  const syncLabel = document.createElement("span");
  syncLabel.innerText = "Sync Pane A/B";
  syncRow.appendChild(syncInput);
  syncRow.appendChild(syncLabel);
  body.appendChild(syncRow);

  const yawInput = createNumericField("Yaw", "1");
  const pitchInput = createNumericField("Pitch", "1");
  const distanceInput = createNumericField("Distance", "0.1", "0.1");
  const moveXInput = createNumericField("Move X", "0.1");
  const moveYInput = createNumericField("Move Y", "0.1");

  body.appendChild(yawInput.row);
  body.appendChild(pitchInput.row);
  body.appendChild(distanceInput.row);
  body.appendChild(moveXInput.row);
  body.appendChild(moveYInput.row);

  const hint = document.createElement("div");
  hint.innerText = "Drag scene to update";
  hint.style.fontSize = "11px";
  hint.style.color = "#9aa4c3";
  body.appendChild(hint);

  dock.appendChild(root);

  let isSyncing = false;
  let editingCount = 0;
  let applyingRemoteState = false;
  const defaultAngle = {
    yaw: -90,
    pitch: 0,
    distance: 20,
    moveX: 0,
    moveY: 0,
    ...(initialAngle || {}),
  };

  function readViewState() {
    return readCameraAngle({
      camera: basicScene.camera,
      controls: basicScene.controls,
    });
  }

  function writeViewState({ yaw, pitch, distance, moveX, moveY }) {
    applyCameraAngle(
      {
        camera: basicScene.camera,
        controls: basicScene.controls,
      },
      { yaw, pitch, distance, moveX, moveY }
    );
  }

  function getPeerPaneId() {
    return paneId === "paneA" ? "paneB" : "paneA";
  }

  function syncPerspectiveToPeer() {
    if (!syncPaneScenePerspective || applyingRemoteState) return;
    const peer = paneScenePerspectiveInstances.get(getPeerPaneId());
    peer?.applyRemoteState?.(readViewState());
  }

  function syncInputs() {
    if (editingCount > 0) return;
    isSyncing = true;
    const state = readViewState();
    yawInput.input.value = state.yaw.toFixed(1);
    pitchInput.input.value = state.pitch.toFixed(1);
    distanceInput.input.value = state.distance.toFixed(1);
    moveXInput.input.value = state.moveX.toFixed(1);
    moveYInput.input.value = state.moveY.toFixed(1);
    isSyncing = false;
  }

  function applyFromInputs() {
    if (isSyncing) return;
    writeViewState({
      yaw: Number(yawInput.input.value),
      pitch: Number(pitchInput.input.value),
      distance: Number(distanceInput.input.value),
      moveX: Number(moveXInput.input.value),
      moveY: Number(moveYInput.input.value),
    });
    syncPerspectiveToPeer();
  }

  [yawInput.input, pitchInput.input, distanceInput.input, moveXInput.input, moveYInput.input].forEach((input) => {
    input.addEventListener("input", applyFromInputs);
    input.addEventListener("change", () => {
      applyFromInputs();
      syncInputs();
    });
    input.addEventListener("focus", () => {
      editingCount += 1;
    });
    input.addEventListener("blur", () => {
      editingCount = Math.max(0, editingCount - 1);
      applyFromInputs();
      syncInputs();
    });
  });

  const handleControlChange = () => {
    syncInputs();
    syncPerspectiveToPeer();
  };
  basicScene.controls.addEventListener("change", handleControlChange);
  writeViewState(defaultAngle);
  syncInputs();

  const applyRemoteState = (state) => {
    applyingRemoteState = true;
    try {
      writeViewState(state);
      syncInputs();
    } finally {
      applyingRemoteState = false;
    }
  };

  const setSyncChecked = (checked) => {
    syncInput.checked = checked;
  };

  syncInput.addEventListener("change", () => {
    syncPaneScenePerspective = syncInput.checked;
    paneScenePerspectiveInstances.forEach((instance) => instance.setSyncChecked?.(syncPaneScenePerspective));
    if (syncPaneScenePerspective) syncPerspectiveToPeer();
  });

  paneScenePerspectiveInstances.set(paneId, {
    applyRemoteState,
    setSyncChecked,
  });

  return {
    element: root,
    dispose() {
      basicScene.controls?.removeEventListener?.("change", handleControlChange);
      if (paneScenePerspectiveInstances.get(paneId)?.applyRemoteState === applyRemoteState) {
        paneScenePerspectiveInstances.delete(paneId);
      }
      root.remove();
    },
  };
}

function createNumericField(labelText, step = "1", min = null) {
  const row = document.createElement("label");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.gap = "8px";

  const label = document.createElement("span");
  label.innerText = labelText;
  label.style.minWidth = "62px";
  label.style.color = "#d7e2ff";

  const input = document.createElement("input");
  input.type = "number";
  input.step = step;
  if (min !== null) input.min = min;
  input.style.width = "88px";
  input.style.border = "1px solid rgba(255,255,255,0.2)";
  input.style.background = "rgba(255,255,255,0.06)";
  input.style.color = "#f5f6ff";
  input.style.borderRadius = "8px";
  input.style.padding = "5px 7px";
  input.style.fontSize = "12px";
  input.style.outline = "none";

  row.appendChild(label);
  row.appendChild(input);
  return { row, input };
}
