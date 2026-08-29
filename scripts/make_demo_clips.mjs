// make_demo_clips.mjs
// Generates the six demo training clips for the Aurora showcase.
// Method: HTML slides -> Playwright screenshots (2x) -> ffmpeg zoompan + xfade.
// Re-runnable: overwrites everything it produces.
//
// Usage: node scripts/make_demo_clips.mjs

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "videos");
const FPS = 25;
const FADE = 0.5; // crossfade seconds
const ZOOM_TOTAL = 0.05; // ~5% slow push-in per slide

// ---------------------------------------------------------------- themes

const THEMES = {
  aurora: {
    bg1: "#1b2033",
    bg2: "#232a45",
    bg3: "#141828",
    text: "#e8ecf4",
    dim: "rgba(232,236,244,0.55)",
    faint: "rgba(232,236,244,0.22)",
    numberOpacity: 0.1,
    font: `'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif`,
  },
  night: {
    bg1: "#141210",
    bg2: "#1c1917",
    bg3: "#0e0c0a",
    text: "#ece5d8",
    dim: "rgba(236,229,216,0.55)",
    faint: "rgba(236,229,216,0.2)",
    numberOpacity: 0.12,
    font: `'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif`,
  },
};

// ---------------------------------------------------------------- clip data

const CLIPS = [
  {
    file: "opening-the-morning-circle.mp4",
    theme: "aurora",
    accent: "#4a9d8f",
    episode: "Episode 01",
    slides: [
      { kind: "title", title: "Opening the morning circle", dur: 4.5 },
      { kind: "step", n: 1, title: "How the night went", line: "One sentence from each resident — no follow-ups yet.", dur: 4.0 },
      { kind: "step", n: 2, title: "Today's plan", line: "Read the plan from the board, exactly as written.", dur: 4.0 },
      { kind: "step", n: 3, title: "Chores confirmed", line: "Every duty named out loud by the person holding it.", dur: 4.0 },
      { kind: "step", n: 4, title: "One question about the day", line: "Each resident asks one — the circle answers together.", dur: 4.0 },
      { kind: "final", title: "Keep it under fifteen minutes.", line: "Talk it through at the evening review.", dur: 4.5 },
    ],
  },
  {
    file: "conflict-first-minutes.mp4",
    theme: "aurora",
    accent: "#5b8dd9",
    episode: "Episode 02",
    slides: [
      { kind: "title", title: "Conflict: the first three minutes", dur: 4.5 },
      { kind: "step", n: 1, title: "Separate, don't adjudicate", line: "Distance first — who was right can wait.", dur: 4.0 },
      { kind: "step", n: 2, title: "Different rooms, a task each", line: "Hands busy, tempers cooling.", dur: 4.0 },
      { kind: "step", n: 3, title: "Ask the room first", line: "Witnesses describe what happened — nobody accuses.", dur: 4.0 },
      { kind: "step", n: 4, title: "One at a time, calmer first", line: "The calmer one speaks while the other listens.", dur: 4.0 },
      { kind: "final", title: "No verdicts in the first three minutes.", line: "Talk it through at the evening review.", dur: 4.5 },
    ],
  },
  {
    file: "meal-quality-check.mp4",
    theme: "aurora",
    accent: "#4a9d8f",
    episode: "Episode 03",
    slides: [
      { kind: "title", title: "Meal quality check", dur: 4.5 },
      { kind: "step", n: 1, title: "Taste from the pot", line: "The duty officer tastes before anyone is served.", dur: 4.0 },
      { kind: "step", n: 2, title: "Hot food hot", line: "If it isn't steaming, it goes back to the stove.", dur: 4.0 },
      { kind: "step", n: 3, title: "Portion against headcount", line: "Count the servings against today's list.", dur: 4.0 },
      { kind: "step", n: 4, title: "One line, signed", line: "One line in the kitchen log, with a signature.", dur: 4.0 },
      { kind: "final", title: "A quiet check keeps the kitchen honest.", line: "Talk it through at the evening review.", dur: 4.5 },
    ],
  },
  {
    file: "night-rounds.mp4",
    theme: "night",
    accent: "#e0a63c",
    episode: "Episode 04",
    slides: [
      { kind: "title", title: "The quiet hours", dur: 4.5 },
      { kind: "step", n: 1, title: "Lights out on time", line: "The corridor goes dark at the posted hour.", dur: 4.0 },
      { kind: "step", n: 2, title: "First round in twenty minutes", line: "That is when problems show themselves.", dur: 4.0 },
      { kind: "step", n: 3, title: "Every two hours after", line: "Same route, same order, no shortcuts.", dur: 4.0 },
      { kind: "step", n: 4, title: "One line per round", line: "Time, route, anything unusual — one line.", dur: 4.0 },
      { kind: "final", title: "A quiet night is a written night.", line: "Talk it through at the morning handover.", dur: 4.5 },
    ],
  },
  {
    file: "film-starting-over.mp4",
    theme: "film",
    accent: "#c9a86a",
    episode: "Film session 01",
    slides: [
      { kind: "film-title", title: "Starting over", line: "A film session — watch, then talk", dur: 5.0 },
      { kind: "film-q", n: 1, line: "What did he do on the first empty morning?", dur: 4.5 },
      { kind: "film-q", n: 2, line: "Who noticed the change before he did?", dur: 4.5 },
      { kind: "film-q", n: 3, line: "What would you have packed for that bus?", dur: 4.5 },
      { kind: "film-final", title: "Pause the film. Let the room answer.", dur: 5.0 },
    ],
  },
  {
    file: "film-family-that-waits.mp4",
    theme: "film",
    accent: "#8fb8d9",
    episode: "Film session 02",
    slides: [
      { kind: "film-title", title: "The family that waits", line: "Told from the side of those who stayed", dur: 5.0 },
      { kind: "film-q", n: 1, line: "What does waiting look like from the kitchen table?", dur: 4.5 },
      { kind: "film-q", n: 2, line: "When did the mother stop counting the days?", dur: 4.5 },
      { kind: "film-q", n: 3, line: "What is the first thing they never say out loud?", dur: 4.5 },
      { kind: "film-final", title: "Talk it through at the evening review.", dur: 5.0 },
    ],
  },
];

// ---------------------------------------------------------------- HTML

function dots(total, current, accent, faint) {
  let s = "";
  for (let i = 0; i < total; i++) {
    s += `<span class="dot${i === current ? " on" : ""}"></span>`;
  }
  return `<div class="dots">${s}</div>`;
}

function baseCss(t, accent) {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 1280px; height: 720px; overflow: hidden; }
    body {
      font-family: ${t.font};
      color: ${t.text};
      background:
        radial-gradient(1100px 700px at 24% 18%, ${t.bg2} 0%, transparent 62%),
        linear-gradient(150deg, ${t.bg1} 0%, ${t.bg3} 100%);
      position: relative;
      -webkit-font-smoothing: antialiased;
    }
    .vignette {
      position: absolute; inset: 0; pointer-events: none;
      background: radial-gradient(ellipse 120% 100% at 50% 45%, transparent 58%, rgba(0,0,0,0.28) 100%);
    }
    .dots { position: absolute; left: 0; right: 0; bottom: 56px; display: flex; justify-content: center; gap: 14px; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: ${t.faint}; }
    .dot.on { background: ${accent}; box-shadow: 0 0 10px ${accent}66; }
    .brand {
      position: absolute; top: 54px; left: 96px;
      font-size: 15px; letter-spacing: 3.5px; text-transform: uppercase; color: ${t.dim};
    }
    .episode {
      position: absolute; top: 54px; right: 96px;
      font-size: 15px; letter-spacing: 3.5px; text-transform: uppercase; color: ${accent};
    }
    .accent-line { height: 3px; width: 110px; background: ${accent}; border-radius: 2px; }
  `;
}

function titleSlide(t, accent, clip, idx) {
  return `<style>${baseCss(t, accent)}
    .wrap { position: absolute; left: 96px; right: 96px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; }
    h1 { font-size: 76px; font-weight: 650; line-height: 1.12; letter-spacing: -0.5px; max-width: 980px; }
    .sub { margin-top: 30px; font-size: 22px; color: ${t.dim}; letter-spacing: 0.4px; }
    .accent-line { margin-bottom: 34px; }
  </style>
  <div class="vignette"></div>
  <div class="episode">${clip.episode}</div>
  <div class="wrap">
    <div class="accent-line"></div>
    <h1>${clip.slides[idx].title}</h1>
    <div class="sub">Aurora training — demo footage</div>
  </div>
  ${dots(clip.slides.length, idx, accent, t.faint)}`;
}

function stepSlide(t, accent, clip, idx) {
  const s = clip.slides[idx];
  return `<style>${baseCss(t, accent)}
    .bignum {
      position: absolute; right: 60px; top: 50%; transform: translateY(-54%);
      font-size: 460px; font-weight: 700; line-height: 1;
      color: ${accent}; opacity: ${t.numberOpacity};
      letter-spacing: -12px; user-select: none;
    }
    .wrap { position: absolute; left: 96px; right: 320px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; }
    .stepno { font-size: 17px; letter-spacing: 3.5px; text-transform: uppercase; color: ${accent}; margin-bottom: 22px; }
    h2 { font-size: 58px; font-weight: 650; line-height: 1.15; letter-spacing: -0.3px; }
    .line { margin-top: 26px; font-size: 26px; line-height: 1.5; color: ${t.dim}; max-width: 760px; }
    .accent-line { margin-top: 36px; width: 72px; }
  </style>
  <div class="vignette"></div>
  <div class="brand">Aurora training — demo footage</div>
  <div class="episode">${clip.episode}</div>
  <div class="bignum">${s.n}</div>
  <div class="wrap">
    <div class="stepno">Step ${s.n}</div>
    <h2>${s.title}</h2>
    <div class="line">${s.line}</div>
    <div class="accent-line"></div>
  </div>
  ${dots(clip.slides.length, idx, accent, t.faint)}`;
}

function finalSlide(t, accent, clip, idx) {
  const s = clip.slides[idx];
  return `<style>${baseCss(t, accent)}
    .wrap { position: absolute; left: 120px; right: 120px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
    h2 { font-size: 54px; font-weight: 650; line-height: 1.2; max-width: 900px; letter-spacing: -0.3px; }
    .line { margin-top: 28px; font-size: 24px; color: ${t.dim}; }
    .accent-line { margin-bottom: 38px; }
  </style>
  <div class="vignette"></div>
  <div class="brand">Aurora training — demo footage</div>
  <div class="episode">${clip.episode}</div>
  <div class="wrap">
    <div class="accent-line"></div>
    <h2>${s.title}</h2>
    <div class="line">${s.line}</div>
  </div>
  ${dots(clip.slides.length, idx, accent, t.faint)}`;
}

// ---- cinematic template ------------------------------------------------

function filmCss(accent) {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 1280px; height: 720px; overflow: hidden; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      color: #f2ede4;
      background:
        radial-gradient(1000px 620px at 50% 40%, #16151a 0%, transparent 70%),
        linear-gradient(180deg, #0b0b0e 0%, #060608 100%);
      position: relative;
      -webkit-font-smoothing: antialiased;
    }
    .bar { position: absolute; left: 0; right: 0; height: 92px; background: #000; z-index: 5; }
    .bar.top { top: 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .bar.bottom { bottom: 0; border-top: 1px solid rgba(255,255,255,0.06); }
    .vignette {
      position: absolute; inset: 0; pointer-events: none;
      background: radial-gradient(ellipse 115% 95% at 50% 48%, transparent 52%, rgba(0,0,0,0.5) 100%);
    }
    .brand {
      position: absolute; bottom: 106px; left: 0; right: 0; z-index: 6;
      text-align: center; font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 13px; letter-spacing: 4px; text-transform: uppercase; color: rgba(242,237,228,0.4);
    }
    .dots { position: absolute; left: 0; right: 0; bottom: 138px; display: flex; justify-content: center; gap: 14px; z-index: 6; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(242,237,228,0.18); }
    .dot.on { background: ${accent}; box-shadow: 0 0 10px ${accent}66; }
    .rule { width: 150px; height: 1px; background: linear-gradient(90deg, transparent, ${accent}, transparent); }
  `;
}

function filmTitleSlide(accent, clip, idx) {
  const s = clip.slides[idx];
  return `<style>${filmCss(accent)}
    .wrap { position: absolute; left: 100px; right: 100px; top: 92px; bottom: 92px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
    .kicker { font-family: 'Segoe UI', Arial, sans-serif; font-size: 16px; letter-spacing: 6px; text-transform: uppercase; color: ${accent}; margin-bottom: 34px; }
    h1 { font-size: 92px; font-weight: 500; letter-spacing: 6px; line-height: 1.1; text-transform: uppercase; }
    .sub { margin-top: 32px; font-style: italic; font-size: 26px; color: rgba(242,237,228,0.7); letter-spacing: 1px; }
    .rule { margin-top: 38px; }
  </style>
  <div class="bar top"></div><div class="bar bottom"></div>
  <div class="vignette"></div>
  <div class="wrap">
    <div class="kicker">${clip.episode}</div>
    <h1>${s.title}</h1>
    <div class="sub">${s.line}</div>
    <div class="rule"></div>
  </div>
  ${dots(clip.slides.length, idx, accent)}
  <div class="brand">Aurora training — demo footage</div>`;
}

function filmQuestionSlide(accent, clip, idx) {
  const s = clip.slides[idx];
  return `<style>${filmCss(accent)}
    .wrap { position: absolute; left: 130px; right: 130px; top: 92px; bottom: 92px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
    .kicker { font-family: 'Segoe UI', Arial, sans-serif; font-size: 15px; letter-spacing: 5px; text-transform: uppercase; color: ${accent}; margin-bottom: 36px; }
    .q { font-style: italic; font-size: 50px; line-height: 1.35; max-width: 940px; color: #f2ede4; }
    .rule { margin-top: 42px; }
  </style>
  <div class="bar top"></div><div class="bar bottom"></div>
  <div class="vignette"></div>
  <div class="wrap">
    <div class="kicker">Question ${s.n}</div>
    <div class="q">&ldquo;${s.line}&rdquo;</div>
    <div class="rule"></div>
  </div>
  ${dots(clip.slides.length, idx, accent)}
  <div class="brand">Aurora training — demo footage</div>`;
}

function filmFinalSlide(accent, clip, idx) {
  const s = clip.slides[idx];
  return `<style>${filmCss(accent)}
    .wrap { position: absolute; left: 120px; right: 120px; top: 92px; bottom: 92px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
    h2 { font-size: 52px; font-weight: 500; letter-spacing: 2px; line-height: 1.3; max-width: 920px; }
    .rule { margin-bottom: 40px; }
  </style>
  <div class="bar top"></div><div class="bar bottom"></div>
  <div class="vignette"></div>
  <div class="wrap">
    <div class="rule"></div>
    <h2>${s.title}</h2>
  </div>
  ${dots(clip.slides.length, idx, accent)}
  <div class="brand">Aurora training — demo footage</div>`;
}

function renderSlideHtml(clip, idx) {
  const t = THEMES[clip.theme];
  const s = clip.slides[idx];
  let body;
  switch (s.kind) {
    case "title": body = titleSlide(t, clip.accent, clip, idx); break;
    case "step": body = stepSlide(t, clip.accent, clip, idx); break;
    case "final": body = finalSlide(t, clip.accent, clip, idx); break;
    case "film-title": body = filmTitleSlide(clip.accent, clip, idx); break;
    case "film-q": body = filmQuestionSlide(clip.accent, clip, idx); break;
    case "film-final": body = filmFinalSlide(clip.accent, clip, idx); break;
    default: throw new Error("unknown slide kind " + s.kind);
  }
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`;
}

// ---------------------------------------------------------------- ffmpeg

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
}

function buildClip(clip, pngs, tmp) {
  // 1) per-slide zoompan segments (high-quality intermediates)
  const segs = [];
  clip.slides.forEach((s, i) => {
    const frames = Math.round(s.dur * FPS);
    const seg = path.join(tmp, `seg_${i}.mp4`);
    // slow centered push-in; supersampled 2560x1440 source keeps it crisp
    let vf =
      `zoompan=z='1+${ZOOM_TOTAL}*on/${frames - 1}':d=${frames}` +
      `:x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':s=1280x720:fps=${FPS}`;
    if (clip.theme === "film") {
      // letterbox bars must not breathe with the zoom: repaint them post-zoom
      vf +=
        `,drawbox=x=0:y=0:w=1280:h=92:color=black:t=fill` +
        `,drawbox=x=0:y=628:w=1280:h=92:color=black:t=fill` +
        `,drawbox=x=0:y=92:w=1280:h=1:color=white@0.06:t=fill` +
        `,drawbox=x=0:y=627:w=1280:h=1:color=white@0.06:t=fill`;
    }
    vf += `,format=yuv420p`;
    run("ffmpeg", ["-y", "-loglevel", "error", "-i", pngs[i], "-vf", vf,
      "-frames:v", String(frames), "-c:v", "libx264", "-preset", "fast", "-crf", "16", seg]);
    segs.push(seg);
  });

  // 2) xfade chain
  const out = path.join(OUT_DIR, clip.file);
  const inputs = segs.flatMap((s) => ["-i", s]);
  let filter = "";
  let last = "[0:v]";
  let offset = 0;
  for (let i = 1; i < segs.length; i++) {
    offset += clip.slides[i - 1].dur - FADE;
    const label = i === segs.length - 1 ? "[vout]" : `[x${i}]`;
    filter += `${last}[${i}:v]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}${label};`;
    last = `[x${i}]`;
  }
  filter = filter.replace(/;$/, "");
  run("ffmpeg", ["-y", "-loglevel", "error", ...inputs,
    "-filter_complex", filter, "-map", "[vout]",
    "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-an", out]);
  return out;
}

// ---------------------------------------------------------------- main

async function main() {
  const only = process.argv.slice(2); // optional: clip file names to rebuild
  const clips = only.length ? CLIPS.filter((c) => only.includes(c.file)) : CLIPS;

  const tmp = mkdtempSync(path.join(tmpdir(), "aurora-clips-"));
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });

  try {
    for (const clip of clips) {
      const pngs = [];
      for (let i = 0; i < clip.slides.length; i++) {
        const html = renderSlideHtml(clip, i);
        await page.setContent(html, { waitUntil: "load" });
        const png = path.join(tmp, `${clip.file.replace(/\.mp4$/, "")}_${i}.png`);
        await page.screenshot({ path: png });
        pngs.push(png);
      }
      const out = buildClip(clip, pngs, tmp);
      console.log("built", path.relative(ROOT, out));
    }
  } finally {
    await browser.close();
    rmSync(tmp, { recursive: true, force: true });
  }

  // report
  const report = [];
  for (const clip of CLIPS) {
    const f = path.join(OUT_DIR, clip.file);
    const probe = JSON.parse(
      execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height:format=duration",
        "-of", "json", f], { encoding: "utf8" })
    );
    report.push({
      file: clip.file,
      durationSec: Math.round(parseFloat(probe.format.duration) * 100) / 100,
      width: probe.streams[0].width,
      height: probe.streams[0].height,
      bytes: statSync(f).size,
    });
  }
  writeFileSync(path.join(ROOT, "scripts", "demo-clips.report.json"),
    JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
