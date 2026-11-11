# Robot Rally Swift Edition

A native macOS prototype for a possible Swift Student Challenge entry. Open `RobotRally/RobotRally.xcodeproj` in Xcode 27, select RobotRally and My Mac, then Run. The deployment target is macOS 14.

The app includes three original short lessons on force, ideal gear reductions, and battery energy. Each lesson leads to a multiple-choice driving challenge and an explanation. WASD, arrow keys, and a standard extended game controller move the robot. The numbered answer buttons provide a direct selection alternative. Controller menu navigation, presentation importing, AI generation, and saving progress are future work. The sample is fully bundled and requires no network access.

## Build

```sh
xcodebuild -project RobotRally/RobotRally.xcodeproj -scheme RobotRally -configuration Debug -derivedDataPath /tmp/robot-rally-swift build CODE_SIGNING_ALLOWED=NO
open '/tmp/robot-rally-swift/Build/Products/Debug/Robot Rally Swift.app'
```

## Current milestone

The first prototype is an introduction, three lessons and playable challenges, answer explanations, and a results review. Review the explanations and try the complete experience before expanding the content. Classroom validation, physical controller testing, and accessibility testing are still needed.

## Authorship and submission preparation

Codex generated the initial Xcode project, SwiftUI interface, SpriteKit gameplay, controller input, and sample educational text at the project owner's request. This prototype is a learning starting point. Keep an accurate record of subsequent individual work and AI assistance. The participant should understand, review, and meaningfully develop the implementation and write the required application essays themselves. Confirm the current competition requirements before submission. This repository is not a completed competition submission.
