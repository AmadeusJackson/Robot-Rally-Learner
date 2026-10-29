# Robot Rally Learning

A local-first macOS desktop learning game built with Electron. Import a PowerPoint, review source-grounded challenges, and drive a robot to collect answers. No cloud account is required.

## Getting started

Install the matching macOS DMG by dragging the app to Applications. See [BUILD_MAC.md](BUILD_MAC.md) for installer builds, GitHub Actions, signing, and unsigned-app limitations.

1. Import a `.pptx` presentation into the library.
2. Inspect the extracted slides, notes, tables, and embedded images.
3. Configure level count, questions, difficulty, scoring, time limits, hints, speed, and controller dead zone.
4. Generate limited deterministic questions offline, or use Apple Intelligence on a supported Mac.
5. Preview every challenge, its correct answers, and source quotation. Edit the JSON if necessary, validate it, and approve it before playing.
6. Drive with WASD, arrow keys, a connected standard-mapped Xbox controller, or the on-screen controls. Collect the requested answers and review explanations and mistakes.

Settings, imported content, levels, results, and the resumable session are stored locally in the Electron user-data directory. Keep a separate copy of your original presentations. Imports are limited to 80 MB per file, and the saved library is limited to 60 MB including embedded images. A corrupt saved state produces an error and is preserved rather than overwritten.

## Content and accuracy

Offline content practice creates term-definition matching and factual sentence-completion questions from slide text. It skips the opening slide and identified title-only slides, and never asks which slide contained a statement. It does not infer cause and effect or interpret diagrams. It may reject a deck with insufficient usable or distinct text; it does not silently invent questions.

Apple Intelligence is detected automatically using Apple's Foundation Models framework. On Apple Silicon Macs running macOS 26 or later (including macOS 27), the app checks whether Apple Intelligence is enabled and its model is ready. When available, it is selected automatically. No Ollama installation, cloud account, API key, or terminal setup is needed. Unsupported Macs can explicitly choose offline content practice. Model download/readiness is managed by macOS. The app reports unavailable reasons and never silently substitutes offline questions after an AI failure.

Apple generation processes teaching slides individually and skips title and agenda slides. It selects concepts and short answers; playable questions blank out the selected term in a verified explanation from the lesson, so an invented question relationship cannot change what is being tested. Generated answers must include an exact source quotation and pass validation before preview. A human must still review answer labels and explanations: a few successful test questions do not establish general AI accuracy.

Challenge data supports concept identification, ordered assembly, cause-and-effect chains, matching, identifying incorrect statements, and troubleshooting. These modes share the answer-collection mechanic. Model or manually authored content determines the educational quality and conceptual difficulty. Difficulty is guidance for AI generation; deterministic mode remains limited recall.

PowerPoint text, speaker notes, tables, and supported embedded raster images are extracted locally. Images are available for human review; automatic OCR or visual reasoning over image-only slides is not provided. Legacy `.ppt` requires a separately installed LibreOffice application at `/Applications/LibreOffice.app` to convert it locally. If conversion is unavailable, save the presentation as `.pptx` in PowerPoint or LibreOffice first. LibreOffice is not bundled in the DMG.

## Development

```sh
npm ci
npm test
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

The controller works across the dashboard, library, mission builder, review, settings, and game. Connect it to macOS before opening the app, then release all buttons/sticks briefly to enable input.

- D-pad or left stick: move focus through controls. In play, drive the robot.
- A: select, activate buttons, toggle a checkbox, or expand details. On a text field, open the on-screen keyboard.
- Left/right: decrease/increase a focused number or change a selected option.
- B: close a dialog or go back; in play, pause. From the pause screen, B saves and exits.
- LB/RB: switch app screens. Right stick: scroll the current panel.
- Menu/Start: pause or resume. Y: reveal source evidence when hints are enabled.

Pause and completion screens expose Continue, Retry level, and Save & exit. A disconnected controller or loss of app focus pauses gameplay. Input must return to neutral after reconnecting or switching between menus and driving, preventing held buttons from triggering unintended actions.

Import opens an in-app browser for PowerPoint files in Downloads, Documents, and Desktop. Folders, file selection, cancellation, and removal confirmation work with the controller. The optional Other location button opens the macOS chooser. macOS permission dialogs and that system chooser are outside the app's controller support and may require a mouse or keyboard. Hidden files and links escaping the allowed folders are not listed.

Controller tests simulate standard Gamepad API input; physical Xbox compatibility still depends on macOS pairing/mapping and should be checked on the user's hardware.
