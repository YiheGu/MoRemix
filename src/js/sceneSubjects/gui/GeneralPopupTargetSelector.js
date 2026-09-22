function normalizeId(value) {
    return String(value);
}

const TARGET_SELECTOR_SCROLLBAR_STYLE_ID = "general-popup-target-selector-scrollbar-style";

function ensureTargetSelectorScrollbarStyle() {
    if (typeof document === "undefined") return;
    if (document.getElementById(TARGET_SELECTOR_SCROLLBAR_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = TARGET_SELECTOR_SCROLLBAR_STYLE_ID;
    style.textContent = `
      .general-popup-target-list {
        scrollbar-width: thin;
        scrollbar-color: rgba(141, 212, 255, 0.55) rgba(255,255,255,0.08);
      }
      .general-popup-target-list::-webkit-scrollbar {
        width: 8px;
      }
      .general-popup-target-list::-webkit-scrollbar-thumb {
        background: rgba(141, 212, 255, 0.55);
        border-radius: 999px;
      }
      .general-popup-target-list::-webkit-scrollbar-track {
        background: rgba(255,255,255,0.08);
        border-radius: 999px;
      }
    `;
    document.head.appendChild(style);
}

function styleToolButton(button) {
    button.type = "button";
    button.style.border = "1px solid rgba(255,255,255,0.22)";
    button.style.background = "rgba(22,28,44,0.96)";
    button.style.color = "#d7def4";
    button.style.fontSize = "11px";
    button.style.padding = "4px 8px";
    button.style.borderRadius = "999px";
    button.style.cursor = "pointer";
    button.style.lineHeight = "1.1";
}

export function createGeneralPopupTargetSelector({
    buttonText = "Select Bones",
    items = [],
    getSelectedIds = () => [],
    onSelectionChange = () => {},
    panelPlacement = "below-right",
    panelWidth = 260,
} = {}) {
    ensureTargetSelectorScrollbarStyle();

    const root = document.createElement("div");
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.alignItems = "flex-end";
    root.style.zIndex = "3";

    const toggleBtn = document.createElement("button");
    styleToolButton(toggleBtn);
    toggleBtn.style.fontSize = "12px";
    toggleBtn.style.padding = "5px 10px";
    toggleBtn.innerText = buttonText;
    toggleBtn.setAttribute("aria-expanded", "false");
    root.appendChild(toggleBtn);

    const panel = document.createElement("div");
    panel.style.position = "absolute";
    panel.style.display = "none";
    panel.style.width = `${Math.max(160, Number(panelWidth) || 260)}px`;
    panel.style.maxHeight = "320px";
    panel.style.background = "rgba(10,14,24,0.98)";
    panel.style.border = "1px solid rgba(255,255,255,0.16)";
    panel.style.borderRadius = "10px";
    panel.style.boxShadow = "0 10px 28px rgba(0,0,0,0.35)";
    panel.style.padding = "10px";
    panel.style.boxSizing = "border-box";
    panel.style.overflow = "hidden";
    root.appendChild(panel);

    const applyPanelPlacement = () => {
        panel.style.top = "";
        panel.style.right = "";
        panel.style.bottom = "";
        panel.style.left = "";
        if (panelPlacement === "left") {
            panel.style.top = "0";
            panel.style.right = "calc(100% + 8px)";
            return;
        }
        if (panelPlacement === "right") {
            panel.style.top = "0";
            panel.style.left = "calc(100% + 8px)";
            return;
        }
        if (panelPlacement === "below-left") {
            panel.style.top = "30px";
            panel.style.left = "0";
            return;
        }
        panel.style.top = "30px";
        panel.style.right = "0";
    };
    applyPanelPlacement();

    const quickBar = document.createElement("div");
    quickBar.style.display = "flex";
    quickBar.style.gap = "8px";
    quickBar.style.marginBottom = "8px";
    panel.appendChild(quickBar);

    const selectAllBtn = document.createElement("button");
    styleToolButton(selectAllBtn);
    selectAllBtn.innerText = "Select All";
    quickBar.appendChild(selectAllBtn);

    const selectNoneBtn = document.createElement("button");
    styleToolButton(selectNoneBtn);
    selectNoneBtn.innerText = "Select None";
    quickBar.appendChild(selectNoneBtn);

    const list = document.createElement("div");
    list.className = "general-popup-target-list";
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "6px";
    list.style.maxHeight = "250px";
    list.style.overflow = "auto";
    list.style.paddingRight = "4px";
    panel.appendChild(list);

    const checkboxById = new Map();

    const emitSelectionChange = () => {
        const selectedIds = [];
        checkboxById.forEach((checkbox, id) => {
            if (checkbox.checked) selectedIds.push(id);
        });
        onSelectionChange(selectedIds);
    };

    const buildList = () => {
        list.innerHTML = "";
        checkboxById.clear();
        items.forEach((item) => {
            const id = normalizeId(item?.id);
            const labelText = item?.label || id;

            const label = document.createElement("label");
            label.style.display = "flex";
            label.style.alignItems = "center";
            label.style.gap = "8px";
            label.style.fontSize = "12px";
            label.style.color = "#d7def4";
            label.style.lineHeight = "1.2";
            label.style.cursor = "pointer";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.style.margin = "0";
            checkbox.style.accentColor = "#7ca2ff";
            checkbox.addEventListener("change", emitSelectionChange);

            const text = document.createElement("span");
            text.innerText = labelText;
            text.style.flex = "1";

            label.appendChild(checkbox);
            label.appendChild(text);
            list.appendChild(label);
            checkboxById.set(id, checkbox);
        });
    };

    const refresh = () => {
        const selectedSet = new Set((getSelectedIds?.() || []).map((id) => normalizeId(id)));
        checkboxById.forEach((checkbox, id) => {
            checkbox.checked = selectedSet.has(id);
        });
    };

    selectAllBtn.addEventListener("click", () => {
        checkboxById.forEach((checkbox) => {
            checkbox.checked = true;
        });
        emitSelectionChange();
    });

    selectNoneBtn.addEventListener("click", () => {
        checkboxById.forEach((checkbox) => {
            checkbox.checked = false;
        });
        emitSelectionChange();
    });

    const setOpen = (open) => {
        panel.style.display = open ? "block" : "none";
        toggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
    };

    toggleBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = panel.style.display === "block";
        setOpen(!isOpen);
        if (!isOpen) refresh();
    });

    const onDocumentPointerDown = (event) => {
        if (!root.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDocumentPointerDown);

    buildList();
    refresh();

    return {
        element: root,
        refresh,
        destroy: () => {
            document.removeEventListener("pointerdown", onDocumentPointerDown);
            root.remove();
        },
    };
}
