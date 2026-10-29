"use strict";
window.PresentationPicker = (() => {
  let active = false;
  function element(tag, text) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  }
  async function choose() {
    if (active) return [];
    active = true;
    const previous = document.activeElement;
    const dialog = element("dialog");
    dialog.id = "presentation-picker";
    dialog.className = "presentation-picker";
    dialog.setAttribute("aria-labelledby", "picker-title");
    const title = element("h2", "Choose a PowerPoint");
    title.id = "picker-title";
    const location = element("p");
    location.className = "picker-location";
    const status = element("p");
    status.setAttribute("role", "status");
    const list = element("div");
    list.className = "picker-list";
    const toolbar = element("div");
    toolbar.className = "picker-toolbar";
    const up = element("button", "↑ Parent folder");
    const cancel = element("button", "Cancel · B");
    cancel.onclick = () => dialog.close("cancel");
    const native = element("button", "Other location (macOS chooser)");
    native.onclick = () => dialog.close("native");
    toolbar.append(up, cancel, native);
    dialog.append(title, location, toolbar, status, list);
    document.body.append(dialog);
    let chosen = [],
      parent = null,
      request = 0;
    async function browse(directory) {
      const token = ++request;
      list.replaceChildren();
      status.textContent = "Reading folder…";
      up.disabled = true;
      try {
        const result = await window.desktopAPI.listPresentationFiles(directory);
        if (token !== request || !dialog.open) return;
        location.textContent =
          result.path || "Choose Downloads, Documents, or Desktop";
        parent = result.parent;
        up.disabled = !result.path;
        up.onclick = () => browse(parent || undefined);
        status.textContent = result.entries.length
          ? "D-pad to move · A to open a folder or import a file · B to cancel"
          : "No PowerPoint files or folders here.";
        for (const entry of result.entries) {
          const button = element(
            "button",
            (entry.isDirectory ? "▸ " : "▤ ") + entry.name,
          );
          button.dataset.path = entry.path;
          button.onclick = () => {
            if (entry.isDirectory) browse(entry.path);
            else {
              chosen = [entry.path];
              dialog.close("selected");
            }
          };
          list.append(button);
        }
        (list.querySelector("button") || cancel).focus();
      } catch (error) {
        if (token !== request) return;
        location.textContent = directory || "Choose a folder";
        status.textContent = error.message;
        up.disabled = false;
        up.onclick = () => browse();
        cancel.focus();
      }
    }
    const completed = new Promise((resolve) =>
      dialog.addEventListener(
        "close",
        () => {
          request++;
          const nativeChosen = dialog.returnValue === "native";
          dialog.remove();
          active = false;
          previous?.focus();
          resolve(nativeChosen ? null : chosen);
        },
        { once: true },
      ),
    );
    dialog.showModal();
    await browse();
    return completed;
  }
  return { choose };
})();
