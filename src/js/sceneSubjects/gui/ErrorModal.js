export function createErrorModal({
  title = "Error",
  message = "Skeleton Choose Error",
} = {}) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.45)";
  overlay.style.display = "none";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "11000";

  const container = document.createElement("div");
  container.style.background = "#1e1e1e";
  container.style.padding = "24px 32px";
  container.style.borderRadius = "12px";
  container.style.boxShadow = "0 10px 30px rgba(0,0,0,0.4)";
  container.style.minWidth = "280px";
  container.style.maxWidth = "360px";
  container.style.textAlign = "center";
  container.style.color = "#fff";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "12px";

  const titleEl = document.createElement("h3");
  titleEl.innerText = title;
  titleEl.style.margin = "0";
  titleEl.style.fontSize = "18px";
  titleEl.style.color = "#ff6b6b";

  const messageEl = document.createElement("p");
  messageEl.innerText = message;
  messageEl.style.margin = "0";
  messageEl.style.fontSize = "14px";
  messageEl.style.color = "#f0f0f0";

  const closeBtn = document.createElement("button");
  closeBtn.innerText = "Close";
  closeBtn.style.padding = "8px 20px";
  closeBtn.style.border = "none";
  closeBtn.style.borderRadius = "999px";
  closeBtn.style.background = "#3f8cff";
  closeBtn.style.color = "#fff";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontSize = "14px";

  closeBtn.addEventListener("click", () => {
    hide();
  });

  container.appendChild(titleEl);
  container.appendChild(messageEl);
  container.appendChild(closeBtn);
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  function show(customMessage) {
    if (customMessage) {
      messageEl.innerText = customMessage;
    }
    overlay.style.display = "flex";
  }

  function hide() {
    overlay.style.display = "none";
  }

  return {
    show,
    hide,
    destroy: () => overlay.remove(),
  };
}

