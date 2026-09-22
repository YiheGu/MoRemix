import { createBatchTrimUI } from './BatchTrimUI';
import { createBatchStatsUI } from './BatchStatsUI';
import { createBatchGenerationUI } from './BatchGenerationUI';
import { applyModalPrimaryButtonStyle, setModalPrimaryButtonDisabled } from '../sceneSubjects/gui/ModalPrimaryButtonStyle.js';

const importModalBg = new URL('../../assets/Background.png', import.meta.url);

const SKELETAL_EXTS = new Set(['fbx', 'glb', 'gltf']);
function getExt(filename) { const p = filename.split('.'); return p.length > 1 ? p[p.length - 1].toLowerCase() : ''; }
function filterSkeletalFiles(fileList) { return Array.from(fileList).filter(f => SKELETAL_EXTS.has(getExt(f.name))); }

// Merge new files into existing list, deduplicate by name+size
function mergeFiles(existing, incoming) {
    const keys = new Set(existing.map(f => `${f.name}::${f.size}`));
    const added = [];
    for (const f of incoming) {
        const k = `${f.name}::${f.size}`;
        if (!keys.has(k)) { keys.add(k); added.push(f); }
    }
    return [...existing, ...added];
}

// ---- Shared inline-style helpers (modal style, matching FileFomatSelectModal) ----

function modalOverlay() {
    const el = document.createElement('div');
    el.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.45);
        display: none; justify-content: center; align-items: center;
        z-index: 10500; font-family: 'Segoe UI', sans-serif;
    `;
    const bg = document.createElement('div');
    bg.style.cssText = `
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background-image: url("${importModalBg.href}");
        background-size: cover; background-position: center;
        filter: blur(5px) brightness(50%); z-index: -1;
    `;
    el.appendChild(bg);
    return el;
}

function modalContainer(minWidth = '440px', maxWidth = '640px') {
    const el = document.createElement('div');
    el.style.cssText = `
        background: #1e1e1e; padding: 32px; border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.35);
        min-width: ${minWidth}; max-width: ${maxWidth};
        color: #f5f5f5; display: flex; flex-direction: column; gap: 20px;
        position: relative; max-height: 88vh; overflow-y: auto;
        scrollbar-width: thin; scrollbar-color: rgba(141,212,255,0.4) transparent;
    `;
    return el;
}

function modalCloseBtn(onClick) {
    const btn = document.createElement('button');
    btn.innerText = 'X';
    btn.style.cssText = `
        position: absolute; top: 12px; right: 12px;
        background: transparent; border: none; color: #b0b0b0;
        font-size: 16px; cursor: pointer; padding: 4px; line-height: 1;
    `;
    btn.addEventListener('mouseover', () => { btn.style.color = '#fff'; });
    btn.addEventListener('mouseout', () => { btn.style.color = '#b0b0b0'; });
    btn.addEventListener('click', onClick);
    return btn;
}

function modalSectionLabel(text) {
    const el = document.createElement('div');
    el.innerText = text;
    el.style.cssText = 'font-size: 12px; font-weight: 600; color: #b0b0b0; text-transform: uppercase; letter-spacing: 0.5px;';
    return el;
}

function modalSecondaryBtn(text, onClick) {
    const btn = document.createElement('button');
    btn.innerText = text;
    btn.style.cssText = `
        padding: 8px 20px; border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.07); color: #d2daf1;
        cursor: pointer; font-size: 13px; font-weight: 500;
        transition: background 0.15s ease;
    `;
    btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,255,255,0.14)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(255,255,255,0.07)'; });
    btn.addEventListener('click', onClick);
    return btn;
}

function modalAccentBtn(text, onClick) {
    const btn = document.createElement('button');
    btn.innerText = text;
    btn.style.cssText = `
        padding: 8px 20px; border-radius: 8px;
        border: 1px solid rgba(141,212,255,0.35);
        background: rgba(141,212,255,0.08); color: #8dd4ff;
        cursor: pointer; font-size: 13px; font-weight: 500;
        transition: background 0.15s ease;
    `;
    btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(141,212,255,0.18)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(141,212,255,0.08)'; });
    btn.addEventListener('click', onClick);
    return btn;
}

// ---- Log modal ----

function createBatchLogModal(getRecords) {
    const overlay = modalOverlay();
    const panel = modalContainer('480px', '580px');
    panel.style.gap = '0';
    panel.style.padding = '0';
    panel.style.maxHeight = '88vh';
    panel.style.overflow = 'hidden';
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';

    // Header
    const hdr = document.createElement('div');
    hdr.style.cssText = 'padding: 24px 28px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;';
    const hTitle = document.createElement('h2');
    hTitle.innerText = 'Batch Processing Log';
    hTitle.style.cssText = 'margin: 0; font-size: 18px; color: #fff;';
    hdr.appendChild(hTitle);
    hdr.appendChild(modalCloseBtn(() => overlay.style.display = 'none'));

    // Body
    const body = document.createElement('div');
    body.style.cssText = 'padding: 20px 28px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 20px; scrollbar-width: thin; scrollbar-color: rgba(141,212,255,0.4) transparent;';

    // Footer
    const ftr = document.createElement('div');
    ftr.style.cssText = 'padding: 14px 28px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: flex-end; flex-shrink: 0;';
    ftr.appendChild(modalSecondaryBtn('Close', () => overlay.style.display = 'none'));

    panel.appendChild(hdr);
    panel.appendChild(body);
    panel.appendChild(ftr);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    function statGroup(label, items, accentColor) {
        const g = document.createElement('div');
        g.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

        const topRow = document.createElement('div');
        topRow.style.cssText = 'display: flex; align-items: baseline; gap: 10px;';
        const lbl = document.createElement('div');
        lbl.style.cssText = 'font-size: 12px; font-weight: 600; color: #b0b0b0; text-transform: uppercase; letter-spacing: 0.5px; flex: 1;';
        lbl.innerText = label;
        const cnt = document.createElement('div');
        cnt.style.cssText = `font-size: 22px; font-weight: 700; color: ${accentColor};`;
        cnt.innerText = String(items.length);
        topRow.appendChild(lbl);
        topRow.appendChild(cnt);
        g.appendChild(topRow);

        if (items.length > 0) {
            const list = document.createElement('div');
            list.style.cssText = `
                border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
                background: rgba(0,0,0,0.2); padding: 6px 0;
                max-height: 140px; overflow-y: auto;
                scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.2) transparent;
            `;
            items.forEach((rec, i) => {
                const row = document.createElement('div');
                row.style.cssText = `
                    padding: 5px 14px; font-size: 12px; color: #d2daf1;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                    display: flex; gap: 8px; align-items: center;
                `;
                if (i === items.length - 1) row.style.borderBottom = 'none';
                const idx = document.createElement('span');
                idx.style.cssText = 'color: #5a7aaa; min-width: 22px; font-variant-numeric: tabular-nums;';
                idx.innerText = `${i + 1}.`;
                const name = document.createElement('span');
                name.style.cssText = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
                name.innerText = rec.filename;
                row.appendChild(idx); row.appendChild(name);
                list.appendChild(row);
            });
            g.appendChild(list);
        } else {
            const empty = document.createElement('div');
            empty.style.cssText = 'font-size: 12px; color: #5a7aaa; font-style: italic;';
            empty.innerText = '(none)';
            g.appendChild(empty);
        }
        return g;
    }

    function refresh() {
        body.innerHTML = '';
        const records = getRecords();
        if (!records || records.length === 0) {
            const hint = document.createElement('div');
            hint.style.cssText = 'color: #b0b0b0; font-size: 13px;';
            hint.innerText = 'No batch session active yet.';
            body.appendChild(hint);
            return;
        }
        const exported = records.filter(r => r.exported);
        const notExported = records.filter(r => !r.exported);
        const trimmed = records.filter(r => r.trimmed);
        const notTrimmed = records.filter(r => !r.trimmed);

        // Summary row
        const sumRow = document.createElement('div');
        sumRow.style.cssText = 'display: flex; gap: 20px; padding: 14px 16px; background: rgba(141,212,255,0.06); border: 1px solid rgba(141,212,255,0.12); border-radius: 10px;';
        function sumItem(label, n, color) {
            const d = document.createElement('div');
            d.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';
            const c = document.createElement('div');
            c.style.cssText = `font-size: 20px; font-weight: 700; color: ${color};`;
            c.innerText = String(n);
            const l = document.createElement('div');
            l.style.cssText = 'font-size: 11px; color: #b0b0b0;';
            l.innerText = label;
            d.appendChild(c); d.appendChild(l);
            return d;
        }
        sumRow.appendChild(sumItem('Total', records.length, '#f5f5f5'));
        sumRow.appendChild(sumItem('Exported', exported.length, '#4ade80'));
        sumRow.appendChild(sumItem('Not Exported', notExported.length, '#b0b0b0'));
        sumRow.appendChild(sumItem('Trimmed', trimmed.length, '#8dd4ff'));
        body.appendChild(sumRow);

        // Divider
        const div = document.createElement('hr');
        div.style.cssText = 'border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 0;';
        body.appendChild(div);

        body.appendChild(statGroup('Exported', exported, '#4ade80'));
        body.appendChild(statGroup('Not Exported', notExported, '#b0b0b0'));
        body.appendChild(statGroup('Trimmed', trimmed, '#8dd4ff'));
        body.appendChild(statGroup('Not Trimmed', notTrimmed, '#7a8aaa'));
    }

    return {
        show() { refresh(); overlay.style.display = 'flex'; },
        hide() { overlay.style.display = 'none'; },
        destroy() { overlay.remove(); },
    };
}

// ---- Main ----

export function createBatchWorkflow({ sceneManager, onClose, onViewChange }) {
    let selectedFiles = [];
    let activeTrimUI = null;
    let activeStatsUI = null;
    let activeGenerationUI = null;
    let records = [];
    const sharedState = { saveDirHandle: null };
    const logModal = createBatchLogModal(() => records);

    // ---- Phase 1 overlay (modal dialog style) ----
    const overlay = modalOverlay();

    const panel = modalContainer('480px', '640px');

    // Close button
    panel.appendChild(modalCloseBtn(() => { overlay.style.display = 'none'; onClose?.(); }));

    // Title
    const titleEl = document.createElement('h2');
    titleEl.innerText = 'Batch Workflow';
    titleEl.style.cssText = 'margin: 0; font-size: 20px; text-align: center; color: #fff;';
    panel.appendChild(titleEl);

    // Step 1 — File / folder pickers
    const step1Section = document.createElement('div');
    step1Section.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';
    step1Section.appendChild(modalSectionLabel('Step 1 — Add Animation Files'));

    // Two picker buttons side by side
    const pickerRow = document.createElement('div');
    pickerRow.style.cssText = 'display: flex; gap: 10px;';

    function pickerBtn(icon, label) {
        const btn = document.createElement('button');
        btn.innerHTML = `${icon}&nbsp;&nbsp;${label}`;
        btn.style.cssText = `
            flex: 1; padding: 12px 10px; border-radius: 10px;
            border: 1px dashed rgba(0,132,255,0.5);
            background: rgba(0,132,255,0.07); color: #60b8ff;
            cursor: pointer; font-size: 13px; font-weight: 500;
            text-align: center; transition: background 0.2s ease, border-color 0.2s ease;
        `;
        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'rgba(0,132,255,0.15)';
            btn.style.borderColor = 'rgba(0,132,255,0.8)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'rgba(0,132,255,0.07)';
            btn.style.borderColor = 'rgba(0,132,255,0.5)';
        });
        return btn;
    }

    const addFolderBtn = pickerBtn('📁', 'Add Folder');
    const addFilesBtn  = pickerBtn('📄', 'Add Files');

    // Hidden inputs
    const folderInput = document.createElement('input');
    folderInput.type = 'file'; folderInput.multiple = true;
    folderInput.setAttribute('webkitdirectory', '');
    folderInput.style.display = 'none';
    folderInput.addEventListener('change', () => {
        selectedFiles = mergeFiles(selectedFiles, filterSkeletalFiles(folderInput.files));
        folderInput.value = '';
        renderFileList();
    });

    const filesInput = document.createElement('input');
    filesInput.type = 'file'; filesInput.multiple = true;
    filesInput.accept = '.fbx,.glb,.gltf';
    filesInput.style.display = 'none';
    filesInput.addEventListener('change', () => {
        selectedFiles = mergeFiles(selectedFiles, filterSkeletalFiles(filesInput.files));
        filesInput.value = '';
        renderFileList();
    });

    addFolderBtn.addEventListener('click', () => folderInput.click());
    addFilesBtn.addEventListener('click',  () => filesInput.click());

    pickerRow.appendChild(addFolderBtn);
    pickerRow.appendChild(addFilesBtn);
    step1Section.appendChild(pickerRow);
    step1Section.appendChild(folderInput);
    step1Section.appendChild(filesInput);
    panel.appendChild(step1Section);

    // File list section
    const listSection = document.createElement('div');
    listSection.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

    const listHeader = document.createElement('div');
    listHeader.style.cssText = 'display: flex; align-items: center; justify-content: space-between;';
    const listLabel = modalSectionLabel('File Queue');
    const clearAllBtn = document.createElement('button');
    clearAllBtn.innerText = 'Clear All';
    clearAllBtn.style.cssText = `
        font-size: 11px; padding: 2px 8px; border-radius: 4px;
        border: 1px solid rgba(255,80,80,0.3); background: rgba(255,80,80,0.06);
        color: #ff8080; cursor: pointer; display: none; transition: background 0.15s ease;
    `;
    clearAllBtn.addEventListener('mouseenter', () => { clearAllBtn.style.background = 'rgba(255,80,80,0.14)'; });
    clearAllBtn.addEventListener('mouseleave', () => { clearAllBtn.style.background = 'rgba(255,80,80,0.06)'; });
    clearAllBtn.addEventListener('click', () => {
        selectedFiles = [];
        renderFileList();
    });
    listHeader.appendChild(listLabel);
    listHeader.appendChild(clearAllBtn);

    const fileSummary = document.createElement('div');
    fileSummary.style.cssText = `
        padding: 8px 12px; border-radius: 8px;
        background: rgba(141,212,255,0.06); border: 1px solid rgba(141,212,255,0.15);
        font-size: 13px; color: #8dd4ff; display: none;
    `;
    const fileListEl = document.createElement('div');
    fileListEl.style.cssText = `
        max-height: 200px; overflow-y: auto;
        border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);
        background: rgba(0,0,0,0.2); padding: 6px 0; display: none;
        scrollbar-width: thin; scrollbar-color: rgba(141,212,255,0.4) transparent;
    `;
    const emptyHint = document.createElement('div');
    emptyHint.style.cssText = 'font-size: 13px; color: #b0b0b0;';
    emptyHint.innerText = 'Add a folder or individual files to get started.';

    listSection.appendChild(listHeader);
    listSection.appendChild(emptyHint);
    listSection.appendChild(fileSummary);
    listSection.appendChild(fileListEl);
    panel.appendChild(listSection);

    // Batch operations section
    const opsSection = document.createElement('div');
    opsSection.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';
    opsSection.appendChild(modalSectionLabel('Batch Operations'));

    const trimActionBtn = document.createElement('button');
    trimActionBtn.style.cssText = `
        padding: 14px 18px; border-radius: 10px; text-align: left;
        border: 1px solid rgba(67,124,204,0.5);
        background: rgba(67,124,204,0.1); color: #f5f5f5;
        cursor: pointer; font-size: 14px; font-weight: 500;
        transition: background 0.15s ease;
    `;
    trimActionBtn.innerHTML = `<div>✂ &nbsp;Batch Preprocessing</div><div style="font-size:11px;color:#b0b0b0;margin-top:4px;">Preview, trim, and export each animation as a GLB file.</div>`;
    setModalPrimaryButtonDisabled(trimActionBtn, true);
    trimActionBtn.addEventListener('mouseenter', () => { if (!trimActionBtn.disabled) trimActionBtn.style.background = 'rgba(67,124,204,0.2)'; });
    trimActionBtn.addEventListener('mouseleave', () => { if (!trimActionBtn.disabled) trimActionBtn.style.background = 'rgba(67,124,204,0.1)'; });
    trimActionBtn.addEventListener('click', () => {
        if (selectedFiles.length === 0 || trimActionBtn.disabled) return;
        showTrimView();
        return;
        records = selectedFiles.map((f, i) => ({
            index: i, filename: f.name, sourceDuration: 0,
            trimmed: false, trimStart: null, trimEnd: null,
            exported: false, exportedName: null,
        }));
        overlay.style.display = 'none';
        activeTrimUI = createBatchTrimUI({
            files: selectedFiles, sceneManager, records,
            onOpenLog: () => logModal.show(),
            getSharedState: () => sharedState,
            setSharedState: (u) => Object.assign(sharedState, u),
            onBack: (result) => {
                activeTrimUI = null;
                overlay.style.display = 'flex';
                if (result?.allDone) {
                    fileSummary.innerText = `✓ All ${selectedFiles.length} files processed.`;
                    fileSummary.style.display = 'block';
                }
            },
        });
    });
    opsSection.appendChild(trimActionBtn);

    // Batch Statistics button
    const statsActionBtn = document.createElement('button');
    statsActionBtn.style.cssText = `
        padding: 14px 18px; border-radius: 10px; text-align: left;
        border: 1px solid rgba(141,212,255,0.3);
        background: rgba(141,212,255,0.06); color: #f5f5f5;
        cursor: pointer; font-size: 14px; font-weight: 500;
        transition: background 0.15s ease;
    `;
    statsActionBtn.innerHTML = `<div>📊 &nbsp;Batch Statistics</div><div style="font-size:11px;color:#b0b0b0;margin-top:4px;">Compute bone metrics across all files and export as CSV.</div>`;
    setModalPrimaryButtonDisabled(statsActionBtn, true);
    statsActionBtn.addEventListener('mouseenter', () => { if (!statsActionBtn.disabled) statsActionBtn.style.background = 'rgba(141,212,255,0.14)'; });
    statsActionBtn.addEventListener('mouseleave', () => { if (!statsActionBtn.disabled) statsActionBtn.style.background = 'rgba(141,212,255,0.06)'; });
    statsActionBtn.addEventListener('click', () => {
        if (selectedFiles.length === 0 || statsActionBtn.disabled) return;
        showStatsView();
        return;
        overlay.style.display = 'none';
        const statsUI = createBatchStatsUI({
            files: selectedFiles,
            sceneManager,
            onBack: () => {
                statsUI?.destroy?.();
                overlay.style.display = 'flex';
            },
        });
    });
    opsSection.appendChild(statsActionBtn);

    const generationActionBtn = document.createElement('button');
    generationActionBtn.style.cssText = `
        padding: 14px 18px; border-radius: 10px; text-align: left;
        border: 1px solid rgba(94,234,212,0.3);
        background: rgba(94,234,212,0.06); color: #f5f5f5;
        cursor: pointer; font-size: 14px; font-weight: 500;
        transition: background 0.15s ease;
    `;
    generationActionBtn.innerHTML = `<div>Batch Generation</div><div style="font-size:11px;color:#b0b0b0;margin-top:4px;">Check bone lists, generate parameter combinations, and export GLBs as a ZIP.</div>`;
    setModalPrimaryButtonDisabled(generationActionBtn, true);
    generationActionBtn.addEventListener('mouseenter', () => { if (!generationActionBtn.disabled) generationActionBtn.style.background = 'rgba(94,234,212,0.14)'; });
    generationActionBtn.addEventListener('mouseleave', () => { if (!generationActionBtn.disabled) generationActionBtn.style.background = 'rgba(94,234,212,0.06)'; });
    generationActionBtn.addEventListener('click', () => {
        if (selectedFiles.length === 0 || generationActionBtn.disabled) return;
        showGenerationView();
        return;
        overlay.style.display = 'none';
        const generationUI = createBatchGenerationUI({
            files: selectedFiles,
            onBack: () => {
                generationUI?.destroy?.();
                overlay.style.display = 'flex';
            },
        });
    });
    opsSection.appendChild(generationActionBtn);
    panel.appendChild(opsSection);

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = `
        display: flex; justify-content: space-between; align-items: center;
        border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px;
    `;
    footer.appendChild(modalAccentBtn('View Log', () => logModal.show()));
    footer.appendChild(modalSecondaryBtn('Close', () => { overlay.style.display = 'none'; onClose?.(); }));
    panel.appendChild(footer);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // ---- Internal ----

    function renderFileList() {
        fileListEl.innerHTML = '';

        if (selectedFiles.length === 0) {
            emptyHint.innerText = 'Add a folder or individual files to get started.';
            emptyHint.style.display = 'block';
            fileSummary.style.display = 'none';
            fileListEl.style.display = 'none';
            clearAllBtn.style.display = 'none';
            setModalPrimaryButtonDisabled(trimActionBtn, true);
            setModalPrimaryButtonDisabled(statsActionBtn, true);
            setModalPrimaryButtonDisabled(generationActionBtn, true);
            return;
        }

        emptyHint.style.display = 'none';
        fileSummary.style.display = 'block';
        fileSummary.innerText = `${selectedFiles.length} animation file${selectedFiles.length > 1 ? 's' : ''} queued.`;
        fileListEl.style.display = 'block';
        clearAllBtn.style.display = 'block';
        setModalPrimaryButtonDisabled(trimActionBtn, false);
        setModalPrimaryButtonDisabled(statsActionBtn, false);
        setModalPrimaryButtonDisabled(generationActionBtn, false);

        selectedFiles.forEach((file, idx) => {
            const item = document.createElement('div');
            item.style.cssText = `
                padding: 5px 10px 5px 14px; font-size: 12px; color: #d2daf1;
                border-bottom: 1px solid rgba(255,255,255,0.04);
                display: flex; align-items: center; gap: 8px;
            `;
            if (idx === selectedFiles.length - 1) item.style.borderBottom = 'none';

            const idxEl = document.createElement('span');
            idxEl.style.cssText = 'color: #5a7aaa; min-width: 28px; font-variant-numeric: tabular-nums; flex-shrink: 0;';
            idxEl.innerText = `${idx + 1}.`;

            const nameEl = document.createElement('span');
            nameEl.style.cssText = 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
            nameEl.title = file.name;
            nameEl.innerText = file.name;

            const extEl = document.createElement('span');
            extEl.style.cssText = `
                font-size: 10px; padding: 1px 6px; border-radius: 4px;
                background: rgba(141,212,255,0.1); color: #8dd4ff;
                text-transform: uppercase; flex-shrink: 0;
            `;
            extEl.innerText = getExt(file.name);

            const removeEl = document.createElement('button');
            removeEl.innerText = '×';
            removeEl.title = 'Remove';
            removeEl.style.cssText = `
                flex-shrink: 0; background: transparent; border: none;
                color: rgba(255,255,255,0.3); font-size: 15px; line-height: 1;
                cursor: pointer; padding: 0 2px;
            `;
            removeEl.addEventListener('mouseenter', () => { removeEl.style.color = '#ff8080'; });
            removeEl.addEventListener('mouseleave', () => { removeEl.style.color = 'rgba(255,255,255,0.3)'; });
            removeEl.addEventListener('click', () => {
                selectedFiles.splice(idx, 1);
                renderFileList();
            });

            item.appendChild(idxEl); item.appendChild(nameEl); item.appendChild(extEl); item.appendChild(removeEl);
            fileListEl.appendChild(item);
        });

        console.log(
            `[Batch] ${selectedFiles.length} file(s) queued:\n` +
            selectedFiles.map((f, i) => `  ${i + 1}. ${f.name}`).join('\n')
        );
    }

    function notifyView(view, updateHistory = true) {
        if (updateHistory) onViewChange?.(view);
    }

    function destroyActiveChild() {
        activeTrimUI?.destroy?.();
        activeTrimUI = null;
        activeStatsUI?.destroy?.();
        activeStatsUI = null;
        activeGenerationUI?.destroy?.();
        activeGenerationUI = null;
    }

    function showListView({ updateHistory = true, result } = {}) {
        destroyActiveChild();
        overlay.style.display = 'flex';
        if (result?.allDone) {
            fileSummary.innerText = `All ${selectedFiles.length} files processed.`;
            fileSummary.style.display = 'block';
        }
        notifyView('list', updateHistory);
    }

    function showTrimView({ updateHistory = true } = {}) {
        if (selectedFiles.length === 0) {
            showListView({ updateHistory });
            return;
        }
        records = selectedFiles.map((f, i) => ({
            index: i, filename: f.name, sourceDuration: 0,
            trimmed: false, trimStart: null, trimEnd: null,
            exported: false, exportedName: null,
        }));
        destroyActiveChild();
        overlay.style.display = 'none';
        activeTrimUI = createBatchTrimUI({
            files: selectedFiles, sceneManager, records,
            onOpenLog: () => logModal.show(),
            getSharedState: () => sharedState,
            setSharedState: (u) => Object.assign(sharedState, u),
            onBack: (result) => {
                activeTrimUI = null;
                showListView({ result });
            },
        });
        notifyView('trim', updateHistory);
    }

    function showStatsView({ updateHistory = true } = {}) {
        if (selectedFiles.length === 0) {
            showListView({ updateHistory });
            return;
        }
        destroyActiveChild();
        overlay.style.display = 'none';
        activeStatsUI = createBatchStatsUI({
            files: selectedFiles,
            sceneManager,
            onBack: () => {
                activeStatsUI = null;
                showListView();
            },
        });
        notifyView('stats', updateHistory);
    }

    function showGenerationView({ updateHistory = true } = {}) {
        if (selectedFiles.length === 0) {
            showListView({ updateHistory });
            return;
        }
        destroyActiveChild();
        overlay.style.display = 'none';
        activeGenerationUI = createBatchGenerationUI({
            files: selectedFiles,
            onBack: () => {
                activeGenerationUI = null;
                showListView();
            },
        });
        notifyView('generation', updateHistory);
    }

    function show(view = 'list', { updateHistory = false } = {}) {
        if (view === 'trim') {
            showTrimView({ updateHistory });
            return;
        }
        if (view === 'stats') {
            showStatsView({ updateHistory });
            return;
        }
        if (view === 'generation') {
            showGenerationView({ updateHistory });
            return;
        }
        showListView({ updateHistory });
    }
    function hide() {
        overlay.style.display = 'none';
        destroyActiveChild();
    }
    function destroy() {
        destroyActiveChild();
        logModal.destroy();
        overlay.remove();
    }

    return { show, hide, destroy };
}
