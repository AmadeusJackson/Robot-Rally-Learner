const { test } = require("node:test");
const assert = require("node:assert/strict");
const { _electron: electron } = require("playwright");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
test(
  "Xbox inputs operate import, configuration, review, keyboard, gameplay pause and removal with the macOS chooser mocked",
  { timeout: 120000 },
  async () => {
    const profile = await fs.mkdtemp(
      path.join(os.tmpdir(), "rally-controller-"),
    );
    let app;
    const errors = [];
    try {
      app = await electron.launch({
        args: [root],
        env: { ...process.env, ROBOT_RALLY_USER_DATA: profile },
      });
      const page = await app.firstWindow();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.waitForFunction(() => typeof state !== "undefined");
      const deck = {
        id: "controller-deck",
        name: "Controller lesson.pptx",
        slides: [
          "Physics",
          "Energy is the capacity to do work.",
          "Velocity is the rate of change of position.",
          "Force is a push or pull on an object.",
          "Mass is the amount of matter in an object.",
        ].map((text, i) => ({ number: i + 1, text, lines: [text] })),
      };
      await app.evaluate(({ ipcMain }, deck) => {
        ipcMain.removeHandler("select-presentations");
        ipcMain.handle("select-presentations", () => [deck]);
      }, deck);
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].focus(),
      );
      await page.waitForFunction(() => document.hasFocus());
      await page.evaluate(() => {
        window.testPad = {
          id: "Xbox test controller",
          index: 0,
          connected: true,
          mapping: "standard",
          axes: [0, 0, 0, 0],
          buttons: Array.from({ length: 17 }, () => ({
            pressed: false,
            value: 0,
          })),
        };
        navigator.getGamepads = () => [window.testPad];
        window.dispatchEvent(new Event("focus"));
      });
      const frames = () =>
        page.evaluate(
          () =>
            new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r)),
            ),
        );
      await page.waitForFunction(() => document.body.classList.contains("controller-connected"));
      await frames();
      const press = async (index) => {
        await page.evaluate((i) => {
          window.testPad.buttons[i] = { pressed: true, value: 1 };
        }, index);
        await frames();
        await page.evaluate((i) => {
          window.testPad.buttons[i] = { pressed: false, value: 0 };
        }, index);
        await frames();
      };
      async function focus(selector) {
        for (let i = 0; i < 150; i++) {
          if (
            await page.evaluate(
              (s) => document.activeElement?.matches(s),
              selector,
            )
          )
            return;
          await press(13);
        }
        throw Error("Controller could not reach " + selector);
      }
      await press(5);
      assert.equal(await page.evaluate(() => page), "library");
      await focus("#import");
      await press(0);
      await page.waitForFunction(() => state.decks.length === 1);
      await press(5);
      assert.equal(await page.evaluate(() => page), "configure");
      await focus("#mode");
      await press(15);
      await focus('[data-setting="levelCount"]');
      await press(14);
      await press(14);
      assert.equal(await page.evaluate(() => state.settings.levelCount), 1);
      await press(0);
      await page.getByRole("heading", { name: "Enter a number" }).waitFor();
      await press(1);
      assert.equal(await page.evaluate(() => state.settings.levelCount), 1);
      await focus('[data-setting="questionsPerLevel"]');
      await press(14);
      await focus("#generate");
      await press(0);
      await page.locator("#review").waitFor({ state: "visible" });
      await focus("#review summary");
      await press(0);
      await focus("#level-editor");
      const original = await page.locator("#level-editor").inputValue();
      await press(0);
      await page
        .locator(".controller-keyboard-grid")
        .waitFor({ state: "visible" });
      await frames();
      await press(0);
      await press(1);
      assert.equal(await page.locator("#level-editor").inputValue(), original);
      await focus("#approved");
      await press(0);
      assert.equal(await page.locator("#approved").isChecked(), true);
      await focus("#play");
      await press(0);
      await page.locator("#game").waitFor({ state: "visible" });
      await frames();
      const startX = await page.evaluate(() => bot.x);
      await page.evaluate(() => (window.testPad.axes[0] = 1));
      await page.waitForFunction((x) => bot.x > x + 10, startX);
      await page.evaluate(() => (window.testPad.axes[0] = 0));
      await frames();
      await press(3);
      assert.equal(await page.locator("#reveal-hint").isVisible(), false);
      await page.evaluate(() => {
        navigator.getGamepads = () => [];
      });
      await page.waitForFunction(() => !playing);
      await page.evaluate(() => {
        navigator.getGamepads = () => [window.testPad];
      });
      await frames();
      await press(9);
      await page.waitForFunction(() => playing);
      await press(9);
      await page.waitForFunction(() => !playing);
      assert.equal(
        await page.locator("#overlay-title").textContent(),
        "Mission paused",
      );
      await focus("#overlay-exit");
      await press(0);
      await page.waitForFunction(() => page === "home");
      assert.ok(await page.evaluate(() => state.session));
      await focus("#resume");
      await press(0);
      await page.waitForFunction(() => page === "game" && playing);
      await press(1);
      await page.waitForFunction(() => !playing);
      await press(1);
      await page.waitForFunction(() => page === "home");
      await press(5);
      await focus("#files button:last-child");
      await press(0);
      await page.locator("dialog[open]").waitFor({ state: "visible" });
      await press(1);
      assert.equal(await page.evaluate(() => state.decks.length), 1);
      assert.deepEqual(errors, []);
    } finally {
      if (app) await app.close();
      await fs.rm(profile, { recursive: true, force: true });
    }
  },
);
