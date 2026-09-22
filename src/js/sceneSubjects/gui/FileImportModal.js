import { applyModalPrimaryButtonStyle, setModalPrimaryButtonDisabled } from './ModalPrimaryButtonStyle.js';

const importModalBg = new URL("../../../assets/Background.png", import.meta.url);
const defaultSkeletonFileUrl = new URL("../../../assets/MixamoWalking.fbx", import.meta.url);
const defaultPldFileUrl = new URL("../../../assets/PLDTestData.csv", import.meta.url);
const defaultFileByType = {
    skeleton: { url: defaultSkeletonFileUrl, name: "MixamoWalking.fbx" },
    pld: { url: defaultPldFileUrl, name: "PLDTestData.csv" },
};
const defaultFileReadableCache = new Map();

export function createFileImportModal({title = 'Import Animation Data', typeSelection, onConfirm, onClose }) {
    let selectedFile = null;
    let allowedExts = [];

    if (typeSelection === "skeleton") allowedExts = ['.fbx', '.glb', '.gltf'];
    else if (typeSelection === "pld") allowedExts = ['.csv'];

    const friendlyText = allowedExts; 
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.45)';
    overlay.style.backgroundSize = 'cover';
    overlay.style.backgroundPosition = 'center';
    overlay.style.backgroundRepeat = 'no-repeat';
    overlay.style.display = 'none';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.overflow = 'auto';
    overlay.style.padding = '64px';
    overlay.style.boxSizing = 'border-box';
    overlay.style.zIndex = '10000';

    const bg = document.createElement('div');
    bg.style.position = 'absolute';
    bg.style.top = '0';
    bg.style.left = '0';
    bg.style.width = '100%';
    bg.style.height = '100%';
    bg.style.backgroundImage = `url("${importModalBg.href}")`;
    bg.style.backgroundSize = 'cover';
    bg.style.backgroundPosition = 'center';
    bg.style.filter = 'blur(5px) brightness(50%)';
    bg.style.zIndex = '-1';

    overlay.appendChild(bg);

    const closeBtn = document.createElement("button");
    closeBtn.innerText = "X";
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "12px";
    closeBtn.style.right = "12px";
    closeBtn.style.background = "transparent";
    closeBtn.style.border = "none";
    closeBtn.style.color = "#b0b0b0";
    closeBtn.style.fontSize = "16px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.padding = "4px";
    closeBtn.style.lineHeight = "1";
    closeBtn.addEventListener("mouseover", () => {
        closeBtn.style.color = "#ffffff";
    });
    closeBtn.addEventListener("mouseout", () => {
        closeBtn.style.color = "#b0b0b0";
    });
    closeBtn.addEventListener("click", () => {
        overlay.style.display = "none";
        if (typeof onClose === "function") {
        onClose();
        }
    });

    const container = document.createElement('div');
    container.style.background = '#1e1e1e';
    container.style.padding = '32px';
    container.style.borderRadius = '16px';
    container.style.boxShadow = '0 10px 40px rgba(0,0,0,0.35)';
    container.style.minWidth = '360px';
    container.style.maxWidth = '480px';
    container.style.color = '#f5f5f5';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '24px';
    container.style.position = "relative";
    container.style.transform = "scale(1.25)";
    container.style.transformOrigin = "center center";

    const header = document.createElement('h2');
    header.innerText = title;
    header.style.margin = '0';
    header.style.fontSize = '20px';
    header.style.textAlign = 'center';
    header.style.color = '#ffffff';

    const description = document.createElement('p');
    description.innerText = `Import ${friendlyText} file`; 
    description.style.textAlign = 'center';
    description.style.color = '#b0b0b0';
    description.style.fontSize = '14px';

    const dropZone = document.createElement('div');
    dropZone.style.border = '2px dashed #3f8cff';
    dropZone.style.borderRadius = '12px';
    dropZone.style.padding = '24px';
    dropZone.style.textAlign = 'center';
    dropZone.style.cursor = 'pointer';
    dropZone.style.background = 'rgba(63, 140, 255, 0.1)';
    dropZone.style.transition = 'all 0.2s ease';
    dropZone.innerText = `Drag ${friendlyText} here or click to select`; 

    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'file';
    hiddenInput.accept = allowedExts.join(','); 
    hiddenInput.style.display = 'none';

    const errorText = document.createElement('div');
    errorText.style.color = '#ff6b6b';
    errorText.style.minHeight = '18px';
    errorText.style.fontSize = '13px';
    errorText.style.textAlign = 'center';

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'center';

    const sampleResources = document.createElement('div');
    sampleResources.style.display = 'flex';
    sampleResources.style.justifyContent = 'center';
    sampleResources.style.alignItems = 'center';
    sampleResources.style.minHeight = '30px';

    if (typeSelection === 'skeleton') {
        const sampleText = document.createElement('p');
        sampleText.style.margin = '0';
        sampleText.style.color = '#b0b0b0';
        sampleText.style.fontSize = '13px';
        sampleText.style.textAlign = 'center';
        sampleText.append('A sample walking animation can be downloaded from ');

        const sampleLink = document.createElement('a');
        sampleLink.href = 'https://www.mixamo.com/#/?page=1&query=walk';
        sampleLink.target = '_blank';
        sampleLink.rel = 'noopener noreferrer';
        sampleLink.innerText = 'Mixamo';
        sampleLink.style.color = '#70a7ff';
        sampleLink.style.textDecoration = 'underline';
        sampleText.appendChild(sampleLink);
        sampleText.append('.');
        sampleResources.appendChild(sampleText);
    } else if (typeSelection === 'pld') {
        const downloadSampleBtn = document.createElement('button');
        downloadSampleBtn.type = 'button';
        downloadSampleBtn.innerText = 'Download sample data';
        downloadSampleBtn.style.padding = '8px 16px';
        downloadSampleBtn.style.border = '1px solid rgba(112,167,255,0.7)';
        downloadSampleBtn.style.borderRadius = '999px';
        downloadSampleBtn.style.background = 'rgba(63,140,255,0.1)';
        downloadSampleBtn.style.color = '#70a7ff';
        downloadSampleBtn.style.cursor = 'pointer';
        downloadSampleBtn.style.fontSize = '13px';
        downloadSampleBtn.addEventListener('click', () => {
            const anchor = document.createElement('a');
            anchor.href = defaultPldFileUrl.href;
            anchor.download = defaultFileByType.pld.name;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
        });
        sampleResources.appendChild(downloadSampleBtn);
    }

    const confirmBtn = document.createElement('button');
    confirmBtn.innerText = 'Confirm';
    applyModalPrimaryButtonStyle(confirmBtn);
    setModalPrimaryButtonDisabled(confirmBtn, true);

    const loadingText = document.createElement('div');
    loadingText.style.textAlign = 'center';
    loadingText.style.fontSize = '13px';
    loadingText.style.color = '#b0b0b0';
    loadingText.style.display = 'none';
    loadingText.innerText = 'Loading...';

    let isDestroyed = false;

    function updateConfirmState() {
        setModalPrimaryButtonDisabled(confirmBtn, !selectedFile);
    }

    function handleFiles(files) {
        if (!files || !files.length) {
            selectedFile = null;
            dropZone.innerText = `Drag ${friendlyText} here or click to select`; 
        } else {
            const file = files[0];
            const name = file.name.toLowerCase();

            const ok = allowedExts.some(ext => name.endsWith(ext));

            if (!ok) {
                setError(`Only support ${friendlyText} file`);
                selectedFile = null;
            } else {
                selectedFile = file;
                dropZone.innerHTML = `<strong>${file.name}</strong>`;
                setError('');
            }
        }
        updateConfirmState();
    }

    dropZone.addEventListener('click', () => hiddenInput.click());
    dropZone.addEventListener('dragover', (event) => {
        event.preventDefault();
    });
    dropZone.addEventListener('dragleave', (event) => {
        event.preventDefault();
    });
    dropZone.addEventListener('drop', (event) => {
        event.preventDefault();
        handleFiles(event.dataTransfer.files);
    });
    hiddenInput.addEventListener('change', () => handleFiles(hiddenInput.files));

    confirmBtn.addEventListener('click', () => {
        if (typeof onConfirm === 'function') {
            onConfirm(selectedFile, api);
        }
    });

    footer.appendChild(confirmBtn);
    container.appendChild(closeBtn);
    container.appendChild(header);
    container.appendChild(description);
    container.appendChild(dropZone);
    container.appendChild(hiddenInput);
    container.appendChild(errorText);
    container.appendChild(loadingText);
    container.appendChild(sampleResources);
    container.appendChild(footer);

    overlay.appendChild(container);
    document.body.appendChild(overlay);

    function setError(message = '') {
        errorText.innerText = message;
    }

    function resetSelection() {
        selectedFile = null;
        hiddenInput.value = '';
        dropZone.innerText = `Drag ${friendlyText} here or click to select`; 
        setError('');
        updateConfirmState();
    }

    async function loadDefaultFileForType() {
        const target = defaultFileByType[typeSelection];
        if (!target?.url) return;

        const cacheKey = target.url.href;
        if (defaultFileReadableCache.has(cacheKey) && defaultFileReadableCache.get(cacheKey) === false) {
            delete defaultFileByType[typeSelection];
            return;
        }

        try {
            const response = await fetch(target.url.href);
            if (!response.ok) {
                defaultFileReadableCache.set(cacheKey, false);
                delete defaultFileByType[typeSelection];
                return;
            }
            const blob = await response.blob();
            if (!blob || blob.size <= 0) {
                defaultFileReadableCache.set(cacheKey, false);
                delete defaultFileByType[typeSelection];
                return;
            }
            if (isDestroyed) return;
            defaultFileReadableCache.set(cacheKey, true);
            selectedFile = new File([blob], target.name, { type: blob.type || '' });
            dropZone.innerHTML = `<strong>${selectedFile.name}</strong>`;
            setError('');
            updateConfirmState();
        } catch (_error) {
            defaultFileReadableCache.set(cacheKey, false);
            delete defaultFileByType[typeSelection];
        }
    }

    const api = {
        show: () => overlay.style.display = 'flex',
        hide: () => overlay.style.display = 'none',
        destroy: () => {
            isDestroyed = true;
            overlay.remove();
        },
        setError,
        setLoading: (isLoading, text = 'Loading...') => {
            loadingText.style.display = isLoading ? 'block' : 'none';
            loadingText.innerText = text;
            setModalPrimaryButtonDisabled(confirmBtn, isLoading || !selectedFile);
        },
        getFile: () => selectedFile,
        getTypeSelection: () => typeSelection,
        reset: resetSelection
    };

    loadDefaultFileForType();

    return api;
}
