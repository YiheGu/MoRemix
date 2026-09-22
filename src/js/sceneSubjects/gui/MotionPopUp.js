import { deepClone } from "../functions/deepClone";

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

export function MotionPopUp(
  bone,
  humanMotion,
  pldMotion,
  allBoneParams,
  oriAllBoneParams,
  scene,
  options = {}
) {
  const mountTarget = options.mountTarget;
  if (mountTarget) {
    return createInlinePopup(bone, humanMotion, pldMotion, allBoneParams, oriAllBoneParams, scene, mountTarget);
  }
  return createLegacyPopup(bone, humanMotion, allBoneParams, scene);
}

function createInlinePopup(bone, humanMotion, pldMotion, allBoneParams, oriAllBoneParams, scene, mountTarget) {
  const selector = `[data-popup-id="${bone.id}"]`;
  let existing = mountTarget.querySelector(selector);
  if (existing?.api) {
    existing.style.display = "";
    return existing.api;
  }

  const card = document.createElement("div");
  card.className = "pane-c-popup-card";
  card.dataset.popupId = bone.id;

  const title = document.createElement("h3");
  title.innerText = `Bone ${bone.id} · ${bone.name}`;
  card.appendChild(title);

  // Pane1: MP Angle
  const pane1 = document.createElement("div");
  pane1.className = "pane-c-popup-pane";
  pane1.innerHTML = "<h4>Main Plane (MP) Angle</h4>";

  const angleImg = document.createElement("img");
  angleImg.style.width = "100%";
  angleImg.style.maxHeight = "160px";
  angleImg.style.marginTop = "8px";
  angleImg.src = bone.Ori.MPAnglePlot || "";
  pane1.appendChild(angleImg);

  const fftImg = document.createElement("img");
  fftImg.style.width = "100%";
  fftImg.style.maxHeight = "160px";
  fftImg.style.marginTop = "8px";
  fftImg.src = bone.Ori.MPSpectrumPlot || "";
  pane1.appendChild(fftImg);

  const ampScaleRow = document.createElement("div");
  ampScaleRow.className = "pane-c-popup-inputs";
  const ampScaleLabel = document.createElement("span");
  ampScaleLabel.innerText = "MPAmpScale:";
  const input = document.createElement("input");
  input.type = "number";
  input.step = "any";
  input.min = "0";
  input.value = allBoneParams[bone.id]?.MPAmp?.ampScale !== undefined ? allBoneParams[bone.id].MPAmp.ampScale : 1;
  input.addEventListener("input", () => {
    allBoneParams[bone.id].MPAmp.ampScale = parseFloat(input.value);
  });
  ampScaleRow.appendChild(ampScaleLabel);
  ampScaleRow.appendChild(input);
  pane1.appendChild(ampScaleRow);

  const meanAddRow = document.createElement("div");
  meanAddRow.className = "pane-c-popup-slider-row";
  const meanAddLabel = document.createElement("span");
  meanAddLabel.innerText = "MPMeanAdd (deg):";
  const meanAddSlider = document.createElement("input");
  meanAddSlider.type = "range";
  meanAddSlider.min = "0";
  meanAddSlider.max = "360";
  meanAddSlider.step = "0.1";
  meanAddSlider.value = (allBoneParams[bone.id]?.MPAmp?.meanAdd !== undefined ? allBoneParams[bone.id].MPAmp.meanAdd : 0) * RAD_TO_DEG;

  const meanAddValueInput = document.createElement("input");
  meanAddValueInput.type = "number";
  meanAddValueInput.step = "0.1";
  meanAddValueInput.min = "0";
  meanAddValueInput.max = "360";
  meanAddValueInput.value = meanAddSlider.value;
  meanAddValueInput.style.width = "50px";
  meanAddValueInput.style.marginLeft = "6px";

  meanAddSlider.addEventListener("input", () => {
    const valDeg = parseFloat(meanAddSlider.value);
    allBoneParams[bone.id].MPAmp.meanAdd = valDeg * DEG_TO_RAD;
    meanAddValueInput.value = valDeg;
  });

  meanAddValueInput.addEventListener("input", () => {
    let valDeg = parseFloat(meanAddValueInput.value);
    if (isNaN(valDeg)) valDeg = 0;
    valDeg = Math.min(Math.max(valDeg, 0), 360);
    allBoneParams[bone.id].MPAmp.meanAdd = valDeg * DEG_TO_RAD;
    meanAddSlider.value = valDeg;
  });

  meanAddRow.appendChild(meanAddLabel);
  meanAddRow.appendChild(meanAddSlider);
  meanAddRow.appendChild(meanAddValueInput);
  pane1.appendChild(meanAddRow);

  const keepFreqRow = document.createElement("div");
  keepFreqRow.className = "pane-c-popup-select-row";
  const keepFreqLabel = document.createElement("span");
  keepFreqLabel.innerText = "MPKeepFreq:";
  const keepFreqSelect = document.createElement("select");
  const options = ["Default", "KeepMaxFreq", "KeepHighFreq", "KeepLowFreq"];
  options.forEach(opt => {
    const option = document.createElement("option");
    option.value = opt;
    option.text = opt;
    keepFreqSelect.appendChild(option);
  });
  keepFreqSelect.value = allBoneParams[bone.id]?.MPAmp?.keepFreq || "Default";
  keepFreqSelect.addEventListener("change", () => {
    allBoneParams[bone.id].MPAmp.keepFreq = keepFreqSelect.value;
  });
  keepFreqRow.appendChild(keepFreqLabel);
  keepFreqRow.appendChild(keepFreqSelect);
  pane1.appendChild(keepFreqRow);

  card.appendChild(pane1);

  // Pane2: V3
  const pane2 = document.createElement("div");
  pane2.className = "pane-c-popup-pane";
  pane2.innerHTML = "<h4>V3</h4>";

  const v3Row = document.createElement("div");
  v3Row.className = "pane-c-popup-inputs";
  const v3Label = document.createElement("span");
  v3Label.innerText = "V3Scale:";
  const v3Ratio = document.createElement("input");
  v3Ratio.type = "number";
  v3Ratio.step = "any";
  v3Ratio.min = "0";
  v3Ratio.value = allBoneParams[bone.id]?.V3Ratio !== undefined ? allBoneParams[bone.id].V3Ratio : 1;
  v3Ratio.addEventListener("input", () => {
    allBoneParams[bone.id].V3Ratio = parseFloat(v3Ratio.value);
  });

  const v3MeanAddRow = document.createElement("div");
  v3MeanAddRow.className = "pane-c-popup-slider-row";
  const v3MeanAddLabel = document.createElement("span");
  v3MeanAddLabel.innerText = "V3MeanAdd:";
  const v3MeanAddSlider = document.createElement("input");
  v3MeanAddSlider.type = "range";
  v3MeanAddSlider.min = "-1";
  v3MeanAddSlider.max = "1";
  v3MeanAddSlider.step = "0.01";
  v3MeanAddSlider.value = allBoneParams[bone.id]?.V3MeanAdd !== undefined ? allBoneParams[bone.id].V3MeanAdd : 0;

  const v3MeanAddValueInput = document.createElement("input");
  v3MeanAddValueInput.type = "number";
  v3MeanAddValueInput.step = "0.01";
  v3MeanAddValueInput.min = "-1";
  v3MeanAddValueInput.max = "1";
  v3MeanAddValueInput.value = v3MeanAddSlider.value;
  v3MeanAddValueInput.style.width = "50px";
  v3MeanAddValueInput.style.marginLeft = "6px";

  v3MeanAddSlider.addEventListener("input", () => {
    const val = parseFloat(v3MeanAddSlider.value);
    allBoneParams[bone.id].V3MeanAdd = val;
    v3MeanAddValueInput.value = val;
  });

  v3MeanAddValueInput.addEventListener("input", () => {
    let val = parseFloat(v3MeanAddValueInput.value);
    if (isNaN(val)) val = 0;
    val = Math.min(Math.max(val, 0), 1); 
    allBoneParams[bone.id].V3MeanAdd = val;
    meanAddSlider.value = val;
  });

  v3MeanAddRow.appendChild(v3MeanAddLabel);
  v3MeanAddRow.appendChild(v3MeanAddSlider);
  v3MeanAddRow.appendChild(v3MeanAddValueInput);

  v3Row.appendChild(v3Label);
  v3Row.appendChild(v3Ratio);

  pane2.appendChild(v3Row);
  pane2.appendChild(v3MeanAddRow);

  card.appendChild(pane2);

  // Pane3: Other Functions
  const pane3 = document.createElement("div");
  pane3.className = "pane-c-popup-pane";
  pane3.innerHTML = "<h4>Other Functions</h4>";
  
  const phaseShiftRow = document.createElement("div");
  phaseShiftRow.className = "pane-c-popup-slider-row";
  const phaseShiftLabel = document.createElement("span");
  phaseShiftLabel.innerText = "PhaseShift:";

  const phaseShiftSlider = document.createElement("input");
  phaseShiftSlider.type = "range";
  phaseShiftSlider.min = "0";
  phaseShiftSlider.max = "1";
  phaseShiftSlider.step = "0.01";
  phaseShiftSlider.value = allBoneParams[bone.id]?.PhaseShift !== undefined ? allBoneParams[bone.id].PhaseShift : 0;

  const phaseShiftValueInput = document.createElement("input");
  phaseShiftValueInput.type = "number";
  phaseShiftValueInput.step = "0.01";
  phaseShiftValueInput.min = "0";
  phaseShiftValueInput.max = "1";
  phaseShiftValueInput.value = phaseShiftSlider.value;
  phaseShiftValueInput.style.width = "50px";
  phaseShiftValueInput.style.marginLeft = "6px";

  phaseShiftSlider.addEventListener("input", () => {
    const val = parseFloat(phaseShiftSlider.value);
    allBoneParams[bone.id].PhaseShift = val;
    phaseShiftValueInput.value = val;
  });

  phaseShiftValueInput.addEventListener("input", () => {
    let val = parseFloat(phaseShiftValueInput.value);
    if (isNaN(val)) val = 0;
    val = Math.min(Math.max(val, 0), 1); // clamp 0~1
    allBoneParams[bone.id].PhaseShift = val;
    phaseShiftSlider.value = val;
  });

  phaseShiftRow.appendChild(phaseShiftLabel);
  phaseShiftRow.appendChild(phaseShiftSlider);
  phaseShiftRow.appendChild(phaseShiftValueInput);
  pane3.appendChild(phaseShiftRow);
  
  card.appendChild(pane3);

  // Pane4: Buttons
  const pane4 = document.createElement("div");
  pane4.className = "pane-c-popup-actions";

  const generateBtn = document.createElement("button");
  generateBtn.innerText = "Generate";
  generateBtn.addEventListener("click", () => {
    humanMotion.generateNewClip(allBoneParams, bone, api);
    pldMotion.setClipWithSource(humanMotion, false);
  });

  const initializeBtn = document.createElement("button");
  initializeBtn.innerText = "Initialize";
  initializeBtn.addEventListener("click", () => {
    allBoneParams = deepClone(oriAllBoneParams);
    humanMotion.generateNewClip(oriAllBoneParams, bone, api);
    pldMotion.setClipWithSource(humanMotion, false);

    // Update UI to default values
    input.value = allBoneParams[bone.id].MPAmp.ampScale;
    meanAddSlider.value = allBoneParams[bone.id].MPAmp.meanAdd * RAD_TO_DEG;
    meanAddValueInput.value = meanAddSlider.value;
    keepFreqSelect.value = allBoneParams[bone.id].MPAmp.keepFreq;
    v3Ratio.value = allBoneParams[bone.id].V3Ratio;
    v3MeanAddSlider.value = allBoneParams[bone.id].V3MeanAdd;
    v3MeanAddValueInput.value = v3MeanAddSlider.value;
    phaseShiftSlider.value = allBoneParams[bone.id].PhaseShift;
    phaseShiftValueInput.value = phaseShiftSlider.value;
  });

  const closeBtn = document.createElement("button");
  closeBtn.innerText = "Close";
  closeBtn.addEventListener("click", () => {
    api.hide();
  });

  pane4.appendChild(generateBtn);
  pane4.appendChild(initializeBtn);
  pane4.appendChild(closeBtn);
  card.appendChild(pane4);

  mountTarget.appendChild(card);

  // Popup API
  const api = {
    element: card,
    input,
    show: () => {
      card.style.display = "";
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    hide: () => {
      card.style.display = "none";
    },
    renew: () => {
      input.value = 1;
      allBoneParams[bone.id].AmplitudeScale = 1;
      pcaSlider.value = 0.5;
      allBoneParams[bone.id].pcaPosition = 0.5;
      thirdAxisSlider.value = 0.5;
      allBoneParams[bone.id].thirdAxis = 0.5;
    },
    getValue: () => parseFloat(input.value),
    setAngleImage: (dataUrl) => {
      angleImg.src = dataUrl;
    },
    setSpectrumImage: (dataUrl) => {
      fftImg.src = dataUrl;
    },
  };

  card.api = api;
  return api;
}

