# Produce a macOS installer

This repository includes a GitHub Actions workflow at `.github/workflows/build-macos.yml` that runs on a Mac to build an unsigned DMG. It is not a pre-built installer.

1. Upload the extracted project files to a GitHub repository with a `main` branch, including `.github/workflows/build-macos.yml`.
2. Open the repository's **Actions** tab, select **Build macOS installer**, and choose **Run workflow**.
3. When the workflow finishes, download its `Robot-Rally-Learning-macOS` artifact.
4. Extract the artifact and open the `.dmg`. Drag the app to Applications.

This app is not notarized by Apple. On first launch, macOS may warn that it cannot verify the developer. Only override Gatekeeper if you trust the source and built artifact. For broad public distribution, Apple Developer signing and notarization are recommended.

The workflow requires an online GitHub-hosted macOS runner, but gameplay and PowerPoint parsing run locally on your Mac. Local AI mode additionally requires a local Ollama model.
