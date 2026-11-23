# Robot Rally competition-rover icon

![Native appearance and size proofs](icon-proof-sheet.png)

## Current direction — version 0.5.2

The user rejected the previous geometric icon as too simple and toy-like. This revision follows the actual in-game rover: exposed aluminum frame rails, triangular lightening cutouts, four black mecanum wheels, a graphite electronics enclosure, orange wiring, a front camera, and padded orange competition bumpers. Its shallow overhead perspective shows the engineered parts without obscuring the silhouette.

The old 9.1/10 self-assessment described the rejected vector direction. It is not a rating of this revision and was not an Apple rating. This revision is judged against the user's more specific request for game fidelity, polish, and competition-robot character.

## Construction and tradeoffs

- The foreground is a lossless PNG with real alpha, generated using `RobotRally/Rover.png` as the reference. It is stored inside the Icon Composer document, not loaded from an external path.
- One foreground group keeps the robot's parts aligned. Icon Composer positions it at 74% scale on a 1024-square canvas. There is no pre-rounded tile in the source image.
- The illustration includes controlled material lighting to distinguish aluminum, fabric, rubber, and graphite. Additional foreground Liquid Glass effects are disabled to avoid double bevels and highlights.
- Default and dark use separate steel-blue background colors. Clear and tinted appearances are rendered by Apple's tools from the same subject.
- This direction deliberately favors material detail over the former flat symbol. At 16 px, the fine electronics and wheel rollers are not individually readable; the diagonal chassis and paired orange bumpers carry recognition. At 32–128 px the frame and wheels become more apparent.
- No team number, sponsor mark, or FIRST/FRC logo is included. This is a fictional competition rover, not an official team or organization identity.

## Verification

Inspected Apple's native renders for default, dark, clear light/dark, and tinted light/dark. The proof sheet includes actual 16, 32, 64, and 128 px renders. The full-resolution preview is `icon-default.png`. Xcode builds the layered catalog and the `AppIcon.icns` compatibility resource. The target continues to support macOS 14.

The system's icon appearance is separate from Robot Rally's in-app theme preference.

## Editing and exporting

Open `../RobotRally/AppIcon.icon` in Icon Composer to adjust the background or placement. The production foreground is `Assets/competition-rover.png`. To reproduce the native previews, run:

```sh
./Design/export-icon.sh /path/to/output-directory
```

Run from `swift-challenge` with Xcode selected. The former vector generator and unreferenced vector layers have been removed; the previous design remains in Git history.

## References and authorship

- [Apple Human Interface Guidelines: App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons/)
- [Apple Design Resources](https://developer.apple.com/design/resources/)
- [Creating your app icon using Icon Composer](https://developer.apple.com/documentation/xcode/creating-your-app-icon-using-icon-composer)

Codex directed the revision and assembled the Icon Composer document. OpenAI's built-in ImageGen produced the new foreground using the existing in-game rover as the visual reference. Apple supplies the final icon mask, background material, appearance processing, and compatibility exports. See [concept-prompts.md](concept-prompts.md) for the exact production prompt and earlier exploratory prompts. Retain this AI-assistance record for any Student Challenge submission.
