import { GUI } from 'dat.gui';
import { createBatchWorkflow } from './batchWorkflow/BatchWorkflow';
import { deepClone } from './sceneSubjects/functions/deepClone';
import { exportGltf } from './sceneSubjects/functions/exportGltf';
import { createFileImportModal } from "./sceneSubjects/gui/FileImportModal";
import { createWorkspaceLayout } from "./layout/WorkspaceLayout";
import { createExportOptionModal } from "./sceneSubjects/gui/ExportOptionModal";
import { createEditPLDMotionGUI, createEditSkeletalMotionGUI } from './sceneSubjects/gui/EditMotionGUI';
import { createPldBoneBindGUI } from './sceneSubjects/gui/PldBoneBindGUI';
import { createPLDBindParentModal } from './sceneSubjects/gui/PLDBindParentModal';
import { showWorkspaceLoadingOverlay } from './sceneSubjects/gui/WorkspaceLoadingOverlay';
import { SkeletalMotion } from './sceneSubjects/SkeletalMotion';
import { PLDMotion } from './sceneSubjects/PLDMotion';
import { createFileFormatSelectModal } from './sceneSubjects/gui/FileFomatSelectModal';
import { BasicScene } from './sceneSubjects/BasicScene';
import { createPlaybackController } from './controlFlow/PlaybackController';
import { createSelectionVisualizationController } from './controlFlow/SelectionVisualizationController';
import { createExportController } from './controlFlow/ExportController';
import { createClipRepeatController } from './controlFlow/ClipRepeatController';
import { createPLDVisualSettings } from './controlFlow/PLDVisualSettings';
import { createSceneVisualSettings } from './controlFlow/SceneVisualSettings';
import { createPaneSceneAngleUI } from './controlFlow/PaneSceneAngleUI';
import { createMPVisualController } from './controlFlow/MPVisualController';
import { createV3VisualController } from './controlFlow/V3VisualController';

export function ControlFlow(sceneManager) {
    // ============= General GUI parameters =============
    let formatSelectModal;
    let importModal;
    let pldMatchModal;
    let pldBindParentModal;
    let motionGUI;

    let pendingAnimationFile = null;
    let workspaceLayout = null;
    let paneCPopupList = null;
    let paneAScene;
    let paneBScene;
    let exportOptionModal = null;
    const paneResizeCleanups = [];
    const paneAngleUiCleanups = [];
    const mpVisualCleanups = [];
    let mpVisualController = null;
    let v3VisualController = null;

    let sceneContexts = {}; // Store scene contexts for video recording
    const paneSettingsDockByContainer = new WeakMap();
    let typeSelection;
    let animRig;
    let skeletalMotion;
    let pldMotion;
    let pldBoneBindings;
    let allBoneParams = {};
    const oriAllBoneParams = {};

    let selectionVizController = null;
    let batchWorkflow = null;
    let applyingHistoryState = false;
    let importSessionId = 0;

    const handleWorkspaceShortcut = (event) => {
        if (!event.ctrlKey || event.altKey || event.metaKey) return;
        if (!workspaceLayout?.element?.isConnected || typeSelection !== "skeleton") return;
        const key = String(event.key || "").toLowerCase();
        if (key === "s") {
            event.preventDefault();
            motionGUI?.generateAllBoneClips?.();
        } else if (key === "i") {
            event.preventDefault();
            motionGUI?.initializeAllBones?.();
        }
    };
    document.addEventListener("keydown", handleWorkspaceShortcut);

    const pldVisualSettings = createPLDVisualSettings({
        getPldMotion: () => pldMotion,
        getPaneSettingsDock,
    });
    const sceneVisualSettings = createSceneVisualSettings({
        getSkeletalMotion: () => skeletalMotion,
        getPaneSettingsDock,
        onSelectionCircleScaleChange: () => {
            selectionVizController?.refresh?.();
        },
        onOriginalBoneTrajectoryVisibilityChange: (visible) => {
            selectionVizController?.setShowOriginalBoneTrajectory?.(visible);
        },
        onOriginalBoneTrajectoryPointSizeChange: () => {
            selectionVizController?.refresh?.();
        },
    });
    const { createPldStickFigureToggle } = pldVisualSettings;
    const {
        createPaneSceneSettingsTab,
        getPaneSelectionCircleRadiusScale,
        getOriginalBoneTrajectoryPointSizeScale,
    } = sceneVisualSettings;

    const playbackController = createPlaybackController({
        getTypeSelection: () => typeSelection,
        getSkeletalMotion: () => skeletalMotion,
        getPldMotion: () => pldMotion,
    });
    selectionVizController = createSelectionVisualizationController({
        getPaneAScene: () => paneAScene,
        getPaneCPopupList: () => paneCPopupList,
        getTypeSelection: () => typeSelection,
        getSkeletalMotion: () => skeletalMotion,
        getPldMotion: () => pldMotion,
        getPaneSelectionCircleRadiusScale,
        getOriginalBoneTrajectoryPointSizeScale,
    });
    const exportController = createExportController({
        sceneManager,
        playback: playbackController,
        getSceneContexts: () => sceneContexts,
        getSkeletalMotion: () => skeletalMotion,
        getPldMotion: () => pldMotion,
        onAfterFrameUpdate: () => {},
    });
    const clipRepeatController = createClipRepeatController({
        getTypeSelection: () => typeSelection,
        getSkeletalMotion: () => skeletalMotion,
        getPldMotion: () => pldMotion,
        getMotionGUI: () => motionGUI,
        playback: playbackController,
    });

    if (sceneManager) {
        sceneManager.addExternalUpdate((delta) => {
            if (!exportController.isRecording() && !playbackController.isPaused() && !playbackController.isScrubbing()) {
                playbackController.advance(delta);
            }
            selectionVizController.update();
            mpVisualController?.update?.();
            v3VisualController?.update?.();
            playbackController.updateUI();
        });
    }

    // Scene Configuration
    let sceneConfig = {
        skeleton: {
        position: { x: 0, y: 0, z: 0 },
        scale: { x: 10, y: 10, z: 10 },
        rotation: { x: 0, y: -Math.PI / 2, z: 0 },
        },
        pld: {
        position: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        rotation: { x: 0, y: 0, z: 0 },
        },
    };

    function getPaneSettingsDock(paneContainer) {
        if (!paneContainer) return null;
        const existing = paneSettingsDockByContainer.get(paneContainer);
        if (existing && existing.isConnected) return existing;

        const dock = document.createElement("div");
        dock.className = "pane-no-fullscreen-toggle";
        dock.style.position = "absolute";
        dock.style.right = "12px";
        dock.style.top = "12px";
        dock.style.zIndex = "7";
        dock.style.display = "flex";
        dock.style.flexDirection = "column";
        dock.style.alignItems = "flex-end";
        dock.style.gap = "8px";
        paneContainer.appendChild(dock);
        paneSettingsDockByContainer.set(paneContainer, dock);
        return dock;
    }

    function buildPopupCallbacks(kind) {
        return {
            onPopupShow: (item) => selectionVizController.onPopupShow(kind, item),
            onPopupFocus: (item) => selectionVizController.onPopupFocus(kind, item),
            onPopupHide: (item) => selectionVizController.onPopupHide(kind, item),
            onAfterGenerate: () => {
                if (!playbackController.isPaused()) return;
                playbackController.seekByTime(playbackController.getCurrentTime(), { updateUI: true, wrap: false });
            },
        };
    }

    function mountPldViewToPane(sceneRef, paneContainer, paneId, analyzePldInfo = false) {
        if (!sceneRef?.scene || !paneContainer || !pldMotion) return;
        pldMotion.setPldInfoAnalysisEnabled?.(analyzePldInfo);
        pldMotion.configureAnimation(sceneRef.scene);
        createPldStickFigureToggle(paneContainer, paneId);
    }

    function setupPaneAMotionGUI(AScene, paneAContainer) {
        if (typeSelection === "skeleton") {
            skeletalMotion.configureAnimation(AScene.scene);
            motionGUI = createEditSkeletalMotionGUI(
                skeletalMotion,
                pldMotion,
                paneAContainer,
                paneCPopupList,
                buildPopupCallbacks("skeleton")
            );
            motionGUI.addBoneManipulationGUI?.();
            return;
        }

        if (typeSelection === "pld") {
            mountPldViewToPane(AScene, paneAContainer, "paneA", true);
            const hiddenPldIds = getFirstLayerPldIdsForUi();
            motionGUI = createEditPLDMotionGUI(
                pldMotion,
                paneAContainer,
                paneCPopupList,
                buildPopupCallbacks("pld"),
                { hiddenPldIds }
            );
            motionGUI.addPldManipulationGUI?.();
        }
    }

    function getFirstLayerPldIdsForUi() {
        if (typeSelection !== "pld" || !Array.isArray(pldMotion?.pldInfo)) return [];

        const globalOrder = pldMotion.pldInfo.updateOrder;
        if (Array.isArray(globalOrder) && Array.isArray(globalOrder[0])) {
            return globalOrder[0];
        }

        const withOrder = pldMotion.pldInfo.find(
            (pld) => Array.isArray(pld?.updateOrder) && Array.isArray(pld.updateOrder[0])
        );
        if (withOrder) {
            return withOrder.updateOrder[0];
        }

        return [];
    }

    function buildPldUpdateOrderByParent(pldInfo = []) {
        if (!Array.isArray(pldInfo) || pldInfo.length < 1) return [];

        const infoById = new Map();
        const orderedIds = [];
        pldInfo.forEach((pld) => {
            const id = Number(pld?.id);
            if (!Number.isFinite(id) || id <= 0 || infoById.has(id)) return;
            infoById.set(id, pld);
            orderedIds.push(id);
        });

        if (orderedIds.length < 1) return [];

        const parentById = new Map();
        orderedIds.forEach((id) => {
            const parentId = Number(infoById.get(id)?.parent);
            parentById.set(id, Number.isFinite(parentId) ? parentId : 0);
        });

        const remaining = new Set(orderedIds);
        const updateOrder = [];

        const takeLayer = (predicate) => {
            const layer = [];
            orderedIds.forEach((id) => {
                if (!remaining.has(id)) return;
                if (!predicate(id)) return;
                remaining.delete(id);
                layer.push(id);
            });
            return layer;
        };

        const firstLayer = takeLayer((id) => {
            const parentId = parentById.get(id);
            return parentId === 0;
        });
        if (firstLayer.length > 0) {
            updateOrder.push(firstLayer);
        }

        let previousLayer = firstLayer;
        while (remaining.size > 0 && previousLayer.length > 0) {
            const previousSet = new Set(previousLayer);
            const nextLayer = takeLayer((id) => previousSet.has(parentById.get(id)));
            if (nextLayer.length < 1) break;
            updateOrder.push(nextLayer);
            previousLayer = nextLayer;
        }

        if (remaining.size > 0) {
            const unresolvedLayer = takeLayer(() => true);
            if (unresolvedLayer.length > 0) updateOrder.push(unresolvedLayer);
            console.warn("Some PLD parent relations are not reachable from root; appended unresolved IDs:", unresolvedLayer);
        }

        return updateOrder;
    }

    function applyPldUpdateOrderFromParents() {
        if (!Array.isArray(pldMotion?.pldInfo) || pldMotion.pldInfo.length < 1) return;
        const updateOrder = buildPldUpdateOrderByParent(pldMotion.pldInfo);
        if (updateOrder.length < 1) return;

        pldMotion.pldInfo.updateOrder = updateOrder;
        pldMotion.pldInfo.forEach((pld) => {
            pld.updateOrder = updateOrder;
        });
        pldMotion.applySphereVisuals?.();
        console.log("PLD Update Order auto-generated:", updateOrder);
    }

    function setIntroVisible(isVisible) {
        if (isVisible) {
            window.BRMIntroPage?.show?.();
        } else {
            window.BRMIntroPage?.hide?.();
        }
    }

    function isImportFlowPage(page) {
        return page === "import" || page === "pld-bind" || page === "workspace";
    }

    function getImportSessionState() {
        return { importSessionId };
    }

    function setBrowserPage(page, data = {}, { replace = false } = {}) {
        if (applyingHistoryState) return;
        const state = { brmPage: page, ...data };
        if (isImportFlowPage(page) && state.importSessionId === undefined) {
            Object.assign(state, getImportSessionState());
        }
        const method = replace ? "replaceState" : "pushState";
        history[method](state, "", location.pathname + location.search);
    }

    function hideToolPages() {
        formatSelectModal?.hide?.();
        importModal?.hide?.();
        pldMatchModal?.hide?.();
        pldBindParentModal?.hide?.();
        batchWorkflow?.hide?.();
        workspaceLayout?.hide?.();
    }

    function showFormatPage({ updateHistory = true, replace = false } = {}) {
        setIntroVisible(false);
        typeSelection = null;
        hideToolPages();
        formatSelectModal?.show?.();
        if (updateHistory) setBrowserPage("format", {}, { replace });
    }

    function showBatchPage({ updateHistory = true, batchView = "list" } = {}) {
        setIntroVisible(false);
        hideToolPages();
        if (!batchWorkflow) {
            batchWorkflow = createBatchWorkflow({
                sceneManager,
                onClose: () => {
                    batchWorkflow?.destroy();
                    batchWorkflow = null;
                    showFormatPage();
                },
                onViewChange: (view) => {
                    setBrowserPage("batch", { batchView: view || "list" });
                },
            });
        }
        batchWorkflow.show(batchView, { updateHistory: false });
        if (updateHistory) setBrowserPage("batch", { batchView });
    }

    function showImportPage(selection = typeSelection, { updateHistory = true } = {}) {
        if (!selection) {
            showFormatPage({ updateHistory });
            return;
        }

        setIntroVisible(false);
        hideToolPages();
        typeSelection = selection;
        if (!importModal || importModal.getTypeSelection?.() !== selection) {
            importModal?.destroy?.();
            setImportModal(false);
        }
        importModal?.show?.();
        if (updateHistory) setBrowserPage("import", { typeSelection });
    }

    function showPldBindPage({ updateHistory = true } = {}) {
        setIntroVisible(false);
        hideToolPages();
        if (pldBindParentModal) {
            pldBindParentModal.show();
            if (updateHistory) setBrowserPage("pld-bind", { typeSelection });
            return;
        }
        showImportPage(typeSelection, { updateHistory });
    }

    function showWorkspacePage({ updateHistory = true } = {}) {
        setIntroVisible(false);
        hideToolPages();
        if (workspaceLayout) {
            workspaceLayout.show();
            workspaceLayout.refresh?.();
            triggerResizeAdjustments();
        } else if ((typeSelection === "skeleton" && skeletalMotion) || (typeSelection === "pld" && pldMotion)) {
            initializeWorkspace(false);
        } else {
            showFormatPage({ updateHistory });
            return;
        }
        if (updateHistory) setBrowserPage("workspace", { typeSelection });
    }

    function applyBrowserPage(state = history.state) {
        applyingHistoryState = true;
        try {
            const page = state?.brmPage || "intro";
            if (isStaleImportFlowState(page, state)) {
                redirectStaleImportFlowState(state);
                return;
            }
            if (page === "intro") {
                hideToolPages();
                setIntroVisible(true);
                return;
            }
            if (page === "format") {
                showFormatPage({ updateHistory: false });
                return;
            }
            if (page === "batch") {
                showBatchPage({ updateHistory: false, batchView: state.batchView || "list" });
                return;
            }
            if (page === "import") {
                showImportPage(state.typeSelection, { updateHistory: false });
                return;
            }
            if (page === "pld-bind") {
                typeSelection = state.typeSelection || typeSelection;
                showPldBindPage({ updateHistory: false });
                return;
            }
            if (page === "workspace") {
                typeSelection = state.typeSelection || typeSelection;
                showWorkspacePage({ updateHistory: false });
            }
        } finally {
            applyingHistoryState = false;
        }
    }

    function isStaleImportFlowState(page, state) {
        if (!isImportFlowPage(page)) return false;
        const stateSession = Number(state?.importSessionId);
        const hasSession = Number.isFinite(stateSession);
        const needsLoadedImport = page === "workspace" || page === "pld-bind";
        return (hasSession || needsLoadedImport) && stateSession !== importSessionId;
    }

    function redirectStaleImportFlowState(state = {}) {
        const selection = typeSelection || state.typeSelection || null;
        resetImportedMotions();

        if (selection) {
            typeSelection = selection;
            showImportPage(selection, { updateHistory: false });
            history.replaceState(
                { brmPage: "import", typeSelection: selection, ...getImportSessionState() },
                "",
                location.pathname + location.search
            );
            return;
        }

        showFormatPage({ updateHistory: false });
        history.replaceState({ brmPage: "format" }, "", location.pathname + location.search);
    }

    window.addEventListener("popstate", (event) => {
        applyBrowserPage(event.state);
    });
    window.BRMToolNavigation = {
        sync: () => applyBrowserPage(history.state),
    };

    // ============= Work flow =============

    // Page 0: Select format for the file to be imported
    formatSelectModal = createFileFormatSelectModal({
        onConfirm: (selection) => handleFileFormatConfirm(selection),
        onBatch: () => showBatchPage(),
    });
    showFormatPage({
        updateHistory: !history.state?.brmPage || history.state.brmPage === "intro",
        replace: !history.state?.brmPage || history.state.brmPage === "intro",
    });

    function ensureMotionInstances() {
        if (!skeletalMotion) skeletalMotion = new SkeletalMotion(sceneManager);
        if (!pldMotion) pldMotion = new PLDMotion(sceneManager);
    }

    function resetImportedMotions() {
        pendingAnimationFile = null;
        resetWorkspaceArtifacts();
        ensureMotionInstances();
        skeletalMotion?.resetState?.();
        pldMotion?.resetState?.();
    }

    function resetWorkspaceArtifacts() {
        pldMatchModal?.hide?.();
        pldMatchModal = null;
        pldBindParentModal?.hide?.();
        pldBindParentModal = null;
        exportOptionModal?.hide?.();
        exportOptionModal?.element?.remove?.();
        exportOptionModal = null;
        motionGUI?.destroy?.();
        motionGUI = null;

        while (paneAngleUiCleanups.length > 0) {
            try {
                paneAngleUiCleanups.pop()?.();
            } catch (error) {
                console.warn("Failed to dispose pane scene angle UI:", error);
            }
        }
        while (mpVisualCleanups.length > 0) {
            try {
                mpVisualCleanups.pop()?.();
            } catch (error) {
                console.warn("Failed to dispose MP visual UI:", error);
            }
        }
        while (paneResizeCleanups.length > 0) {
            try {
                paneResizeCleanups.pop()?.();
            } catch (error) {
                console.warn("Failed to dispose pane resize listener:", error);
            }
        }

        workspaceLayout?.hide?.();
        workspaceLayout?.element?.remove?.();
        workspaceLayout = null;
        paneCPopupList = null;
        paneAScene = null;
        paneBScene = null;
        sceneContexts = {};
        mpVisualController = null;
        v3VisualController = null;
        selectionVizController?.clearActiveSelection?.();
        allBoneParams = {};
        Object.keys(oriAllBoneParams).forEach((key) => delete oriAllBoneParams[key]);
        pldBoneBindings = undefined;
    }

    function startNewImportSession() {
        importSessionId += 1;
        resetImportedMotions();
    }

    function handleFileFormatConfirm(selection){
        if (!selection) {
            formatSelectModal.setFeedback("Please choose a format");
        }

        typeSelection = selection;

        startNewImportSession();

        showImportPage(selection);
    };
    
    // Page 1: import animation file
    function setImportModal(shouldShow = true) {
        importModal = createFileImportModal({
            title: "Import Animation Data",
            typeSelection,
            onConfirm: (file, uiApi) => {
            if (!file) {
                uiApi.setError("Please select one file.");
                return;
            }
            startNewImportSession();
            setBrowserPage("import", { typeSelection }, { replace: true });
            uiApi.setError("");
            pendingAnimationFile = file;
            uiApi.setLoading(false);
            uiApi.hide();

            handleSkeletonConfirm();
            },
            onClose: () => {
            showFormatPage();
            },
        });
        if (shouldShow) importModal.show();
    }

    async function handleSkeletonConfirm() {
        let loadingOverlay = null;
        try {
        if (typeSelection === 'skeleton'){
            loadingOverlay = showWorkspaceLoadingOverlay("Loading skeleton motion...");
            await skeletalMotion.loadSkeletalMotionFromFile(
                pendingAnimationFile,
                ({ loaded, total, percent }) => {
                    loadingOverlay?.setProgress(percent);
                    if (Number.isFinite(total) && total > 0) {
                        loadingOverlay?.setMessage(
                            `Loading skeleton motion... ${Math.round(loaded / 1024)}KB / ${Math.round(total / 1024)}KB`
                        );
                    }
                }
            );
            loadingOverlay?.setProgress(100);
            pendingAnimationFile = null;
            
            initializeWorkspace(false);
            showWorkspacePage();
        } else if (typeSelection === 'pld'){
            await pldMotion.loadPLDMotionFromFile(pendingAnimationFile);
            pendingAnimationFile = null;

            // // Create PLD-Bone binding GUI and record the bindings
            // pldMatchModal = createPldBoneBindGUI(
            //     pldMotion.pldNameList,
            //     "mixamo",             
            //     (configs) => {                 // onChange callback
            //         pldBoneBindings = configs;
            //     },
            //     (configs) => {                 // onConfirm callback
            //         pldBoneBindings = configs;
            //         console.log("PLD-Bone config confirmed:", configs);
            //         handlePldBindingConfirmed();
            //     }
            // );
            // pldMatchModal.show();

            // Show PLD Parent Binding Modal
            if (pldMotion && pldMotion.pldInfo) {
                // Set default parent values for each PLD
                const defaultParentValues = [0,1,2,3,4,1,6,7,8,1,10,11,11,13,14,15,11,17,18,19];

                pldBindParentModal = createPLDBindParentModal(pldMotion, {
                    defaultParentValues: defaultParentValues,
                    onConfirm: () => {
                        console.log("PLD Parent binding confirmed", pldMotion.pldInfo);
                        applyPldUpdateOrderFromParents();
                        handlePldBindingConfirmed();
                    },
                    onClose: () => {
                        showImportPage(typeSelection);
                    }
                });
                if (pldBindParentModal) {
                    showPldBindPage();
                } else {
                    applyPldUpdateOrderFromParents();
                    handlePldBindingConfirmed();
                }
            } else {
                applyPldUpdateOrderFromParents();
                handlePldBindingConfirmed();
            }
        }

        } catch (error) {
        console.error("Fail to load animation file:", error);
        importModal?.show?.();
        } finally {
            loadingOverlay?.close?.();
        }
    }

    // Handle PLD Binding Confirmation
    async function handlePldBindingConfirmed() {
        // if (!pldBoneBindings || pldBoneBindings.length === 0) {
        //     console.warn("No PLD-Bone bindings configured");
        //     return;
        // }

        initializeWorkspace();
    }

    // Page3: main page
    function initializeWorkspace(updateHistory = true) {
        if (!sceneManager) {
            console.warn("Missing sceneManager; unable to create workspace layout.");
            return;
        }

        while (paneAngleUiCleanups.length > 0) {
            const dispose = paneAngleUiCleanups.pop();
            try {
                dispose?.();
            } catch (error) {
                console.warn("Failed to dispose pane scene angle UI:", error);
            }
        }

        while (mpVisualCleanups.length > 0) {
            const dispose = mpVisualCleanups.pop();
            try {
                dispose?.();
            } catch (error) {
                console.warn("Failed to dispose MP visual UI:", error);
            }
        }
        mpVisualController = null;
        v3VisualController = null;

        // Create workspace
        const firstInit = !workspaceLayout;
        if (firstInit) {
            workspaceLayout = createWorkspaceLayout();
            workspaceLayout.mount(document.body);
        }

        const paneAContainer = workspaceLayout.getPane("A");
        const paneBContainer = workspaceLayout.getPane("B");
        const paneC = workspaceLayout.getPane("C");

        selectionVizController.clearActiveSelection();

        // Pane C
        if (paneC && firstInit) {
            paneC.innerHTML = "";
            paneC.classList.add("pane-c-panel");
            paneC.style.position = "relative";

            const paneContent = document.createElement("div");
            paneContent.className = "pane-c-content";
            paneContent.addEventListener("click", (event) => {
                const target = event.target instanceof Element ? event.target : event.target?.parentElement;
                if (!target) return;
                if (target.closest(".pane-c-popup-card")) return;
                if (target.closest(".pane-c-playback")) return;
                if (target.closest(".pane-c-action-bar")) return;
                selectionVizController.clearActiveSelection();
            });

            const header = document.createElement("div");
            header.className = "pane-c-header";
            header.innerText = "Motion Controls";

            paneCPopupList = document.createElement("div");
            paneCPopupList.className = "pane-c-popup-list";
            paneCPopupList.addEventListener("pointerdown", (event) => {
                const target = event.target instanceof Element ? event.target : event.target?.parentElement;
                const card = target?.closest?.(".pane-c-popup-card");
                if (!card || card.style.display === "none") return;
                selectionVizController.activateByPopupCard(card);
            }, true);
            paneCPopupList.addEventListener("click", (event) => {
                const target = event.target instanceof Element ? event.target : event.target?.parentElement;
                const card = target?.closest?.(".pane-c-popup-card");
                if (!card || card.style.display === "none") return;
                selectionVizController.activateByPopupCard(card);
            }, true);
            paneCPopupList.addEventListener("focusin", (event) => {
                const target = event.target instanceof Element ? event.target : event.target?.parentElement;
                const card = target?.closest?.(".pane-c-popup-card");
                if (!card || card.style.display === "none") return;
                selectionVizController.activateByPopupCard(card);
            }, true);

            const actionBar = document.createElement("div");
            actionBar.className = "pane-c-action-bar";
            const leftActions = document.createElement("div");
            leftActions.style.display = "flex";
            leftActions.style.alignItems = "center";
            leftActions.style.gap = "8px";
            const playbackUI = playbackController.createControls();
            const clipRepeatWrap = clipRepeatController.createControls();
            leftActions.appendChild(clipRepeatWrap);
            actionBar.appendChild(leftActions);

            // Export
            const exportBtn = document.createElement("button");
            exportBtn.innerText = "Export Settings";
            exportBtn.type = "button";
            actionBar.appendChild(exportBtn);

            exportBtn.addEventListener("click", () => {
                if (!exportOptionModal) return;
                exportOptionModal.show();
            });

            paneContent.appendChild(header);
            paneContent.appendChild(paneCPopupList);
            paneContent.appendChild(playbackUI.root);
            paneContent.appendChild(actionBar);
            paneC.appendChild(paneContent);
        }

        // Pane A
        if (paneAContainer) {
            paneAContainer.innerHTML = ""; 

            const AScene = new BasicScene(paneAContainer, sceneManager);
            paneAScene = AScene;
            
            // Store scene context for video recording
            sceneContexts.paneA = {
                scene: AScene.scene,
                camera: AScene.camera,
                renderer: AScene.renderer,
                canvas: AScene.renderer.domElement,
                controls: AScene.controls
            };
            createPaneSceneSettingsTab(paneAContainer, AScene, "paneA");
            const paneAAngleUi = createPaneSceneAngleUI({
                paneContainer: paneAContainer,
                basicScene: AScene,
                paneId: "paneA",
                getPaneSettingsDock,
            });
            if (paneAAngleUi?.dispose) paneAngleUiCleanups.push(() => paneAAngleUi.dispose());

            mpVisualController = createMPVisualController({
                paneContainer: paneAContainer,
                paneId: "paneA",
                getPaneSettingsDock,
                getActiveSelection: () => selectionVizController?.getActiveSelection?.(),
                getSkeletalMotion: () => skeletalMotion,
                getPldMotion: () => pldMotion,
            });
            if (mpVisualController?.dispose) mpVisualCleanups.push(() => mpVisualController.dispose());

            v3VisualController = createV3VisualController({
                paneContainer: paneAContainer,
                paneId: "paneA",
                getPaneSettingsDock,
                getActiveSelection: () => selectionVizController?.getActiveSelection?.(),
                getSkeletalMotion: () => skeletalMotion,
                getPldMotion: () => pldMotion,
            });
            if (v3VisualController?.dispose) mpVisualCleanups.push(() => v3VisualController.dispose());

            setupPaneAMotionGUI(AScene, paneAContainer);

            
            paneResizeCleanups.push(
                workspaceLayout.onPaneResize("A", ({ width, height }) => {
                    AScene.resize(width, height);
                })
            );
        }

        // Pane B
        if (paneBContainer) {
            paneBContainer.innerHTML = ""; 

            const BScene = new BasicScene(paneBContainer, sceneManager);
            paneBScene = BScene;
            
            // Store scene context for video recording
            sceneContexts.paneB = {
                scene: BScene.scene,
                camera: BScene.camera,
                renderer: BScene.renderer,
                canvas: BScene.renderer.domElement,
                controls: BScene.controls
            };
            createPaneSceneSettingsTab(paneBContainer, BScene, "paneB");
            const paneBAngleUi = createPaneSceneAngleUI({
                paneContainer: paneBContainer,
                basicScene: BScene,
                paneId: "paneB",
                getPaneSettingsDock,
            });
            if (paneBAngleUi?.dispose) paneAngleUiCleanups.push(() => paneBAngleUi.dispose());

            if (typeSelection === "skeleton"){
                pldMotion.loadPLDMotionFromSkeletalMotion(skeletalMotion);
                mountPldViewToPane(BScene, paneBContainer, "paneB", false);
            }

            paneResizeCleanups.push(
                workspaceLayout.onPaneResize("B", ({ width, height }) => {
                    BScene.resize(width, height);
                })
            );
        }

        clipRepeatController.syncState();

        // Export Modal
        if (!exportOptionModal) {
            exportOptionModal = createExportOptionModal({
                mountTo: paneC,
                onConfirm: ({ optionId, videoSettings }) => {
                    if (optionId === "animation") {
                        // Export as GLB animation file
                        if (typeof skeletalMotion.exportGLTF === "function") {
                            skeletalMotion.exportGLTF();
                        } else {
                            console.warn("exportGLTF missing on skeletalMotion.");
                        }
                    } else if (optionId === "pldCsv") {
                        // Export PLD as CSV
                        if (typeof pldMotion.exportAsCSV === "function") {
                            pldMotion.exportAsCSV();
                        } else {
                            console.warn("exportAsCSV missing on pldMotion.");
                        }
                    } else if (optionId === "pldVideo") {
                        return exportController.recordAndDownloadVideos(videoSettings);
                    }
                },
                onVideoAnglePreview: ({ targetPane, angle }) => {
                    exportController.previewCameraAngle({ targetPane, angle });
                },
            });
        }

        playbackController.applyPausedState(false);
        playbackController.seekByTime(0, { updateUI: false, wrap: false });
        playbackController.updateUI(true);

        // Final
        workspaceLayout.show();
        workspaceLayout.refresh();
        triggerResizeAdjustments();
        if (updateHistory) setBrowserPage("workspace", { typeSelection });
    }

    // ============= Additional Functions =============
    // Resize panels
    function triggerResizeAdjustments() {
        if (paneAScene && paneAScene.parentElement) {
            const rectA = paneAScene.parentElement.getBoundingClientRect();
            paneAScene.resize(rectA.width, rectA.height);
        }
        if (paneBScene && paneBScene.parentElement) {
            const rectB = paneBScene.parentElement.getBoundingClientRect();
            paneBScene.resize(rectB.width, rectB.height);
        }
    }
    
}
