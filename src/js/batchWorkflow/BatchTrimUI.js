import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { SkeletalMotion } from '../sceneSubjects/SkeletalMotion';
import { BasicScene } from '../sceneSubjects/BasicScene';
import { createPlaybackController } from '../controlFlow/PlaybackController';
import { showWorkspaceLoadingOverlay } from '../sceneSubjects/gui/WorkspaceLoadingOverlay';
import { applyGlbReimportScaleCompensation, detachExcludedAnimationExportObjects } from '../sceneSubjects/functions/exportAnimationModelOnly';

// Inject only the pane-c-playback styles (from WorkspaceLayout) needed by createPlaybackController
const PLAYBACK_STYLE_ID = 'btui-playback-style';
function injectPlaybackStyles() {
    if (document.getElementById(PLAYBACK_STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = PLAYBACK_STYLE_ID;
    s.innerHTML = `
        .pane-c-playback { border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px; display: flex; flex-direction: column; gap: 8px; }
        .pane-c-playback-controls { display: flex; gap: 8px; justify-content: flex-start; align-items: center; }
        .pane-c-playback-controls button {
            padding: 6px 14px; border-radius: 6px;
            border: 1px solid rgba(255,255,255,0.2);
            background: rgba(255,255,255,0.08); color: #fff;
            cursor: pointer; font-size: 13px; transition: background 0.15s ease;
        }
        .pane-c-playback-controls button:hover { background: rgba(255,255,255,0.18); }
        .pane-c-progress-row { display: flex; align-items: center; gap: 10px; }
        .pane-c-progress-row input[type="range"] { flex: 1; accent-color: #6f95ff; }
        .pane-c-progress-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
        .pane-c-progress-frame { min-width: 88px; text-align: right; color: #d7e2ff; font-size: 12px; font-variant-numeric: tabular-nums; }
        .pane-c-progress-time { min-width: 122px; text-align: right; color: #bcc5df; font-size: 12px; font-variant-numeric: tabular-nums; }
    `;
    document.head.appendChild(s);
}

// ---- Helpers ----

function ws(el, css) { el.style.cssText += css; }

function workspaceBtn(el, accent = false) {
    const base = accent
        ? 'border: 1px solid rgba(141,212,255,0.5); background: rgba(141,212,255,0.1); color: #8dd4ff;'
        : 'border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: #f5f6ff;';
    ws(el, `padding: 6px 14px; border-radius: 6px; ${base}
        cursor: pointer; font-size: 13px; font-weight: 500;
        transition: background 0.15s ease, border-color 0.15s ease;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`);
    el.addEventListener('mouseenter', () => {
        if (el.disabled) return;
        el.style.background = accent ? 'rgba(141,212,255,0.2)' : 'rgba(255,255,255,0.18)';
        el.style.borderColor = accent ? 'rgba(141,212,255,0.8)' : 'rgba(255,255,255,0.35)';
    });
    el.addEventListener('mouseleave', () => {
        if (el.disabled) return;
        el.style.background = accent ? 'rgba(141,212,255,0.1)' : 'rgba(255,255,255,0.08)';
        el.style.borderColor = accent ? 'rgba(141,212,255,0.5)' : 'rgba(255,255,255,0.2)';
    });
}

function sectionTitle(text) {
    const el = document.createElement('div');
    el.innerText = text;
    ws(el, 'font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.38); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 2px;');
    return el;
}

// ---- Animation helpers ----

function trimAnimationClip(sourceClip, startTime, endTime) {
    const clampedStart = Math.max(0, startTime);
    const clampedEnd = Math.min(sourceClip.duration, endTime);
    const duration = clampedEnd - clampedStart;
    if (duration <= 0) return sourceClip.clone();

    const newTracks = sourceClip.tracks.map(track => {
        const times = track.times;
        const values = track.values;
        const valueSize = times.length > 0 ? values.length / times.length : 1;
        const newTimes = [];
        const newValues = [];
        for (let i = 0; i < times.length; i++) {
            const t = times[i];
            if (t >= clampedStart - 1e-6 && t <= clampedEnd + 1e-6) {
                newTimes.push(Math.max(0, t - clampedStart));
                for (let j = 0; j < valueSize; j++) newValues.push(values[i * valueSize + j]);
            }
        }
        if (newTimes.length === 0) {
            newTimes.push(0);
            const mid = Math.min(times.length - 1, Math.floor(times.length / 2));
            for (let j = 0; j < valueSize; j++) newValues.push(values[mid * valueSize + j]);
        }
        return new track.constructor(track.name, newTimes, newValues);
    });
    return new THREE.AnimationClip(sourceClip.name + '_trimmed', duration, newTracks);
}

async function exportClipAsGLB(model, clip, filename, dirHandle) {
    const safeFilename = filename.endsWith('.glb') ? filename : filename + '.glb';
    return new Promise((resolve, reject) => {
        const exporter = new GLTFExporter();
        const restoreExcludedObjects = detachExcludedAnimationExportObjects(model);
        const restoreExportScale = applyGlbReimportScaleCompensation(model);
        const restoreExportState = () => {
            restoreExportScale();
            restoreExcludedObjects();
        };
        try {
            exporter.parse(model, async (result) => {
                restoreExportState();
                try {
                    const blob = result instanceof ArrayBuffer
                        ? new Blob([result], { type: 'model/gltf-binary' })
                        : new Blob([JSON.stringify(result)], { type: 'application/json' });
                    if (dirHandle) {
                        const fh = await dirHandle.getFileHandle(safeFilename, { create: true });
                        const w = await fh.createWritable();
                        await w.write(blob);
                        await w.close();
                    } else {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = safeFilename;
                        document.body.appendChild(a); a.click(); a.remove();
                        URL.revokeObjectURL(url);
                    }
                    resolve();
                } catch (err) { reject(err); }
            }, (err) => {
                restoreExportState();
                reject(err);
            }, { binary: true, animations: clip ? [clip] : [] });
        } catch (err) {
            restoreExportState();
            reject(err);
        }
    });
}

// ---- Main export ----

export function createBatchTrimUI({ files, sceneManager, records, onBack, onOpenLog, getSharedState, setSharedState }) {
    injectPlaybackStyles();

    let currentIndex = 0;
    let saveDirHandle = getSharedState?.().saveDirHandle ?? null;
    let batchScene = null;
    let batchSkeletalMotion = null;
    let batchPlayback = null;
    let batchActive = false;
    let trimStart = 0;
    let trimEnd = 0;

    // ---- Root overlay (full-screen workspace style) ----
    const overlay = document.createElement('div');
    ws(overlay, `position: fixed; inset: 0; z-index: 11000;
        background: #0f1117; display: flex; flex-direction: column;
        font-family: 'Segoe UI', sans-serif; color: #f5f5f5; font-size: 13px;`);

    // ---- Header bar ----
    const header = document.createElement('div');
    ws(header, `display: flex; align-items: center; gap: 12px; padding: 10px 20px;
        background: rgba(0,0,0,0.4); border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;`);

    const backBtn = document.createElement('button');
    backBtn.type = 'button'; backBtn.innerText = '← Back to File List';
    workspaceBtn(backBtn);
    backBtn.addEventListener('click', () => {
        if (confirm('Return to file list? Unexported animations will not be saved.')) {
            destroy(); onBack?.();
        }
    });

    const titleEl = document.createElement('div');
    titleEl.innerText = 'Batch Preprocessing';
    ws(titleEl, 'font-size: 15px; font-weight: 600;');

    const progressEl = document.createElement('div');
    ws(progressEl, 'font-size: 13px; color: #8dd4ff; white-space: nowrap;');

    const currentFileEl = document.createElement('div');
    ws(currentFileEl, 'flex: 1; font-size: 12px; color: #bcc5df; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;');

    const logBtn = document.createElement('button');
    logBtn.type = 'button'; logBtn.innerText = 'View Log';
    workspaceBtn(logBtn);
    logBtn.addEventListener('click', () => onOpenLog?.());

    header.appendChild(backBtn);
    header.appendChild(titleEl);
    header.appendChild(progressEl);
    header.appendChild(currentFileEl);
    header.appendChild(logBtn);

    // ---- Main area ----
    const mainArea = document.createElement('div');
    ws(mainArea, 'display: flex; flex: 1; min-height: 0;');

    // Viewport
    const viewportEl = document.createElement('div');
    ws(viewportEl, 'flex: 1; position: relative; min-width: 0; background: #161925;');

    // ---- Sidebar ----
    const sidebar = document.createElement('div');
    ws(sidebar, `width: 248px; flex-shrink: 0;
        background: rgba(8,12,20,0.82);
        border-left: 1px solid rgba(255,255,255,0.08);
        padding: 16px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto;
        scrollbar-width: thin; scrollbar-color: rgba(141,212,255,0.3) transparent;`);

    function sidebarSection(titleText, ...children) {
        const sec = document.createElement('div');
        ws(sec, 'display: flex; flex-direction: column; gap: 6px;');
        sec.appendChild(sectionTitle(titleText));
        children.forEach(c => { if (c) sec.appendChild(c); });
        return sec;
    }

    // Save directory
    const setDirBtn = document.createElement('button');
    setDirBtn.type = 'button';
    workspaceBtn(setDirBtn, true);
    ws(setDirBtn, 'width: 100%; box-sizing: border-box; text-align: left;');
    updateSaveDirBtn();
    setDirBtn.addEventListener('click', async () => {
        if (!('showDirectoryPicker' in window)) { saveDirHandle = null; setSharedState?.({ saveDirHandle: null }); updateSaveDirBtn(); return; }
        try {
            saveDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            setSharedState?.({ saveDirHandle });
            updateSaveDirBtn();
        } catch (e) { if (e.name !== 'AbortError') console.error(e); }
    });
    const saveDirHintEl = document.createElement('div');
    ws(saveDirHintEl, 'font-size: 11px; color: rgba(255,255,255,0.28);');
    saveDirHintEl.innerText = !('showDirectoryPicker' in window) ? 'Unsupported browser — files will download.' : '';
    sidebar.appendChild(sidebarSection('Save Directory', setDirBtn, saveDirHintEl.innerText ? saveDirHintEl : null));

    // Status badges
    const exportedBadge = document.createElement('span');
    const trimmedBadge = document.createElement('span');
    [exportedBadge, trimmedBadge].forEach(b => {
        ws(b, `display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;
            border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.4);`);
    });
    const badgeRow = document.createElement('div');
    ws(badgeRow, 'display: flex; gap: 6px; flex-wrap: wrap;');
    badgeRow.appendChild(exportedBadge);
    badgeRow.appendChild(trimmedBadge);
    sidebar.appendChild(sidebarSection('Status', badgeRow));

    // Export name
    const fileNameInput = document.createElement('input');
    fileNameInput.type = 'text'; fileNameInput.placeholder = 'animation_trimmed';
    ws(fileNameInput, `width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.2); color: #fff; font-size: 13px;
        font-family: inherit;`);
    sidebar.appendChild(sidebarSection('Export Filename', fileNameInput));

    // Navigation
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button'; prevBtn.innerText = '← Prev';
    workspaceBtn(prevBtn);
    prevBtn.addEventListener('click', () => loadFile(currentIndex - 1));
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button'; nextBtn.innerText = 'Next →';
    workspaceBtn(nextBtn);
    nextBtn.addEventListener('click', () => loadFile(currentIndex + 1));
    const navRow = document.createElement('div');
    ws(navRow, 'display: flex; gap: 6px;');
    [prevBtn, nextBtn].forEach(b => { ws(b, 'flex: 1; text-align: center;'); navRow.appendChild(b); });
    sidebar.appendChild(sidebarSection('Navigate', navRow));

    // Export buttons
    const exportBtn = document.createElement('button');
    exportBtn.type = 'button'; exportBtn.innerText = 'Export';
    workspaceBtn(exportBtn, true);
    ws(exportBtn, 'width: 100%; box-sizing: border-box;');
    exportBtn.addEventListener('click', () => doExport(false));

    const exportNextBtn = document.createElement('button');
    exportNextBtn.type = 'button'; exportNextBtn.innerText = 'Export & Next';
    workspaceBtn(exportNextBtn);
    ws(exportNextBtn, 'width: 100%; box-sizing: border-box; margin-top: 4px;');
    exportNextBtn.addEventListener('click', () => doExport(true));
    sidebar.appendChild(sidebarSection('Export', exportBtn, exportNextBtn));

    mainArea.appendChild(viewportEl);
    mainArea.appendChild(sidebar);

    // ---- Bottom bar: trim + playback ----
    const bottomBar = document.createElement('div');
    ws(bottomBar, `flex-shrink: 0; padding: 10px 20px 12px;
        background: rgba(0,0,0,0.45); border-top: 1px solid rgba(255,255,255,0.08);
        display: flex; flex-direction: column; gap: 8px;`);

    // Trim track visual
    const trimTrackWrap = document.createElement('div');
    ws(trimTrackWrap, 'position: relative; height: 16px;');
    const trimTrackBg = document.createElement('div');
    ws(trimTrackBg, `position: absolute; top: 50%; transform: translateY(-50%);
        left: 0; right: 0; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px;`);
    const trimTrackFill = document.createElement('div');
    ws(trimTrackFill, `position: absolute; top: 50%; transform: translateY(-50%);
        height: 4px; background: rgba(141,212,255,0.5); border-radius: 2px; pointer-events: none;`);
    trimTrackFill.style.left = '0%'; trimTrackFill.style.width = '100%';
    trimTrackWrap.appendChild(trimTrackBg);
    trimTrackWrap.appendChild(trimTrackFill);

    // Trim sliders row
    const trimRow = document.createElement('div');
    ws(trimRow, 'display: flex; gap: 12px; align-items: center;');

    function trimGroup(labelText) {
        const g = document.createElement('div');
        ws(g, 'display: flex; align-items: center; gap: 6px; flex: 1;');
        const lbl = document.createElement('span');
        lbl.innerText = labelText;
        ws(lbl, 'font-size: 11px; color: rgba(255,255,255,0.38); white-space: nowrap;');
        const slider = document.createElement('input');
        slider.type = 'range'; slider.min = '0'; slider.max = '1000';
        ws(slider, 'flex: 1; accent-color: #6f95ff;');
        const val = document.createElement('div');
        ws(val, 'min-width: 46px; text-align: right; color: #8dd4ff; font-variant-numeric: tabular-nums; font-size: 12px;');
        g.appendChild(lbl); g.appendChild(slider); g.appendChild(val);
        return { group: g, slider, val };
    }

    const trimStartCtrl = trimGroup('Start');
    trimStartCtrl.slider.value = '0';
    trimStartCtrl.val.innerText = '0.00s';
    const trimEndCtrl = trimGroup('End');
    trimEndCtrl.slider.value = '1000';
    trimEndCtrl.val.innerText = '0.00s';

    trimRow.appendChild(trimStartCtrl.group);
    trimRow.appendChild(trimEndCtrl.group);
    bottomBar.appendChild(trimTrackWrap);
    bottomBar.appendChild(trimRow);

    overlay.appendChild(header);
    overlay.appendChild(mainArea);
    overlay.appendChild(bottomBar);
    document.body.appendChild(overlay);

    // ---- Three.js setup ----
    batchScene = new BasicScene(viewportEl, sceneManager);
    batchSkeletalMotion = new SkeletalMotion(sceneManager);

    batchPlayback = createPlaybackController({
        getTypeSelection: () => 'skeleton',
        getSkeletalMotion: () => batchSkeletalMotion,
        getPldMotion: () => null,
        onAfterSeek: () => {},
    });

    const playbackUI = batchPlayback.createControls();
    // Remove default border-top from playback root since bottom bar already has separation
    playbackUI.root.style.borderTop = 'none';
    playbackUI.root.style.paddingTop = '0';
    bottomBar.appendChild(playbackUI.root);

    // Trim slider events — pause + seek to corresponding frame while dragging
    trimStartCtrl.slider.addEventListener('input', () => {
        const duration = batchSkeletalMotion?.sourceClip?.duration || 0;
        if (!duration) return;
        trimStart = (Number(trimStartCtrl.slider.value) / 1000) * duration;
        if (trimStart > trimEnd - 0.033) {
            trimStart = Math.max(0, trimEnd - 0.033);
            trimStartCtrl.slider.value = String(Math.round((trimStart / duration) * 1000));
        }
        updateTrimDisplay(duration);
        updateTrimRecord(duration);
        batchPlayback.applyPausedState(true);
        batchPlayback.seekByTime(trimStart);
    });

    trimEndCtrl.slider.addEventListener('input', () => {
        const duration = batchSkeletalMotion?.sourceClip?.duration || 0;
        if (!duration) return;
        trimEnd = (Number(trimEndCtrl.slider.value) / 1000) * duration;
        if (trimEnd < trimStart + 0.033) {
            trimEnd = Math.min(duration, trimStart + 0.033);
            trimEndCtrl.slider.value = String(Math.round((trimEnd / duration) * 1000));
        }
        updateTrimDisplay(duration);
        updateTrimRecord(duration);
        batchPlayback.applyPausedState(true);
        batchPlayback.seekByTime(trimEnd);
    });

    // Viewport resize
    const resizeObserver = new ResizeObserver(entries => {
        entries.forEach(e => batchScene?.resize(e.contentRect.width, e.contentRect.height));
    });
    resizeObserver.observe(viewportEl);

    // Drive playback via sceneManager — advance within [trimStart, trimEnd]
    batchActive = true;
    sceneManager.addExternalUpdate((delta) => {
        if (!batchActive) return;
        if (!batchPlayback.isPaused() && !batchPlayback.isScrubbing()) {
            const trimDuration = trimEnd - trimStart;
            if (trimDuration > 0.033) {
                const current = batchPlayback.getCurrentTime();
                let next = current + delta;
                if (next >= trimEnd) {
                    // Wrap back to trimStart when reaching trimEnd
                    next = trimStart + ((next - trimStart) % trimDuration);
                } else if (next < trimStart) {
                    next = trimStart;
                }
                batchPlayback.seekByTime(next, { updateUI: false, wrap: false });
            } else {
                batchPlayback.advance(delta);
            }
        }
        batchPlayback.updateUI();
    });

    loadFile(0);

    // ---- Internal functions ----

    function updateSaveDirBtn() {
        if (saveDirHandle) {
            setDirBtn.innerText = `Save to: ${saveDirHandle.name}`;
            setDirBtn.title = saveDirHandle.name;
        } else {
            setDirBtn.innerText = 'Select Output Directory';
            setDirBtn.title = '';
        }
    }

    function updateProgress() {
        progressEl.innerText = `${currentIndex + 1} / ${files.length}`;
        currentFileEl.innerText = files[currentIndex]?.name || '';
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex >= files.length - 1;
        [prevBtn, nextBtn].forEach(b => { b.style.opacity = b.disabled ? '0.4' : '1'; b.style.cursor = b.disabled ? 'default' : 'pointer'; });
    }

    function updateTrimDisplay(duration) {
        if (!duration) return;
        trimStartCtrl.val.innerText = trimStart.toFixed(2) + 's';
        trimEndCtrl.val.innerText = trimEnd.toFixed(2) + 's';
        const s = trimStart / duration;
        const e = trimEnd / duration;
        trimTrackFill.style.left = `${s * 100}%`;
        trimTrackFill.style.width = `${(e - s) * 100}%`;
    }

    function updateTrimRecord(duration) {
        if (!records || currentIndex < 0 || currentIndex >= records.length) return;
        const isTrimmed = trimStart > 1e-3 || trimEnd < duration - 1e-3;
        records[currentIndex].trimmed = isTrimmed;
        records[currentIndex].trimStart = trimStart;
        records[currentIndex].trimEnd = trimEnd;
        updateStatusBadges();
    }

    function updateStatusBadges() {
        if (!records || currentIndex < 0) return;
        const rec = records[currentIndex];
        if (!rec) return;

        if (rec.exported) {
            ws(exportedBadge, '');
            exportedBadge.style.cssText = `display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;
                background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.35);`;
            exportedBadge.innerText = 'Exported';
        } else {
            exportedBadge.style.cssText = `display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;
                background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.38); border: 1px solid rgba(255,255,255,0.1);`;
            exportedBadge.innerText = 'Not Exported';
        }

        if (rec.trimmed) {
            trimmedBadge.style.cssText = `display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;
                background: rgba(141,212,255,0.12); color: #8dd4ff; border: 1px solid rgba(141,212,255,0.3);`;
            trimmedBadge.innerText = 'Trimmed';
            trimmedBadge.style.display = 'inline-block';
        } else {
            trimmedBadge.style.display = 'none';
        }
    }

    async function loadFile(index) {
        if (index < 0 || index >= files.length) return;
        currentIndex = index;
        updateProgress();

        const file = files[index];
        const loadingOverlay = showWorkspaceLoadingOverlay(`Loading: ${file.name}`);
        try {
            batchSkeletalMotion.resetState();
            await batchSkeletalMotion.loadSkeletalMotionFromFile(file, ({ percent }) => {
                if (Number.isFinite(percent)) loadingOverlay.setProgress(percent);
            });
            loadingOverlay.setProgress(100);
            batchSkeletalMotion.configureAnimation(batchScene.scene);

            const duration = batchSkeletalMotion.sourceClip?.duration || 0;
            if (records && records[index]) records[index].sourceDuration = duration;

            trimStart = 0;
            trimEnd = duration;
            trimStartCtrl.slider.value = '0';
            trimEndCtrl.slider.value = '1000';
            updateTrimDisplay(duration);
            updateStatusBadges();

            fileNameInput.value = file.name.replace(/\.[^.]+$/, '') + '_trim';

            // Start playback from trimStart (= 0 initially)
            batchPlayback.applyPausedState(false);
            batchPlayback.seekByTime(trimStart, { updateUI: false, wrap: false });
            batchPlayback.updateUI(true);
        } catch (err) {
            console.error('Batch load error:', err);
            alert(`Failed to load: ${file.name}\n${err?.message || err}`);
        } finally {
            loadingOverlay.close();
        }
    }

    async function doExport(andNext) {
        const model = batchSkeletalMotion?.model;
        const sourceClip = batchSkeletalMotion?.sourceClip;
        if (!model || !sourceClip) { alert('No animation loaded.'); return; }

        const rawName = fileNameInput.value.trim() || 'trimmed';
        const trimmedClip = trimAnimationClip(sourceClip, trimStart, trimEnd);

        exportBtn.disabled = true; exportNextBtn.disabled = true;
        exportBtn.style.opacity = '0.45'; exportNextBtn.style.opacity = '0.45';
        try {
            await exportClipAsGLB(model, trimmedClip, rawName, saveDirHandle);

            if (records && records[currentIndex]) {
                records[currentIndex].exported = true;
                records[currentIndex].exportedName = rawName.endsWith('.glb') ? rawName : rawName + '.glb';
                records[currentIndex].trimmed = trimStart > 1e-3 || trimEnd < sourceClip.duration - 1e-3;
            }
            updateStatusBadges();

            if (andNext) {
                if (currentIndex >= files.length - 1) { destroy(); onBack?.({ allDone: true }); return; }
                await loadFile(currentIndex + 1);
            }
        } catch (err) {
            console.error('Export error:', err);
            alert(`Export failed: ${err?.message || err}`);
        } finally {
            exportBtn.disabled = false; exportNextBtn.disabled = false;
            exportBtn.style.opacity = '1'; exportNextBtn.style.opacity = '1';
        }
    }

    function destroy() {
        batchActive = false;
        resizeObserver.disconnect();
        batchSkeletalMotion?.resetState?.();
        batchScene?.dispose?.();
        overlay.remove();
    }

    return { destroy };
}
