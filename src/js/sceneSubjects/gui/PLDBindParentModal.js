import { applyModalPrimaryButtonStyle } from "./ModalPrimaryButtonStyle.js";

const PLDBineModalBg = new URL("../../../assets/Background.png", import.meta.url);
const PLD_PARENT_SCROLLBAR_STYLE_ID = "pld-parent-binding-scrollbar-style";

function ensurePLDParentBindingScrollbarStyle() {
    if (document.getElementById(PLD_PARENT_SCROLLBAR_STYLE_ID)) return;

    const styleEl = document.createElement("style");
    styleEl.id = PLD_PARENT_SCROLLBAR_STYLE_ID;
    styleEl.textContent = `
      .pld-parent-binding-modal {
        scrollbar-width: thin;
        scrollbar-color: rgba(141, 212, 255, 0.55) rgba(255,255,255,0.08);
      }
      .pld-parent-binding-modal::-webkit-scrollbar {
        width: 8px;
      }
      .pld-parent-binding-modal::-webkit-scrollbar-thumb {
        background: rgba(141, 212, 255, 0.55);
        border-radius: 999px;
      }
      .pld-parent-binding-modal::-webkit-scrollbar-track {
        background: rgba(255,255,255,0.08);
        border-radius: 999px;
      }
    `;
    document.head.appendChild(styleEl);
}

export function createPLDBindParentModal(pldMotion, options = {}) {
    const onConfirm = options.onConfirm || (() => {});
    const onClose = options.onClose || (() => {});
    const defaultParentValues = options.defaultParentValues || [];

    if (!pldMotion || !pldMotion.pldInfo || pldMotion.pldInfo.length === 0) {
        console.warn("PLDMotion or pldInfo not available");
        return null;
    }
    ensurePLDParentBindingScrollbarStyle();

    // Create overlay backsdrop
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
    bg.style.backgroundImage = `url("${PLDBineModalBg.href}")`;
    bg.style.backgroundSize = "cover";
    bg.style.backgroundPosition = "center";
    bg.style.filter = "blur(5px) brightness(50%)";
    bg.style.zIndex = "-1";
    overlay.appendChild(bg);

    // Create modal container
    const modal = document.createElement("div");
    modal.classList.add("pld-parent-binding-modal");
    modal.style.background = "#1e1e1e";
    modal.style.padding = "32px";
    modal.style.borderRadius = "16px";
    modal.style.boxShadow = "0 10px 40px rgba(0, 0, 0, 0.35)";
    modal.style.minWidth = "400px";
    modal.style.maxWidth = "700px";
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
    title.innerText = "PLD Parent Binding";
    title.style.margin = "0";
    title.style.fontSize = "20px";
    title.style.textAlign = "center";
    title.style.color = "#ffffff";
    modal.appendChild(title);

    // Description
    const description = document.createElement("p");
    description.innerText = "Specify the parent PLD ID for each child PLD\nAt least one PLD's parent ID must be set to 0";
    description.style.textAlign = "center";
    description.style.color = "#b0b0b0";
    description.style.fontSize = "14px";
    description.style.margin = "0";
    modal.appendChild(description);

    // Table container
    const tableContainer = document.createElement("div");
    tableContainer.style.overflowX = "auto";

    // Create table
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.fontSize = "14px";

    // Table header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.style.borderBottom = "2px solid #3f8cff";

    const headers = ["Child Name", "Child ID", "Parent ID"];
    headers.forEach(headerText => {
        const th = document.createElement("th");
        th.innerText = headerText;
        th.style.padding = "12px";
        th.style.textAlign = "left";
        th.style.fontWeight = "bold";
        th.style.color = "#3f8cff";
        th.style.fontSize = "13px";
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Table body
    const tbody = document.createElement("tbody");
    const inputData = [];

    pldMotion.pldInfo.forEach((pld, index) => {
        const row = document.createElement("tr");
        row.style.borderBottom = "1px solid #333";
        row.style.color = "#b0b0b0";

        // Child PLD Name (text, read-only)
        const nameCell = document.createElement("td");
        nameCell.style.padding = "12px";
        const nameSpan = document.createElement("span");
        nameSpan.innerText = pld.name || "N/A";
        nameCell.appendChild(nameSpan);
        row.appendChild(nameCell);

        // Child PLD ID (text, read-only)
        const idCell = document.createElement("td");
        idCell.style.padding = "12px";
        const idSpan = document.createElement("span");
        idSpan.innerText = pld.id;
        idCell.appendChild(idSpan);
        row.appendChild(idCell);

        // Parent PLD ID (dropdown select)
        const parentCell = document.createElement("td");
        parentCell.style.padding = "12px";
        const parentSelect = document.createElement("select");
        
        // Create option list: 0 and all child IDs
        const optionValues = [0, ...pldMotion.pldInfo.map(pld => pld.id)];
        
        // Add default empty option
        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.text = "-- Select Parent --";
        parentSelect.appendChild(emptyOption);
        
        // Add all available parent ID options
        optionValues.forEach(value => {
            const option = document.createElement("option");
            option.value = value;
            option.text = value.toString();
            parentSelect.appendChild(option);
        });
        
        parentSelect.value = pld.parent !== undefined ? pld.parent : (defaultParentValues[index] !== undefined ? defaultParentValues[index] : pld.id);
        parentSelect.style.width = "100%";
        parentSelect.style.padding = "6px";
        parentSelect.style.boxSizing = "border-box";
        parentSelect.style.border = "1px solid #444";
        parentSelect.style.borderRadius = "6px";
        parentSelect.style.backgroundColor = "#2a2a2a";
        parentSelect.style.color = "#f5f5f5";
        parentSelect.style.fontSize = "13px";
        parentSelect.style.outline = "none";
        parentSelect.style.cursor = "pointer";
        parentSelect.addEventListener("focus", () => {
            parentSelect.style.borderColor = "#3f8cff";
            parentSelect.style.backgroundColor = "#333333";
        });
        parentSelect.addEventListener("blur", () => {
            parentSelect.style.borderColor = "#444";
            parentSelect.style.backgroundColor = "#2a2a2a";
        });
        parentCell.appendChild(parentSelect);
        row.appendChild(parentCell);

        tbody.appendChild(row);
        inputData.push({ pld, parentInput: parentSelect });
    });

    table.appendChild(tbody);
    tableContainer.appendChild(table);
    modal.appendChild(tableContainer);

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
        // Validate inputs
        let hasError = false;
        let hasRootParent = false;
        inputData.forEach(({ pld, parentInput }) => {
            const parentValue = parentInput.value.trim();
            if (parentValue === "") {
                hasError = true;
            } else {
                const parentId = parseInt(parentValue, 10);
                pld.parent = parentId;
                if (parentId === 0) hasRootParent = true;
            }
        });

        if (hasError) {
            errorText.innerText = "Please specify parent ID for all children";
            return;
        }

        if (!hasRootParent) {
            errorText.innerText = "At least one PLD's parent ID must be set to 0";
            return;
        }

        errorText.innerText = "";

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
