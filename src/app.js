"use strict";
const $ = (id) => document.getElementById(id),
  api = window.desktopAPI,
  G = window.GameCore;
const defaults = {
  levelCount: 3,
  questionsPerLevel: 2,
  difficulty: "easy",
  distractors: 3,
  timeLimit: 0,
  reward: 100,
  penalty: 50,
  comboBonus: 10,
  speed: 250,
  hints: true,
  ordered: true,
  deadZone: 0.19,
  endpoint: "http://127.0.0.1:11434",
  model: "",
};
let state = {
    version: 1,
    decks: [],
    levels: [],
    results: [],
    settings: { ...defaults },
    session: null,
  },
  page = "home",
  busy = false,
  saving = Promise.resolve(),
  game = null,
  items = [],
  playing = false,
  keys = new Set(),
  lastTime = 0,
  overlayAction = null,
  saveTimer = 0;
const bot = { x: 500, y: 550, radius: 18, angle: 0 },
  canvas = $("field"),
  ctx = canvas.getContext("2d");
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function report(message) {
  $("status").textContent = message || "";
}
function persist() {
  const snapshot = JSON.parse(JSON.stringify(state));
  saving = saving
    .catch(() => {})
    .then(() => api.saveState(snapshot))
    .catch((e) => report("Could not save your workspace: " + e.message));
  return saving;
}
function show(name) {
  if (page === "game" && name !== "game" && game) {
    playing = false;
    saveSession();
  }
  page = name;
  document
    .querySelectorAll(".page")
    .forEach((el) => (el.hidden = el.id !== name));
  document
    .querySelectorAll("[data-page]")
    .forEach((el) => el.classList.toggle("active", el.dataset.page === name));
  if (name === "home") renderHome();
  if (name === "library") renderLibrary();
  if (name === "results") renderResults();
}
document
  .querySelectorAll("[data-page]")
  .forEach((el) => (el.onclick = () => show(el.dataset.page)));
function renderHome() {
  $("deck-count").textContent = state.decks.length;
  $("run-count").textContent = state.results.length;
  $("best-score").textContent = state.results.length
    ? Math.max(...state.results.map((r) => r.score))
    : 0;
  $("resume").hidden = !state.session;
}
function syncSettings() {
  document.querySelectorAll("[data-setting]").forEach((el) => {
    const key = el.dataset.setting;
    if (el.type === "checkbox") el.checked = !!state.settings[key];
    else if (key !== "model") el.value = state.settings[key];
    el.onchange = () => {
      let value =
        el.type === "checkbox"
          ? el.checked
          : el.type === "number"
            ? Number(el.value)
            : el.value;
      if (
        el.type === "number" &&
        (!Number.isFinite(value) ||
          value < Number(el.min) ||
          value > Number(el.max))
      ) {
        report("Enter a value between " + el.min + " and " + el.max);
        el.value = state.settings[key];
        return;
      }
      state.settings[key] = value;
      report("");
      persist();
    };
  });
}
async function importDecks() {
  if (busy) return;
  busy = true;
  report("Importing presentation content…");
  try {
    const paths = await window.PresentationPicker.choose();
    const decks =
      paths === null
        ? await api.selectPresentations()
        : paths.length
          ? await api.importPresentationPaths(paths)
          : [];
    const errors = [];
    for (const deck of decks) {
      if (deck.error) errors.push(deck.name + ": " + deck.error);
      else if (!state.decks.some((d) => d.id === deck.id))
        state.decks.push(deck);
    }
    await persist();
    show("library");
    report(errors.join("\n"));
  } catch (e) {
    report(e.message);
  } finally {
    busy = false;
  }
}
$("import").onclick = importDecks;
$("home-import").onclick = importDecks;
function renderLibrary() {
  const out = $("files");
  out.replaceChildren();
  if (!state.decks.length) {
    out.append(
      node(
        "div",
        "Your library is empty. Import a PowerPoint to start.",
        "empty",
      ),
    );
    return;
  }
  for (const deck of state.decks) {
    const card = node("article", undefined, "deck"),
      header = node("header"),
      label = node("div"),
      actions = node("div");
    label.append(
      node("h3", deck.name),
      node("span", deck.slides.length + " slides · stored locally", "source"),
    );
    const inspect = node("button", "Inspect slides");
    inspect.onclick = () => renderSlides(deck);
    const remove = node("button", "Remove");
    remove.onclick = async () => {
      if (
        !(await controllerUI.confirm(
          "Remove this presentation? Missions and saved runs that depend on it will be cleared.",
        ))
      )
        return;
      state.decks = state.decks.filter((d) => d.id !== deck.id);
      state.levels = [];
      state.session = null;
      game = null;
      $("review").hidden = true;
      $("slide-preview").replaceChildren();
      persist();
      renderLibrary();
    };
    actions.append(inspect, remove);
    header.append(label, actions);
    card.append(header);
    out.append(card);
  }
}
function renderSlides(deck) {
  const out = $("slide-preview");
  out.replaceChildren(node("h2", deck.name));
  for (const slide of deck.slides) {
    const card = node("details", undefined, "panel");
    card.append(
      node(
        "summary",
        "Slide " + slide.number + " · " + (slide.lines?.[0] || "Visual slide"),
      ),
    );
    card.append(node("p", slide.text || "No extractable text."));
    if (slide.notes?.length)
      card.append(
        node("h3", "Speaker notes"),
        node(
          "p",
          Array.isArray(slide.notes) ? slide.notes.join("\n") : slide.notes,
        ),
      );
    for (const table of slide.tables || []) {
      const el = node("table");
      for (const row of Array.isArray(table) ? table : table.rows || []) {
        const tr = node("tr");
        for (const cell of row)
          tr.append(
            node("td", typeof cell === "string" ? cell : JSON.stringify(cell)),
          );
        el.append(tr);
      }
      card.append(el);
    }
    for (const image of slide.images || []) {
      if (!/^data:image\/(png|jpeg|gif|webp);base64,/.test(image.dataUrl || ""))
        continue;
      const img = node("img");
      img.src = image.dataUrl;
      img.alt = image.name || "Embedded slide image";
      card.append(img);
    }
    out.append(card);
  }
}
let appleAvailability = { available: false, message: "Checking availability…" };
async function checkAppleAI(selectDefault = false) {
  $("refresh-apple").disabled = true;
  $("apple-status").textContent = "Checking Apple Intelligence availability…";
  try {
    appleAvailability = await api.checkAppleAI();
  } catch (error) {
    appleAvailability = {
      available: false,
      reason: "detection_failed",
      message: error.message,
    };
  }
  const result = appleAvailability;
  const text = result.available
    ? "Apple Intelligence is available. Questions are generated on this Mac; review them before play."
    : "Apple Intelligence is unavailable" +
      (result.reason
        ? " (" + String(result.reason).replaceAll("_", " ") + ")"
        : "") +
      ". " +
      (result.message ||
        "This Mac does not currently support on-device generation.") +
      " Choose Offline · content practice to build questions without AI.";
  $("apple-status").textContent = text;
  $("apple-settings-status").textContent = text;
  $("mode").querySelector('[value="apple"]').disabled = !result.available;
  if (selectDefault) $("mode").value = result.available ? "apple" : "offline";
  $("refresh-apple").disabled = false;
}
$("refresh-apple").onclick = () => checkAppleAI(true);
$("generate").onclick = async () => {
  if (busy) return;
  busy = true;
  $("generate").disabled = true;
  report("");
  $("generation-status").textContent = "Building draft missions locally…";
  try {
    if (!state.decks.length) throw Error("Import a presentation first.");
    const payload = { decks: state.decks, settings: state.settings };
    state.levels = await ($("mode").value === "apple"
      ? api.generateApple(payload)
      : api.generateOffline(payload));
    state.session = null;
    await persist();
    renderReview();
    $("generation-status").textContent =
      "Draft ready. Review and approve every question before play.";
  } catch (e) {
    $("generation-status").textContent =
      e.message +
      ($("mode").value === "apple"
        ? " No replacement questions were generated. Choose Offline · content practice and generate again, or author questions in the editor."
        : " You can edit or author questions below.");
    if ($("mode").value !== "apple") openAuthor();
  } finally {
    busy = false;
    $("generate").disabled = false;
  }
};
function openAuthor() {
  if (!state.levels.length) {
    const deck = state.decks[0],
      slide = deck?.slides.find((s) => s.text);
    $("review").hidden = false;
    $("approved").checked = false;
    $("level-editor").value = JSON.stringify(
      [
        {
          id: "level-1",
          title: "My mission",
          questions: [
            {
              id: "q1",
              type: "concept",
              title: "Source recall",
              prompt: "Which statement is supported by the quoted source?",
              choices: [
                {
                  id: "a",
                  text: slide?.lines?.[0] || "Replace with exact source text",
                },
                {
                  id: "b",
                  text: "Replace with an unambiguously incorrect option",
                },
              ],
              correctIds: ["a"],
              ordered: false,
              explanation: "Explain why the source supports the answer.",
              source: {
                deckId: deck?.id || "",
                slideNumber: slide?.number || 1,
                quote: slide?.text || "Replace with source evidence",
              },
            },
          ],
        },
      ],
      null,
      2,
    );
    $("question-preview").replaceChildren(
      node("p", "Author a question in the editor below, then validate it."),
    );
    $("level-editor").parentElement.open = true;
  } else renderReview();
}
$("open-review").onclick = openAuthor;
function sourceText(q) {
  const deck = state.decks.find((d) => d.id === q.source?.deckId);
  return (
    (deck?.name || "Unknown presentation") + " · slide " + q.source?.slideNumber
  );
}
function renderReview() {
  $("review").hidden = false;
  $("approved").checked = false;
  $("level-editor").value = JSON.stringify(state.levels, null, 2);
  const out = $("question-preview");
  out.replaceChildren();
  for (const level of state.levels) {
    out.append(node("h3", level.title));
    for (const q of level.questions) {
      const card = node("article", undefined, "question");
      card.append(node("span", q.type, "tag"), node("h3", q.prompt));
      q.choices.forEach((choice) =>
        card.append(
          node(
            "div",
            (q.correctIds.includes(choice.id) ? "✓ " : "○ ") + choice.text,
            q.correctIds.includes(choice.id) ? "answer" : "",
          ),
        ),
      );
      card.append(
        node("p", q.explanation),
        node("div", sourceText(q), "source"),
        node("blockquote", q.source.quote),
      );
      out.append(card);
    }
  }
}
async function applyEdits() {
  const levels = JSON.parse($("level-editor").value),
    result = await api.validateLevels({ levels, decks: state.decks });
  if (!result.valid)
    throw Error((result.errors || ["Validation failed"]).join("\n"));
  state.levels = levels;
  state.session = null;
  await persist();
  return levels;
}
$("level-editor").oninput = () => {
  $("approved").checked = false;
};
$("validate").onclick = async () => {
  try {
    await applyEdits();
    renderReview();
    report("Questions validated. Review them, then check the approval box.");
  } catch (e) {
    report(e.message);
  }
};
$("play").onclick = async () => {
  try {
    if (!$("approved").checked)
      throw Error("Review the questions and check the approval box first.");
    await applyEdits();
    startGame();
  } catch (e) {
    report(e.message);
  }
};
function current() {
  return state.levels[game.levelIndex].questions[game.questionIndex];
}
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
function startGame(session) {
  game = session
    ? JSON.parse(JSON.stringify(session))
    : {
        levelIndex: 0,
        questionIndex: 0,
        score: 0,
        combo: 0,
        correct: 0,
        incorrect: 0,
        mistakes: [],
        collected: [],
        remaining: state.settings.timeLimit,
        startedAt: new Date().toISOString(),
        levelStart: { score: 0, correct: 0, incorrect: 0, mistakeCount: 0 },
      };
  show("game");
  setupQuestion(!!session);
  report("");
}
$("resume").onclick = () => {
  if (state.session) startGame(state.session);
};
function setupQuestion(resume = false) {
  const q = current();
  if (!resume) {
    game.collected = [];
    game.remaining = state.settings.timeLimit;
  }
  items = shuffle(
    q.choices.map((choice) => ({
      ...choice,
      active: !game.collected.includes(choice.id),
      cooldown: 0,
      w: 280,
      h: 84,
    })),
  );
  items.forEach((item, i) => {
    item.number = i + 1;
    item.x = 170 + (i % 3) * 330;
    item.y = 95 + Math.floor(i / 3) * 135;
  });
  bot.x = 500;
  bot.y = 550;
  keys.clear();
  $("overlay").hidden = true;
  playing = true;
  $("mission-title").textContent = state.levels[game.levelIndex].title;
  $("mission-position").textContent =
    `LEVEL ${game.levelIndex + 1} / ${state.levels.length} · QUESTION ${game.questionIndex + 1} / ${state.levels[game.levelIndex].questions.length}`;
  $("challenge-type").textContent = q.type;
  $("prompt").textContent = q.prompt;
  $("hint").textContent = state.settings.hints
    ? "Source: " + sourceText(q)
    : "";
  $("reveal-hint").hidden = !state.settings.hints;
  $("reveal-hint").onclick = () => {
    $("hint").textContent = sourceText(q) + " — " + q.source.quote;
    $("reveal-hint").hidden = true;
  };
  $("feedback").textContent = "Drive over an answer to collect it.";
  $("answer-accessibility").textContent =
    "Options: " + items.map((c) => c.number + ". " + c.text).join(" · ");
  updateScore();
  saveSession();
  canvas.focus();
  if (game.collected.length === q.correctIds.length) showFeedback();
  else if (state.settings.timeLimit && game.remaining <= 0) timeoutQuestion();
}
function updateScore() {
  $("score").textContent = game.score;
  $("combo").textContent = game.combo + " correct streak";
  const q = current();
  $("collect-progress").textContent =
    `Collected ${game.collected.length} / ${q.correctIds.length}` +
    (q.ordered && state.settings.ordered ? " · Collect in order" : "") +
    (state.settings.timeLimit
      ? " · " + Math.ceil(game.remaining) + " seconds remaining"
      : "");
}
function saveSession() {
  if (!game) return;
  state.session = JSON.parse(JSON.stringify(game));
  persist();
}
function modal(title, message, action, label = "Continue") {
  playing = false;
  keys.clear();
  $("overlay-title").textContent = title;
  $("overlay-message").textContent = message;
  $("continue").textContent = label;
  $("overlay").hidden = false;
  overlayAction = action;
  saveSession();
}
$("continue").onclick = () => {
  const fn = overlayAction;
  overlayAction = null;
  if (fn) fn();
};
function pickup(item, t) {
  const q = current();
  if (!item.active || t < item.cooldown) return;
  const isAnswer = q.correctIds.includes(item.id),
    isNext =
      !q.ordered ||
      !state.settings.ordered ||
      item.id === q.correctIds[game.collected.length],
    correct = isAnswer && isNext;
  const outcome = G.scorePickup(
    game.score,
    game.combo,
    correct,
    state.settings,
  );
  Object.assign(game, { score: outcome.score, combo: outcome.combo });
  if (correct) {
    item.active = false;
    game.collected.push(item.id);
    game.correct++;
    $("feedback").textContent =
      "Correct! +" + outcome.delta + " points. " + q.explanation;
  } else {
    game.incorrect++;
    game.mistakes.push({
      prompt: q.prompt,
      picked: item.text,
      reason: isAnswer
        ? "Correct concept, incorrect sequence position."
        : q.explanation,
      source: sourceText(q),
      quote: q.source.quote,
    });
    item.cooldown = t + 1500;
    bot.x = 500;
    bot.y = 550;
    $("feedback").textContent =
      (isAnswer
        ? "That belongs later in the sequence."
        : "Incorrect. " + q.explanation) +
      " −" +
      state.settings.penalty +
      " points.";
  }
  updateScore();
  saveSession();
  if (game.collected.length === q.correctIds.length) showFeedback();
}
function showFeedback() {
  modal(
    "Challenge complete",
    current().explanation + " Source: " + sourceText(current()),
    nextQuestion,
    "Next challenge →",
  );
}
function nextQuestion() {
  const next = G.advanceProgress(
    state.levels,
    game.levelIndex,
    game.questionIndex,
  );
  if (next.complete) {
    finishRun();
    return;
  }
  const newLevel = next.levelIndex !== game.levelIndex;
  Object.assign(game, {
    levelIndex: next.levelIndex,
    questionIndex: next.questionIndex,
  });
  if (newLevel)
    game.levelStart = {
      score: game.score,
      correct: game.correct,
      incorrect: game.incorrect,
      mistakeCount: game.mistakes.length,
    };
  setupQuestion();
}
function timeoutQuestion() {
  modal(
    "Time is up",
    "Review the source and retry this question. Your score is unchanged.",
    () => {
      game.remaining = state.settings.timeLimit;
      setupQuestion(true);
    },
    "Retry question",
  );
}
function finishRun() {
  state.results.unshift({
    id: Date.now().toString(),
    date: new Date().toISOString(),
    score: game.score,
    correct: game.correct,
    incorrect: game.incorrect,
    mistakes: game.mistakes,
    levels: state.levels.length,
  });
  state.results = state.results.slice(0, 100);
  state.session = null;
  game = null;
  playing = false;
  persist();
  show("results");
}
function pause() {
  if (!game || page !== "game") return;
  if (playing)
    modal(
      "Mission paused",
      "Your progress is saved. Take your time.",
      () => {
        $("overlay").hidden = true;
        playing = true;
        canvas.focus();
      },
      "Resume",
    );
  else if ($("overlay-title").textContent === "Mission paused")
    $("continue").click();
}
$("pause").onclick = pause;
$("exit").onclick = () => {
  playing = false;
  saveSession();
  show("home");
};
$("restart").onclick = () => {
  if (!game) return;
  const start = game.levelStart || {
    score: 0,
    correct: 0,
    incorrect: 0,
    mistakeCount: 0,
  };
  Object.assign(game, {
    questionIndex: 0,
    score: start.score,
    correct: start.correct,
    incorrect: start.incorrect,
    combo: 0,
  });
  game.mistakes = game.mistakes.slice(0, start.mistakeCount);
  setupQuestion();
};
function renderResults() {
  const out = $("results-list");
  out.replaceChildren();
  if (!state.results.length) {
    out.append(
      node(
        "div",
        "Complete a rally to see your learning progress here.",
        "empty",
      ),
    );
    return;
  }
  for (const result of state.results) {
    const card = node("article", undefined, "result"),
      attempts = result.correct + result.incorrect;
    card.append(
      node("h2", result.score + " points"),
      node(
        "p",
        new Date(result.date).toLocaleString() +
          " · " +
          result.levels +
          " levels · " +
          (attempts ? Math.round((result.correct / attempts) * 100) : 0) +
          "% pickup accuracy",
      ),
    );
    if (!result.mistakes.length)
      card.append(node("p", "No incorrect pickups. Nice work."));
    else {
      const detail = node("details");
      detail.append(
        node("summary", "Review " + result.mistakes.length + " mistakes"),
      );
      for (const m of result.mistakes) {
        const item = node("div", undefined, "mistake");
        item.append(
          node("strong", m.prompt),
          node("p", "Picked: " + m.picked),
          node("p", m.reason),
          node("small", m.source),
          node("blockquote", m.quote),
        );
        detail.append(item);
      }
      card.append(detail);
    }
    out.append(card);
  }
}
const controls = {
  w: "up",
  arrowup: "up",
  s: "down",
  arrowdown: "down",
  a: "left",
  arrowleft: "left",
  d: "right",
  arrowright: "right",
};
document.addEventListener("keydown", (e) => {
  if (page !== "game" || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.key === "Escape") {
    e.preventDefault();
    if (!e.repeat) pause();
    return;
  }
  const direction = controls[e.key.toLowerCase()];
  if (direction && playing) {
    keys.add(direction);
    e.preventDefault();
  }
});
document.addEventListener("keyup", (e) =>
  keys.delete(controls[e.key.toLowerCase()]),
);
window.addEventListener("blur", () => {
  keys.clear();
  if (playing) pause();
});
document.querySelectorAll("[data-dir]").forEach((el) => {
  el.onpointerdown = (e) => {
    if (!playing) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    keys.add(el.dataset.dir);
  };
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((event) =>
    el.addEventListener(event, () => keys.delete(el.dataset.dir)),
  );
});
const controllerPages = ["home", "library", "configure", "results", "settings"];
const controllerUI = window.ControllerUI.create({
  context: () => ({
    page,
    playing,
    hintAvailable: state.settings.hints && !$("reveal-hint").hidden,
  }),
  revealHint: () => {
    if (!$("reveal-hint").hidden) $("reveal-hint").click();
  },
  pause,
  back: () => {
    if (page === "game") $("exit").click();
    else show("home");
  },
  cycle: (direction) => {
    const index = controllerPages.indexOf(page);
    show(
      controllerPages[
        (Math.max(index, 0) + direction + controllerPages.length) %
          controllerPages.length
      ],
    );
  },
});
const overlayActions = node("div", undefined, "controller-dialog-actions");
const overlayRetry = node("button", "Retry level");
overlayRetry.id = "overlay-retry";
overlayRetry.onclick = () => $("restart").click();
const overlayExit = node("button", "Save & exit");
overlayExit.id = "overlay-exit";
overlayExit.onclick = () => $("exit").click();
overlayActions.append(overlayRetry, overlayExit);
$("continue").parentElement.append(overlayActions);
function gamepad() {
  const pad = Array.from(navigator.getGamepads?.() || []).find(
    (p) => p?.connected,
  );
  $("controller").textContent = pad
    ? "Controller connected: " + pad.id
    : "Controller: not detected";
  controllerUI.update(pad, performance.now());
  if (!pad || !controllerUI.canDrive()) return { x: 0, y: 0 };
  const movement = G.deadZone(
    pad.axes[0],
    pad.axes[1],
    state.settings.deadZone,
  );
  if (pad.buttons[14]?.pressed) movement.x = -1;
  if (pad.buttons[15]?.pressed) movement.x = 1;
  if (pad.buttons[12]?.pressed) movement.y = -1;
  if (pad.buttons[13]?.pressed) movement.y = 1;
  return movement;
}
function draw() {
  ctx.fillStyle = "#11252d";
  ctx.fillRect(0, 0, 1000, 600);
  ctx.strokeStyle = "#203943";
  ctx.lineWidth = 1;
  for (let x = 20; x < 1000; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 600);
    ctx.stroke();
  }
  for (let y = 20; y < 600; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1000, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#44616b";
  ctx.strokeRect(8, 8, 984, 584);
  ctx.textAlign = "center";
  for (const item of items) {
    if (!item.active) continue;
    ctx.fillStyle = "#2a424b";
    ctx.beginPath();
    ctx.roundRect(item.x - item.w / 2, item.y - item.h / 2, item.w, item.h, 12);
    ctx.fill();
    ctx.strokeStyle = "#647d83";
    ctx.stroke();
    ctx.fillStyle = "#eff6ef";
    ctx.font = "15px -apple-system, sans-serif";
    const words = (item.number + ". " + item.text).split(/\s+/),
      lines = [""];
    for (const word of words) {
      const i = lines.length - 1,
        next = (lines[i] + " " + word).trim();
      if (ctx.measureText(next).width > 255 && lines[i]) lines.push(word);
      else lines[i] = next;
    }
    const shown = lines.slice(0, 4);
    if (lines.length > 4) shown[3] = shown[3].slice(0, -3) + "…";
    shown.forEach((line, i) =>
      ctx.fillText(
        line,
        item.x,
        item.y + (i - (shown.length - 1) / 2) * 17 + 5,
      ),
    );
  }
  ctx.save();
  ctx.translate(bot.x, bot.y);
  ctx.rotate(bot.angle + Math.PI / 2);
  ctx.fillStyle = "#060e12";
  ctx.fillRect(-24, -21, 10, 42);
  ctx.fillRect(14, -21, 10, 42);
  ctx.fillStyle = "#c6f576";
  ctx.beginPath();
  ctx.roundRect(-16, -21, 32, 42, 7);
  ctx.fill();
  ctx.fillStyle = "#1b3933";
  ctx.fillRect(-10, -14, 20, 14);
  ctx.fillStyle = "#d7fcfb";
  ctx.fillRect(-7, -11, 4, 4);
  ctx.fillRect(3, -11, 4, 4);
  ctx.fillStyle = "#f5d677";
  ctx.beginPath();
  ctx.moveTo(0, -31);
  ctx.lineTo(-6, -22);
  ctx.lineTo(6, -22);
  ctx.fill();
  ctx.restore();
}
function frame(t) {
  const dt = Math.min(0.05, Math.max(0, (t - lastTime) / 1000));
  lastTime = t;
  const pad = gamepad();
  if (playing && game && page === "game") {
    let x = pad.x + (keys.has("right") ? 1 : 0) - (keys.has("left") ? 1 : 0),
      y = pad.y + (keys.has("down") ? 1 : 0) - (keys.has("up") ? 1 : 0);
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    if (m > 0.01) {
      bot.x = Math.max(
        30,
        Math.min(970, bot.x + x * state.settings.speed * dt),
      );
      bot.y = Math.max(
        30,
        Math.min(570, bot.y + y * state.settings.speed * dt),
      );
      bot.angle = Math.atan2(y, x);
    }
    for (const item of items) {
      if (item.active && G.collides(bot, item)) {
        pickup(item, t);
        break;
      }
    }
    if (playing && state.settings.timeLimit) {
      game.remaining = Math.max(0, game.remaining - dt);
      updateScore();
      if (game.remaining === 0) timeoutQuestion();
    }
    if (t - saveTimer > 3000) {
      saveTimer = t;
      saveSession();
    }
  }
  if (page === "game") draw();
  requestAnimationFrame(frame);
}
function validSession(s) {
  const q = state.levels[s.levelIndex]?.questions?.[s.questionIndex];
  return (
    !!q &&
    Number.isFinite(s.score) &&
    Number.isFinite(s.combo) &&
    Number.isFinite(s.correct) &&
    Number.isFinite(s.incorrect) &&
    Array.isArray(s.mistakes) &&
    Array.isArray(s.collected) &&
    s.collected.every((id) => q.correctIds.includes(id)) &&
    Number.isFinite(s.remaining) &&
    s.remaining >= 0
  );
}
(async () => {
  try {
    const loaded = await api.loadState();
    if (loaded)
      state = {
        ...state,
        ...loaded,
        settings: { ...defaults, ...loaded.settings },
      };
    if (
      state.levels.some((level) =>
        level.questions.some((q) =>
          /Which exact statement appears on slide/i.test(q.prompt),
        ),
      )
    ) {
      state.levels = [];
      state.session = null;
      await persist();
      report(
        "Older slide-location missions were removed. Your presentations, results, and settings are preserved. Generate new content-focused missions in the mission builder.",
      );
    }
    syncSettings();
    await checkAppleAI(true);
    renderHome();
    if (state.session && !validSession(state.session)) {
      state.session = null;
      report(
        "The saved run was inconsistent and cannot be resumed. Your library and results remain available.",
      );
    }
    renderHome();
    if (state.levels.length) renderReview();
    if (loaded?.warning) report(loaded.warning);
  } catch (e) {
    report(
      "Workspace could not be loaded: " +
        e.message +
        " Editing is disabled to protect the existing data. Restart after restoring a valid state.json backup.",
    );
    document
      .querySelectorAll("button,input,select,textarea")
      .forEach((el) => (el.disabled = true));
  }
  requestAnimationFrame(frame);
})();
