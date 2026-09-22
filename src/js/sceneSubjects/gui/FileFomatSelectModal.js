import { applyModalPrimaryButtonStyle, setModalPrimaryButtonDisabled } from "./ModalPrimaryButtonStyle.js";

const importModalBg = new URL("../../../assets/Background.png", import.meta.url);
const skeletonImage = new URL("../../../assets/SkeletonFormat.png", import.meta.url);
const pldImage = new URL("../../../assets/PldFormat.png", import.meta.url);

export function createFileFormatSelectModal({ onConfirm, onBatch }) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.45)";
  overlay.style.display = "none";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.overflow = "auto";
  overlay.style.padding = "64px";
  overlay.style.boxSizing = "border-box";
  overlay.style.zIndex = "10001";

  const container = document.createElement("div");
  container.style.background = "#1e1e1e";
  container.style.padding = "32px";
  container.style.borderRadius = "16px";
  container.style.boxShadow = "0 10px 40px rgba(0,0,0,0.35)";
  container.style.minWidth = "360px";
  container.style.maxWidth = "520px";
  container.style.color = "#f5f5f5";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "24px";
  container.style.position = "relative";
  container.style.transform = "scale(1.25)";
  container.style.transformOrigin = "center center";

  // Background Image
  const bg = document.createElement('div');
  bg.style.position = 'absolute';
  bg.style.top = '0';
  bg.style.left = '0';
  bg.style.width = '100%';
  bg.style.height = '100%';
  bg.style.backgroundImage = `url("${importModalBg.href}")`;
  bg.style.backgroundSize = 'cover';
  bg.style.backgroundPosition = 'center';
  bg.style.filter = 'blur(5px) brightness(50%)';  
  bg.style.zIndex = '-1';

  overlay.appendChild(bg);

  const header = document.createElement("h2");
  header.innerText = "Select the format of the file to be imported";
  header.style.margin = "0";
  header.style.fontSize = "20px";
  header.style.textAlign = "center";
  header.style.color = "#ffffff";

  const optionsWrapper = document.createElement("div");
  optionsWrapper.style.display = "flex";
  optionsWrapper.style.justifyContent = "space-between";
  optionsWrapper.style.gap = "16px";

  const feedback = document.createElement("div");
  feedback.style.textAlign = "center";
  feedback.style.fontSize = "13px";
  feedback.style.minHeight = "18px";
  feedback.style.color = "#ff6b6b";

  let selectedOption = null;

  const highlightColors = {
    skeleton: "#0084ffff",
    pld: "#0084ffff",
  };
  const cardBaseBackground = "rgba(255, 255, 255, 0.05)";
  const cardHoverBackground = "rgba(255, 255, 255, 0.1)";
  const cardSelectedBackground = "rgba(63, 140, 255, 0.24)";

  function setCardSelected(card, active, color) {
    if (!card) return;
    card.dataset.selected = active ? "true" : "false";
    card.style.background = active ? cardSelectedBackground : cardBaseBackground;
    card.style.borderColor = active ? color : "rgba(255,255,255,0.1)";
    card.style.boxShadow = active ? `0 0 14px ${color}55` : "none";
  }

  function handleSelect(optionKey) {
    selectedOption = optionKey;
    setCardSelected(
      skeletonOption,
      optionKey === "skeleton",
      highlightColors.skeleton
    );
    setCardSelected(
      pldOption,
      optionKey === "pld",
      highlightColors.pld
    );
    setFeedback("");
    setModalPrimaryButtonDisabled(confirmBtn, false);
  }

  function createOption(imageUrl, labelText, optionKey) {
    const card = document.createElement("div");
    card.style.flex = "1";
    card.style.background = cardBaseBackground;
    card.style.borderRadius = "12px";
    card.style.padding = "16px";
    card.style.textAlign = "center";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "12px";
    card.style.border = "2px solid rgba(255,255,255,0.1)";
    card.style.boxSizing = "border-box";

    const img = document.createElement("img");
    img.src = imageUrl;
    img.style.width = "100%";
    img.style.borderRadius = "8px";
    img.style.height = "350px";
    img.style.objectFit = "cover";
    img.style.display = "block";

    const label = document.createElement("div");
    label.innerText = labelText;
    label.style.fontSize = "14px";
    label.style.color = "#dcdcdc";
    label.style.fontWeight = "600";

    card.appendChild(img);
    card.appendChild(label);
    card.dataset.selected = "false";
    card.style.cursor = "pointer";
    card.addEventListener("mouseenter", () => {
      if (card.dataset.selected === "true") return;
      card.style.background = cardHoverBackground;
    });
    card.addEventListener("mouseleave", () => {
      if (card.dataset.selected === "true") return;
      card.style.background = cardBaseBackground;
    });
    card.addEventListener("click", () => handleSelect(optionKey));
    return card;
  }

  const skeletonOption = createOption(
    skeletonImage.href,
    "Skeletal Animation",
    "skeleton"
  );
  const pldOption = createOption(
    pldImage.href,
    "Point Light Display",
    "pld"
  );

  optionsWrapper.appendChild(skeletonOption);
  optionsWrapper.appendChild(pldOption);

  const footer = document.createElement("div");
  footer.style.display = "flex";
  footer.style.justifyContent = "center";

  const confirmBtn = document.createElement("button");
  confirmBtn.innerText = "Confirm";
  applyModalPrimaryButtonStyle(confirmBtn);
  setModalPrimaryButtonDisabled(confirmBtn, true);

  confirmBtn.addEventListener("click", () => {
    if (typeof onConfirm === "function") {
      onConfirm(selectedOption);
    }
  });

  function setFeedback(message = "") {
    feedback.innerText = message;
  }

  function resetSelection() {
    selectedOption = null;
    setFeedback("");
    setCardSelected(skeletonOption, false, highlightColors.skeleton);
    setCardSelected(pldOption, false, highlightColors.pld);
    setModalPrimaryButtonDisabled(confirmBtn, true);
  }

  footer.appendChild(confirmBtn);

  // Batch processing entry
  const batchDivider = document.createElement("div");
  batchDivider.style.cssText = `
    border-top: 1px solid rgba(255,255,255,0.1);
    padding-top: 16px;
    display: flex; justify-content: center;
  `;
  const batchBtn = document.createElement("button");
  batchBtn.innerText = "⚙ Batch Workflow";
  batchBtn.style.cssText = `
    padding: 8px 20px; border-radius: 8px;
    border: 1px solid rgba(141,212,255,0.35);
    background: rgba(141,212,255,0.08); color: #8dd4ff;
    cursor: pointer; font-size: 13px; font-weight: 500;
    transition: background 0.15s ease;
  `;
  batchBtn.addEventListener("mouseenter", () => {
    batchBtn.style.background = "rgba(141,212,255,0.18)";
  });
  batchBtn.addEventListener("mouseleave", () => {
    batchBtn.style.background = "rgba(141,212,255,0.08)";
  });
  batchBtn.addEventListener("click", () => {
    if (typeof onBatch === "function") onBatch();
  });
  batchDivider.appendChild(batchBtn);

  container.appendChild(header);
  container.appendChild(optionsWrapper);
  container.appendChild(feedback);
  container.appendChild(footer);
  container.appendChild(batchDivider);

  overlay.appendChild(container);
  document.body.appendChild(overlay);

  const api = {
    show: () => {
      overlay.style.display = "flex";
    },
    hide: () => {
      overlay.style.display = "none";
    },
    destroy: () => {
      overlay.remove();
    },
    resetSelection,
    getSelection: () => selectedOption,
    setFeedback,
  };
  return api;
}
