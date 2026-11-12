# Robot Rally Swift Edition

A native macOS prototype for a possible Swift Student Challenge entry. Open `RobotRally/RobotRally.xcodeproj` in Xcode 27, select RobotRally and My Mac, then Run. The deployment target is macOS 14.

The app includes three original short lessons on force, ideal gear reductions, and battery energy. Each lesson leads to a multiple-choice driving challenge and an explanation. WASD, arrow keys, and a standard extended game controller move the robot. The numbered answer buttons provide a direct selection alternative. Controller menu navigation, presentation importing, AI generation, and saving progress are future work. The sample is fully bundled and requires no network access.

## Build

```sh
xcodebuild -project RobotRally/RobotRally.xcodeproj -scheme RobotRally -configuration Debug -derivedDataPath /tmp/robot-rally-swift build CODE_SIGNING_ALLOWED=NO
open '/tmp/robot-rally-swift/Build/Products/Debug/Robot Rally Swift.app'
```

## Current milestone

Version 0.4 blends the detailed rover and arena with distinct blue, mint, and purple bays, short success effects, and a native Mac title bar and controls sheet. Practice driving first lets you visit all three bays without affecting lesson scores. Opening Controls pauses driving; resume when ready. Feedback sounds are optional and off by default. Reduce Motion suppresses the arena pulses, sparks, and tire trails as well as interface transitions. Command-R restarts from the lesson and challenge screens.

Version 0.3 gives the driving arena the main window area. The question stays above it and the explanation stays below. Direct selection is available through the Choose directly popover. The floor has panel seams, painted markings, and a raised perimeter rail. A detailed rover sprite replaces the initial geometric robot.

`RobotRally/Rover.png` was generated with OpenAI ImageGen for this project. It depicts a fictional competition rover and is bundled locally. Include this use of generative AI in any submission disclosure.

Version 0.2 adds a warm paper-colored interface, a detailed robot and marked field, and interactive experiments for force, gear ratios, and power draw. The robot accelerates and turns smoothly, leaves brief tire marks, and confirms an answer after 0.45 seconds in a bay. Escape or the Pause button pauses driving, and switching away from the app pauses the game automatically. Answer explanations stay below a field sized from the window rather than the explanation length. The controller B button pauses driving, and A continues after feedback. Full controller navigation remains future work. Review the explanations and try the complete experience before expanding the content. Classroom validation, physical controller testing, and accessibility testing are still needed.

## Authorship and submission preparation

Codex generated the initial Xcode project, SwiftUI interface, SpriteKit gameplay, controller input, sample educational text, and the visual and interaction updates through version 0.4 at the project owner's request. This prototype is a learning starting point. Keep an accurate record of subsequent individual work and AI assistance. The participant should understand, review, and meaningfully develop the implementation and write the required application essays themselves. Confirm the current competition requirements before submission. This repository is not a completed competition submission.
