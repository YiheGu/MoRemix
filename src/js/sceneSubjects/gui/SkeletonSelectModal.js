import { applyModalPrimaryButtonStyle, setModalPrimaryButtonDisabled } from "./ModalPrimaryButtonStyle.js";

const importModalBg = new URL("../../../assets/Background.png", import.meta.url);
const metaHumanImage = new URL("../../../assets/MHSkeleton.png", import.meta.url);
const mixamoImage = new URL("../../../assets/MixamoSkeleton.png", import.meta.url);

export function createSkeletonSelectModal({ typeSelection, onConfirm, onClose }) {
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

  const closeBtn = document.createElement("button");
  closeBtn.innerText = "X";
  closeBtn.style.position = "absolute";
  closeBtn.style.top = "12px";
  closeBtn.style.right = "12px";
  closeBtn.style.background = "transparent";
  closeBtn.style.border = "none";
  closeBtn.style.color = "#b0b0b0";
  closeBtn.style.fontSize = "16px";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.padding = "4px";
  closeBtn.style.lineHeight = "1";
  closeBtn.addEventListener("mouseover", () => {
    closeBtn.style.color = "#ffffff";
  });
  closeBtn.addEventListener("mouseout", () => {
    closeBtn.style.color = "#b0b0b0";
  });
  closeBtn.addEventListener("click", () => {
    overlay.style.display = "none";
    if (typeof onClose === "function") {
      onClose();
    }
  });

  let text = "";
  if (typeSelection === "skeleton") text="Which skeleton does this animation file use?"
  else if (typeSelection === "pld") text="Which skeleton do you want to use for PLD?";

  const header = document.createElement("h2");
  header.innerText = text;
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
    metahuman: "#009dffff",
    mixamo: "#009dffff",
  };
  const cardBaseBackground = "rgba(255, 255, 255, 0.05)";
  const cardHoverBackground = "rgba(255, 255, 255, 0.1)";
  const cardSelectedBackground = "rgba(63, 140, 255, 0.24)";

  function setCardSelected(card, active, color) {
    if (!card) return;
    card.dataset.selected = active ? "true" : "false";
    card.style.background = active ? cardSelectedBackground : cardBaseBackground;
    card.style.border = active
      ? `2px solid ${color}`
      : "1px solid rgba(255,255,255,0.1)";
    card.style.boxShadow = active ? `0 0 14px ${color}55` : "none";
  }

  function handleSelect(optionKey) {
    selectedOption = optionKey;
    setCardSelected(
      metaHumanOption,
      optionKey === "metahuman",
      highlightColors.metahuman
    );
    setCardSelected(
      mixamoOption,
      optionKey === "mixamo",
      highlightColors.mixamo
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
    card.style.border = "1px solid rgba(255,255,255,0.1)";

    const img = document.createElement("img");
    img.src = imageUrl;
    img.style.width = "100%";
    img.style.borderRadius = "8px";
    img.style.objectFit = "cover";

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

  const metaHumanOption = createOption(
    metaHumanImage.href,
    "MetaHuman Skeleton",
    "metahuman"
  );
  const mixamoOption = createOption(
    mixamoImage.href,
    "Mixamo Skeleton",
    "mixamo"
  );

  optionsWrapper.appendChild(metaHumanOption);
  optionsWrapper.appendChild(mixamoOption);

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
    setCardSelected(metaHumanOption, false, highlightColors.metahuman);
    setCardSelected(mixamoOption, false, highlightColors.mixamo);
    setModalPrimaryButtonDisabled(confirmBtn, true);
  }

  footer.appendChild(confirmBtn);

  container.appendChild(closeBtn);
  container.appendChild(header);
  container.appendChild(optionsWrapper);
  container.appendChild(feedback);
  container.appendChild(footer);

  overlay.appendChild(container);
  document.body.appendChild(overlay);

  return {
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
}
