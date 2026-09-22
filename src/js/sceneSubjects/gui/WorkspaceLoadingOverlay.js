let activeLoadingOverlay = null;

export function showWorkspaceLoadingOverlay(message = "Loading...") {
    if (activeLoadingOverlay?.parentElement) {
        activeLoadingOverlay.parentElement.removeChild(activeLoadingOverlay);
        activeLoadingOverlay = null;
    }

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "12050";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.background = "rgba(6, 10, 18, 0.72)";
    overlay.style.backdropFilter = "blur(2px)";
    overlay.style.pointerEvents = "all";
    overlay.style.cursor = "wait";

    const panel = document.createElement("div");
    panel.style.padding = "14px 18px";
    panel.style.minWidth = "280px";
    panel.style.maxWidth = "380px";
    panel.style.borderRadius = "10px";
    panel.style.border = "1px solid rgba(255,255,255,0.22)";
    panel.style.background = "rgba(8, 12, 20, 0.85)";
    panel.style.color = "#f5f6ff";
    panel.style.fontSize = "13px";
    panel.style.fontWeight = "600";
    panel.style.boxShadow = "0 12px 24px rgba(0,0,0,0.32)";

    const text = document.createElement("div");
    text.innerText = message;
    text.style.marginBottom = "8px";
    panel.appendChild(text);

    const progressWrap = document.createElement("div");
    progressWrap.style.height = "6px";
    progressWrap.style.borderRadius = "999px";
    progressWrap.style.background = "rgba(255,255,255,0.14)";
    progressWrap.style.overflow = "hidden";
    progressWrap.style.border = "1px solid rgba(255,255,255,0.1)";

    const progressBar = document.createElement("div");
    progressBar.style.height = "100%";
    progressBar.style.width = "0%";
    progressBar.style.borderRadius = "999px";
    progressBar.style.background = "rgba(141, 212, 255, 0.9)";
    progressBar.style.transition = "width 0.16s ease";
    progressWrap.appendChild(progressBar);
    panel.appendChild(progressWrap);

    const progressText = document.createElement("div");
    progressText.style.marginTop = "7px";
    progressText.style.fontSize = "12px";
    progressText.style.color = "#d7e2ff";
    progressText.style.fontWeight = "500";
    progressText.innerText = "0%";
    panel.appendChild(progressText);

    overlay.appendChild(panel);

    document.body.appendChild(overlay);
    activeLoadingOverlay = overlay;

    const setMessage = (nextMessage) => {
        text.innerText = nextMessage || "Loading...";
    };

    const setProgress = (percent) => {
        if (!Number.isFinite(percent)) {
            progressBar.style.width = "35%";
            progressText.innerText = "Loading...";
            return;
        }
        const safePercent = Math.max(0, Math.min(100, percent));
        progressBar.style.width = `${safePercent}%`;
        progressText.innerText = `${Math.round(safePercent)}%`;
    };

    const close = () => {
        if (overlay.parentElement) {
            overlay.parentElement.removeChild(overlay);
        }
        if (activeLoadingOverlay === overlay) {
            activeLoadingOverlay = null;
        }
    };

    return { close, setMessage, setProgress };
}
