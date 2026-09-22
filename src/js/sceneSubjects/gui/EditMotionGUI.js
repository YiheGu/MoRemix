import { deepClone } from "../functions/deepClone";
import { createInlineMotionPopup } from "./MotionPopupCore";
import { GUI } from "dat.gui";

function buildDefaultParams() {
    return {
        referenceMode: "mean",
        AmplitudeScale: 1,
        PhaseScale: 0,
        MPAmp: {
            ampScale: 1,
            meanAdd: 0,
            filter_type: "none",
            f1: 1,
            f2: 2,
            transition_bw: 0,
            attenuation_ratio: 0.001,
        },
        V3Ratio: 1,
        V3MeanAdd: 0,
        PhaseShift: 0,
        FrequencyScale: 1,
        FrequencyMaxHz: 5,
        FrequencyMinCorrelation: 0.5,
        KeepOriginalLength: true,
        scale: true,
        plotScale: {
            angle: true,
            spectrum: true,
            fourier: true,
            v3: true,
        },
    };
}

function createGuiContainer(mainGuiTo) {
    const gui = new GUI({ autoPlace: false });
    gui.domElement.classList.add("pane-motion-gui");
    gui.domElement.style.position = "absolute";
    gui.domElement.style.left = "12px";
    gui.domElement.style.top = "12px";

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "pane-motion-gui-toggle";
    gui.domElement.prepend(toggleBtn);

    const setCollapsed = (collapsed) => {
        gui.domElement.classList.toggle("is-collapsed", !!collapsed);
        toggleBtn.innerText = "Bone List";
        toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    };
    toggleBtn.addEventListener("click", () => {
        const collapsed = gui.domElement.classList.contains("is-collapsed");
        setCollapsed(!collapsed);
    });
    setCollapsed(false);

    const actionList = document.createElement("div");
    actionList.className = "pane-motion-action-list";
    gui.domElement.appendChild(actionList);

    mainGuiTo.appendChild(gui.domElement);
    return gui;
}

function createGeneralProxy() {
    return {
        id: "all",
        name: "All",
        Ori: { MPAnglePlot: "", MPSpectrumPlot: "" },
    };
}

function createPopupOpenButton(container, label, onClick, extraClass = "") {
    if (!container) return null;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `pane-motion-action-btn ${extraClass}`.trim();
    btn.innerText = label;
    btn.title = label;
    btn.addEventListener("click", onClick);
    container.appendChild(btn);
    return btn;
}

function createPopupOptions(popupTo, popupKind, callbacks, item, extraOptions = {}) {
    return {
        ...(popupTo ? { mountTarget: popupTo } : {}),
        popupKind,
        onShow: () => callbacks.onPopupShow?.(item),
        onFocus: () => callbacks.onPopupFocus?.(item),
        onHide: () => callbacks.onPopupHide?.(item),
        onAfterGenerate: () => callbacks.onAfterGenerate?.(item),
        ...extraOptions,
    };
}

function createSkeletonPopup(
    bone,
    skeletalMotion,
    pldMotion,
    allParams,
    oriAllParams,
    popupOptions = {}
) {
    const { mountTarget } = popupOptions;
    if (!mountTarget) return null;
    return createInlineMotionPopup({
        entity: bone,
        paramsMap: allParams,
        originalParamsMap: oriAllParams,
        mountTarget,
        popupKindDefault: "skeleton",
        popupEvents: popupOptions,
        titleAll: "All Bones",
        titleItem: (item) => `Bone ${item.id} - ${item.name}`,
        generalTargetSelectorOptions: popupOptions.generalTargetSelectorOptions,
        onGenerateSingle: async ({ entity, paramsMap, api }) => {
            await skeletalMotion.generateNewClip(paramsMap, entity, api);
            pldMotion?.setClipWithSource?.(skeletalMotion, false);
            popupOptions.onAfterGenerate?.(entity);
        },
        onInitializeSingle: async ({ entity, paramsMap, api }) => {
            await skeletalMotion.generateNewClip(paramsMap, entity, api);
            pldMotion?.setClipWithSource?.(skeletalMotion, false);
        },
        onRenew: ({ entity, paramsMap, input }) => {
            input.value = 1;
            paramsMap[entity.id].AmplitudeScale = 1;
        },
    });
}

function createPldPopup(pld, pldMotion, allParams, oriAllParams, popupOptions = {}) {
    const { mountTarget } = popupOptions;
    if (!mountTarget) return null;
    return createInlineMotionPopup({
        entity: pld,
        paramsMap: allParams,
        originalParamsMap: oriAllParams,
        mountTarget,
        popupKindDefault: "pld",
        popupEvents: popupOptions,
        titleAll: "All PLDs",
        titleItem: (item) => `PLD ${item.id} - ${item.name}`,
        generalTargetSelectorOptions: popupOptions.generalTargetSelectorOptions,
        imageStyleOptions: {
            displayBlock: true,
            autoHeight: true,
            minWidth: "420px",
        },
        zoomWrapStyleOptions: {
            padding: "6px",
            boxSizing: "border-box",
        },
        onGenerateSingle: async ({ entity, paramsMap, api }) => {
            await pldMotion.generateNewClip(paramsMap, entity, api);
            popupOptions.onAfterGenerate?.(entity);
        },
        onInitializeSingle: async ({ entity, paramsMap, api }) => {
            await pldMotion.generateNewClip(paramsMap, entity, api);
        },
    });
}

function createEditMotionGUICore({
    mainGuiTo,
    popupTo,
    callbacks = {},
    sourceInfoRef,
    infoListKey,
    checkMethodName,
    checkLabel,
    noInfoMessage,
    popupKind,
    itemFolderLabel,
    createPopup,
    prepareGenerateForItem,
    finalizeInitializeForGeneral,
    onFrequencyEstimateConfigChange,
    itemFilter,
}) {
    const gui = createGuiContainer(mainGuiTo);
    const allParams = {};
    const oriAllParams = {};
    const allPopups = {};

    let isCheckButtonAdded = false;
    let resetAllParamsToDefaultImpl = () => {};

    const getItems = () => {
        const rawItems = sourceInfoRef?.[infoListKey] || [];
        if (typeof itemFilter !== "function") return rawItems;
        return rawItems.filter((item, index) => itemFilter(item, index, rawItems));
    };
    const actionList = gui.domElement.querySelector(".pane-motion-action-list");

    function showCheckButton() {
        if (isCheckButtonAdded) return;
        isCheckButtonAdded = true;
        const checkInfo = gui
            .add(sourceInfoRef, checkMethodName)
            .name(checkLabel)
            .onChange(() => {
                addManipulationGUI();
                checkInfo.onChange(() => {}); // Do once
            });
    }

    function addManipulationGUI() {
        const items = getItems();
        if (actionList) actionList.innerHTML = "";
        if (!items.length) {
            console.log(noInfoMessage);
            if (actionList) {
                const empty = document.createElement("div");
                empty.className = "pane-motion-empty";
                empty.innerText = noInfoMessage;
                actionList.appendChild(empty);
            }
            return;
        }

        const normalizeItemId = (value) => String(value);
        const selectedItemIdSet = new Set(items.map((item) => normalizeItemId(item.id)));
        const isItemSelected = (itemOrId) => {
            const id = itemOrId && typeof itemOrId === "object" ? itemOrId.id : itemOrId;
            return selectedItemIdSet.has(normalizeItemId(id));
        };
        const setSelectedItems = (ids = []) => {
            selectedItemIdSet.clear();
            ids.forEach((id) => selectedItemIdSet.add(normalizeItemId(id)));
        };

        items.forEach((item) => {
            const params = buildDefaultParams();
            allParams[item.id] = params;
            oriAllParams[item.id] = deepClone(params);
        });

        const syncGeneralPopupParams = (sourceParams) => {
            const params = deepClone(sourceParams);
            items.forEach((item) => {
                if (!isItemSelected(item.id)) return;
                allParams[item.id] = deepClone(params);
                allPopups[item.id]?.setParams?.(params);
            });
        };

        const forEachSelectedItemPopup = (handler) => {
            items.forEach((item) => {
                if (!isItemSelected(item.id)) return;
                const popupApi = allPopups[item.id];
                if (!popupApi) return;
                handler(item, popupApi);
            });
        };

        const triggerGeneralGenerate = async () => {
            const sourceParams = deepClone(allParams.all);
            const selectedPopups = [];
            forEachSelectedItemPopup((item, popupApi) => {
                prepareGenerateForItem?.({ item, popupApi, allParams, sourceParams });
                selectedPopups.push(popupApi);
            });
            if (popupKind === "skeleton") {
                await selectedPopups[0]?.generate?.();
                return;
            }
            for (const popupApi of selectedPopups) await popupApi?.generate?.();
        };

        const triggerGeneralInitialize = () => {
            forEachSelectedItemPopup((item, popupApi) => {
                if (popupApi?.initialize) {
                    popupApi.initialize();
                    return;
                }
                allParams[item.id] = deepClone(oriAllParams[item.id]);
            });
            finalizeInitializeForGeneral?.({ allParams, oriAllParams, allPopups });
        };

        resetAllParamsToDefaultImpl = () => {
            items.forEach((item) => {
                const popupApi = allPopups[item.id];
                if (popupApi?.initialize) {
                    popupApi.initialize();
                    return;
                }
                allParams[item.id] = deepClone(oriAllParams[item.id]);
            });
            finalizeInitializeForGeneral?.({ allParams, oriAllParams, allPopups });
        };

        const generalProxy = createGeneralProxy();
        const generalParams = buildDefaultParams();
        allParams[generalProxy.id] = generalParams;
        oriAllParams[generalProxy.id] = deepClone(generalParams);
        const generalTargetSelectorOptions = {
            buttonText: popupKind === "skeleton" ? "Select Bones" : "Select PLDs",
            items: items.map((item) => ({
                id: normalizeItemId(item.id),
                label: itemFolderLabel(item),
            })),
            getSelectedIds: () => Array.from(selectedItemIdSet),
            onSelectionChange: (selectedIds) => {
                setSelectedItems(selectedIds);
            },
        };

        const generalPopupApi = createPopup(
            generalProxy,
            allParams,
            oriAllParams,
            createPopupOptions(popupTo, popupKind, callbacks, generalProxy, {
                onBroadcastParams: (params) => syncGeneralPopupParams(params),
                onGenerateAll: () => triggerGeneralGenerate(),
                onInitializeAll: () => triggerGeneralInitialize(),
                onFrequencyEstimateConfigChange: (config) => {
                    items.forEach((item) => {
                        if (!isItemSelected(item.id)) return;
                        onFrequencyEstimateConfigChange?.(item, config);
                    });
                },
                generalTargetSelectorOptions,
            })
        );
        generalPopupApi.hide();
        allPopups[generalProxy.id] = generalPopupApi;
        createPopupOpenButton(actionList, "General Manipulation", () => generalPopupApi.show(), "is-all");

        items.forEach((item) => {
            const popupApi = createPopup(
                item,
                allParams,
                oriAllParams,
                createPopupOptions(popupTo, popupKind, callbacks, item, {
                    onFrequencyEstimateConfigChange: (config) =>
                        onFrequencyEstimateConfigChange?.(item, config),
                })
            );
            popupApi.hide();
            allPopups[item.id] = popupApi;
            createPopupOpenButton(actionList, itemFolderLabel(item), () => popupApi.show());
        });
    }

    return {
        gui,
        allPopups,
        showCheckButton,
        addManipulationGUI,
        generateAllItems: async () => {
            const itemPopups = Object.entries(allPopups)
                .filter(([id, popupApi]) => id !== "all" && popupApi?.generate)
                .map(([, popupApi]) => popupApi);
            if (popupKind === "skeleton") {
                await itemPopups[0]?.generate?.();
                return;
            }
            for (const popupApi of itemPopups) await popupApi.generate();
        },
        initializeAllItems: () => {
            Object.entries(allPopups).forEach(([id, popupApi]) => {
                if (id !== "all") popupApi?.initialize?.();
            });
        },
        destroy: () => {
            Object.values(allPopups).forEach((popupApi) => popupApi?.destroy?.());
            gui.destroy?.();
        },
        resetAllParamsToDefault: (...args) => resetAllParamsToDefaultImpl(...args),
    };
}

export function createEditSkeletalMotionGUI(
    skeletalMotion,
    pldMotion,
    mainGuiTo,
    popupTo,
    callbacks = {}
) {
    const core = createEditMotionGUICore({
        mainGuiTo,
        popupTo,
        callbacks,
        sourceInfoRef: skeletalMotion,
        infoListKey: "BoneInfo",
        checkMethodName: "checkBoneInfo",
        checkLabel: "Check BoneInfo",
        noInfoMessage: "No bone info available",
        popupKind: "skeleton",
        itemFolderLabel: (bone) => `Bone ${bone.id} - ${bone.name}`,
        createPopup: (bone, allParams, oriAllParams, popupOptions) =>
            createSkeletonPopup(
                bone,
                skeletalMotion,
                pldMotion,
                allParams,
                oriAllParams,
                popupOptions
            ),
        prepareGenerateForItem: ({ item, popupApi, allParams, sourceParams }) => {
            allParams[item.id] = deepClone(sourceParams);
            popupApi?.setParams?.(sourceParams);
        },
        finalizeInitializeForGeneral: ({ allParams, oriAllParams, allPopups }) => {
            const generalDefaults = deepClone(oriAllParams.all);
            allParams.all = generalDefaults;
            allPopups.all?.setParams?.(generalDefaults);
        },
        onFrequencyEstimateConfigChange: (bone, config) =>
            skeletalMotion.setBoneFrequencyEstimateConfig(bone.id, config),
        itemFilter: (bone) => Number(bone?.parent) !== 0,
    });

    return {
        gui: core.gui,
        allPopups: core.allPopups,
        showCheckBoneButton: core.showCheckButton,
        addBoneManipulationGUI: core.addManipulationGUI,
        generateAllBoneClips: core.generateAllItems,
        initializeAllBones: core.initializeAllItems,
        destroy: core.destroy,
        resetAllBoneParamsToDefault: core.resetAllParamsToDefault,
    };
}

export function createEditPLDMotionGUI(
    pldMotion,
    mainGuiTo,
    popupTo,
    callbacks = {},
    options = {}
) {
    const hiddenPldIdSet = new Set(
        Array.isArray(options?.hiddenPldIds)
            ? options.hiddenPldIds
                .map((id) => Number(id))
                .filter((id) => Number.isFinite(id))
            : []
    );
    const core = createEditMotionGUICore({
        mainGuiTo,
        popupTo,
        callbacks,
        sourceInfoRef: pldMotion,
        infoListKey: "pldInfo",
        checkMethodName: "checkPLDInfo",
        checkLabel: "Check PLD Info",
        noInfoMessage: "No PLD information available",
        popupKind: "pld",
        itemFolderLabel: (pld) => `PLD ${pld.id} - ${pld.name}`,
        createPopup: (pld, allParams, oriAllParams, popupOptions) =>
            createPldPopup(pld, pldMotion, allParams, oriAllParams, popupOptions),
        onFrequencyEstimateConfigChange: (pld, config) =>
            pldMotion.setPldFrequencyEstimateConfig(pld.id, config),
        itemFilter: (pld) => !hiddenPldIdSet.has(Number(pld?.id))
    });

    return {
        gui: core.gui,
        allPopups: core.allPopups,
        showCheckPldButton: core.showCheckButton,
        addPldManipulationGUI: core.addManipulationGUI,
        generateAllPldClips: core.generateAllItems,
        initializeAllPlds: core.initializeAllItems,
        destroy: core.destroy,
        resetAllPldParamsToDefault: core.resetAllParamsToDefault,
    };
}
