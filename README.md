# Robot Rally Learning

A local-first macOS desktop learning game built with Electron. Import a PowerPoint, review source-grounded challenges, and drive a robot to collect answers. No cloud account is required.

## Getting started

Install the matching macOS DMG by dragging the app to Applications. See [BUILD_MAC.md](BUILD_MAC.md) for installer builds, GitHub Actions, signing, and unsigned-app limitations.

1. Import a `.pptx` presentation into the library.
2. Inspect the extracted slides, notes, tables, and embedded images.
3. Configure level count, questions, difficulty, scoring, time limits, hints, speed, and controller dead zone.
4. Generate limited deterministic questions offline, or use an installed local Ollama model.
5. Preview every challenge, its correct answers, and source quotation. Edit the JSON if necessary, validate it, and approve it before playing.
6. Drive with WASD, arrow keys, a connected standard-mapped Xbox controller, or the on-screen controls. Collect the requested answers and review explanations and mistakes.

Settings, imported content, levels, results, and the resumable session are stored locally in the Electron user-data directory. Keep a separate copy of your original presentations. Imports are limited to 80 MB per file, and the saved library is limited to 60 MB including embedded images. A corrupt saved state produces an error and is preserved rather than overwritten.

## Content and accuracy

Deterministic mode creates limited extractive recall questions from slide text. It does not infer cause and effect or interpret diagrams. It may reject a deck with insufficient usable or distinct text; it does not silently invent questions.

Ollama integration is optional. Start Ollama separately, install a model, configure its loopback HTTP endpoint (such as `http://127.0.0.1:11434`) in Settings, refresh models, and choose one. Downloading Ollama or a model requires internet access; inference with an installed model is local. AI accuracy has **not been evaluated**. A valid schema and matching source quotation are necessary checks but do not establish semantic correctness. A person must review the answer labels, distractors, explanations, and source evidence before approving gameplay.

Challenge data supports concept identification, ordered assembly, cause-and-effect chains, matching, identifying incorrect statements, and troubleshooting. These modes share the answer-collection mechanic. Model or manually authored content determines the educational quality and conceptual difficulty. Difficulty is guidance for AI generation; deterministic mode remains limited recall.

PowerPoint text, speaker notes, tables, and supported embedded raster images are extracted locally. Images are available for human review; automatic OCR or visual reasoning over image-only slides is not provided. Legacy `.ppt` requires a separately installed LibreOffice application at `/Applications/LibreOffice.app` to convert it locally. If conversion is unavailable, save the presentation as `.pptx` in PowerPoint or LibreOffice first. LibreOffice and Ollama are not bundled in the DMG.

## Development

```sh
npm ci
npm test
npm run test:e2e
npm start
npm run dist:mac
```

Use Node.js 24. `ROBOT_RALLY_USER_DATA` may point to an isolated data directory for testing; normal app launches use Electron’s user-data location. macOS packaging must run on macOS. All application assets are bundled; the renderer uses no remote scripts or fonts. The interface remains vanilla JavaScript to retain the small prototype's useful canvas code and avoid a framework migration; it is not a TypeScript/React rewrite.

Architecture:

- `src/main.js` / `src/preload.js`: narrow IPC, native dialogs, local generation, and desktop lifecycle.
- `src/extraction.js`: PowerPoint import and local legacy conversion.
- `src/persistence.js`: local state storage.
- `src/ollama.js`: bounded HTTP requests to loopback-only Ollama endpoints.
- `src/content.js`: deterministic generation and challenge validation.
- `src/game-core.js`: pure input, collision, scoring, and progression functions.
- `src/app.js`, `src/index.html`, `src/style.css`: interface, source review, canvas gameplay, and result history.
- `test/`: focused automated checks. Passing these checks does not establish physical controller compatibility, semantic AI accuracy, or notarization.

## Release verification

Before public distribution, test a signed and notarized installer on clean Intel and Apple Silicon Macs, a physical Xbox controller, real-world `.ppt` conversion, and the chosen Ollama models. Run the repository's GitHub Actions workflow and inspect both installer artifacts. Local packaging success does not prove a remote CI run has succeeded.
