import JSZip from 'jszip';
import { SkeletalMotion } from '../sceneSubjects/SkeletalMotion';
import { BasicScene } from '../sceneSubjects/BasicScene';
import { deepClone } from '../sceneSubjects/functions/deepClone';
import { showWorkspaceLoadingOverlay } from '../sceneSubjects/gui/WorkspaceLoadingOverlay';
import { recordAnimationMultipleAngles } from '../sceneSubjects/functions/videoRecorder';
import { applyCameraAngle } from '../controlFlow/cameraAngleUtils';

const PARAM_OPTIONS = [
    { id: 'MPAmp.ampScale', label: 'Main Plane Amplitude Scale' },
    { id: 'MPAmp.meanAddDegrees', label: 'Main Plane Mean Addition (deg)' },
    { id: 'MPAmp.f1', label: 'Main Plane Filter f1' },
    { id: 'MPAmp.f2', label: 'Main Plane Filter f2' },
    { id: 'MPAmp.transition_bw', label: 'Main Plane Filter Transition Bandwidth' },
    { id: 'MPAmp.attenuation_ratio', label: 'Main Plane Filter Attenuation Ratio' },
    { id: 'V3Ratio', label: 'V3 Amplitude Scale' },
    { id: 'V3MeanAdd', label: 'V3 Mean Addition (V3/BoneLen)' },
    { id: 'PhaseShift', label: 'Phase Shift' },
    { id: 'FrequencyScale', label: 'Frequency Ratio' },
    { id: 'FrequencyHz', label: 'Frequency (Hz)' },
];

function ws(el, css) { el.style.cssText += css; }

function button(text, accent = false) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerText = text;
    ws(btn, `padding: 7px 14px; border-radius: 6px; cursor: pointer; font-size: 13px;
        border: 1px solid ${accent ? 'rgba(141,212,255,0.5)' : 'rgba(255,255,255,0.2)'};
        background: ${accent ? 'rgba(141,212,255,0.1)' : 'rgba(255,255,255,0.08)'};
        color: ${accent ? '#8dd4ff' : '#f5f6ff'};`);
    return btn;
}

function defaultParams() {
    return {
        referenceMode: "mean",
        AmplitudeScale: 1,
        PhaseScale: 0,
        MPAmp: {
            ampScale: 1,
            meanAdd: 0,
            filter_type: 'none',
            f1: 1,
            f2: 2,
            transition_bw: 0,
            attenuation_ratio: 0.001,
        },
        V3Ratio: 1,
        V3MeanAdd: 0,
        PhaseShift: 0,
        FrequencyScale: 1,
        KeepOriginalLength: true,
    };
}

function getFileBase(name = 'animation') {
    return String(name).replace(/\.[^.]+$/, '') || 'animation';
}

function getBoneList(motion) {
    return (motion?.BoneInfo || [])
        .filter((bone) => Number(bone?.parent) !== 0)
        .map((bone) => bone.name);
}

function sameBoneList(a = [], b = []) {
    if (a.length !== b.length) return false;
    return a.every((name, index) => name === b[index]);
}

function parseNumberList(text) {
    return String(text || '')
        .split(/[\s,;]+/)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
}

function setParamValue(params, path, value, bone = null) {
    if (path === 'MPAmp.meanAddDegrees') {
        params.MPAmp.meanAdd = value * Math.PI / 180;
        return;
    }
    if (path === 'FrequencyHz') {
        const estimate = bone?.FrequencyEstimate;
        const fundamentalHz = Number(estimate?.fundamentalHz);
        if (estimate?.reliable !== true || !(fundamentalHz > 0)) {
            throw new Error(`Cannot apply Frequency (Hz) to ${bone?.name || 'the selected bone'} because its fundamental frequency is unavailable or unreliable. Use Frequency Ratio instead.`);
        }
        if (!(value > 0)) {
            throw new Error('Frequency (Hz) values must be greater than zero.');
        }
        params.FrequencyScale = value / fundamentalHz;
        return;
    }
    if (path === 'FrequencyScale' && !(value > 0)) {
        throw new Error('Frequency Ratio values must be greater than zero.');
    }
    if (path.startsWith('MPAmp.')) {
        const key = path.split('.')[1];
        params.MPAmp[key] = value;
        if (['f1', 'f2', 'transition_bw', 'attenuation_ratio'].includes(key) && params.MPAmp.filter_type === 'none') {
            params.MPAmp.filter_type = 'bandpass';
        }
        return;
    }
    params[path] = value;
}

function buildCombinations(rows) {
    return rows.reduce((acc, row) => {
        const next = [];
        row.values.forEach((value) => {
            acc.forEach((combo) => next.push([...combo, { row, value }]));
        });
        return next;
    }, [[]]);
}

function buildSynchronizedCombinations(rows) {
    const levelCount = rows[0]?.values?.length || 0;
    const combinations = [];
    for (let i = 0; i < levelCount; i++) {
        combinations.push(rows.map((row) => ({ row, value: row.values[i] })));
    }
    return combinations;
}

function comboSuffix(combo) {
    return combo
        .map(({ row, value }) => `${row.param.replaceAll('.', '-')}_${String(value).replace(/[^a-zA-Z0-9._-]/g, '_')}`)
        .join('__');
}

function getComboLabel(combo) {
    return comboSuffix(combo) || 'default';
}

function resetMotionToOriginalForGeneration(motion, originalClip) {
    motion.currentClip = originalClip.clone();
    (motion.BoneInfo || []).forEach((bone) => {
        bone.New = deepClone(bone.Ori);
    });
}

function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function prepareHiddenSceneForExport(scene) {
    scene.resize?.(256, 256);
    for (let i = 0; i < 3; i++) {
        scene.update?.(0);
        await nextFrame();
    }
}

async function loadMotionForGeneration(file) {
    const host = document.createElement('div');
    ws(host, 'position: fixed; left: -10000px; top: -10000px; width: 256px; height: 256px; pointer-events: none;');
    document.body.appendChild(host);

    const scene = new BasicScene(host, null);
    const motion = new SkeletalMotion(null);
    await motion.loadSkeletalMotionFromFile(file);
    motion.configureAnimation(scene.scene);
    await prepareHiddenSceneForExport(scene);
    return {
        motion,
        scene,
        dispose() {
            motion.resetState();
            scene.dispose?.();
            host.remove();
        },
    };
}

async function loadMotionForBoneList(file) {
    const motion = new SkeletalMotion(null);
    await motion.loadSkeletalMotionFromFile(file);
    return {
        motion,
        dispose() {
            motion.resetState();
        },
    };
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function createBatchGenerationUI({ files, onBack }) {
    let checkResults = [];
    let activeRows = [];
    let exportMode = 'glb';
    let generationMode = 'cartesian';
    let angleCounter = 1;
    const videoAngles = [];

    const overlay = document.createElement('div');
    ws(overlay, `position: fixed; inset: 0; z-index: 11000; background: #0f1117;
        display: flex; flex-direction: column; color: #f5f5f5; font: 13px 'Segoe UI', sans-serif;`);

    const header = document.createElement('div');
    ws(header, 'display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: rgba(0,0,0,0.4); border-bottom: 1px solid rgba(255,255,255,0.08);');
    const backBtn = button('Back to File List');
    backBtn.addEventListener('click', () => { destroy(); onBack?.(); });
    const title = document.createElement('div');
    title.innerText = 'Batch Generation';
    ws(title, 'font-size: 15px; font-weight: 600;');
    header.appendChild(backBtn);
    header.appendChild(title);
    overlay.appendChild(header);

    const body = document.createElement('div');
    ws(body, 'flex: 1; overflow: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px;');
    overlay.appendChild(body);
    document.body.appendChild(overlay);

    renderChecking();
    runBoneListCheck();

    function clearBody() {
        body.innerHTML = '';
    }

    function sectionTitle(text) {
        const el = document.createElement('div');
        el.innerText = text;
        ws(el, 'font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.5px;');
        return el;
    }

    function renderChecking() {
        clearBody();
        body.appendChild(sectionTitle('Step 1 - File Check'));
        const status = document.createElement('div');
        status.innerText = 'Checking bone lists...';
        ws(status, 'color: #8dd4ff;');
        body.appendChild(status);
    }

    async function runBoneListCheck() {
        const loading = showWorkspaceLoadingOverlay('Checking bone lists...');
        const results = [];
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                loading.setMessage(`Checking bone lists... ${i + 1} / ${files.length}`);
                const loaded = await loadMotionForBoneList(file);
                try {
                    results.push({
                        file,
                        boneList: getBoneList(loaded.motion),
                        error: null,
                    });
                } finally {
                    loaded.dispose();
                }
                loading.setProgress(((i + 1) / files.length) * 100);
            }
            checkResults = results;
            renderCheckResults();
        } catch (err) {
            console.error('Batch generation file check failed:', err);
            alert(`File check failed: ${err?.message || err}`);
            renderCheckResults();
        } finally {
            loading.close();
        }
    }

    function renderCheckResults() {
        clearBody();
        body.appendChild(sectionTitle('Step 1 - File Check'));

        const ref = checkResults[0]?.boneList || [];
        const failed = checkResults.filter((item) => item.error);
        const different = checkResults.filter((item) => !item.error && !sameBoneList(item.boneList, ref));
        const allSame = failed.length === 0 && different.length === 0;

        const summary = document.createElement('div');
        summary.innerText = failed.length > 0
            ? `${failed.length} file(s) failed to load.`
            : (allSame ? 'All animation files have exactly the same bone list.' : 'Different bone lists found.');
        ws(summary, `padding: 12px 14px; border-radius: 8px; border: 1px solid ${allSame ? 'rgba(34,197,94,0.35)' : 'rgba(255,190,80,0.38)'};
            background: ${allSame ? 'rgba(34,197,94,0.12)' : 'rgba(255,190,80,0.1)'};
            color: ${allSame ? '#4ade80' : '#ffd28a'};`);
        body.appendChild(summary);

        const listWrap = document.createElement('div');
        ws(listWrap, 'display: flex; flex-direction: column; gap: 8px;');
        checkResults.forEach((result) => {
            const details = document.createElement('details');
            ws(details, 'border: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.18); border-radius: 8px; padding: 8px 12px;');
            const sum = document.createElement('summary');
            sum.innerText = `${result.file.name} - ${result.boneList.length} bones`;
            ws(sum, 'cursor: pointer; color: #d7e2ff;');
            const pre = document.createElement('pre');
            pre.innerText = result.boneList.join('\n');
            ws(pre, 'max-height: 260px; overflow: auto; margin: 10px 0 0; color: #bcc5df; font-size: 12px;');
            details.appendChild(sum);
            details.appendChild(pre);
            listWrap.appendChild(details);
        });
        body.appendChild(listWrap);

        const actions = document.createElement('div');
        ws(actions, 'display: flex; justify-content: flex-end; gap: 10px;');
        const reupload = button('Re-upload Animation Files');
        reupload.addEventListener('click', () => { destroy(); onBack?.(); });
        const cont = button('Continue', true);
        cont.disabled = failed.length > 0;
        cont.style.opacity = cont.disabled ? '0.45' : '1';
        cont.addEventListener('click', () => renderGenerationSetup());
        actions.appendChild(reupload);
        actions.appendChild(cont);
        body.appendChild(actions);
    }

    function renderGenerationSetup() {
        clearBody();
        activeRows = [];
        exportMode = 'glb';
        generationMode = 'cartesian';
        videoAngles.splice(0, videoAngles.length);
        angleCounter = 1;
        body.appendChild(sectionTitle('Step 2 - Generation Parameters'));

        const hint = document.createElement('div');
        hint.innerText = 'Add rows in the form of bones + parameter + value list.';
        ws(hint, 'color: #bcc5df;');
        body.appendChild(hint);

        body.appendChild(createGenerationModePanel());

        const rowsEl = document.createElement('div');
        ws(rowsEl, 'display: flex; flex-direction: column; gap: 10px;');
        body.appendChild(rowsEl);

        body.appendChild(createExportSettingsPanel());

        const actions = document.createElement('div');
        ws(actions, 'display: flex; justify-content: space-between; gap: 10px;');
        const addRowBtn = button('Add Parameter Row');
        const right = document.createElement('div');
        ws(right, 'display: flex; gap: 10px;');
        const backToCheck = button('Back');
        backToCheck.addEventListener('click', renderCheckResults);
        const generateBtn = button('Generate GLB ZIP', true);
        generateBtn.addEventListener('click', () => runGeneration());
        actions.appendChild(addRowBtn);
        right.appendChild(backToCheck);
        right.appendChild(generateBtn);
        actions.appendChild(right);
        body.appendChild(actions);

        addRowBtn.addEventListener('click', () => addParamRow(rowsEl));
        addParamRow(rowsEl);

        function updateGenerateLabel() {
            generateBtn.innerText = exportMode === 'video' ? 'Generate Video ZIP' : 'Generate GLB ZIP';
        }

        function createGenerationModePanel() {
            const panel = document.createElement('div');
            ws(panel, 'display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; background: rgba(0,0,0,0.18);');

            const title = document.createElement('div');
            title.innerText = 'Combination Mode';
            ws(title, 'font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.5px;');
            panel.appendChild(title);

            const row = document.createElement('div');
            ws(row, 'display: flex; gap: 12px; flex-wrap: wrap;');
            row.appendChild(createModeRadioLabel('Cartesian Product', 'cartesian'));
            row.appendChild(createModeRadioLabel('Synchronized Levels', 'synchronized'));
            panel.appendChild(row);

            const note = document.createElement('div');
            note.innerText = 'Synchronized Levels pairs row 1 level 1 with row 2 level 1, row 1 level 2 with row 2 level 2, etc. All rows must have the same number of values.';
            ws(note, 'color: #9aa4c3; font-size: 12px; line-height: 1.35;');
            panel.appendChild(note);

            return panel;
        }

        function createModeRadioLabel(labelText, value) {
            const label = document.createElement('label');
            ws(label, 'display: flex; align-items: center; gap: 6px; color: #d7e2ff; cursor: pointer;');
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'batch-generation-mode';
            input.value = value;
            input.checked = generationMode === value;
            input.addEventListener('change', () => {
                if (input.checked) generationMode = value;
            });
            const text = document.createElement('span');
            text.innerText = labelText;
            label.appendChild(input);
            label.appendChild(text);
            return label;
        }

        function createExportSettingsPanel() {
            const panel = document.createElement('div');
            ws(panel, 'display: flex; flex-direction: column; gap: 12px; padding: 12px; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; background: rgba(0,0,0,0.18);');

            panel.appendChild(sectionTitle('Step 3 - Export Settings'));

            const modeRow = document.createElement('div');
            ws(modeRow, 'display: flex; gap: 12px; flex-wrap: wrap;');
            const glbLabel = createRadioLabel('GLB ZIP', 'glb');
            const videoLabel = createRadioLabel('Video ZIP', 'video');
            modeRow.appendChild(glbLabel);
            modeRow.appendChild(videoLabel);
            panel.appendChild(modeRow);

            const videoPanel = document.createElement('div');
            ws(videoPanel, 'display: none; flex-direction: column; gap: 12px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.08);');

            const qualityRow = document.createElement('div');
            ws(qualityRow, 'display: grid; grid-template-columns: minmax(160px, 220px) minmax(160px, 220px); gap: 10px;');
            const fpsInput = document.createElement('input');
            fpsInput.type = 'number';
            fpsInput.min = '1';
            fpsInput.max = '120';
            fpsInput.value = '30';
            styleField(fpsInput);
            const resSelect = document.createElement('select');
            styleField(resSelect);
            [
                ['1080p', '1920x1080'],
                ['720p', '1280x720'],
                ['480p', '854x480'],
            ].forEach(([value, label]) => {
                const option = document.createElement('option');
                option.value = value;
                option.innerText = label;
                resSelect.appendChild(option);
            });
            qualityRow.appendChild(wrapField('FPS', fpsInput));
            qualityRow.appendChild(wrapField('Resolution', resSelect));
            videoPanel.appendChild(qualityRow);

            const sceneSettingsPanel = document.createElement('div');
            ws(sceneSettingsPanel, 'display: flex; flex-direction: column; gap: 10px; padding: 10px; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; background: rgba(255,255,255,0.03);');
            sceneSettingsPanel.appendChild(sectionTitle('Hidden Scene Settings'));

            const sceneGrid = document.createElement('div');
            ws(sceneGrid, 'display: grid; grid-template-columns: repeat(2, minmax(160px, 1fr)); gap: 10px; align-items: center;');
            const showPlaneInput = document.createElement('input');
            showPlaneInput.type = 'checkbox';
            showPlaneInput.checked = false;
            const showSkeletonInput = document.createElement('input');
            showSkeletonInput.type = 'checkbox';
            showSkeletonInput.checked = true;
            const bgInput = document.createElement('input');
            bgInput.type = 'color';
            bgInput.value = '#ffffff';
            styleField(bgInput);
            bgInput.style.height = '34px';
            bgInput.style.padding = '2px';
            const meshOpacityInput = document.createElement('input');
            meshOpacityInput.type = 'range';
            meshOpacityInput.min = '0';
            meshOpacityInput.max = '1';
            meshOpacityInput.step = '0.05';
            meshOpacityInput.value = '1';
            const meshOpacityValue = document.createElement('span');
            meshOpacityValue.innerText = '1.00';
            meshOpacityValue.style.color = '#bcc5df';
            meshOpacityValue.style.fontVariantNumeric = 'tabular-nums';
            meshOpacityInput.addEventListener('input', () => {
                meshOpacityValue.innerText = Number(meshOpacityInput.value).toFixed(2);
            });
            sceneGrid.appendChild(wrapCheckbox('Show Plane', showPlaneInput));
            sceneGrid.appendChild(wrapCheckbox('Show Skeleton', showSkeletonInput));
            sceneGrid.appendChild(wrapField('Background', bgInput));
            sceneGrid.appendChild(wrapInlineField('Mesh Opacity', meshOpacityInput, meshOpacityValue));
            sceneSettingsPanel.appendChild(sceneGrid);
            videoPanel.appendChild(sceneSettingsPanel);

            const clipRepeatPanel = document.createElement('div');
            ws(clipRepeatPanel, 'display: flex; flex-direction: column; gap: 10px; padding: 10px; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; background: rgba(255,255,255,0.03);');
            clipRepeatPanel.appendChild(sectionTitle('Clip Repeat'));
            const clipRepeatInput = document.createElement('input');
            clipRepeatInput.type = 'number';
            clipRepeatInput.min = '1';
            clipRepeatInput.step = '1';
            clipRepeatInput.value = '1';
            styleField(clipRepeatInput);
            clipRepeatPanel.appendChild(wrapField('Repeat Count', clipRepeatInput));
            panel.appendChild(clipRepeatPanel);

            const angleEditor = document.createElement('div');
            ws(angleEditor, 'display: grid; grid-template-columns: repeat(5, minmax(110px, 1fr)) auto; gap: 8px; align-items: end;');
            const yawInput = numberInput('0');
            const pitchInput = numberInput('15');
            const distanceInput = numberInput('30');
            const moveXInput = numberInput('0');
            const moveYInput = numberInput('0');
            const addAngleBtn = button('Add Angle');
            angleEditor.appendChild(wrapField('Yaw', yawInput));
            angleEditor.appendChild(wrapField('Pitch', pitchInput));
            angleEditor.appendChild(wrapField('Distance', distanceInput));
            angleEditor.appendChild(wrapField('Move X', moveXInput));
            angleEditor.appendChild(wrapField('Move Y', moveYInput));
            angleEditor.appendChild(addAngleBtn);
            videoPanel.appendChild(angleEditor);

            const angleList = document.createElement('div');
            ws(angleList, 'display: flex; flex-direction: column; gap: 8px;');
            videoPanel.appendChild(angleList);

            addAngleBtn.addEventListener('click', () => {
                addVideoAngle({
                    yaw: Number(yawInput.value) || 0,
                    pitch: Number(pitchInput.value) || 0,
                    distance: Math.max(0.001, Number(distanceInput.value) || 30),
                    moveX: Number(moveXInput.value) || 0,
                    moveY: Number(moveYInput.value) || 0,
                }, angleList);
            });

            panel.appendChild(videoPanel);
            addVideoAngle({ yaw: 0, pitch: 15, distance: 30, moveX: 0, moveY: 0 }, angleList);

            panel.getBatchSettings = () => ({
                fps: Math.max(1, Math.min(120, parseInt(fpsInput.value, 10) || 30)),
                resolution: resSelect.value || '1080p',
                angles: videoAngles.filter((angle) => angle.enabled),
                sceneSettings: {
                    showPlane: showPlaneInput.checked,
                    showSkeleton: showSkeletonInput.checked,
                    backgroundColor: normalizeHexColor(bgInput.value, '#ffffff'),
                    meshOpacity: clamp(Number(meshOpacityInput.value), 0, 1, 1),
                },
                clipRepeat: Math.max(1, Math.round(Number(clipRepeatInput.value) || 1)),
            });

            function createRadioLabel(labelText, value) {
                const label = document.createElement('label');
                ws(label, 'display: flex; align-items: center; gap: 6px; cursor: pointer; color: #d7e2ff;');
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'batchGenerationExportMode';
                radio.value = value;
                radio.checked = exportMode === value;
                radio.addEventListener('change', () => {
                    if (!radio.checked) return;
                    exportMode = value;
                    videoPanel.style.display = exportMode === 'video' ? 'flex' : 'none';
                    updateGenerateLabel();
                });
                const text = document.createElement('span');
                text.innerText = labelText;
                label.appendChild(radio);
                label.appendChild(text);
                return label;
            }

            function addVideoAngle(config, list) {
                const angle = {
                    id: `angle_${angleCounter}`,
                    seq: angleCounter,
                    camera: 'scene',
                    name: `angle_${angleCounter}_y${config.yaw}_p${config.pitch}_d${config.distance}_mx${config.moveX}_my${config.moveY}`,
                    yaw: config.yaw,
                    pitch: config.pitch,
                    distance: config.distance,
                    moveX: config.moveX,
                    moveY: config.moveY,
                    enabled: true,
                };
                angleCounter += 1;
                videoAngles.push(angle);

                const row = document.createElement('div');
                ws(row, 'display: flex; align-items: center; gap: 8px;');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = true;
                checkbox.addEventListener('change', () => { angle.enabled = checkbox.checked; });
                const text = document.createElement('div');
                text.innerText = `Angle ${angle.seq}: yaw ${angle.yaw}, pitch ${angle.pitch}, distance ${angle.distance}, moveX ${angle.moveX}, moveY ${angle.moveY}`;
                ws(text, 'flex: 1; color: #bcc5df; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px 8px;');
                const removeBtn = button('Remove');
                removeBtn.addEventListener('click', () => {
                    const idx = videoAngles.findIndex((item) => item.id === angle.id);
                    if (idx >= 0) videoAngles.splice(idx, 1);
                    row.remove();
                });
                row.appendChild(checkbox);
                row.appendChild(text);
                row.appendChild(removeBtn);
                list.appendChild(row);
            }

            function numberInput(value) {
                const input = document.createElement('input');
                input.type = 'number';
                input.step = '0.001';
                input.value = value;
                styleField(input);
                return input;
            }

            function styleField(field) {
                ws(field, 'width: 100%; box-sizing: border-box; padding: 7px 8px; background: rgba(0,0,0,0.25); color: #fff; border: 1px solid rgba(255,255,255,0.16); border-radius: 6px;');
            }

            function clamp(value, min, max, fallback) {
                return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
            }

            function normalizeHexColor(value, fallback = '#ffffff') {
                if (typeof value !== 'string') return fallback;
                const hex = value.trim();
                return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : fallback;
            }

            function wrapField(labelText, field) {
                const wrap = document.createElement('label');
                ws(wrap, 'display: flex; flex-direction: column; gap: 4px; color: #9aa4c3; font-size: 12px;');
                const text = document.createElement('span');
                text.innerText = labelText;
                wrap.appendChild(text);
                wrap.appendChild(field);
                return wrap;
            }

            function wrapCheckbox(labelText, field) {
                const wrap = document.createElement('label');
                ws(wrap, 'display: flex; align-items: center; gap: 8px; color: #d7e2ff; font-size: 12px; cursor: pointer;');
                const text = document.createElement('span');
                text.innerText = labelText;
                wrap.appendChild(field);
                wrap.appendChild(text);
                return wrap;
            }

            function wrapInlineField(labelText, field, valueEl) {
                const wrap = document.createElement('label');
                ws(wrap, 'display: flex; align-items: center; gap: 8px; color: #9aa4c3; font-size: 12px;');
                const text = document.createElement('span');
                text.innerText = labelText;
                text.style.minWidth = '84px';
                field.style.flex = '1';
                wrap.appendChild(text);
                wrap.appendChild(field);
                wrap.appendChild(valueEl);
                return wrap;
            }

            return panel;
        }
    }

    function addParamRow(rowsEl) {
        const availableBones = checkResults[0]?.boneList || [];
        const row = { bones: [], param: PARAM_OPTIONS[0].id, values: [] };
        activeRows.push(row);

        const el = document.createElement('div');
        ws(el, 'display: grid; grid-template-columns: minmax(220px, 1.2fr) minmax(220px, 1fr) minmax(220px, 1fr) auto; gap: 8px; align-items: start; padding: 10px; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; background: rgba(0,0,0,0.18);');

        const bonePicker = document.createElement('details');
        ws(bonePicker, 'width: 100%; background: rgba(0,0,0,0.25); color: #fff; border: 1px solid rgba(255,255,255,0.16); border-radius: 6px;');
        const boneSummary = document.createElement('summary');
        boneSummary.innerText = 'Select bones';
        ws(boneSummary, 'cursor: pointer; padding: 7px 8px; color: #d7e2ff;');
        const boneList = document.createElement('div');
        ws(boneList, 'max-height: 220px; overflow: auto; padding: 6px 8px 8px; display: flex; flex-direction: column; gap: 4px;');
        bonePicker.appendChild(boneSummary);
        bonePicker.appendChild(boneList);

        function updateBoneSummary() {
            boneSummary.innerText = row.bones.length > 0
                ? `${row.bones.length} bone${row.bones.length > 1 ? 's' : ''} selected`
                : 'Select bones';
        }

        availableBones.forEach((name) => {
            const label = document.createElement('label');
            ws(label, 'display: flex; align-items: center; gap: 6px; cursor: pointer; color: #bcc5df; font-size: 12px;');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = name;
            checkbox.addEventListener('change', () => {
                row.bones = Array.from(boneList.querySelectorAll('input[type="checkbox"]:checked'))
                    .map((input) => input.value);
                updateBoneSummary();
            });
            const text = document.createElement('span');
            text.innerText = name;
            label.appendChild(checkbox);
            label.appendChild(text);
            boneList.appendChild(label);
        });

        const paramSelect = document.createElement('select');
        ws(paramSelect, 'width: 100%; padding: 7px 8px; background: rgba(0,0,0,0.25); color: #fff; border: 1px solid rgba(255,255,255,0.16); border-radius: 6px;');
        PARAM_OPTIONS.forEach((param) => {
            const opt = document.createElement('option');
            opt.value = param.id;
            opt.innerText = param.label;
            paramSelect.appendChild(opt);
        });
        paramSelect.addEventListener('change', () => { row.param = paramSelect.value; });

        const valuesInput = document.createElement('input');
        valuesInput.placeholder = 'e.g. 0.5, 1, 1.5';
        ws(valuesInput, 'width: 100%; box-sizing: border-box; padding: 7px 8px; background: rgba(0,0,0,0.25); color: #fff; border: 1px solid rgba(255,255,255,0.16); border-radius: 6px;');
        valuesInput.addEventListener('input', () => { row.values = parseNumberList(valuesInput.value); });

        const remove = button('Remove');
        remove.addEventListener('click', () => {
            activeRows = activeRows.filter((item) => item !== row);
            el.remove();
        });

        el.appendChild(bonePicker);
        el.appendChild(paramSelect);
        el.appendChild(valuesInput);
        el.appendChild(remove);
        rowsEl.appendChild(el);
    }

    function collectCompleteRows() {
        const rows = activeRows
            .map((row) => ({ ...row, values: row.values.length ? row.values : [] }))
            .filter((row) => row.bones.length > 0 && row.param && row.values.length > 0);
        return rows;
    }

    function validateSynchronizedRows(rows) {
        if (generationMode !== 'synchronized') return true;
        const expected = rows[0]?.values?.length || 0;
        const mismatch = rows.find((row) => row.values.length !== expected);
        if (!mismatch) return true;
        alert(`Synchronized Levels requires every parameter row to have the same number of values. Expected ${expected} value(s), but found ${mismatch.values.length}.`);
        return false;
    }

    async function applyComboToMotion(motion, originalClip, combo) {
        resetMotionToOriginalForGeneration(motion, originalClip);
        const boneByName = new Map((motion.BoneInfo || []).map((bone) => [bone.name, bone]));
        const paramsByBone = {};
        const touchedBones = new Map();
        combo.forEach(({ row, value }) => {
            row.bones.forEach((boneName) => {
                const bone = boneByName.get(boneName);
                if (!bone) return;
                if (!paramsByBone[bone.id]) paramsByBone[bone.id] = defaultParams();
                setParamValue(paramsByBone[bone.id], row.param, value, bone);
                touchedBones.set(bone.id, bone);
            });
        });
        const firstBone = touchedBones.values().next().value;
        if (firstBone) await motion.generateNewClip(paramsByBone, firstBone, null);
    }

    function getBatchSettings() {
        const settingsPanel = Array.from(body.children).find(
            (child) => typeof child.getBatchSettings === 'function'
        );
        return settingsPanel?.getBatchSettings?.() || null;
    }

    function playMotionAtTime(motion, time) {
        if (!motion?.mixer || !motion?.currentClip) return;
        const duration = Number(motion.currentClip.duration) || 0;
        const epsilon = 1e-6;
        const safeTime = duration > 0
            ? Math.max(0, Math.min(duration - epsilon, Number(time) || 0))
            : 0;
        const oldScale = Number(motion.mixer.timeScale);
        if (oldScale === 0) motion.mixer.timeScale = 1;
        motion.mixer.setTime(safeTime);
        motion.mixer.update(0);
        if (oldScale === 0) motion.mixer.timeScale = 0;
    }

    function applyBatchSceneSettings(sceneRef, motion, sceneSettings = {}) {
        sceneRef?.setGroundPlaneVisible?.(!!sceneSettings.showPlane);
        sceneRef?.setBackgroundColor?.(sceneSettings.backgroundColor || '#ffffff');
        motion?.setMeshOpacity?.(sceneSettings.meshOpacity);
        motion?.setSkeletonHelperVisible?.(sceneSettings.showSkeleton !== false);
    }

    async function runGeneration() {
        const rows = collectCompleteRows();
        if (rows.length < 1) {
            alert('Please add at least one complete parameter row.');
            return;
        }
        if (!validateSynchronizedRows(rows)) return;

        const combinations = generationMode === 'synchronized'
            ? buildSynchronizedCombinations(rows)
            : buildCombinations(rows);
        const settings = getBatchSettings();
        if (!settings) {
            alert('Batch export settings are unavailable.');
            return;
        }
        if (exportMode === 'video') {
            await runVideoGeneration(combinations, settings);
            return;
        }
        await runGlbGeneration(combinations, settings);
    }

    async function runGlbGeneration(combinations, settings) {
        const zip = new JSZip();
        const loading = showWorkspaceLoadingOverlay(`Generating ${files.length * combinations.length} animations...`);
        let done = 0;
        const total = files.length * combinations.length;

        try {
            for (const file of files) {
                const loaded = await loadMotionForGeneration(file);
                try {
                    const motion = loaded.motion;
                    const folder = zip.folder(getFileBase(file.name));
                    motion.setClipRepeat?.(settings.clipRepeat, false);
                    const originalGenerationClip = motion.originClip.clone();

                    for (const combo of combinations) {
                        await applyComboToMotion(motion, originalGenerationClip, combo);
                        const blob = await motion.exportGLBBlob();
                        folder.file(`${getFileBase(file.name)}__${getComboLabel(combo)}.glb`, blob);
                        done += 1;
                        loading.setMessage(`Generating animations... ${done} / ${total}`);
                        loading.setProgress((done / total) * 100);
                    }
                } finally {
                    loaded.dispose();
                }
            }

            loading.setMessage('Creating ZIP...');
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            downloadBlob(zipBlob, 'batch_generation_results.zip');
            loading.setProgress(100);
        } catch (err) {
            console.error('Batch generation failed:', err);
            alert(`Batch generation failed: ${err?.message || err}`);
        } finally {
            loading.close();
        }
    }

    async function runVideoGeneration(combinations, settings) {
        if (!settings || settings.angles.length < 1) {
            alert('Please add and select at least one camera angle.');
            return;
        }

        const zip = new JSZip();
        const total = files.length * combinations.length * settings.angles.length;
        const loading = showWorkspaceLoadingOverlay(`Recording ${total} videos...`);
        let doneAngles = 0;

        try {
            for (const file of files) {
                const loaded = await loadMotionForGeneration(file);
                try {
                    const motion = loaded.motion;
                    const sceneRef = loaded.scene;
                    const repeatCount = Math.max(1, Math.round(Number(settings.clipRepeat) || 1));
                    if (repeatCount !== 1) {
                        motion.setClipRepeat?.(repeatCount, false);
                    }
                    applyBatchSceneSettings(sceneRef, motion, settings.sceneSettings);
                    const sceneContext = {
                        scene: sceneRef.scene,
                        camera: sceneRef.camera,
                        renderer: sceneRef.renderer,
                        canvas: sceneRef.renderer.domElement,
                        controls: sceneRef.controls,
                    };
                    const folder = zip.folder(getFileBase(file.name));
                    const originalGenerationClip = motion.originClip.clone();

                    for (const combo of combinations) {
                        await applyComboToMotion(motion, originalGenerationClip, combo);
                        const duration = Math.max(0.001, Number(motion.currentClip?.duration) || 1);
                        const comboLabel = getComboLabel(combo);
                        const result = await recordAnimationMultipleAngles({
                            sceneContexts: { scene: sceneContext },
                            angles: settings.angles.map((angle) => ({
                                ...angle,
                                camera: 'scene',
                                name: `${comboLabel}_${angle.name}`,
                            })),
                            playAnimation: (currentTime) => playMotionAtTime(motion, currentTime),
                            beforeEachAngle: (angle, context) => applyCameraAngle(context, angle),
                            duration,
                            fps: settings.fps,
                            resolution: settings.resolution,
                            warmupFrames: 20,
                            onProgress: (anglePercent, angleName, angleIndex, angleTotal) => {
                                const inCombo = (Number(angleIndex) || 0) + ((Number(anglePercent) || 0) / 100);
                                const comboProgress = inCombo / Math.max(1, Number(angleTotal) || settings.angles.length);
                                const overall = ((doneAngles + comboProgress * settings.angles.length) / total) * 100;
                                loading.setMessage(`Recording videos... ${Math.min(total, Math.floor(doneAngles + comboProgress * settings.angles.length) + 1)} / ${total}`);
                                loading.setProgress(overall);
                            },
                        });

                        for (const [name, data] of result.videos.entries()) {
                            folder.file(`${getFileBase(file.name)}__${name}.webm`, data.blob);
                        }
                        doneAngles += settings.angles.length;
                        loading.setProgress((doneAngles / total) * 100);
                    }
                } finally {
                    loaded.dispose();
                }
            }

            loading.setMessage('Creating ZIP...');
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            downloadBlob(zipBlob, 'batch_generation_videos.zip');
            loading.setProgress(100);
        } catch (err) {
            console.error('Batch video generation failed:', err);
            alert(`Batch video generation failed: ${err?.message || err}`);
        } finally {
            loading.close();
        }
    }

    function destroy() {
        overlay.remove();
    }

    return { destroy };
}
