"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
function build(arch) {
  const dir = path.join(root, "native-bin", arch);
  fs.mkdirSync(dir, { recursive: true });
  if (arch !== "arm64") {
    console.log(
      "Apple Intelligence helper omitted: Apple Silicon is required.",
    );
    return;
  }
  if (process.platform !== "darwin")
    throw Error(
      "Build the Apple Intelligence helper on macOS with Xcode 26 or newer.",
    );
  try {
    const sdk = execFileSync("xcrun", ["--sdk", "macosx", "--show-sdk-path"], {
      encoding: "utf8",
    }).trim();
    if (
      !fs.existsSync(
        path.join(sdk, "System/Library/Frameworks/FoundationModels.framework"),
      )
    )
      throw Error(
        "The active macOS SDK does not contain FoundationModels. Select Xcode 26 or newer with xcode-select.",
      );
    execFileSync(
      "xcrun",
      [
        "swiftc",
        "-parse-as-library",
        "-O",
        "-target",
        "arm64-apple-macos26.0",
        "-sdk",
        sdk,
        path.join(root, "native/AppleModel.swift"),
        "-o",
        path.join(dir, "apple-model"),
      ],
      { stdio: "inherit" },
    );
    execFileSync(
      "codesign",
      ["--force", "--sign", "-", path.join(dir, "apple-model")],
      { stdio: "inherit" },
    );
  } catch (e) {
    throw Error("Apple Intelligence helper build failed: " + e.message);
  }
}
module.exports = async (context) =>
  build(
    typeof context.arch === "string"
      ? context.arch
      : require("builder-util").Arch[context.arch],
  );
if (require.main === module) build(process.argv[2] || process.arch);
