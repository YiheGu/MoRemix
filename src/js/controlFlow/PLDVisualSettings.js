import { createGeneralPopupTargetSelector } from "../sceneSubjects/gui/GeneralPopupTargetSelector";
import { createPaneDockPanel } from "./CollapsiblePanel";

export function createPLDVisualSettings({
    getPldMotion,
    getPaneSettingsDock,
} = {}) {
    const panePldVisualSettings = {
        paneA: { isOpen: false },
        paneB: { isOpen: false },
    };

    function normalizeHexColor(value, fallback = "#a0a0a0") {
        if (typeof value !== "string") return fallback;
        const hex = value.trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return fallback;
        return hex.toLowerCase();
    }

    function getPanePldVisualSettings(paneId) {
        if (!panePldVisualSettings[paneId]) {
            panePldVisualSettings[paneId] = { isOpen: false };
        }
        return panePldVisualSettings[paneId];
    }

    function resolvePldMotion() {
        return getPldMotion?.() || null;
    }

    function buildSphereSelectorItems(motion) {
        const fromInfo = Array.isArray(motion?.pldInfo)
            ? motion.pldInfo
                .map((pld) => ({
                    id: Number(pld?.id),
                    name: typeof pld?.name === "string" ? pld.name : "",
                }))
                .filter((item) => Number.isFinite(item.id))
            : [];

        if (fromInfo.length > 0) {
            return fromInfo.map((item) => ({
                id: item.id,
                label: item.name ? `Sphere ${item.id} - ${item.name}` : `Sphere ${item.id}`,
            }));
        }

        const fromGroup = motion?.getAllSphereIds?.() || [];
        return fromGroup.map((id) => ({ id, label: `Sphere ${id}` }));
    }

    function createPldStickFigureToggle(paneContainer, paneId) {
        const pldMotion = resolvePldMotion();
        if (!paneContainer || !pldMotion) return;

        const dock = getPaneSettingsDock?.(paneContainer);
        if (!dock) return;
        const viewState = getPanePldVisualSettings(paneId);

        const { root, body: panel } = createPaneDockPanel({
            title: `PLD Visual (${paneId === "paneA" ? "A" : "B"})`,
            initialCollapsed: !viewState.isOpen,
            width: "228px",
            minWidth: "190px",
            onToggle: (isOpen) => {
                viewState.isOpen = isOpen;
                if (isOpen) sphereSelectorApi?.refresh?.();
            },
        });

        const headerRow = document.createElement("div");
        headerRow.style.display = "flex";
        headerRow.style.alignItems = "center";
        headerRow.style.justifyContent = "flex-end";
        headerRow.style.gap = "8px";

        const sphereSelectorSlot = document.createElement("div");
        sphereSelectorSlot.style.position = "relative";
        sphereSelectorSlot.style.display = "flex";
        sphereSelectorSlot.style.justifyContent = "flex-end";
        const sphereSelectorApi = createGeneralPopupTargetSelector({
            buttonText: "Show Spheres",
            panelPlacement: "below-right",
            panelWidth: 220,
            items: buildSphereSelectorItems(pldMotion),
            getSelectedIds: () => {
                const motion = resolvePldMotion();
                if (!motion) return [];
                if (typeof motion.getVisibleSphereIds === "function") {
                    return motion.getVisibleSphereIds();
                }
                return motion.getAllSphereIds?.() || [];
            },
            onSelectionChange: (selectedIds) => {
                const motion = resolvePldMotion();
                motion?.setVisibleSphereIds?.(selectedIds);
            },
        });
        if (sphereSelectorApi?.element) {
            sphereSelectorApi.element.style.alignItems = "flex-end";
            sphereSelectorSlot.appendChild(sphereSelectorApi.element);
        }
        headerRow.appendChild(sphereSelectorSlot);
        panel.appendChild(headerRow);

        const lineVisibleRow = document.createElement("label");
        lineVisibleRow.style.display = "flex";
        lineVisibleRow.style.alignItems = "center";
        lineVisibleRow.style.gap = "6px";
        lineVisibleRow.style.cursor = "pointer";

        const lineVisible = document.createElement("input");
        lineVisible.type = "checkbox";
        lineVisible.checked = !!pldMotion.showStickFigure;
        lineVisible.style.cursor = "pointer";
        const lineVisibleText = document.createElement("span");
        lineVisibleText.innerText = "Stick Figure";
        lineVisibleRow.appendChild(lineVisible);
        lineVisibleRow.appendChild(lineVisibleText);
        panel.appendChild(lineVisibleRow);

        const thicknessRow = document.createElement("div");
        thicknessRow.style.display = "flex";
        thicknessRow.style.alignItems = "center";
        thicknessRow.style.gap = "6px";
        const thicknessLabel = document.createElement("span");
        thicknessLabel.innerText = "Line Width";
        thicknessLabel.style.minWidth = "72px";
        const thicknessSlider = document.createElement("input");
        thicknessSlider.type = "range";
        thicknessSlider.min = "1";
        thicknessSlider.max = "40";
        thicknessSlider.step = "1";
        thicknessSlider.value = String(Number(pldMotion.stickThickness) || 1);
        thicknessSlider.style.flex = "1";
        const thicknessValue = document.createElement("span");
        thicknessValue.innerText = thicknessSlider.value;
        thicknessValue.style.minWidth = "22px";
        thicknessValue.style.textAlign = "right";
        thicknessRow.appendChild(thicknessLabel);
        thicknessRow.appendChild(thicknessSlider);
        thicknessRow.appendChild(thicknessValue);
        panel.appendChild(thicknessRow);

        const lineColorRow = document.createElement("div");
        lineColorRow.style.display = "flex";
        lineColorRow.style.alignItems = "center";
        lineColorRow.style.gap = "8px";
        const lineColorLabel = document.createElement("span");
        lineColorLabel.innerText = "Line Color";
        lineColorLabel.style.minWidth = "72px";
        const lineColorInput = document.createElement("input");
        lineColorInput.type = "color";
        lineColorInput.value = normalizeHexColor(pldMotion.stickColor || "#c9c9c9", "#c9c9c9");
        lineColorInput.style.width = "40px";
        lineColorInput.style.height = "24px";
        lineColorInput.style.padding = "0";
        lineColorInput.style.border = "1px solid rgba(255,255,255,0.22)";
        lineColorInput.style.borderRadius = "6px";
        lineColorInput.style.background = "transparent";
        lineColorRow.appendChild(lineColorLabel);
        lineColorRow.appendChild(lineColorInput);
        panel.appendChild(lineColorRow);

        const sphereColorRow = document.createElement("div");
        sphereColorRow.style.display = "flex";
        sphereColorRow.style.alignItems = "center";
        sphereColorRow.style.gap = "8px";
        const sphereColorLabel = document.createElement("span");
        sphereColorLabel.innerText = "Sphere Color";
        sphereColorLabel.style.minWidth = "72px";
        const sphereColorInput = document.createElement("input");
        sphereColorInput.type = "color";
        sphereColorInput.value = normalizeHexColor(pldMotion.sphereColor || "#3875bb", "#3875bb");
        sphereColorInput.style.width = "40px";
        sphereColorInput.style.height = "24px";
        sphereColorInput.style.padding = "0";
        sphereColorInput.style.border = "1px solid rgba(255,255,255,0.22)";
        sphereColorInput.style.borderRadius = "6px";
        sphereColorInput.style.background = "transparent";
        sphereColorRow.appendChild(sphereColorLabel);
        sphereColorRow.appendChild(sphereColorInput);
        panel.appendChild(sphereColorRow);

        const hierarchyColorRow = document.createElement("label");
        hierarchyColorRow.style.display = "flex";
        hierarchyColorRow.style.alignItems = "center";
        hierarchyColorRow.style.gap = "6px";
        hierarchyColorRow.style.cursor = "pointer";
        const hierarchyColorVisible = document.createElement("input");
        hierarchyColorVisible.type = "checkbox";
        hierarchyColorVisible.checked = pldMotion.useHierarchySphereColoring !== false;
        const hierarchyColorText = document.createElement("span");
        hierarchyColorText.innerText = "Hierarchy Sphere Color";
        hierarchyColorRow.appendChild(hierarchyColorVisible);
        hierarchyColorRow.appendChild(hierarchyColorText);
        panel.appendChild(hierarchyColorRow);

        const sphereSizeRow = document.createElement("div");
        sphereSizeRow.style.display = "flex";
        sphereSizeRow.style.alignItems = "center";
        sphereSizeRow.style.gap = "6px";
        const sphereSizeLabel = document.createElement("span");
        sphereSizeLabel.innerText = "Sphere Size";
        sphereSizeLabel.style.minWidth = "72px";
        const sphereSizeSlider = document.createElement("input");
        sphereSizeSlider.type = "range";
        sphereSizeSlider.min = "0.1";
        sphereSizeSlider.max = "3";
        sphereSizeSlider.step = "0.05";
        sphereSizeSlider.value = String(Number(pldMotion.sphereSize) || 1);
        sphereSizeSlider.style.flex = "1";
        const sphereSizeValue = document.createElement("span");
        sphereSizeValue.innerText = Number(sphereSizeSlider.value).toFixed(2);
        sphereSizeValue.style.minWidth = "32px";
        sphereSizeValue.style.textAlign = "right";
        sphereSizeRow.appendChild(sphereSizeLabel);
        sphereSizeRow.appendChild(sphereSizeSlider);
        sphereSizeRow.appendChild(sphereSizeValue);
        panel.appendChild(sphereSizeRow);

        const labelRow = document.createElement("label");
        labelRow.style.display = "flex";
        labelRow.style.alignItems = "center";
        labelRow.style.gap = "6px";
        labelRow.style.cursor = "pointer";
        const labelVisible = document.createElement("input");
        labelVisible.type = "checkbox";
        labelVisible.checked = pldMotion.showSphereLabels !== false;
        const labelText = document.createElement("span");
        labelText.innerText = "Show Sphere ID";
        labelRow.appendChild(labelVisible);
        labelRow.appendChild(labelText);
        panel.appendChild(labelRow);

        const labelColorRow = document.createElement("div");
        labelColorRow.style.display = "flex";
        labelColorRow.style.alignItems = "center";
        labelColorRow.style.gap = "8px";
        const labelColorLabel = document.createElement("span");
        labelColorLabel.innerText = "Sphere ID Color";
        labelColorLabel.style.minWidth = "72px";
        const labelColorInput = document.createElement("input");
        labelColorInput.type = "color";
        labelColorInput.value = normalizeHexColor(pldMotion.labelColor || "#ffffff", "#ffffff");
        labelColorInput.style.width = "40px";
        labelColorInput.style.height = "24px";
        labelColorInput.style.padding = "0";
        labelColorInput.style.border = "1px solid rgba(255,255,255,0.22)";
        labelColorInput.style.borderRadius = "6px";
        labelColorInput.style.background = "transparent";
        labelColorRow.appendChild(labelColorLabel);
        labelColorRow.appendChild(labelColorInput);
        panel.appendChild(labelColorRow);

        const outlineRow = document.createElement("label");
        outlineRow.style.display = "flex";
        outlineRow.style.alignItems = "center";
        outlineRow.style.gap = "6px";
        outlineRow.style.cursor = "pointer";
        const outlineVisible = document.createElement("input");
        outlineVisible.type = "checkbox";
        outlineVisible.checked = pldMotion.showSphereOutline === true;
        const outlineText = document.createElement("span");
        outlineText.innerText = "Sphere Outline";
        outlineRow.appendChild(outlineVisible);
        outlineRow.appendChild(outlineText);
        panel.appendChild(outlineRow);

        const outlineColorRow = document.createElement("div");
        outlineColorRow.style.display = "flex";
        outlineColorRow.style.alignItems = "center";
        outlineColorRow.style.gap = "8px";
        const outlineColorLabel = document.createElement("span");
        outlineColorLabel.innerText = "Outline Color";
        outlineColorLabel.style.minWidth = "72px";
        const outlineColorInput = document.createElement("input");
        outlineColorInput.type = "color";
        outlineColorInput.value = normalizeHexColor(pldMotion.sphereOutlineColor || "#ffffff", "#ffffff");
        outlineColorInput.style.width = "40px";
        outlineColorInput.style.height = "24px";
        outlineColorInput.style.padding = "0";
        outlineColorInput.style.border = "1px solid rgba(255,255,255,0.22)";
        outlineColorInput.style.borderRadius = "6px";
        outlineColorInput.style.background = "transparent";
        outlineColorRow.appendChild(outlineColorLabel);
        outlineColorRow.appendChild(outlineColorInput);
        panel.appendChild(outlineColorRow);

        const syncEnableState = () => {
            const enabled = lineVisible.checked;
            thicknessSlider.disabled = !enabled;
            lineColorInput.disabled = !enabled;
            thicknessValue.style.opacity = enabled ? "1" : "0.5";
            thicknessLabel.style.opacity = enabled ? "1" : "0.5";
            lineColorLabel.style.opacity = enabled ? "1" : "0.5";
        };

        lineVisible.addEventListener("change", () => {
            const motion = resolvePldMotion();
            if (typeof motion?.setStickFigureVisible === "function") {
                motion.setStickFigureVisible(lineVisible.checked);
            }
            syncEnableState();
        });

        thicknessSlider.addEventListener("input", () => {
            const motion = resolvePldMotion();
            thicknessValue.innerText = thicknessSlider.value;
            if (typeof motion?.setStickFigureThickness === "function") {
                motion.setStickFigureThickness(Number(thicknessSlider.value));
            }
        });

        lineColorInput.addEventListener("input", () => {
            const motion = resolvePldMotion();
            if (typeof motion?.setStickFigureColor === "function") {
                motion.setStickFigureColor(lineColorInput.value);
            }
        });

        sphereColorInput.addEventListener("input", () => {
            const motion = resolvePldMotion();
            if (typeof motion?.setSphereColor === "function") {
                motion.setSphereColor(sphereColorInput.value);
            }
        });

        hierarchyColorVisible.addEventListener("change", () => {
            const motion = resolvePldMotion();
            if (typeof motion?.setHierarchySphereColoringEnabled === "function") {
                motion.setHierarchySphereColoringEnabled(hierarchyColorVisible.checked);
            }
        });

        sphereSizeSlider.addEventListener("input", () => {
            const motion = resolvePldMotion();
            sphereSizeValue.innerText = Number(sphereSizeSlider.value).toFixed(2);
            if (typeof motion?.setSphereSize === "function") {
                motion.setSphereSize(Number(sphereSizeSlider.value));
            }
        });

        labelVisible.addEventListener("change", () => {
            const motion = resolvePldMotion();
            if (typeof motion?.setSphereLabelVisible === "function") {
                motion.setSphereLabelVisible(labelVisible.checked);
            }
        });

        labelColorInput.addEventListener("input", () => {
            const motion = resolvePldMotion();
            if (typeof motion?.setSphereLabelColor === "function") {
                motion.setSphereLabelColor(labelColorInput.value);
            }
        });

        outlineVisible.addEventListener("change", () => {
            const motion = resolvePldMotion();
            if (typeof motion?.setSphereOutlineVisible === "function") {
                motion.setSphereOutlineVisible(outlineVisible.checked);
            }
        });

        outlineColorInput.addEventListener("input", () => {
            const motion = resolvePldMotion();
            if (typeof motion?.setSphereOutlineColor === "function") {
                motion.setSphereOutlineColor(outlineColorInput.value);
            }
        });

        syncEnableState();
        dock.appendChild(root);
    }

    return {
        createPldStickFigureToggle,
    };
}
