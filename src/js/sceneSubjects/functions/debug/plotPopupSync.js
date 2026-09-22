const popupUpdaters = new Map();
const popupLatestImages = new Map();

function makeKey(kind, id) {
    return `${String(kind)}:${String(id)}`;
}

function makeImageKey(kind, id, imageType) {
    return `${makeKey(kind, id)}:${String(imageType)}`;
}

export function registerPlotPopupUpdater(kind, id, updater) {
    if (!kind || id === undefined || id === null || !updater) return;
    const key = makeKey(kind, id);
    popupUpdaters.set(key, updater);

    const angleDataUrl = popupLatestImages.get(makeImageKey(kind, id, "angle"));
    const spectrumDataUrl = popupLatestImages.get(makeImageKey(kind, id, "spectrum"));
    const fourierDataUrl = popupLatestImages.get(makeImageKey(kind, id, "fourier"));
    const v3DataUrl = popupLatestImages.get(makeImageKey(kind, id, "v3"));
    if (angleDataUrl) updater.setAngleImage?.(angleDataUrl);
    if (spectrumDataUrl) updater.setSpectrumImage?.(spectrumDataUrl);
    if (fourierDataUrl) updater.setFourierImage?.(fourierDataUrl);
    if (v3DataUrl) updater.setV3Image?.(v3DataUrl);
}

export function unregisterPlotPopupUpdater(kind, id) {
    if (!kind || id === undefined || id === null) return;
    popupUpdaters.delete(makeKey(kind, id));
}

export function updatePlotPopupImage(kind, id, imageType, dataUrl) {
    if (!kind || id === undefined || id === null || !dataUrl) return;
    popupLatestImages.set(makeImageKey(kind, id, imageType), dataUrl);

    const updater = popupUpdaters.get(makeKey(kind, id));
    if (!updater) return;

    if (imageType === "angle") {
        updater.setAngleImage?.(dataUrl);
        return;
    }
    if (imageType === "spectrum") {
        updater.setSpectrumImage?.(dataUrl);
        return;
    }
    if (imageType === "fourier") {
        updater.setFourierImage?.(dataUrl);
        return;
    }
    if (imageType === "v3") {
        updater.setV3Image?.(dataUrl);
    }
}
