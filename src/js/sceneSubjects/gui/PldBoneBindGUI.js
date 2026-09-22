import { GUI } from 'dat.gui';
import { MixamoBoneInfo } from '../variables/MixamoBoneInfo.js';
import { MHBoneInfo } from '../variables/MetaHumanBoneInfo.js';
import { applyModalPrimaryButtonStyle } from "./ModalPrimaryButtonStyle.js";

const panelBg = new URL("../../../assets/Background.png", import.meta.url);

export function createPldBoneBindGUI(pldName, skeletonSelection, onChangeCallback, onConfirmCallback) {

    let boneName;
    if (skeletonSelection === "mixamo") {
        boneName = MixamoBoneInfo.map(bone => bone.name);
    } else if (skeletonSelection === "metahuman") {
        boneName = MHBoneInfo.map(bone => bone.name);
    } else {
        boneName = [];
    }

    const overlay = document.createElement("div");
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.45);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 10001;
    `;
    document.body.appendChild(overlay);

    const bg = document.createElement("div");
    bg.style.cssText = `
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background-image: url("${panelBg.href}");
        background-size: cover;
        background-position: center;
        filter: blur(5px) brightness(50%);
        z-index: -1;
    `;
    overlay.appendChild(bg);

    const containerElement = document.createElement("div");
    containerElement.style.cssText = `
        background: #1e1e1e;
        padding: 32px;
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.35);
        min-width: 900px;
        max-width: 1200px;
        color: #f5f5f5;
        display: flex;
        flex-direction: column;
        gap: 24px;
        position: relative;
        max-height: 85vh;
        overflow-y: auto;
    `;
    overlay.appendChild(containerElement);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "X";
    closeBtn.style.cssText = `
        position: absolute;
        top: 14px;
        right: 14px;
        background: transparent;
        border: none;
        color: #b0b0b0;
        font-size: 18px;
        cursor: pointer;
        padding: 4px;
    `;
    closeBtn.onmouseover = () => closeBtn.style.color = "#fff";
    closeBtn.onmouseout = () => closeBtn.style.color = "#b0b0b0";
    closeBtn.onclick = () => { overlay.style.display = "none"; };
    containerElement.appendChild(closeBtn);

    const title = document.createElement('h2');
    title.textContent = "PLD Bone Configuration";
    title.style.cssText = `
        margin: 0;
        text-align: center;
        color: white;
        font-size: 22px;
        font-weight: 600;
    `;
    containerElement.appendChild(title);

    const mainContainer = document.createElement('div');
    mainContainer.style.cssText = `
        display: flex;
        gap: 20px;
    `;
    containerElement.appendChild(mainContainer);

    const column1 = document.createElement("div");
    column1.style.cssText = `
        flex: 0 0 200px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        justify-content: space-between;
    `;

    const imgLabel = document.createElement("div");
    imgLabel.textContent = "Preview";
    imgLabel.style.cssText = `
        font-size: 13px;
        color: #ccc;
    `;
    column1.appendChild(imgLabel);

    const img = document.createElement("img");
    img.src = "/assets/green.png";
    img.style.cssText = `
        width: 180px;
        height: 180px;
        border-radius: 12px;
        object-fit: cover;
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 0 12px rgba(0,0,0,0.4);
    `;
    column1.appendChild(img);

    mainContainer.appendChild(column1);

    const dataColumns = document.createElement("div");
    dataColumns.style.cssText = `
        flex: 1;
        display: flex;
        gap: 12px;
    `;

    const column2 = document.createElement("div");
    const column3 = document.createElement("div");
    const column4 = document.createElement("div");
    const column5 = document.createElement("div");

    [column2, column3, column4].forEach(col => {
        col.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 10px;
            align-items: stretch;
        `;
    });

    column5.style.cssText = `
        flex: 0 0 60px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        align-items: center;
    `;

    const headers = ["PLD Name", "Bone Name", "Scale"];
    [column2, column3, column4].forEach((col, idx) => {
        const h = document.createElement("div");
        h.textContent = headers[idx];
        h.style.cssText = `
            font-size: 12px;
            color: #ccc;
            padding-bottom: 6px;
            border-bottom: 1px solid rgba(255,255,255,0.15);
        `;
        col.appendChild(h);
    });

    const delHeader = document.createElement("div");
    delHeader.textContent = "Del";
    delHeader.style.cssText = `
        font-size: 12px;
        color: #ccc;
        padding-bottom: 6px;
        border-bottom: 1px solid rgba(255,255,255,0.15);
        text-align: center;
    `;
    column5.appendChild(delHeader);

    dataColumns.appendChild(column2);
    dataColumns.appendChild(column3);
    dataColumns.appendChild(column4);
    dataColumns.appendChild(column5);
    mainContainer.appendChild(dataColumns);

    const boneList = boneName || [];
    const pldNameArray = Array.isArray(pldName) ? pldName : [];
    const configs = [];

    if (pldNameArray.length > 0) {
        pldNameArray.forEach((pld, idx) => {
            const config = {
                pldName: pld,
                selectedBone: "",
                scale: 1.0
            };
            configs.push(config);
            createRow(config);
        });
    }

    const addRowBtn = document.createElement("button");
    addRowBtn.textContent = "+ Add Row";
    addRowBtn.style.cssText = `
        padding: 10px 20px;
        background: #3f8cff;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        width: 100%;
    `;
    addRowBtn.onmouseover = () => addRowBtn.style.background = "#5aa0ff";
    addRowBtn.onmouseout = () => addRowBtn.style.background = "#3f8cff";
    addRowBtn.onclick = () => {
        const newConfig = {
            pldName: pldNameArray.length > 0 ? pldNameArray[0] : `PLD_${configs.length}`,
            selectedBone: "",
            scale: 1.0
        };
        configs.push(newConfig);
        createRow(newConfig);
        triggerChange();
    };

    column1.appendChild(addRowBtn);

    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: center;
        margin-top: 12px;
    `;
    containerElement.appendChild(buttonContainer);

    function createRow(config) {
        const commonHeight = "34px";

        const nameSelect = document.createElement("select");
        applyInputStyle(nameSelect);
        nameSelect.style.height = commonHeight;
        pldNameArray.forEach(pldNameItem => {
            const opt = document.createElement("option");
            opt.value = pldNameItem;
            opt.textContent = pldNameItem;
            opt.style.cssText = 'color: white; background: #1e1e1e;';
            nameSelect.appendChild(opt);
        });
        nameSelect.value = config.pldName;
        nameSelect.onchange = e => {
            config.pldName = e.target.value;
            triggerChange();
        };
        column2.appendChild(nameSelect);

        const boneSelect = document.createElement("select");
        applyInputStyle(boneSelect);
        boneSelect.style.height = commonHeight;
        boneList.forEach(bone => {
            const opt = document.createElement("option");
            opt.value = bone;
            opt.textContent = bone;
            opt.style.cssText = 'color: white; background: #1e1e1e;';
            boneSelect.appendChild(opt);
        });
        boneSelect.value = config.selectedBone;
        boneSelect.onchange = e => {
            config.selectedBone = e.target.value;
            triggerChange();
        };
        column3.appendChild(boneSelect);

        const scaleInput = document.createElement("input");
        scaleInput.type = "number";
        scaleInput.step = "0.1";
        scaleInput.min = "0";
        scaleInput.max = "1";
        scaleInput.value = config.scale;
        applyInputStyle(scaleInput);
        scaleInput.style.height = commonHeight;

        scaleInput.oninput = e => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) {
                config.scale = v;
                triggerChange();
            }
        };

        column4.appendChild(scaleInput);

        const delBtn = document.createElement("button");
        delBtn.textContent = "✕";
        delBtn.style.cssText = `
            padding: 0;
            border: none;
            background: #b53939;
            color: white;
            border-radius: 6px;
            cursor: pointer;
            width: 100%;
            height: ${commonHeight};
            font-size: 13px;
            font-weight: 600;
        `;
        delBtn.onmouseover = () => delBtn.style.background = "#e24a4a";
        delBtn.onmouseout = () => delBtn.style.background = "#b53939";
        delBtn.onclick = () => {
            nameSelect.remove();
            boneSelect.remove();
            scaleInput.remove();
            delBtn.remove();
            const idx = configs.indexOf(config);
            if (idx >= 0) configs.splice(idx, 1);
            triggerChange();
        };
        column5.appendChild(delBtn);

        config.nameElement = nameSelect;
        config.boneSelect = boneSelect;
        config.scaleInput = scaleInput;
    }

    function applyInputStyle(el) {
        el.style.cssText = `
            padding: 8px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.15);
            color: white;
            border-radius: 8px;
            font-size: 13px;
            width: 100%;
            box-sizing: border-box;
        `;
    }

    const confirmBtn = document.createElement("button");
    confirmBtn.innerText = "Confirm";
    applyModalPrimaryButtonStyle(confirmBtn);

    confirmBtn.addEventListener("click", () => {

        if (configs.length === 0) {
            console.warn("No PLD-Bone configurations to confirm");
            return;
        }

        if (typeof onConfirmCallback === "function") {
            onConfirmCallback(configs);
        }

        overlay.style.display = "none";
    });

    buttonContainer.appendChild(confirmBtn);

    function triggerChange() {
        if (onChangeCallback) onChangeCallback(configs);
    }

    return {
        show: () => overlay.style.display = "flex",
        hide: () => overlay.style.display = "none",
        remove: () => overlay.remove(),
        getConfigs: () => configs,
        updateBoneList: (newBoneList) => {
            configs.forEach((cfg) => {
                const sel = cfg.boneSelect;
                const old = sel.value;
                sel.innerHTML = "";
                newBoneList.forEach(b => {
                    const opt = document.createElement("option");
                    opt.value = b;
                    opt.textContent = b;
                    opt.style.cssText = 'color: white; background: #1e1e1e;';
                    sel.appendChild(opt);
                });
                sel.value = newBoneList.includes(old) ? old : newBoneList[0];
            });
        },
        confirmAndClose: () => {
            if (configs.length === 0) {
                console.warn("No PLD-Bone configurations to confirm");
                return false;
            }
            if (typeof onConfirmCallback === "function") {
                onConfirmCallback(configs);
            }
            overlay.style.display = "none";
            return true;
        }
    };
}
