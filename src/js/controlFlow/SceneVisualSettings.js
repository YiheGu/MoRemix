import { createPaneDockPanel } from "./CollapsiblePanel";

export function createSceneVisualSettings({
    getSkeletalMotion,
    getPaneSettingsDock,
    onSelectionCircleScaleChange,
    onOriginalBoneTrajectoryVisibilityChange,
    onOriginalBoneTrajectoryPointSizeChange,
} = {}) {
    const paneSceneSettings = {
        paneA: createDefaultPaneSettings(),
        paneB: createDefaultPaneSettings(),
    };
    const paneSceneSettingInstances = new Map();
    let syncPaneSceneSettings = true;

    function createDefaultPaneSettings() {
        return {
            showPlane: false,
            backgroundColor: "#ffffff",
            meshOpacity: 1,
            showSkeletonHelper: true,
            selectionCircleRadiusScale: 1,
            showOriginalBoneTrajectory: false,
            originalBoneTrajectoryPointSizeScale: 1,
            lightAzimuth: 16.7,
            isOpen: false,
        };
    }

    function normalizeHexColor(value, fallback = "#ffffff") {
        if (typeof value !== "string") return fallback;
        const hex = value.trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return fallback;
        return hex.toLowerCase();
    }

    function getPaneSceneSettings(paneId) {
        if (!paneSceneSettings[paneId]) {
            paneSceneSettings[paneId] = createDefaultPaneSettings();
        }
        return paneSceneSettings[paneId];
    }

    function getPaneSelectionCircleRadiusScale(paneId = "paneA") {
        const settings = getPaneSceneSettings(paneId);
        const raw = Number(settings.selectionCircleRadiusScale);
        return Number.isFinite(raw) && raw > 0 ? raw : 1;
    }

    function getOriginalBoneTrajectoryPointSizeScale() {
        const raw = Number(getPaneSceneSettings("paneA").originalBoneTrajectoryPointSizeScale);
        return Number.isFinite(raw) && raw > 0 ? raw : 1;
    }

    function applyPaneMeshOpacitySetting(paneId) {
        const settings = getPaneSceneSettings(paneId);
        const raw = Number(settings.meshOpacity);
        const safe = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 1;
        settings.meshOpacity = safe;

        if (paneId === "paneA") {
            getSkeletalMotion?.()?.setMeshOpacity?.(safe);
        }
    }

    function applyPaneSkeletonHelperSetting(paneId) {
        if (paneId !== "paneA") return;
        const settings = getPaneSceneSettings(paneId);
        settings.showSkeletonHelper = settings.showSkeletonHelper !== false;
        getSkeletalMotion?.()?.setSkeletonHelperVisible?.(settings.showSkeletonHelper);
    }

    function applyPaneSceneSettings(paneId, basicScene) {
        if (!basicScene) return;
        const settings = getPaneSceneSettings(paneId);
        settings.backgroundColor = normalizeHexColor(
            settings.backgroundColor || basicScene.getBackgroundColorHex?.(),
            "#ffffff"
        );
        basicScene.setGroundPlaneVisible(settings.showPlane !== false);
        basicScene.setBackgroundColor(settings.backgroundColor);
        basicScene.setDirectionalLightAzimuth?.(settings.lightAzimuth);
        applyPaneMeshOpacitySetting(paneId);
        applyPaneSkeletonHelperSetting(paneId);
    }

    function getPeerPaneId(paneId) {
        return paneId === "paneA" ? "paneB" : "paneA";
    }

    function copyCommonSceneSettings(sourcePaneId, targetPaneId) {
        const source = getPaneSceneSettings(sourcePaneId);
        const target = getPaneSceneSettings(targetPaneId);
        target.showPlane = source.showPlane;
        target.backgroundColor = source.backgroundColor;
        target.lightAzimuth = source.lightAzimuth;
    }

    function syncSceneSettingsToPeer(sourcePaneId) {
        if (!syncPaneSceneSettings) return;
        const targetPaneId = getPeerPaneId(sourcePaneId);
        const targetInstance = paneSceneSettingInstances.get(targetPaneId);
        copyCommonSceneSettings(sourcePaneId, targetPaneId);
        targetInstance?.applyFromSettings?.();
    }

    function createPaneSceneSettingsTab(paneContainer, basicScene, paneId) {
        if (!paneContainer || !basicScene) return;
        const settings = getPaneSceneSettings(paneId);
        applyPaneSceneSettings(paneId, basicScene);

        const dock = getPaneSettingsDock?.(paneContainer);
        if (!dock) return;

        const { root, body: panel } = createPaneDockPanel({
            title: `Scene Settings (${paneId === "paneA" ? "A" : "B"})`,
            initialCollapsed: !settings.isOpen,
            width: "220px",
            minWidth: "190px",
            onToggle: (isOpen) => {
                settings.isOpen = isOpen;
            },
        });

        const syncRow = document.createElement("label");
        syncRow.style.display = "flex";
        syncRow.style.alignItems = "center";
        syncRow.style.gap = "6px";
        syncRow.style.cursor = "pointer";
        const syncInput = document.createElement("input");
        syncInput.type = "checkbox";
        syncInput.checked = syncPaneSceneSettings;
        const syncLabel = document.createElement("span");
        syncLabel.innerText = "Sync Pane A/B";
        syncRow.appendChild(syncInput);
        syncRow.appendChild(syncLabel);
        panel.appendChild(syncRow);

        const planeRow = document.createElement("label");
        planeRow.style.display = "flex";
        planeRow.style.alignItems = "center";
        planeRow.style.gap = "6px";
        planeRow.style.cursor = "pointer";
        const planeVisible = document.createElement("input");
        planeVisible.type = "checkbox";
        planeVisible.checked = settings.showPlane !== false;
        const planeLabel = document.createElement("span");
        planeLabel.innerText = "Show Plane";
        planeRow.appendChild(planeVisible);
        planeRow.appendChild(planeLabel);
        panel.appendChild(planeRow);

        const bgRow = document.createElement("div");
        bgRow.style.display = "flex";
        bgRow.style.alignItems = "center";
        bgRow.style.gap = "8px";
        const bgLabel = document.createElement("span");
        bgLabel.innerText = "Background";
        bgLabel.style.minWidth = "70px";
        const bgInput = document.createElement("input");
        bgInput.type = "color";
        bgInput.value = normalizeHexColor(settings.backgroundColor, "#ffffff");
        bgInput.style.width = "40px";
        bgInput.style.height = "24px";
        bgInput.style.borderRadius = "6px";
        bgInput.style.border = "1px solid rgba(255,255,255,0.22)";
        bgInput.style.padding = "0";
        bgInput.style.background = "transparent";
        bgInput.style.cursor = "pointer";
        const bgValue = document.createElement("span");
        bgValue.innerText = bgInput.value;
        bgValue.style.color = "#bcc5df";
        bgValue.style.fontVariantNumeric = "tabular-nums";
        bgRow.appendChild(bgLabel);
        bgRow.appendChild(bgInput);
        bgRow.appendChild(bgValue);
        panel.appendChild(bgRow);

        const lightAzimuthRow = document.createElement("div");
        lightAzimuthRow.style.display = "flex";
        lightAzimuthRow.style.alignItems = "center";
        lightAzimuthRow.style.gap = "8px";
        const lightAzimuthLabel = document.createElement("span");
        lightAzimuthLabel.innerText = "Light Angle";
        lightAzimuthLabel.style.minWidth = "70px";
        const lightAzimuthInput = document.createElement("input");
        lightAzimuthInput.type = "range";
        lightAzimuthInput.min = "0";
        lightAzimuthInput.max = "360";
        lightAzimuthInput.step = "1";
        lightAzimuthInput.value = String(Number.isFinite(Number(settings.lightAzimuth)) ? Number(settings.lightAzimuth) : 16.7);
        lightAzimuthInput.style.flex = "1";
        const lightAzimuthValue = document.createElement("span");
        lightAzimuthValue.innerText = `${Math.round(Number(lightAzimuthInput.value))}°`;
        lightAzimuthValue.style.minWidth = "38px";
        lightAzimuthValue.style.textAlign = "right";
        lightAzimuthValue.style.color = "#bcc5df";
        lightAzimuthValue.style.fontVariantNumeric = "tabular-nums";
        lightAzimuthRow.appendChild(lightAzimuthLabel);
        lightAzimuthRow.appendChild(lightAzimuthInput);
        lightAzimuthRow.appendChild(lightAzimuthValue);
        panel.appendChild(lightAzimuthRow);

        const meshOpacityRow = document.createElement("div");
        meshOpacityRow.style.display = "flex";
        meshOpacityRow.style.alignItems = "center";
        meshOpacityRow.style.gap = "8px";
        const meshOpacityLabel = document.createElement("span");
        meshOpacityLabel.innerText = "Mesh Opacity";
        meshOpacityLabel.style.minWidth = "70px";
        const meshOpacityInput = document.createElement("input");
        meshOpacityInput.type = "range";
        meshOpacityInput.min = "0";
        meshOpacityInput.max = "1";
        meshOpacityInput.step = "0.05";
        const initialMeshOpacity = Number(settings.meshOpacity);
        meshOpacityInput.value = String(
            Number.isFinite(initialMeshOpacity) ? Math.max(0, Math.min(1, initialMeshOpacity)) : 1
        );
        meshOpacityInput.style.flex = "1";
        const meshOpacityValue = document.createElement("span");
        meshOpacityValue.innerText = Number(meshOpacityInput.value).toFixed(2);
        meshOpacityValue.style.minWidth = "32px";
        meshOpacityValue.style.textAlign = "right";
        meshOpacityValue.style.color = "#bcc5df";
        meshOpacityValue.style.fontVariantNumeric = "tabular-nums";
        meshOpacityRow.appendChild(meshOpacityLabel);
        meshOpacityRow.appendChild(meshOpacityInput);
        meshOpacityRow.appendChild(meshOpacityValue);
        panel.appendChild(meshOpacityRow);

        let skeletonHelperVisible = null;
        if (paneId === "paneA") {
            const skeletonHelperRow = document.createElement("label");
            skeletonHelperRow.style.display = "flex";
            skeletonHelperRow.style.alignItems = "center";
            skeletonHelperRow.style.gap = "6px";
            skeletonHelperRow.style.cursor = "pointer";

            skeletonHelperVisible = document.createElement("input");
            skeletonHelperVisible.type = "checkbox";
            skeletonHelperVisible.checked = settings.showSkeletonHelper !== false;

            const skeletonHelperLabel = document.createElement("span");
            skeletonHelperLabel.innerText = "Show Skeleton";
            skeletonHelperRow.appendChild(skeletonHelperVisible);
            skeletonHelperRow.appendChild(skeletonHelperLabel);
            panel.appendChild(skeletonHelperRow);
        }

        let circleRadiusScaleInput = null;
        let circleRadiusScaleValue = null;
        if (paneId === "paneA") {
            const circleRadiusRow = document.createElement("div");
            circleRadiusRow.style.display = "flex";
            circleRadiusRow.style.alignItems = "center";
            circleRadiusRow.style.gap = "8px";

            const circleRadiusLabel = document.createElement("span");
            circleRadiusLabel.innerText = "Circle Radius";
            circleRadiusLabel.style.minWidth = "70px";

            circleRadiusScaleInput = document.createElement("input");
            circleRadiusScaleInput.type = "range";
            circleRadiusScaleInput.min = "0.2";
            circleRadiusScaleInput.max = "3";
            circleRadiusScaleInput.step = "0.05";
            circleRadiusScaleInput.value = String(getPaneSelectionCircleRadiusScale("paneA"));
            circleRadiusScaleInput.style.flex = "1";

            circleRadiusScaleValue = document.createElement("span");
            circleRadiusScaleValue.innerText = Number(circleRadiusScaleInput.value).toFixed(2);
            circleRadiusScaleValue.style.minWidth = "32px";
            circleRadiusScaleValue.style.textAlign = "right";
            circleRadiusScaleValue.style.color = "#bcc5df";
            circleRadiusScaleValue.style.fontVariantNumeric = "tabular-nums";

            circleRadiusRow.appendChild(circleRadiusLabel);
            circleRadiusRow.appendChild(circleRadiusScaleInput);
            circleRadiusRow.appendChild(circleRadiusScaleValue);
            panel.appendChild(circleRadiusRow);
        }

        let originalBoneTrajectoryVisible = null;
        let originalBoneTrajectoryPointSizeInput = null;
        let originalBoneTrajectoryPointSizeValue = null;
        if (paneId === "paneA") {
            const trajectoryRow = document.createElement("label");
            trajectoryRow.style.display = "flex";
            trajectoryRow.style.alignItems = "center";
            trajectoryRow.style.gap = "6px";
            trajectoryRow.style.cursor = "pointer";

            originalBoneTrajectoryVisible = document.createElement("input");
            originalBoneTrajectoryVisible.type = "checkbox";
            originalBoneTrajectoryVisible.checked = settings.showOriginalBoneTrajectory === true;

            const trajectoryLabel = document.createElement("span");
            trajectoryLabel.innerText = "Show original bone trajectory";
            trajectoryRow.appendChild(originalBoneTrajectoryVisible);
            trajectoryRow.appendChild(trajectoryLabel);
            panel.appendChild(trajectoryRow);

            const pointSizeRow = document.createElement("div");
            pointSizeRow.style.display = "flex";
            pointSizeRow.style.alignItems = "center";
            pointSizeRow.style.gap = "8px";

            const pointSizeLabel = document.createElement("span");
            pointSizeLabel.innerText = "Point Size";
            pointSizeLabel.style.minWidth = "70px";

            originalBoneTrajectoryPointSizeInput = document.createElement("input");
            originalBoneTrajectoryPointSizeInput.type = "range";
            originalBoneTrajectoryPointSizeInput.min = "0.2";
            originalBoneTrajectoryPointSizeInput.max = "3";
            originalBoneTrajectoryPointSizeInput.step = "0.05";
            originalBoneTrajectoryPointSizeInput.value = String(getOriginalBoneTrajectoryPointSizeScale());
            originalBoneTrajectoryPointSizeInput.style.flex = "1";

            originalBoneTrajectoryPointSizeValue = document.createElement("span");
            originalBoneTrajectoryPointSizeValue.innerText = Number(originalBoneTrajectoryPointSizeInput.value).toFixed(2);
            originalBoneTrajectoryPointSizeValue.style.minWidth = "32px";
            originalBoneTrajectoryPointSizeValue.style.textAlign = "right";
            originalBoneTrajectoryPointSizeValue.style.color = "#bcc5df";
            originalBoneTrajectoryPointSizeValue.style.fontVariantNumeric = "tabular-nums";

            pointSizeRow.appendChild(pointSizeLabel);
            pointSizeRow.appendChild(originalBoneTrajectoryPointSizeInput);
            pointSizeRow.appendChild(originalBoneTrajectoryPointSizeValue);
            panel.appendChild(pointSizeRow);
        }

        planeVisible.addEventListener("change", () => {
            settings.showPlane = planeVisible.checked;
            basicScene.setGroundPlaneVisible(settings.showPlane);
            syncSceneSettingsToPeer(paneId);
        });

        bgInput.addEventListener("input", () => {
            settings.backgroundColor = normalizeHexColor(bgInput.value, "#ffffff");
            bgValue.innerText = settings.backgroundColor;
            basicScene.setBackgroundColor(settings.backgroundColor);
            syncSceneSettingsToPeer(paneId);
        });

        lightAzimuthInput.addEventListener("input", () => {
            settings.lightAzimuth = Number(lightAzimuthInput.value);
            lightAzimuthValue.innerText = `${Math.round(settings.lightAzimuth)}°`;
            basicScene.setDirectionalLightAzimuth?.(settings.lightAzimuth);
            syncSceneSettingsToPeer(paneId);
        });

        meshOpacityInput.addEventListener("input", () => {
            const nextOpacity = Number(meshOpacityInput.value);
            settings.meshOpacity = Number.isFinite(nextOpacity) ? Math.max(0, Math.min(1, nextOpacity)) : 1;
            meshOpacityValue.innerText = settings.meshOpacity.toFixed(2);
            applyPaneMeshOpacitySetting(paneId);
        });

        if (skeletonHelperVisible) {
            skeletonHelperVisible.addEventListener("change", () => {
                settings.showSkeletonHelper = skeletonHelperVisible.checked;
                applyPaneSkeletonHelperSetting(paneId);
            });
        }

        if (circleRadiusScaleInput && circleRadiusScaleValue) {
            circleRadiusScaleInput.addEventListener("input", () => {
                settings.selectionCircleRadiusScale = Math.max(0.05, Number(circleRadiusScaleInput.value) || 1);
                circleRadiusScaleValue.innerText = settings.selectionCircleRadiusScale.toFixed(2);
                onSelectionCircleScaleChange?.();
            });
        }

        if (originalBoneTrajectoryVisible) {
            originalBoneTrajectoryVisible.addEventListener("change", () => {
                settings.showOriginalBoneTrajectory = originalBoneTrajectoryVisible.checked;
                onOriginalBoneTrajectoryVisibilityChange?.(settings.showOriginalBoneTrajectory);
            });
        }

        if (originalBoneTrajectoryPointSizeInput && originalBoneTrajectoryPointSizeValue) {
            originalBoneTrajectoryPointSizeInput.addEventListener("input", () => {
                settings.originalBoneTrajectoryPointSizeScale = Math.max(
                    0.05,
                    Number(originalBoneTrajectoryPointSizeInput.value) || 1
                );
                originalBoneTrajectoryPointSizeValue.innerText = settings.originalBoneTrajectoryPointSizeScale.toFixed(2);
                onOriginalBoneTrajectoryPointSizeChange?.();
            });
        }

        const applyFromSettings = () => {
            planeVisible.checked = settings.showPlane !== false;
            bgInput.value = normalizeHexColor(settings.backgroundColor, "#ffffff");
            bgValue.innerText = bgInput.value;
            basicScene.setGroundPlaneVisible(settings.showPlane !== false);
            basicScene.setBackgroundColor(bgInput.value);
            lightAzimuthInput.value = String(Number.isFinite(Number(settings.lightAzimuth)) ? Number(settings.lightAzimuth) : 16.7);
            lightAzimuthValue.innerText = `${Math.round(Number(lightAzimuthInput.value))}°`;
            basicScene.setDirectionalLightAzimuth?.(Number(lightAzimuthInput.value));
        };

        const setSyncChecked = (checked) => {
            syncInput.checked = checked;
        };

        syncInput.addEventListener("change", () => {
            syncPaneSceneSettings = syncInput.checked;
            paneSceneSettingInstances.forEach((instance) => instance.setSyncChecked?.(syncPaneSceneSettings));
            if (syncPaneSceneSettings) syncSceneSettingsToPeer(paneId);
        });

        paneSceneSettingInstances.set(paneId, {
            applyFromSettings,
            setSyncChecked,
        });

        dock.appendChild(root);
    }

    return {
        createPaneSceneSettingsTab,
        getPaneSelectionCircleRadiusScale,
        getOriginalBoneTrajectoryPointSizeScale,
    };
}
