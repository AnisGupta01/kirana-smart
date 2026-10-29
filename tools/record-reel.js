/* Records a 9:16 Instagram reel (1080x1920 MP4) of a cinematic shop page.
   Usage:  node tools/record-reel.js [page] [output.mp4]
           page defaults to demo/chai/index.html, output to reel-demo.mp4
   Needs: npm i playwright (+ a Chromium), and ffmpeg on the PATH.
   How: the page runs in slow motion (CSS + requestAnimationFrame time x SLOW) while
   full-resolution screenshots are taken, then the frames are sped back up to real time. */
const http = require("http"), fs = require("fs"), path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { console.error("Install Playwright first: npm i playwright && npx playwright install chromium"); process.exit(1); }
const root = path.join(__dirname, "..");
const PAGE = process.argv[2] || "demo/chai/index.html";
const MP4 = path.resolve(process.argv[3] || "reel-demo.mp4");
const out = path.join(require("os").tmpdir(), "ks-reel-frames");
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(root, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
const W = +(process.env.W || 390), H = +(process.env.H || 693), DPR = 1, SECS = +(process.env.SECS || 18), SPEED = process.env.SPEED || "1.1";
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + srv.address().port;
  const b = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu-vsync"] });
  /* warm the cache so the recording starts on a fully loaded page */
  const warm = await b.newContext({ viewport: { width: W, height: H } });
  const wp = await warm.newPage(); await wp.goto(base + "/" + PAGE); await wp.waitForTimeout(800); await warm.close();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  const p = await ctx.newPage();
  await p.setContent('<body style="margin:0;background:#0a0908"></body>');
  /* Real-time capture at full device resolution: Page.captureScreenshot honours the DPR
     (the screencast does not in headless). The page runs in slow motion (autoplay speed and
     CSS animation playback rate x SLOW) and the frame times are sped back up when encoding. */
  const cdp = await ctx.newCDPSession(p);
  const SLOW = +(process.env.SLOW || 0.22);
  const CLIP = +(process.env.SCALE || 2); /* device pixel ratio of the frames */
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: CLIP, mobile: false });
  await cdp.send("Animation.enable");
  await cdp.send("Animation.setPlaybackRate", { playbackRate: SLOW });
  const frames = [];
  let capturing = true;
  const startLoop = () => (async () => {
    while (capturing) {
      try {
        const n = frames.length;
        const r = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 88, optimizeForSpeed: true });
        fs.writeFileSync(path.join(out, "f" + String(n).padStart(5, "0") + ".jpg"), Buffer.from(r.data, "base64"));
        frames.push(Date.now() / 1000);
      } catch (e) { await new Promise((r) => setTimeout(r, 30)); }
    }
  })();
  const t0 = Date.now();
  await p.goto(base + "/" + PAGE + "?autoplay=1&reel=1&speed=" + SPEED, { waitUntil: "domcontentloaded" });
  const loop = startLoop();
  /* tap "Add" on the chai and samosa while they are on screen (element.click = no mousedown, so autoplay keeps going) */
  const tapWhenActive = async (idx) => {
    await p.waitForFunction((i) => document.getElementById("railNum").textContent === String(i).padStart(2, "0") && document.querySelectorAll(".scene")[i - 1].classList.contains("is-in"), idx, { timeout: 60000 });
    await p.waitForTimeout(700 / SLOW);
    await p.evaluate((i) => { const b = document.querySelectorAll(".scene")[i - 1].querySelector("[data-add]"); if (b) b.click(); }, idx);
  };
  /* tap "Add" on items 1 and 4 so the reel shows the cart (NOTAP=1 to skip) */
  if (!process.env.NOTAP) { try { await tapWhenActive(1); await tapWhenActive(4); } catch (e) { console.log("(skipped the Add taps)"); } }
  const left = SECS * 1000 / SLOW - (Date.now() - t0);
  if (left > 0) await p.waitForTimeout(left);
  capturing = false; await loop;
  await ctx.close();
  /* ffconcat list with real frame durations */
  let list = "ffconcat version 1.0\n";
  for (let i = 0; i < frames.length; i++) {
    const d = (i + 1 < frames.length ? frames[i + 1] - frames[i] : 0.1) * SLOW;
    list += "file f" + String(i).padStart(5, "0") + ".jpg\nduration " + Math.max(0.001, d).toFixed(4) + "\n";
  }
  fs.writeFileSync(path.join(out, "list.ffconcat"), list);
  console.log("frames:", frames.length, "span", (frames[frames.length - 1] - frames[0]).toFixed(2), "s elapsed", (Date.now() - t0) / 1000);
  await b.close(); srv.close();
  require("child_process").execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(out, "list.ffconcat"),
    "-vf", "fps=30,scale=1080:1920:flags=lanczos,setsar=1,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
    "-profile:v", "high", "-movflags", "+faststart", "-an", MP4], { stdio: "inherit" });
  fs.rmSync(out, { recursive: true, force: true });
  console.log("reel saved:", MP4);
})();
