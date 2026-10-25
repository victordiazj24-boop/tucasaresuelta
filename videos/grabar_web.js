// Graba un clip vertical 1080x1920 "navegando" por la web local (dist/) frame a frame.
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const [,, cat, out] = process.argv;
const DIST = '/home/user/tucasaresuelta/dist';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 693 }, deviceScaleFactor: 1080/390, isMobile: true, hasTouch: true });
  fs.mkdirSync(out, { recursive: true }); let n = 0;
  const shot = async () => p.screenshot({ path: path.join(out, String(n++).padStart(5,'0') + '.png') });
  const hold = async (f) => { for (let i=0;i<f;i++) await shot(); };
  const dot = `if(!document.getElementById('tdot')){const d=document.createElement('div');d.id='tdot';d.style.cssText='position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(255,255,255,.55);border:3px solid rgba(234,88,12,.9);box-shadow:0 2px 10px rgba(0,0,0,.3);z-index:99999;pointer-events:none;display:none;transition:transform .15s';document.body.appendChild(d);}`;
  const tap = async (sel) => {
    await p.evaluate(dot);
    const el = await p.$(sel); await el.scrollIntoViewIfNeeded(); await hold(4);
    const bb = await el.boundingBox();
    await p.evaluate(([x,y]) => { const d=document.getElementById('tdot'); d.style.left=x+'px'; d.style.top=y+'px'; d.style.display='block'; d.style.transform='scale(1)'; }, [bb.x+bb.width/2, bb.y+bb.height/2]);
    await hold(8);
    await p.evaluate(() => document.getElementById('tdot').style.transform='scale(.7)'); await hold(6);
    await p.evaluate(() => document.getElementById('tdot').style.transform='scale(1)'); await hold(3);
  };
  const scroll = async (px, f) => { for (let i=0;i<f;i++){ const t=(1-Math.cos(Math.PI*(i+1)/f))/2 - (1-Math.cos(Math.PI*i/f))/2; await p.evaluate(d=>window.scrollBy(0,d), px*t); await shot(); } };
  await p.goto('file://' + DIST + '/index.html'); await p.waitForTimeout(800);
  await hold(20); await scroll(500, 30);
  await tap(`a[href="categoria/${cat}.html"]`);
  await p.goto('file://' + DIST + `/categoria/${cat}.html`); await p.waitForTimeout(800);
  await hold(15); await scroll(420, 30); await hold(5);
  await tap('.card .btn-amazon'); await hold(10);
  await b.close(); console.log('frames', n);
})();
