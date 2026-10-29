const { test } = require("node:test");
const assert = require("node:assert/strict");
const { _electron: electron } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const fixture = require("./fixtures/deck.cjs");
const root = path.resolve(__dirname, "..");
test(
  "Electron import, review, gameplay, local inference validation, and persistence",
  { timeout: 120000 },
  async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "rally-e2e-"));
    const deck = fixture(path.join(temp, "Physics.pptx"));
    let app;
    const errors = [];
    const launch = async () => {
      const a = await electron.launch({
        args: [root],
        env: {
          ...process.env,
          ROBOT_RALLY_USER_DATA: path.join(temp, "profile"),
        },
      });
      const p = await a.firstWindow();
      p.on("pageerror", (e) => errors.push(e.message));
      await p.waitForFunction(
        () =>
          document.querySelector("#home-import") &&
          !document.querySelector("#home").hidden,
      );
      return { a, p };
    };
    try {
      let launched = await launch();
      app = launched.a;
      let page = launched.p;
      await app.evaluate(({ dialog }, file) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [file],
        });
      }, deck);
      await page.locator("#home-import").click();
      await page.waitForFunction(() =>
        document.querySelector("#files").textContent.includes("Physics.pptx"),
      );
      const imported = await page.evaluate(() => window.desktopAPI.loadState());
      assert.equal(imported.decks[0].slides.length, 8);
      await page.locator('[data-page="configure"]').click();
      await page.locator('[data-setting="levelCount"]').fill("2");
      await page.locator('[data-setting="questionsPerLevel"]').fill("1");
      await page.locator('[data-setting="distractors"]').fill("1");
      await page.locator("#mode").selectOption("offline");
      await page.locator("#generate").click();
      await page.locator("#review").waitFor({ state: "visible" });
      await page.locator("#approved").check();
      await page.locator("#play").click();
      await page.locator("#game").waitFor({ state: "visible" });
      await page.locator("#field").focus();
      const before = await page.evaluate(() => bot.x);
      await page.keyboard.down("ArrowRight");
      await page.waitForFunction((x) => bot.x > x + 10, before);
      await page.keyboard.up("ArrowRight");
      await page.locator("#pause").click();
      assert.equal(await page.evaluate(() => playing), false);
      await page.locator("#continue").click();
      await page.evaluate(() => {
        const wrong = items.find((i) => !current().correctIds.includes(i.id));
        bot.x = wrong.x;
        bot.y = wrong.y;
      });
      await page.waitForFunction(() => game.incorrect === 1);
      assert.equal(await page.evaluate(() => game.score), -50);
      await page.evaluate(() => {
        const right = items.find((i) => current().correctIds.includes(i.id));
        bot.x = right.x;
        bot.y = right.y;
      });
      await page.waitForFunction(() => game.correct === 1);
      assert.equal(await page.evaluate(() => game.score), 50);
      await page.locator("#continue").click();
      await page.waitForFunction(() => game.levelIndex === 1);
      await page.locator("#exit").click();
      await page.waitForFunction(async () =>
        Boolean((await window.desktopAPI.loadState()).session),
      );
      const availability = await page.evaluate(() =>
        window.desktopAPI.checkAppleAI(),
      );
      assert.equal(typeof availability.available, "boolean");
      const contentState = await page.evaluate(() =>
        window.desktopAPI.loadState(),
      );
      for (const level of contentState.levels)
        for (const q of level.questions) {
          assert.ok(q.source.slideNumber > 1);
          assert.doesNotMatch(q.prompt, /slide|presentation/i);
        }
      await app.close();
      app = null;
      launched = await launch();
      app = launched.a;
      page = launched.p;
      await page.locator("#resume").waitFor({ state: "visible" });
      const restored = await page.evaluate(() => window.desktopAPI.loadState());
      assert.equal(restored.decks.length, 1);
      assert.equal(restored.settings.levelCount, 2);
      assert.ok(restored.session);
      await page.locator("#resume").click();
      await page.evaluate(() => {
        const right = items.find((i) => current().correctIds.includes(i.id));
        bot.x = right.x;
        bot.y = right.y;
      });
      await page.waitForFunction(() => game.correct === 2);
      await page.locator("#continue").click();
      await page.locator("#results").waitFor({ state: "visible" });
      await page.waitForFunction(
        async () => (await window.desktopAPI.loadState()).results.length === 1,
      );
      const final = await page.evaluate(() => window.desktopAPI.loadState());
      assert.equal(final.results[0].score, 160);
      assert.equal(final.results[0].mistakes.length, 1);
      assert.equal(final.session, null);
      assert.deepEqual(errors, []);
    } finally {
      if (app) await app.close();
      await fs.rm(temp, { recursive: true, force: true });
    }
  },
);
