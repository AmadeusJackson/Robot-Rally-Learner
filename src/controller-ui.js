(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ControllerUI = factory();
})(globalThis, function () {
  "use strict";
  class InputRepeater {
    constructor() {
      this.reset();
    }
    reset() {
      this.ready = false;
      this.held = new Map();
    }
    sample(values, time) {
      if (!this.ready) {
        if (!Object.values(values).some(Boolean)) this.ready = true;
        return [];
      }
      const events = [];
      for (const [key, down] of Object.entries(values)) {
        if (!down) {
          this.held.delete(key);
          continue;
        }
        if (!this.held.has(key)) {
          events.push(key);
          this.held.set(key, time + 430);
        } else if (
          ["up", "down", "left", "right"].includes(key) &&
          time >= this.held.get(key)
        ) {
          events.push(key);
          this.held.set(key, time + 140);
        }
      }
      return events;
    }
  }
  function create(options = {}) {
    const repeater = new InputRepeater();
    let connected = false,
      active = true,
      padId = null,
      lastRoot = null,
      drivingBlocked = true,
      wasDriving = false;
    const doc = document;
    const legend = doc.createElement("div");
    legend.id = "controller-legend";
    legend.hidden = true;
    legend.setAttribute("aria-live", "polite");
    doc.body.append(legend);
    const visible = (el) =>
      !el.disabled &&
      !el.closest("[hidden], [inert]") &&
      el.getClientRects().length > 0;
    const root = () =>
      Array.from(doc.querySelectorAll("dialog[open]")).at(-1) ||
      (!doc.getElementById("overlay")?.hidden &&
      options.context?.().page === "game"
        ? doc.getElementById("overlay")
        : doc);
    const controls = (scope) =>
      Array.from(
        scope.querySelectorAll(
          'button, input:not([type=hidden]), select, textarea, summary, [tabindex="0"]',
        ),
      ).filter(visible);
    function focus(el) {
      if (!el) return;
      doc
        .querySelectorAll(".controller-focus")
        .forEach((e) => e.classList.remove("controller-focus"));
      el.classList.add("controller-focus");
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    function closeDialog(dialog, result) {
      if (dialog.open) dialog.close(result);
    }
    function dialog(title) {
      const previous = doc.activeElement,
        el = doc.createElement("dialog");
      el.className = "controller-dialog";
      const heading = doc.createElement("h2");
      heading.textContent = title;
      el.append(heading);
      doc.body.append(el);
      el.addEventListener(
        "close",
        () => {
          el.remove();
          focus(previous);
          repeater.reset();
        },
        { once: true },
      );
      el.addEventListener("cancel", (e) => {
        e.preventDefault();
        closeDialog(el, "cancel");
      });
      return el;
    }
    function button(parent, label, action) {
      const el = doc.createElement("button");
      el.type = "button";
      el.textContent = label;
      el.onclick = action;
      parent.append(el);
      return el;
    }
    function confirmAction(message) {
      return new Promise((resolve) => {
        const el = dialog("Confirm action"),
          p = doc.createElement("p");
        p.textContent = message;
        el.append(p);
        const row = doc.createElement("div");
        row.className = "controller-dialog-actions";
        el.append(row);
        const cancel = button(row, "Cancel", () => closeDialog(el, "cancel"));
        button(row, "Remove presentation", () => closeDialog(el, "confirm"));
        el.addEventListener(
          "close",
          () => resolve(el.returnValue === "confirm"),
          { once: true },
        );
        el.showModal();
        focus(cancel);
        repeater.reset();
      });
    }
    function keyboard(target) {
      const original = target.value,
        el = dialog("On-screen keyboard");
      let upper = false;
      const editor = doc.createElement("textarea");
      editor.className = "controller-keyboard-editor";
      editor.value = original;
      editor.setAttribute("aria-label", "Text being edited");
      el.append(editor);
      editor.selectionStart = editor.selectionEnd =
        target.selectionStart ?? original.length;
      const edit = (text) => {
        let a = editor.selectionStart,
          b = editor.selectionEnd;
        editor.setRangeText(text, a, b, "end");
      };
      const grid = doc.createElement("div");
      grid.className = "controller-keyboard-grid";
      el.append(grid);
      const chars =
        "abcdefghijklmnopqrstuvwxyz0123456789{}[]\":,.-_/?=!+()*;@#$%&\\'<>|`~";
      const charButtons = [];
      for (const char of chars) {
        charButtons.push(
          button(grid, char, () => edit(upper ? char.toUpperCase() : char)),
        );
      }
      const row = doc.createElement("div");
      row.className = "controller-keyboard-actions";
      el.append(row);
      button(row, "Shift: abc", function () {
        upper = !upper;
        this.textContent = upper ? "Shift: ABC" : "Shift: abc";
        charButtons.forEach(
          (b, i) => (b.textContent = upper ? chars[i].toUpperCase() : chars[i]),
        );
      });
      button(row, "Space", () => edit(" "));
      button(row, "New line", () => edit("\n"));
      button(row, "⌫ Backspace", () => {
        if (editor.selectionStart === editor.selectionEnd)
          editor.selectionStart = Math.max(0, editor.selectionStart - 1);
        edit("");
      });
      button(row, "← Caret", () => {
        editor.selectionStart = editor.selectionEnd = Math.max(
          0,
          editor.selectionStart - 1,
        );
      });
      button(row, "Caret →", () => {
        editor.selectionStart = editor.selectionEnd = Math.min(
          editor.value.length,
          editor.selectionEnd + 1,
        );
      });
      button(row, "Clear", () => {
        editor.value = "";
      });
      button(row, "Cancel", () => closeDialog(el, "cancel"));
      button(row, "Done", () => {
        target.value = editor.value;
        target.dispatchEvent(new Event("input", { bubbles: true }));
        target.dispatchEvent(new Event("change", { bubbles: true }));
        closeDialog(el, "done");
      });
      el.showModal();
      focus(charButtons[0]);
      repeater.reset();
    }
    function adjust(el, direction) {
      if (el?.tagName === "SELECT") {
        const opts = Array.from(el.options).filter((o) => !o.disabled);
        const i = opts.indexOf(el.selectedOptions[0]);
        const next =
          opts[Math.max(0, Math.min(opts.length - 1, i + direction))];
        if (next) {
          el.value = next.value;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return true;
      }
      if (el?.tagName === "INPUT" && ["number", "range"].includes(el.type)) {
        const step = el.step === "any" ? 1 : Number(el.step) || 1;
        const min = el.min === "" ? -Infinity : Number(el.min),
          max = el.max === "" ? Infinity : Number(el.max);
        el.value = String(
          Math.max(
            min,
            Math.min(max, Number(el.value || 0) + step * direction),
          ),
        );
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      return false;
    }
    function activate(el) {
      if (!el) return;
      if (
        el.tagName === "TEXTAREA" ||
        (el.tagName === "INPUT" &&
          ![
            "checkbox",
            "radio",
            "button",
            "submit",
            "number",
            "range",
          ].includes(el.type))
      ) {
        if (el.classList.contains("controller-keyboard-editor")) return;
        keyboard(el);
      } else if (el.tagName === "SELECT") adjust(el, 1);
      else if (el.tagName === "SUMMARY") {
        el.parentElement.open = !el.parentElement.open;
      } else el.click();
    }
    function move(direction, scope) {
      const all = controls(scope);
      if (!all.length) return;
      const current = doc.activeElement,
        index = all.indexOf(current);
      if (
        (direction === "left" || direction === "right") &&
        adjust(current, direction === "left" ? -1 : 1)
      )
        return;
      if (
        scope.matches?.(".controller-dialog") &&
        current?.closest(".controller-keyboard-grid")
      ) {
        const buttons = Array.from(current.parentElement.children);
        let delta =
          direction === "up"
            ? -10
            : direction === "down"
              ? 10
              : direction === "left"
                ? -1
                : 1;
        const target = buttons.indexOf(current) + delta;
        if (target >= 0 && target < buttons.length) {
          focus(buttons[target]);
          return;
        }
      }
      const delta = direction === "up" || direction === "left" ? -1 : 1;
      focus(all[(index < 0 ? 0 : index + delta + all.length) % all.length]);
    }
    function back(scope, context) {
      if (scope.tagName === "DIALOG") {
        closeDialog(scope, "cancel");
        return;
      }
      if (context.page === "game" && context.playing) {
        options.pause?.();
        return;
      }
      options.back?.();
    }
    function update(pad, time) {
      const context = options.context?.() || {};
      if (!pad || !active) {
        if (!pad && connected && context.playing && context.page === "game")
          options.pause?.();
        if (connected) {
          legend.hidden = true;
          doc.body.classList.remove("controller-connected");
          doc
            .querySelectorAll(".controller-focus")
            .forEach((el) => el.classList.remove("controller-focus"));
        }
        connected = false;
        padId = null;
        drivingBlocked = true;
        wasDriving = false;
        repeater.reset();
        return;
      }
      if (padId !== pad.index + ":" + pad.id) {
        repeater.reset();
        padId = pad.index + ":" + pad.id;
      }
      connected = true;
      legend.hidden = false;
      doc.body.classList.add("controller-connected");
      const scope = root();
      const isDriving =
        context.playing && context.page === "game" && scope === doc;
      if (isDriving !== wasDriving) {
        repeater.reset();
        drivingBlocked = true;
        wasDriving = isDriving;
      }
      if (!isDriving) drivingBlocked = true;
      legend.textContent = isDriving
        ? "Left stick / D-pad: drive · Start / B: pause" +
          (context.hintAvailable ? " · Y: source hint" : "")
        : "D-pad / left stick: focus · ← →: adjust · A: select · B: back · LB / RB: screens · Right stick: scroll";
      const down = (i) => !!pad.buttons[i]?.pressed,
        axis = (i) => Number(pad.axes[i]) || 0;
      const events = repeater.sample(
        {
          up: down(12) || axis(1) < -0.55,
          down: down(13) || axis(1) > 0.55,
          left: down(14) || axis(0) < -0.55,
          right: down(15) || axis(0) > 0.55,
          a: down(0),
          b: down(1),
          y: down(3),
          start: down(9),
          lb: down(4),
          rb: down(5),
        },
        time,
      );
      if (scope !== lastRoot) {
        if (lastRoot !== null) repeater.reset();
        lastRoot = scope;
        if (scope !== doc && !controls(scope).includes(doc.activeElement))
          focus(controls(scope)[0]);
      }
      if (isDriving && repeater.ready) drivingBlocked = false;
      if (!isDriving && !controls(scope).includes(doc.activeElement))
        focus(controls(scope)[0]);
      for (const event of events) {
        if (event === "start") {
          if (scope.tagName === "DIALOG") continue;
          if (context.page === "game") options.pause?.();
          else
            focus(
              controls(scope).find((e) => e.classList.contains("primary")) ||
                controls(scope)[0],
            );
          return;
        }
        if (event === "b") {
          back(scope, context);
          return;
        }
        if (isDriving) {
          if (event === "y" && context.hintAvailable) options.revealHint?.();
          continue;
        }
        if (event === "a")
          activate(
            controls(scope).includes(doc.activeElement)
              ? doc.activeElement
              : controls(scope)[0],
          );
        else if (["up", "down", "left", "right"].includes(event))
          move(event, scope);
        else if ((event === "lb" || event === "rb") && scope === doc) {
          options.cycle?.(event === "lb" ? -1 : 1);
          focus(
            controls(doc).find((e) => e.matches("nav .active")) ||
              controls(doc)[0],
          );
        }
        if (root() !== scope) break;
      }
      if (!isDriving && Math.abs(axis(3)) > 0.25) {
        let target = doc.activeElement;
        while (target && target !== doc.body) {
          const overflow = getComputedStyle(target).overflowY;
          if (
            target.scrollHeight > target.clientHeight + 1 &&
            /auto|scroll/.test(overflow)
          )
            break;
          target = target.parentElement;
        }
        if (!target || target === doc.body)
          target = scope === doc ? doc.scrollingElement : scope;
        target.scrollTop += axis(3) * 12;
      }
    }
    window.addEventListener("blur", () => {
      active = false;
      drivingBlocked = true;
      repeater.reset();
    });
    window.addEventListener("focus", () => {
      active = true;
      drivingBlocked = true;
      repeater.reset();
    });
    doc.addEventListener("focusin", (event) => {
      if (connected) {
        doc
          .querySelectorAll(".controller-focus")
          .forEach((el) => el.classList.remove("controller-focus"));
        event.target.classList.add("controller-focus");
      }
    });
    return {
      update,
      confirm: confirmAction,
      keyboard,
      focus,
      canDrive: () => active && !drivingBlocked,
      reset: () => {
        repeater.reset();
        drivingBlocked = true;
      },
    };
  }
  return { InputRepeater, create };
});
