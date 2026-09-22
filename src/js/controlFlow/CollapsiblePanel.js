export function createCollapsiblePanelHeader({
  title,
  body,
  initialCollapsed = false,
  onToggle,
} = {}) {
  if (!body) return null;

  const button = document.createElement("button");
  button.type = "button";
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "space-between";
  button.style.gap = "12px";
  button.style.width = "100%";
  button.style.padding = "0";
  button.style.border = "0";
  button.style.background = "transparent";
  button.style.color = "#d7e2ff";
  button.style.font = "inherit";
  button.style.fontWeight = "600";
  button.style.cursor = "pointer";
  button.style.textAlign = "left";

  const label = document.createElement("span");
  label.innerText = title;
  const indicator = document.createElement("span");
  indicator.style.fontSize = "12px";
  indicator.style.color = "#9aa4c3";
  indicator.style.lineHeight = "1";
  button.appendChild(label);
  button.appendChild(indicator);

  let collapsed = !!initialCollapsed;
  const render = () => {
    body.style.display = collapsed ? "none" : "flex";
    indicator.innerText = collapsed ? "+" : "-";
    button.setAttribute("aria-expanded", collapsed ? "false" : "true");
    button.title = collapsed ? `Expand ${title}` : `Collapse ${title}`;
  };

  button.addEventListener("click", () => {
    collapsed = !collapsed;
    render();
    onToggle?.(!collapsed);
  });
  render();

  return {
    element: button,
    isCollapsed: () => collapsed,
    setCollapsed(value) {
      collapsed = !!value;
      render();
    },
  };
}

export function createPaneDockPanel({
  title,
  initialCollapsed = true,
  width = "220px",
  minWidth = "190px",
  onToggle,
} = {}) {
  const root = document.createElement("div");
  root.className = "pane-no-fullscreen-toggle pane-dock-panel";
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.gap = "8px";
  root.style.width = width;
  root.style.minWidth = minWidth;
  root.style.padding = "10px 12px";
  root.style.borderRadius = "8px";
  root.style.border = "1px solid rgba(255,255,255,0.22)";
  root.style.background = "rgba(8, 12, 20, 0.82)";
  root.style.color = "#f5f6ff";
  root.style.fontSize = "12px";
  root.style.boxShadow = "0 12px 24px rgba(0,0,0,0.3)";
  root.style.backdropFilter = "blur(4px)";
  root.style.boxSizing = "border-box";

  const body = document.createElement("div");
  body.style.flexDirection = "column";
  body.style.gap = "8px";

  const collapsible = createCollapsiblePanelHeader({
    title,
    body,
    initialCollapsed,
    onToggle,
  });
  root.appendChild(collapsible.element);
  root.appendChild(body);

  return {
    root,
    body,
    collapsible,
  };
}
