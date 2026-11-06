# Robot Rally Learning

A local-first macOS desktop learning game built with Electron. Import a PowerPoint, review source-grounded challenges, and drive a robot to collect answers. No cloud account is required.

## Getting started

Install the matching macOS DMG by dragging the app to Applications. See [BUILD_MAC.md](BUILD_MAC.md) for installer builds, GitHub Actions, signing, and unsigned-app limitations.

1. Import a `.pptx` presentation into the library.
2. Inspect the extracted slides, notes, tables, and embedded images.
3. Configure level count, questions, difficulty, scoring, time limits, hints, speed, and controller dead zone.
4. Generate source-grounded questions with Local study AI, Apple Intelligence, or offline practice.
5. Preview every challenge, its correct answers, and source quotation. Edit the JSON if necessary, validate it, and approve it before playing.
6. Drive with WASD, arrow keys, a connected standard-mapped Xbox controller, or the on-screen controls. Collect the requested answers and review explanations and mistakes.

Settings, imported content, levels, results, and the resumable session are stored locally in the Electron user-data directory. Keep a separate copy of your original presentations. Imports are limited to 80 MB per file, and the saved library is limited to 60 MB including embedded images. A corrupt saved state produces an error and is preserved rather than overwritten.

## Content and accuracy

Offline content practice creates term-definition matching and factual sentence-completion questions from slide text. It skips the opening slide and identified title-only slides, and never asks which slide contained a statement. It does not infer cause and effect or interpret diagrams. It may reject a deck with insufficient usable or distinct text; it does not silently invent questions.

Apple Intelligence is detected automatically using Apple's Foundation Models framework. On Apple Silicon Macs running macOS 26 or later (including macOS 27), the app checks whether Apple Intelligence is enabled and its model is ready. When available, it is selected automatically unless Local study AI is installed. No Ollama installation, cloud account, API key, or terminal setup is needed. Unsupported Macs can explicitly choose offline content practice. Model download/readiness is managed by macOS. The app reports unavailable reasons and never silently substitutes offline questions after an AI failure.

Apple Intelligence retains source-backed sentence-completion practice. Tests of richer questions from the built-in model exposed incorrect reasoning that its own review missed, so those experimental questions are not enabled. Use **Local study AI** for application and reasoning questions.

Local study AI writes a question, then a separate model session solves shuffled options without seeing the proposed answer. Application answers may express an inference instead of copying a term. The supporting source passage (up to 1,800 characters) is copied directly into the citation. Up to four nearby teaching slides from the same presentation provide context; the answer checker identifies the passage that most directly supports the answer. The independent solver checks every option against the teaching material. It must find one supported answer and reject alternatives as contradicted, rather than merely unstated; unresolved options reject the candidate. Medium/Hard candidates must pass checks for reasoning, support, and a single correct answer. Distractor difficulty is generation guidance rather than a hard acceptance check. Feedback quotes the lesson passage directly rather than presenting a generated rationale as fact. These checks are not a guarantee; human preview remains required. Reasoning modes prefer explanatory slides over diagram labels. Accepted questions are retained in a shorter draft if not enough candidates pass, and the interface reports the shortfall. No accepted questions means an explicit failure.

Existing saved questions are preserved. Select **Local study AI** and Medium or Hard in **Build a game**, then choose **Generate questions**. Driving, collision scoring, and controller behavior are unchanged.

Challenge data supports concept identification, application and prediction, ordered assembly, cause-and-effect chains, matching, identifying incorrect statements, and troubleshooting. These modes share the answer-collection mechanic. Model or manually authored content determines the educational quality and conceptual difficulty. Difficulty is guidance for AI generation; deterministic mode remains limited recall.

PowerPoint text, speaker notes, tables, and supported embedded raster images are extracted locally. Images are available for human review; automatic OCR or visual reasoning over image-only slides is not provided. Legacy `.ppt` requires a separately installed LibreOffice application at `/Applications/LibreOffice.app` to convert it locally. If conversion is unavailable, save the presentation as `.pptx` in PowerPoint or LibreOffice first. LibreOffice is not bundled in the DMG.

## Development

```sh
npm ci
npm test
python3 -B test/local_model_test.py
npm run test:e2e
npm run build:apple
npm run test:e2e
npm start
npm run dist:mac
```

Use Node.js 24 and Xcode 26 or later with the macOS 26+ SDK to build the bundled Apple Intelligence helper. Intel builds omit the helper and use offline/manual questions. `ROBOT_RALLY_USER_DATA` may point to an isolated data directory for testing; normal app launches use Electron’s user-data location. macOS packaging must run on macOS. All application assets are bundled; the renderer uses no remote scripts or fonts. The interface remains vanilla JavaScript to retain the small prototype's useful canvas code and avoid a framework migration; it is not a TypeScript/React rewrite.

Architecture:

- `src/main.js` / `src/preload.js`: narrow IPC, native dialogs, local generation, and desktop lifecycle.
- `src/extraction.js`: PowerPoint import and local legacy conversion.
- `src/persistence.js`: local state storage.
- `src/content.js`: content question generation, title-slide filtering, and challenge validation.
- `native/AppleModel.swift`, `src/apple-ai.js`, `src/apple-generation.js`: native on-device model availability, structured generation, and source validation.
- `src/game-core.js`: pure input, collision, scoring, and progression functions.
- `src/app.js`, `src/index.html`, `src/style.css`: interface, source review, canvas gameplay, and result history.
- `test/`: focused automated checks. Passing these checks does not establish physical controller compatibility, semantic AI accuracy, or notarization.

## Release verification

Before public distribution, test a signed and notarized installer on clean Intel and Apple Silicon Macs, a physical Xbox controller, real-world `.ppt` conversion, and Apple Intelligence generation on representative teaching materials. Run the repository's GitHub Actions workflow and inspect both installer artifacts. Local packaging success does not prove a remote CI run has succeeded.

Existing slide-location missions are cleared during upgrade so they cannot be resumed. Imported presentations, settings, and result history are preserved. Source hints cite the slide without revealing its answer; choose Reveal source evidence to view the quotation.

## Xbox controller navigation

The controller works across Overview, Presentations, Build a game, question review, Settings, and the game. Connect it to macOS before opening the app, then release all buttons/sticks briefly to enable input.

- D-pad or left stick: move focus through controls. In play, drive the robot.
- A: select, activate buttons, toggle a checkbox, or expand details. On a text or number field, open the on-screen keyboard for direct editing.
- Left/right: decrease/increase a focused number or change a selected option.
- B: close a dialog or go back; in play, pause. From the pause screen, B saves and exits.
- LB/RB: switch app screens. Right stick: scroll the current panel.
- Menu/Start: pause or resume. Y: reveal source evidence when hints are enabled.

Pause and completion screens expose Continue, Retry level, and Save & exit. A disconnected controller or loss of app focus pauses gameplay. Input must return to neutral after reconnecting or switching between menus and driving, preventing held buttons from triggering unintended actions.

Add presentations opens the standard macOS file chooser directly. Use Command-click or Shift-click to select multiple PowerPoint files, then choose Open. The app accepts up to 20 files per import. The system chooser and macOS permission prompts may require a mouse or keyboard; the Xbox controller can open the chooser but does not control it.

Controller tests simulate standard Gamepad API input; physical Xbox compatibility still depends on macOS pairing/mapping and should be checked on the user's hardware.

## Window sizing

The window can shrink to 480 × 480. Navigation moves above the page in narrow windows; forms, cards, and action rows reflow, and longer pages scroll vertically. The game field preserves its proportions and scales to the space around the question and controls. Very short windows or long questions may still require scrolling. Dialogs and the on-screen keyboard scroll within the window and leave space for the controller legend. Switching screens starts at the top of the page.

`npm run test:e2e` includes layout checks from 480 × 480 through 1920 × 1080, covering page overflow, game proportions, reachable keyboard actions.

## Mixing presentations

Choose **Add presentations**, select one or more PowerPoint files in the macOS chooser, then choose **Open**. You can import again later to add to the library. Cancel leaves the library unchanged.

Open **Build a game** and choose **Generate questions** after adding presentations. All generation modes shuffle eligible content within each presentation and take turns across presentations, so a larger deck does not crowd out smaller decks. Title and agenda slides remain excluded. Choose at least as many total questions as presentations to allow coverage of each. Sources with no usable questions may be omitted; the draft status lists presentations not represented. Existing saved missions keep their questions until you generate a new draft.

The multi-presentation end-to-end test imports two real PPTX files together, adds a third, verifies mixed sources within levels, and reloads the saved workspace. Apple source mixing is covered with a simulated model provider.

Overview lists your five most recently added presentations and saved progress. Choose a presentation to inspect its slides, or use **Build a game** to configure questions.

## Local study AI (optional)

On an Apple Silicon Mac with at least 16 GB memory, Qwen3.5 9B can generate and independently check questions locally through MLX. It is an existing model, not a newly trained model. Install `uv`, then run `npm run setup:local-ai` once. This downloads roughly 6 GB of model weights plus a Python runtime into `~/Library/Application Support/robot-rally-desktop/local-ai`. The setup script pins the model revision and major runtime packages. Model weights and Python are not included in the DMG. Other Macs continue to offer Apple Intelligence and offline mode.

When installed, **Local study AI · Qwen3.5 9B** is selected by default; Apple Intelligence remains selectable. Generation runs in a subprocess with Hugging Face offline mode enabled and no web server. Slides are not uploaded. The model loads once per draft and is released when generation finishes or the app quits. The independent checker returns compact verdicts for each option. Once a candidate passes, **Finish with accepted questions** lets you end the run after the current candidate and review the shorter draft. Both models can make mistakes, and preview/approval remains required. Local generation shows accepted-question progress and may return a shorter draft if candidates fail checks.

Model: https://huggingface.co/mlx-community/Qwen3.5-9B-4bit (Apache-2.0). Runtime: https://github.com/ml-explore/mlx-lm (MIT).

## App updates

In Settings, choose **Check GitHub for updates**. When a newer stable release is available, **Download and open installer** downloads the DMG for the app’s architecture and verifies its size and SHA-256 digest against the GitHub release asset. Finish your game, quit the app, and copy the new app into Applications from the opened disk image. Future launches should use that copy. Saved presentations and local AI models live in Application Support. Checks run only when requested and require internet access.

To distribute an update, bump the package version and lockfile, merge the release commit, then push a matching stable tag such as `v1.4.2`. Both macOS builds must succeed before the tag workflow publishes the two DMGs as a GitHub Release. Branch builds produce Actions artifacts for testing.
