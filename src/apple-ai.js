"use strict";
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
function helperPath() {
  const packaged =
    process.resourcesPath &&
    path.join(process.resourcesPath, "apple-ai", "apple-model");
  return packaged && fs.existsSync(packaged)
    ? packaged
    : path.resolve(__dirname, "../native-bin/arm64/apple-model");
}
function unavailable() {
  if (process.platform !== "darwin" || process.arch !== "arm64")
    return {
      available: false,
      reason: "deviceNotEligible",
      message: "Apple Intelligence requires an Apple Silicon Mac.",
    };
  if (Number(os.release().split(".")[0]) < 25)
    return {
      available: false,
      reason: "osUnsupported",
      message: "Apple Intelligence generation requires macOS 26 or newer.",
    };
  if (!fs.existsSync(helperPath()))
    return {
      available: false,
      reason: "helperMissing",
      message:
        "The Apple Intelligence helper is missing. Install the Apple Silicon build or run npm run build:apple for development.",
    };
  return null;
}
function invoke(request) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      helperPath(),
      [],
      {
        timeout: request.command === "status" ? 15000 : 120000,
        maxBuffer: 256 * 1024,
        encoding: "utf8",
      },
      (error, stdout) => {
        if (error)
          return reject(
            Error(
              error.killed
                ? "Apple Intelligence timed out. Try a smaller request."
                : "Apple Intelligence helper could not run: " +
                    error.message.slice(0, 400),
            ),
          );
        try {
          const data = JSON.parse(stdout);
          if (data.error) throw Error(data.error);
          resolve(data);
        } catch (e) {
          reject(Error("Apple Intelligence: " + e.message));
        }
      },
    );
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(request));
  });
}
async function checkAppleAI() {
  const missing = unavailable();
  if (missing) return missing;
  try {
    const result = await invoke({ command: "status" });
    if (
      typeof result.available !== "boolean" ||
      typeof result.reason !== "string" ||
      typeof result.message !== "string"
    )
      throw Error("Invalid availability response.");
    return result;
  } catch (e) {
    return { available: false, reason: "helperError", message: e.message };
  }
}
async function generateAppleQuestion({
  text,
  difficulty = "easy",
  distractors = 3,
  previousPrompts = [],
} = {}) {
  const missing = unavailable();
  if (missing) throw Error(missing.message);
  if (typeof text !== "string" || !text.trim() || text.length > 8000)
    throw Error("Apple Intelligence needs 1–8000 characters of source text.");
  if (
    !["easy", "medium", "hard", "custom"].includes(difficulty) ||
    !Number.isInteger(distractors) ||
    distractors < 1 ||
    distractors > 7
  )
    throw Error("Invalid Apple Intelligence generation settings.");
  if (
    !Array.isArray(previousPrompts) ||
    previousPrompts.length > 20 ||
    previousPrompts.some((s) => typeof s !== "string" || s.length > 2000)
  )
    throw Error("Invalid previous questions.");
  const result = await invoke({
    command: "generate",
    text,
    difficulty,
    distractors,
    previousPrompts,
  });
  if (result.available === false) throw Error(result.message);
  if (
    !["prompt", "answer", "explanation", "quote"].every(
      (k) =>
        typeof result[k] === "string" &&
        result[k].trim() &&
        result[k].length <= 2000,
    ) ||
    !Array.isArray(result.distractors) ||
    result.distractors.length !== distractors ||
    result.distractors.some(
      (s) => typeof s !== "string" || !s.trim() || s.length > 2000,
    )
  )
    throw Error(
      "Apple Intelligence returned invalid question fields or the wrong number of distractors. Review settings and try again.",
    );
  return result;
}
module.exports = { checkAppleAI, generateAppleQuestion };
