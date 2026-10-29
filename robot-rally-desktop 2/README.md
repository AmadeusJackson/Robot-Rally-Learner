# Robot Rally Learning (local desktop prototype)

An Electron desktop game that turns PowerPoint slide text into drive-and-collect missions. All import, extraction, and gameplay run on your own computer. No cloud API or account is used.

## Run locally

1. Install Node.js 20+.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Run `npm start`.
5. Import one or more `.pptx` files, choose number of levels (1–20), difficulty, and generation mode.
6. Connect an Xbox controller via USB or Bluetooth. Left stick and D-pad drive; A advances after levels; X restarts a level. Keyboard WASD and arrows also work.

### Old PowerPoint `.ppt` files

Install LibreOffice so the app can convert old `.ppt` files locally. Alternatively, open the file in PowerPoint and **Save As → `.pptx`**.

### Local AI generation (recommended)

Install [Ollama](https://ollama.com), download a model (for example `ollama pull qwen2.5:7b`), and ensure its local service is running. In the app, select **Local AI**, refresh the model list, and generate levels. The app sends extracted text **only to the local Ollama server at 127.0.0.1:11434**. No external API is used. The local model can make mistakes. Check the scientific content before relying on it for an exam.

### Offline mode (no AI)

Offline mode creates slide-sequence matching levels from extracted slide text. This is useful for testing the game but is **not equivalent to understanding causal order**. It preserves slide order rather than reliably constructing biological process steps.

### Package an installable app

- Windows: `npm run dist:win` (requires Windows)
- macOS: `npm run dist:mac` (requires macOS)
- Linux: `npm run dist:linux` (requires Linux)

Build outputs go to `dist/`. Packaging is not performed in the provided ZIP. Unsigned installers may show operating-system warnings.

## Limitations

- Text extraction from slides only. Diagrams, charts, speaker notes, animations and pictures are not interpreted.
- The prototype does not persist imported decks between sessions.
- Local Ollama generation may take time and may fail to produce high-quality ordered levels with smaller models.
- Gamepad availability depends on the operating system and Electron/Chromium gamepad support.
- No telemetry, log-in, or cloud upload; the application connects to loopback Ollama only when local AI mode is selected.
