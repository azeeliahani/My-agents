// Renders animation.html frame by frame, re-timed by timeline.json, and encodes an MP4.
// If voiceover/<id>.wav files exist, they are mixed in at the start of each segment.
// Usage: node render.js [out.mp4]                     full video
//        node render.js --stills 10,25,40 [dir]       PNG stills (video time) for review
const { chromium } = require('playwright');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const FPS = 30;
const TL = JSON.parse(fs.readFileSync(path.join(__dirname, 'timeline.json'), 'utf8'));

// piecewise-linear map from video time to master-animation time
const keys = [];
let v = 0;
for (const s of TL.segments) { s.v0 = v; v += s.dur; s.v1 = v; }
const TOTAL = v;
function animTime(vt) {
  for (const s of TL.segments) if (vt <= s.v1) return s.anim[0] + (vt - s.v0) / s.dur * (s.anim[1] - s.anim[0]);
  const last = TL.segments[TL.segments.length - 1]; return last.anim[1];
}

function audioArgs() {
  const clips = TL.segments.map(s => ({ s, f: path.join(__dirname, 'voiceover', s.id + '.wav') })).filter(c => fs.existsSync(c.f));
  if (!clips.length) return null;
  const inputs = [], filters = [];
  clips.forEach((c, i) => {
    const ms = Math.round((c.s.v0 + (TL.voDelay || 0)) * 1000);
    const dur = parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', c.f]).stdout);
    if (dur > c.s.dur - (TL.voDelay || 0) + 0.05) console.warn(`! voiceover ${c.s.id} is ${dur.toFixed(2)}s, slot is ${c.s.dur}s — raise dur in timeline.json`);
    inputs.push('-i', c.f);
    filters.push(`[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[a${i}]`);
  });
  filters.push(`${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0,apad,atrim=0:${TOTAL}[aout]`);
  return { inputs, map: ['-filter_complex', filters.join(';'), '-map', '0:v', '-map', '[aout]', '-c:a', 'aac', '-b:a', '192k'] };
}

(async () => {
  const args = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + path.join(__dirname, 'animation.html') + '?capture');
  await page.evaluate(async () => { await document.fonts.load('700 20px Inter'); await document.fonts.load('500 20px Inter'); await document.fonts.load('italic 500 20px Inter'); await document.fonts.ready; });
  const grab = (t, type) => page.evaluate(([t, type]) => { render(t); return document.getElementById('cv').toDataURL(type, 0.95); }, [t, type]);
  if (args[0] === '--stills') {
    const dir = args[2] || 'stills'; fs.mkdirSync(dir, { recursive: true });
    for (const t of args[1].split(',').map(Number)) {
      const d = await grab(animTime(t), 'image/png');
      fs.writeFileSync(path.join(dir, `v${String(t).padStart(5, '0')}.png`), Buffer.from(d.split(',')[1], 'base64'));
    }
  } else {
    const out = args[0] || 'knowledge-foundation.mp4';
    const audio = audioArgs();
    const ffArgs = ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      ...(audio ? audio.inputs : []), ...(audio ? audio.map : []),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-loglevel', 'error', out];
    console.log(audio ? 'mixing voiceover' : 'no voiceover/*.wav found — rendering silent');
    const ff = spawn('ffmpeg', ffArgs, { stdio: ['pipe', 'ignore', 'inherit'] });
    const n = Math.round(TOTAL * FPS);
    for (let i = 0; i < n; i++) {
      const d = await grab(animTime(i / FPS), 'image/jpeg');
      if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.log(`wrote ${out} (${TOTAL.toFixed(1)}s)`);
  }
  await browser.close();
})();
