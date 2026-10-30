const { test } = require('node:test');
const assert = require('node:assert/strict');
const { _electron: electron } = require('playwright');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const fixture = require('./fixtures/deck.cjs');
const root = path.resolve(__dirname, '..');
test('pages, review, dialogs and game reflow across window sizes', {timeout: 120000}, async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'rally-layout-'));
  let app;
  try {
    const file = fixture(path.join(temp, 'Physics.pptx'));
    app = await electron.launch({args:[root], env:{...process.env, ROBOT_RALLY_USER_DATA:path.join(temp,'profile')}});
    const p = await app.firstWindow();
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.waitForFunction(() => typeof state !== 'undefined');
    await app.evaluate(({dialog}, file) => { dialog.showOpenDialog = async () => ({canceled:false, filePaths:[file]}); }, file);
    await p.locator('#home-import').click();
    await p.waitForFunction(() => state.decks.length === 1);
    await p.locator('[data-page="configure"]').click();
    await p.locator('#mode').selectOption('offline');
    await p.locator('#generate').click();
    await p.locator('#review').waitFor({state:'visible'});
    // Stress content that should wrap, including filenames and source tables.
    await p.evaluate(() => {
      state.decks[0].name = 'LongPresentationFilename'.repeat(12) + '.pptx';
      renderLibrary(); renderSlides(state.decks[0]);
      document.querySelectorAll('#slide-preview details').forEach(e => e.open = true);
      document.body.classList.add('controller-connected');
      const legend = document.querySelector('#controller-legend');
      legend.hidden = false;
      legend.textContent = 'D-pad / left stick: navigate · A: select · B: back · LB / RB: screens · Right stick: scroll · Menu: pause';
    });
    // Prevent the input polling from hiding the simulated legend.
    await p.evaluate(() => { controllerUI.update = () => {}; });
    async function check(label) {
      await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const over = await p.evaluate(() => ({
        width:innerWidth, scroll:document.documentElement.scrollWidth,
        bad:[...document.querySelectorAll('main button, main input, main select, dialog[open] button')]
          .filter(e => e.getClientRects().length && (e.getBoundingClientRect().right > innerWidth + 1 || e.getBoundingClientRect().left < -1))
          .map(e => e.id || e.textContent.slice(0,40))
      }));
      assert.ok(over.scroll <= over.width + 1, label + ': horizontal overflow ' + JSON.stringify(over));
      assert.deepEqual(over.bad, [], label + ': clipped controls');
    }
    for (const [width,height] of [[480,480],[640,600],[800,600],[900,650],[1280,720],[1440,900],[1920,1080]]) {
      await app.evaluate(({BrowserWindow}, size) => BrowserWindow.getAllWindows()[0].setContentSize(...size), [width,height]);
      for (const name of ['home','library','configure','settings','results']) {
        await p.evaluate(name => show(name), name);
        await check(`${width}x${height} ${name}`);
      }
      await p.evaluate(() => { show('configure'); document.querySelector('#approved').checked=true; });
      await p.locator('#play').click();
      await p.locator('#pause').click();
      await check(`${width} game`);
      const ratio = await p.locator('#field').evaluate(e => e.clientWidth / e.clientHeight);
      assert.ok(Math.abs(ratio - 5/3) < .02, 'game keeps its aspect ratio');
      await p.locator('#overlay-exit').click();
      await p.evaluate(() => { show('configure'); controllerUI.keyboard(document.querySelector('#level-editor')); });
      await check(`${width} keyboard`);
      await p.getByRole('button',{name:'Done',exact:true}).scrollIntoViewIfNeeded();
      const done = await p.getByRole('button',{name:'Done',exact:true}).boundingBox();
      const legendTop = await p.locator('#controller-legend').evaluate(e => e.getBoundingClientRect().top);
      assert.ok(done.y >= 0 && done.y + done.height <= legendTop, 'keyboard actions reachable above legend');
      if (width === 480) await p.screenshot({path:path.join(root,'..','responsive-keyboard.png')});
      await p.getByRole('button',{name:'Cancel',exact:true}).click();
      await p.evaluate(() => { show('home'); window.scrollTo(0,0); });
      if (width === 480) await p.screenshot({path:path.join(root,'..','responsive-small.png')});
    }
    assert.deepEqual(errors, []);
  } finally {
    if(app) await app.close();
    await fs.rm(temp,{recursive:true,force:true});
  }
});
