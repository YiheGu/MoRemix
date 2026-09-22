import { applyModalPrimaryButtonStyle } from "./ModalPrimaryButtonStyle.js";

const PLDUpdateOrderModalBg = new URL("../../../assets/Background.png", import.meta.url);
const PLD_UPDATE_ORDER_SCROLLBAR_STYLE_ID = "pld-update-order-scrollbar-style";

function ensurePLDUpdateOrderScrollbarStyle() {
    if (document.getElementById(PLD_UPDATE_ORDER_SCROLLBAR_STYLE_ID)) return;

    const styleEl = document.createElement("style");
    styleEl.id = PLD_UPDATE_ORDER_SCROLLBAR_STYLE_ID;
    styleEl.textContent = `
      .pld-update-order-modal {
        scrollbar-width: thin;
        scrollbar-color: rgba(141, 212, 255, 0.55) rgba(255,255,255,0.08);
      }
      .pld-update-order-modal::-webkit-scrollbar {
        width: 8px;
      }
      .pld-update-order-modal::-webkit-scrollbar-thumb {
        background: rgba(141, 212, 255, 0.55);
        border-radius: 999px;
      }
      .pld-update-order-modal::-webkit-scrollbar-track {
        background: rgba(255,255,255,0.08);
        border-radius: 999px;
      }
    `;
    document.head.appendChild(styleEl);
}

export function createPLDUpdateOrderModal(pldMotion, options = {}) {
    const onConfirm = options.onConfirm || (() => {});
    const onClose = options.onClose || (() => {});
    const defaultUpdateOrder = options.defaultUpdateOrder || [];

    if (!pldMotion || !pldMotion.pldInfo || pldMotion.pldInfo.length === 0) {
        console.warn("PLDMotion or pldInfo not available");
        return null;
    }
    ensurePLDUpdateOrderScrollbarStyle();

    // Create overlay backdrop
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.45)";
    overlay.style.backgroundSize = "cover";
    overlay.style.backgroundPosition = "center";
    overlay.style.backgroundRepeat = "no-repeat";
    overlay.style.display = "none";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.zIndex = "10000";

    const bg = document.createElement("div");
    bg.style.position = "absolute";
    bg.style.top = "0";
    bg.style.left = "0";
    bg.style.width = "100%";
    bg.style.height = "100%";
    bg.style.backgroundImage = `url("${PLDUpdateOrderModalBg.href}")`;
    bg.style.backgroundSize = "cover";
    bg.style.backgroundPosition = "center";
    bg.style.filter = "blur(5px) brightness(50%)";
    bg.style.zIndex = "-1";
    overlay.appendChild(bg);

    // Create modal container
    const modal = document.createElement("div");
    modal.classList.add("pld-update-order-modal");
    modal.style.background = "#1e1e1e";
    modal.style.padding = "32px";
    modal.style.borderRadius = "16px";
    modal.style.boxShadow = "0 10px 40px rgba(0, 0, 0, 0.35)";
    modal.style.minWidth = "500px";
    modal.style.maxWidth = "800px";
    modal.style.maxHeight = "80vh";
    modal.style.overflowY = "auto";
    modal.style.color = "#f5f5f5";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.style.gap = "24px";
    modal.style.position = "relative";

    // Close button
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
        onClose();
    });
    modal.appendChild(closeBtn);

    // Title
    const title = document.createElement("h2");
    title.innerText = "PLD Update Order";
    title.style.margin = "0";
    title.style.fontSize = "20px";
    title.style.textAlign = "center";
    title.style.color = "#ffffff";
    modal.appendChild(title);

    // Description
    const description = document.createElement("p");
    description.innerText = "Specify the update order for PLDs. Each row defines one update group with multiple PLD IDs.";
    description.style.textAlign = "center";
    description.style.color = "#b0b0b0";
    description.style.fontSize = "14px";
    description.style.margin = "0";
    modal.appendChild(description);

    // Rows container
    const rowsContainer = document.createElement("div");
    rowsContainer.style.display = "flex";
    rowsContainer.style.flexDirection = "column";
    rowsContainer.style.gap = "12px";
    rowsContainer.style.maxHeight = "400px";
    rowsContainer.style.overflowY = "auto";
    rowsContainer.style.paddingRight = "8px";

    const rows = [];
    
    // Initialize rows from defaultUpdateOrder or empty rows
    const initialRows = defaultUpdateOrder.length > 0 ? defaultUpdateOrder : [[]];
    
    function createRow(rowIndex, pldIds = []) {
        const rowWrapper = document.createElement("div");
        rowWrapper.style.display = "flex";
        rowWrapper.style.gap = "12px";
        rowWrapper.style.alignItems = "center";

        // Row number (auto-numbered)
        const numberCell = document.createElement("div");
        numberCell.style.minWidth = "40px";
        numberCell.style.textAlign = "center";
        numberCell.style.color = "#b0b0b0";
        numberCell.style.fontSize = "14px";
        numberCell.style.fontWeight = "bold";
        numberCell.innerText = (rowIndex + 1).toString();

        // PLD IDs input field
        const inputField = document.createElement("input");
        inputField.type = "text";
        inputField.placeholder = "e.g. 1 12 14";
        inputField.value = pldIds.join(" ");
        inputField.style.flex = "1";
        inputField.style.padding = "8px 12px";
        inputField.style.border = "1px solid #444";
        inputField.style.borderRadius = "6px";
        inputField.style.backgroundColor = "#2a2a2a";
        inputField.style.color = "#f5f5f5";
        inputField.style.fontSize = "13px";
        inputField.style.outline = "none";
        inputField.style.boxSizing = "border-box";
        inputField.addEventListener("focus", () => {
            inputField.style.borderColor = "#3f8cff";
            inputField.style.backgroundColor = "#333333";
        });
        inputField.addEventListener("blur", () => {
            inputField.style.borderColor = "#444";
            inputField.style.backgroundColor = "#2a2a2a";
        });

        // Add row button
        const addBtn = document.createElement("button");
        addBtn.innerText = "+";
        addBtn.style.padding = "8px 12px";
        addBtn.style.minWidth = "36px";
        addBtn.style.border = "1px solid #444";
        addBtn.style.borderRadius = "6px";
        addBtn.style.backgroundColor = "#2a2a2a";
        addBtn.style.color = "#3f8cff";
        addBtn.style.fontSize = "14px";
        addBtn.style.cursor = "pointer";
        addBtn.style.transition = "all 0.2s ease";
        addBtn.addEventListener("mouseover", () => {
            addBtn.style.backgroundColor = "#333333";
            addBtn.style.borderColor = "#3f8cff";
        });
        addBtn.addEventListener("mouseout", () => {
            addBtn.style.backgroundColor = "#2a2a2a";
            addBtn.style.borderColor = "#444";
        });
        addBtn.addEventListener("click", () => {
            const newRowIndex = rows.length;
            const newRow = createRow(newRowIndex, []);
            rows.push({ inputField: newRow.inputField, wrapper: newRow.wrapper });
            rowsContainer.appendChild(newRow.wrapper);
            updateRowNumbers();
            updateButtonStates();
        });

        // Delete row button
        const deleteBtn = document.createElement("button");
        deleteBtn.innerText = "−";
        deleteBtn.style.padding = "8px 12px";
        deleteBtn.style.minWidth = "36px";
        deleteBtn.style.border = "1px solid #444";
        deleteBtn.style.borderRadius = "6px";
        deleteBtn.style.backgroundColor = "#2a2a2a";
        deleteBtn.style.color = "#ff6b6b";
        deleteBtn.style.fontSize = "14px";
        deleteBtn.style.cursor = "pointer";
        deleteBtn.style.transition = "all 0.2s ease";
        deleteBtn.addEventListener("mouseover", () => {
            deleteBtn.style.backgroundColor = "#333333";
            deleteBtn.style.borderColor = "#ff6b6b";
        });
        deleteBtn.addEventListener("mouseout", () => {
            deleteBtn.style.backgroundColor = "#2a2a2a";
            deleteBtn.style.borderColor = "#444";
        });
        deleteBtn.addEventListener("click", () => {
            rowWrapper.remove();
            const index = rows.findIndex(r => r.wrapper === rowWrapper);
            if (index > -1) {
                rows.splice(index, 1);
            }
            updateRowNumbers();
            updateButtonStates();
        });

        rowWrapper.appendChild(numberCell);
        rowWrapper.appendChild(inputField);
        rowWrapper.appendChild(addBtn);
        rowWrapper.appendChild(deleteBtn);

        return { inputField, wrapper: rowWrapper, addBtn, deleteBtn };
    }

    function updateRowNumbers() {
        rows.forEach((row, index) => {
            const numberCell = row.wrapper.querySelector("div:first-child");
            if (numberCell) {
                numberCell.innerText = (index + 1).toString();
            }
        });
    }

    function updateButtonStates() {
        rows.forEach((row, index) => {
            const deleteBtn = row.wrapper.querySelector("button:last-child");
            if (deleteBtn) {
                deleteBtn.disabled = rows.length === 1;
                deleteBtn.style.opacity = rows.length === 1 ? "0.5" : "1";
                deleteBtn.style.cursor = rows.length === 1 ? "not-allowed" : "pointer";
            }
        });
    }

    // Create initial rows
    initialRows.forEach((pldIds, index) => {
        const row = createRow(index, pldIds);
        rows.push({ inputField: row.inputField, wrapper: row.wrapper, addBtn: row.addBtn, deleteBtn: row.deleteBtn });
        rowsContainer.appendChild(row.wrapper);
    });

    updateButtonStates();

    modal.appendChild(rowsContainer);

    // Error text
    const errorText = document.createElement("div");
    errorText.style.color = "#ff6b6b";
    errorText.style.minHeight = "18px";
    errorText.style.fontSize = "13px";
    errorText.style.textAlign = "center";
    modal.appendChild(errorText);

    // Button container
    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "center";
    footer.style.gap = "12px";

    // Confirm button
    const confirmBtn = document.createElement("button");
    confirmBtn.innerText = "Confirm";
    applyModalPrimaryButtonStyle(confirmBtn);
    confirmBtn.addEventListener("click", () => {
        // Validate and parse inputs
        let hasError = false;
        const updateOrder = [];

        rows.forEach((row, index) => {
            const input = row.inputField.value.trim();
            
            if (input === "") {
                // Allow empty rows, just skip them
                return;
            }

            // Parse space or comma separated PLD IDs
            const pldIdStrings = input.split(/[\s,]+/).filter(s => s.length > 0);
            const pldIds = [];

            for (const idStr of pldIdStrings) {
                const id = parseInt(idStr, 10);
                if (isNaN(id) || id < 1) {
                    hasError = true;
                    errorText.innerText = `Invalid PLD ID "${idStr}" in row ${index + 1}. Please enter positive integers.`;
                    return;
                }
                pldIds.push(id);
            }

            if (pldIds.length > 0) {
                updateOrder.push(pldIds);
            }
        });

        if (hasError) {
            return;
        }

        if (updateOrder.length === 0) {
            errorText.innerText = "Please specify at least one PLD ID.";
            return;
        }

        // Store the update order in pldMotion.pldInfo.updateOrder
        pldMotion.pldInfo.updateOrder = updateOrder;

        // Copy updateOrder to each pld
        pldMotion.pldInfo.forEach(pld => {
            pld.updateOrder = updateOrder;
        });

        overlay.style.display = "none";
        onConfirm();
    });
    footer.appendChild(confirmBtn);

    // Cancel button
    const cancelBtn = document.createElement("button");
    cancelBtn.innerText = "Cancel";
    cancelBtn.style.padding = "10px 28px";
    cancelBtn.style.border = "1px solid #3f8cff";
    cancelBtn.style.borderRadius = "999px";
    cancelBtn.style.backgroundColor = "transparent";
    cancelBtn.style.color = "#3f8cff";
    cancelBtn.style.fontSize = "15px";
    cancelBtn.style.cursor = "pointer";
    cancelBtn.style.minWidth = "120px";
    cancelBtn.style.transition = "all 0.2s ease";
    cancelBtn.addEventListener("mouseover", () => {
        cancelBtn.style.backgroundColor = "rgba(63, 140, 255, 0.1)";
    });
    cancelBtn.addEventListener("mouseout", () => {
        cancelBtn.style.backgroundColor = "transparent";
    });
    cancelBtn.addEventListener("click", () => {
        overlay.style.display = "none";
        onClose();
    });
    footer.appendChild(cancelBtn);

    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    return {
        show: () => {
            if (!document.body.contains(overlay)) document.body.appendChild(overlay);
            overlay.style.display = "flex";
        },
        hide: () => {
            overlay.style.display = "none";
        }
    };
}
