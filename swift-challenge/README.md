# Robot Rally Swift Edition

A native macOS prototype for a possible Swift Student Challenge entry. Open `RobotRally/RobotRally.xcodeproj` in Xcode 27, select RobotRally and My Mac, then Run. The deployment target is macOS 14.

The app includes three original short lessons on force, ideal gear reductions, and battery energy. Each lesson leads to a multiple-choice driving challenge and an explanation. WASD, arrow keys, and a standard extended game controller move the robot. The numbered answer buttons provide a direct selection alternative. Controller navigation covers the home screen, lessons, practice, pause controls, settings, direct answers, and results. Presentation importing, AI generation, and saving learning progress remain future work. The sample is fully bundled and requires no network access.

## Build

```sh
xcodebuild -project RobotRally/RobotRally.xcodeproj -scheme RobotRally -configuration Debug -derivedDataPath /tmp/robot-rally-swift build CODE_SIGNING_ALLOWED=NO
open '/tmp/robot-rally-swift/Build/Products/Debug/Robot Rally Swift.app'
```

## Current milestone

Version 0.5 moves controller input out of the arena so it works throughout the app. The selected control has an orange outline, and focused lesson controls and result cards scroll into view. Settings and direct-answer selection stop the robot. Disconnecting the controller or leaving the app pauses driving. Held buttons cannot skip screens, and held steering input must return to neutral before navigating a new screen.

The appearance switcher now updates the actual SwiftUI palette and native window appearance immediately, including the settings sheet. It preserves the current lesson and experiment values and saves the preference for the next launch.

### Xbox controller controls

| Control | Action |
| --- | --- |
| Left stick or D-pad | Drive in the arena; move the selection in menus |
| A | Activate the outlined button; cycle a selected setting |
| Left / right on a selected setting | Change appearance, sound, or the lesson experiment value |
| B | Back; pause/resume while driving; close settings or direct answers |
| Menu | Pause/resume in the arena; open/close settings elsewhere |
| Y | Open/close appearance and controls from any screen |
| X | Open direct answers during a question; start lessons from practice |

While paused, use the D-pad and A to resume, restart, return home, or open settings. Results cards can be selected to scroll through the explanations. Pair the controller in macOS before use; the app detects connection changes automatically. System dialogs and macOS menus still use macOS input controls.

### Regression checks

Run `./Tests/check.sh` from this directory with Xcode's command-line tools selected. The checks feed simulated controller snapshots through the production input handler and verify lesson progression, settings, direct answers, practice, pause/resume, disconnect/reconnect, input repeats, preference persistence, and repainting an existing view when switching Light → Dark → Light. These checks do not replace physical Xbox controller testing.

Version 0.4.1 adds a saved appearance preference. Open the keyboard icon in the top-right corner and choose System, Light, or Dark under Appearance. System follows macOS and is the default. The theme covers menus, lesson experiments, answer choices, feedback, and results; the driving arena keeps its dark floor in both themes.

Version 0.4 blends the detailed rover and arena with distinct blue, mint, and purple bays, short success effects, and a native Mac title bar and controls sheet. Practice driving first lets you visit all three bays without affecting lesson scores. Opening Controls pauses driving; resume when ready. Feedback sounds are optional and off by default. Reduce Motion suppresses the arena pulses, sparks, and tire trails as well as interface transitions. Command-R restarts from the lesson and challenge screens.

Version 0.3 gives the driving arena the main window area. The question stays above it and the explanation stays below. Direct selection is available through the Choose directly popover. The floor has panel seams, painted markings, and a raised perimeter rail. A detailed rover sprite replaces the initial geometric robot.

`RobotRally/Rover.png` was generated with OpenAI ImageGen for this project. It depicts a fictional competition rover and is bundled locally. Include this use of generative AI in any submission disclosure.

Version 0.2 adds a warm paper-colored interface, a detailed robot and marked field, and interactive experiments for force, gear ratios, and power draw. The robot accelerates and turns smoothly, leaves brief tire marks, and confirms an answer after 0.45 seconds in a bay. Escape or the Pause button pauses driving, and switching away from the app pauses the game automatically. Answer explanations stay below a field sized from the window rather than the explanation length. The controller B button pauses driving, and A continues after feedback. Review the explanations and try the complete experience before expanding the content. Classroom validation, physical controller testing, and accessibility testing are still needed.

## Authorship and submission preparation

Codex generated the initial Xcode project, SwiftUI interface, SpriteKit gameplay, controller input, sample educational text, and the visual and interaction updates through version 0.5 at the project owner's request. This prototype is a learning starting point. Keep an accurate record of subsequent individual work and AI assistance. The participant should understand, review, and meaningfully develop the implementation and write the required application essays themselves. Confirm the current competition requirements before submission. This repository is not a completed competition submission.
