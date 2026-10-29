# Build and distribute for macOS

## Install the app

Download the DMG for your Mac: `arm64` for Apple Silicon, `x64` for Intel. Open it and drag **Robot Rally Learning** to **Applications**. No terminal is needed for normal use.

An unsigned or unnotarized build may be blocked by Gatekeeper. If you trust the source, use macOS **System Settings → Privacy & Security → Open Anyway** after attempting to open the app, then confirm. Organization security policies may prevent this. Signing and notarization are required for smooth public distribution; successful packaging alone does not prove signing, notarization, or installation on another Mac.

## Build locally (developers)

Install Node.js 24 and Xcode 26 or newer with its macOS SDK on a Mac, then run from this folder:

```sh
npm ci
npm run build:apple
npm test
npm run test:e2e
npm run dist:mac
```

Use `npm run dist:mac:arm64` or `npm run dist:mac:x64` to build one architecture. Output is in `dist/`. The lockfile pins dependencies. Electron is packaged with the app; users do not install Node.js.

## GitHub Actions

Upload the **contents of this project directory** to the root of your private repository, including `package-lock.json`, `build/`, `src/`, `test/`, and `.github/workflows/build-macos.yml`. Do not place the project one directory below the repository root. Enable GitHub Actions for the repository, and commit the workflow to its default branch. The **Actions → Build macOS installers → Run workflow** button then appears for users with write access. Pushes to `main`/`master` and version tags also build automatically.

Each matrix job runs tests and builds one architecture, then uploads its DMG as a downloadable workflow artifact. A private repository needs available macOS Actions minutes and policies that allow the referenced actions. Artifact availability requires a successful actual workflow run; this source archive cannot establish that a private repository has run it.

## Optional signing and notarization

Set repository Actions secrets:

- `CSC_LINK`: base64-encoded Developer ID Application `.p12` certificate.
- `CSC_KEY_PASSWORD`: certificate password.
- `APPLE_ID`: Apple developer account email.
- `APPLE_APP_SPECIFIC_PASSWORD`: app-specific Apple password.
- `APPLE_TEAM_ID`: Apple developer team ID.

The same environment variables work for local builds. Electron Builder discovers the certificate, signs the app with hardened runtime and the JIT entitlement, and notarizes when all Apple credentials are present. Without credentials it produces a development distribution, not a notarized public release. Never commit certificates or credentials. Verify signed releases with `codesign --verify --deep --strict` and `spctl --assess --type execute` before distributing.

The macOS 15 CI runner with Xcode 26.3 builds a bundled Swift Foundation Models helper for Apple Silicon. Intel packages omit it. Runtime detection checks the model’s actual availability, including on macOS 27; the app never invokes the fm command-line tool or asks users to accept its CLI terms.
