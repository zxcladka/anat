// Мінімальний CDP-клієнт: headless Chrome, емуляція пристрою, JS, скріншоти.
// node cdp.mjs tasks.json  — tasks: {width,height,mobile,dark,steps:[{url|eval|shot|wait|full}]}
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const port = 9333 + Math.floor(Math.random() * 500);
const prof = `${process.cwd()}/prof-${port}`;
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl; for (let i = 0; i < 50; i++) { try { const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); wsUrl = v.webSocketDebuggerUrl; break; } catch { await sleep(200); } }
if (!wsUrl) { chrome.kill(); throw new Error('chrome did not start'); }
const ws = new WebSocket(wsUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); const events = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method) events.push(m); };
const send = (method, params = {}, sessionId) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const { targetId } = (await send('Target.createTarget', { url: 'about:blank' })).result;
const { sessionId } = (await send('Target.attachToTarget', { targetId, flatten: true })).result;
const S = (m, p) => send(m, p, sessionId).then(r => { if (r.error) console.error('ERR', m, r.error.message); return r.result; });
await S('Page.enable'); await S('Runtime.enable'); await S('Log.enable');
await S('Emulation.setDeviceMetricsOverride', { width: cfg.width, height: cfg.height, deviceScaleFactor: cfg.mobile ? 2 : 1, mobile: !!cfg.mobile });
if (cfg.mobile) await S('Emulation.setTouchEmulationEnabled', { enabled: true });
if (cfg.dark != null) await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: cfg.dark ? 'dark' : 'light' }] });
const errors = [];
for (const st of cfg.steps) {
  if (st.url) { await S('Page.navigate', { url: st.url }); await sleep(st.wait ?? 900); }
  if (st.eval) { const r = await S('Runtime.evaluate', { expression: st.eval, awaitPromise: true, returnByValue: true }); console.log(st.shot || 'eval', '=>', JSON.stringify(r?.result?.value ?? r?.exceptionDetails?.exception?.description)); if (st.wait && !st.url) await sleep(st.wait); }
  if (st.shot) { if (st.full) { const { contentSize } = await S('Page.getLayoutMetrics'); await S('Emulation.setDeviceMetricsOverride', { width: cfg.width, height: Math.ceil(contentSize.height), deviceScaleFactor: cfg.mobile ? 2 : 1, mobile: !!cfg.mobile }); await sleep(200); }
    const { data } = await S('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${st.shot}.png`, Buffer.from(data, 'base64'));
    if (st.full) { await S('Emulation.setDeviceMetricsOverride', { width: cfg.width, height: cfg.height, deviceScaleFactor: cfg.mobile ? 2 : 1, mobile: !!cfg.mobile }); } }
}
for (const e of events) if (e.method === 'Runtime.exceptionThrown' || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error')) errors.push(JSON.stringify(e.params).slice(0, 300));
console.log('console errors:', errors.length, errors.join('\n'));
ws.close(); chrome.kill(); try { fs.rmSync(prof, { recursive: true, force: true }); } catch {}
