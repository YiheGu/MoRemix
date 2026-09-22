const BTN_BG = "#437ccc";
const BTN_BG_HOVER = "#6f90bc";
const BTN_BG_DISABLED = "#5d7aa8";
const BTN_TEXT = "#ffffff";
const BTN_TEXT_DISABLED = "#d2d9e5";

export function setModalPrimaryButtonDisabled(button, disabled) {
  button.disabled = !!disabled;
  if (button.disabled) {
    button.style.opacity = "1";
    button.style.cursor = "not-allowed";
    button.style.background = BTN_BG_DISABLED;
    button.style.borderColor = BTN_BG_DISABLED;
    button.style.color = BTN_TEXT_DISABLED;
    return;
  }

  button.style.opacity = "1";
  button.style.cursor = "pointer";
  button.style.background = BTN_BG;
  button.style.borderColor = BTN_BG;
  button.style.color = BTN_TEXT;
}

export function applyModalPrimaryButtonStyle(button, { minWidth = "120px" } = {}) {
  button.style.padding = "10px 28px";
  button.style.border = `1px solid ${BTN_BG}`;
  button.style.borderRadius = "999px";
  button.style.background = BTN_BG;
  button.style.color = BTN_TEXT;
  button.style.fontSize = "14px";
  button.style.fontWeight = "600";
  button.style.letterSpacing = "0";
  button.style.minWidth = minWidth;
  button.style.transition = "background-color 0.16s ease, border-color 0.16s ease";
  button.style.boxShadow = "none";
  button.style.filter = "none";
  button.style.transform = "none";
  setModalPrimaryButtonDisabled(button, button.disabled);

  button.addEventListener("mouseenter", () => {
    if (button.disabled) return;
    button.style.background = BTN_BG_HOVER;
    button.style.borderColor = BTN_BG_HOVER;
  });
  button.addEventListener("mouseleave", () => {
    if (button.disabled) return;
    button.style.background = BTN_BG;
    button.style.borderColor = BTN_BG;
  });
}
