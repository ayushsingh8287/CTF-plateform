// CITY BACKDROP: the animated neon-city background (canvas scene + optional video, see config.js).
import { useEffect, useRef, useState } from "react";
import { BG_VIDEO, BG_VIDEO_WEBM, BG_POSTER } from "../config.js";

/*
  Neon Tokyo at night: a real-time animated scene drawn on <canvas>.
  - Layers: sky + moon + tower, far/mid skylines (slow camera drift), neon signs,
    elevated expressway with light streaks, a passing train, drones, near framing
    buildings, wet road with shimmering reflections, traffic light trails, rain,
    ripples, drifting fog and slowly moving violet/cyan light sources.
  - Optional <video>: if client/public/videos/neon-tokyo.mp4 exists it fades in
    over the scene; if it is missing or fails, the scene simply stays.
  - Respects prefers-reduced-motion, pauses when the tab is hidden, has a
    user-facing pause button, and lowers quality automatically on slow devices.
  - The whole layer is pointer-events:none and sits behind the app (see style.css).
*/

const RM = "(prefers-reduced-motion: reduce)";
const PAL = ["#e879f9", "#22d3ee", "#8b5cf6", "#fb7185", "#fbbf24", "#67e8f9"];
const WIN = ["#ffe3a8", "#ffd1f7", "#a5f3fc", "#c4b5fd"];
const JP =
  '"Yu Gothic","Hiragino Sans","Noto Sans CJK JP","Noto Sans JP","Meiryo",sans-serif';
const QUALITY = [
  { cap: 960, smax: 1, rain: 0.45, sh: 12 },
  { cap: 1280, smax: 1.25, rain: 0.7, sh: 8 },
  { cap: 1920, smax: 1.5, rain: 1, sh: 6 },
];

const rng = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const mk = (w, h) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Soft radial glow sprite, reused (scaled) every frame instead of per-frame gradients.
function glow(color, size = 128) {
  const c = mk(size, size),
    g = c.getContext("2d"),
    r = size / 2,
    gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, color);
  gr.addColorStop(0.35, color.replace(/[\d.]+\)$/, "0.35)"));
  gr.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

// Detects whether the system can draw Japanese glyphs (otherwise use Latin signs).
function cjkOK() {
  try {
    const c = mk(28, 28),
      x = c.getContext("2d", { willReadFrequently: true }),
      d = (ch) => {
        x.clearRect(0, 0, 28, 28);
        x.font = "22px " + JP;
        x.fillText(ch, 2, 22);
        const px = x.getImageData(0, 0, 28, 28).data;
        let sum = 0;
        for (let i = 3; i < px.length; i += 4) sum += px[i];
        return sum + ":" + px.slice(0, 400).join("");
      };
    const a = d("電"),
      b = d("鬱");
    return a !== b && !a.startsWith("0:");
  } catch {
    return false;
  }
}

// One neon sign rendered once to a sprite (glow baked in); flickered at draw time.
function neon(w, h, color, s, paint) {
  const pad = 14,
    c = mk((w + pad * 2) * s, (h + pad * 2) * s),
    x = c.getContext("2d");
  x.scale(s, s);
  x.translate(pad, pad);
  x.fillStyle = "rgba(6,5,20,.88)";
  x.fillRect(0, 0, w, h);
  x.strokeStyle = color;
  x.shadowColor = color;
  x.shadowBlur = 9;
  x.lineWidth = 1.5;
  x.strokeRect(1, 1, w - 2, h - 2);
  x.fillStyle = color;
  x.textAlign = "center";
  x.textBaseline = "middle";
  paint(x, w, h);
  return { c, pad, w: w + pad * 2, h: h + pad * 2 };
}

// A seamless (horizontally tileable) skyline layer.
function skyline(Lw, hy, r, o, s) {
  const c = mk(Lw * s, hy * s),
    g = c.getContext("2d");
  g.scale(s, s);
  const bl = [];
  for (let px = 0; px < Lw;) {
    let w = o.wmin + r() * (o.wmax - o.wmin);
    if (Lw - (px + w) < o.wmin) w = Lw - px;
    bl.push({ x: px, w, h: hy * (o.min + r() * (o.max - o.min)) });
    px += w;
  }
  for (const b of bl) {
    const top = hy - b.h,
      gr = g.createLinearGradient(0, top, 0, hy);
    gr.addColorStop(0, o.top);
    gr.addColorStop(1, o.bot);
    g.fillStyle = gr;
    g.fillRect(b.x, top, b.w, b.h);
    if (r() < 0.5) g.fillRect(b.x + b.w * 0.25, top - 6 - r() * 9, b.w * 0.45, 10);
    if (r() < 0.6)
      g.fillRect(b.x + b.w * (0.2 + r() * 0.6), top - 12 - r() * 22, 1.5, 28);
    g.globalAlpha = o.rimA;
    g.fillStyle = o.rim[(r() * o.rim.length) | 0];
    g.fillRect(b.x, top, 1.5, b.h);
    for (let wy = top + 8; wy < hy - 6; wy += o.sy)
      for (let wx = b.x + 5; wx < b.x + b.w - 5; wx += o.sx)
        if (r() < o.p) {
          g.globalAlpha = o.wa * (0.35 + r() * 0.65);
          g.fillStyle = WIN[(r() * 4) | 0];
          g.fillRect(wx, wy, o.ww, o.wh);
        }
    g.globalAlpha = 1;
  }
  const fg = g.createLinearGradient(0, hy * 0.3, 0, hy);
  fg.addColorStop(0, "rgba(90,40,140,0)");
  fg.addColorStop(1, o.fog);
  g.fillStyle = fg;
  g.fillRect(0, hy * 0.3, Lw, hy * 0.7);
  return { c, bl, Lw, h: hy };
}

// Draw a tileable layer so it covers [0, W] at scroll offset `off`.
function tile(g, L, off, W) {
  let x = (((off % L.Lw) + L.Lw) % L.Lw) - L.Lw;
  for (; x < W; x += L.Lw) g.drawImage(L.c, x, 0, L.Lw, L.h);
}
function tileX(L, off) {
  return (((off % L.Lw) + L.Lw) % L.Lw) - L.Lw;
}

function build(W, H, q, cjk) {
  const Q = QUALITY[q],
    dpr = window.devicePixelRatio || 1,
    s = Math.min(dpr, Q.cap / W, Q.smax),
    hy = Math.round(H * 0.6),
    Lw = Math.round(Math.max(W * 1.3, 1500)),
    M = 60,
    r = rng(7);

  // ---- sky (static) with moon, stars and a lattice tower ----
  const sky = mk((W + M * 2) * s, (hy + M) * s),
    sg = sky.getContext("2d");
  sg.scale(s, s);
  const gr = sg.createLinearGradient(0, 0, 0, hy + M);
  gr.addColorStop(0, "#06061a");
  gr.addColorStop(0.35, "#150f3d");
  gr.addColorStop(0.7, "#3a1766");
  gr.addColorStop(0.92, "#8a2c8e");
  gr.addColorStop(1, "#c04bb0");
  sg.fillStyle = gr;
  sg.fillRect(0, 0, W + M * 2, hy + M);
  const stars = [];
  for (let i = 0; i < 110; i++) {
    const x = r() * (W + M * 2),
      y = r() * hy * 0.7,
      a = 0.25 + r() * 0.6;
    sg.fillStyle = `rgba(230,225,255,${a * (1 - y / (hy * 0.8))})`;
    sg.fillRect(x, y, r() < 0.15 ? 2 : 1, r() < 0.15 ? 2 : 1);
    if (i < 14) stars.push({ x: x - M, y, ph: r() * 6.28 });
  }
  const mx = M + W * 0.74,
    my = H * 0.17,
    mr = Math.min(W, H) * 0.085;
  const hg = sg.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 4.2);
  hg.addColorStop(0, "rgba(200,170,255,.38)");
  hg.addColorStop(1, "rgba(200,170,255,0)");
  sg.fillStyle = hg;
  sg.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
  const mg = sg.createRadialGradient(
    mx - mr * 0.3,
    my - mr * 0.3,
    mr * 0.1,
    mx,
    my,
    mr,
  );
  mg.addColorStop(0, "#fbf4ff");
  mg.addColorStop(1, "#bfa6f5");
  sg.fillStyle = mg;
  sg.beginPath();
  sg.arc(mx, my, mr, 0, 6.2832);
  sg.fill();
  sg.strokeStyle = "rgba(200,180,255,.35)";
  sg.lineWidth = 1;
  sg.beginPath();
  sg.arc(mx, my, mr * 1.35, 0, 6.2832);
  sg.stroke();
  // lattice tower
  const tx = M + W * 0.56,
    tTop = hy * 0.3,
    tw = Math.max(34, W * 0.028);
  sg.fillStyle = "#1a0f38";
  sg.strokeStyle = "rgba(255,110,80,.55)";
  sg.lineWidth = 1.2;
  sg.beginPath();
  sg.moveTo(tx - tw, hy + 4);
  sg.lineTo(tx - tw * 0.12, tTop + (hy - tTop) * 0.25);
  sg.lineTo(tx - 1.5, tTop);
  sg.lineTo(tx + 1.5, tTop);
  sg.lineTo(tx + tw * 0.12, tTop + (hy - tTop) * 0.25);
  sg.lineTo(tx + tw, hy + 4);
  sg.closePath();
  sg.fill();
  sg.stroke();
  for (let i = 1; i < 9; i++) {
    const k = i / 9,
      y = tTop + (hy - tTop) * (0.18 + k * 0.82),
      hw = tw * (0.1 + 0.9 * Math.pow(k, 1.05));
    sg.beginPath();
    sg.moveTo(tx - hw, y);
    sg.lineTo(tx + hw, y);
    sg.stroke();
    sg.beginPath();
    sg.moveTo(tx - hw, y);
    sg.lineTo(tx + hw * ((i % 2) * 2 - 1) * 0.2, y - (hy - tTop) * 0.07);
    sg.stroke();
  }

  // ---- skylines ----
  const far = skyline(
    Lw,
    hy,
    rng(11),
    {
      min: 0.2,
      max: 0.5,
      wmin: 40,
      wmax: 90,
      top: "#241a55",
      bot: "#341a62",
      rim: ["#67e8f9", "#e879f9"],
      rimA: 0.35,
      sy: 8,
      sx: 6,
      ww: 2,
      wh: 3,
      p: 0.3,
      wa: 0.5,
      fog: "rgba(190,80,190,.55)",
    },
    s,
  );
  const mid = skyline(
    Lw,
    hy,
    rng(23),
    {
      min: 0.28,
      max: 0.74,
      wmin: 56,
      wmax: 120,
      top: "#0e0b2b",
      bot: "#1a0f3c",
      rim: ["#22d3ee", "#e879f9", "#8b5cf6"],
      rimA: 0.6,
      sy: 10,
      sx: 8,
      ww: 3,
      wh: 4,
      p: 0.22,
      wa: 0.85,
      fog: "rgba(150,50,160,.42)",
    },
    s,
  );

  // ---- neon signs on the mid layer (layer-local coordinates) ----
  const sr = rng(41),
    V = cjk
      ? ["ラーメン", "電脳", "居酒屋", "夜", "危険", "喫茶", "ネオン", "酒場"]
      : ["BAR", "24H", "NEON", "SAKE", "OPEN", "HOTEL"],
    HZ = cjk ? ["電脳街", "ネオン", "CYBER", "LIVE"] : ["CYBER", "LIVE", "NEON"],
    signs = [];
  let forced = false;
  mid.bl.forEach((b, i) => {
    const col = PAL[(sr() * PAL.length) | 0];
    if (!forced && b.x > Lw * 0.42 && b.w > 80) {
      forced = true;
      const sw = Math.min(b.w - 8, 108),
        sp = neon(sw, 24, "#e879f9", s, (x, w, h) => {
          x.font = "700 14px ui-monospace,Consolas,monospace";
          x.shadowBlur = 8;
          x.fillText("P4R4D0X", w / 2, h / 2 + 1);
        });
      signs.push({
        lx: b.x + (b.w - sw) / 2 - sp.pad,
        y: hy - b.h + 30 - sp.pad,
        sp,
        ph: 1,
        sp2: 0.7,
        bad: false,
      });
      return;
    }
    if (b.w > 56 && sr() < 0.5) {
      const sw = 16 + ((sr() * 8) | 0),
        word = V[(sr() * V.length) | 0],
        n = [...word].length,
        sh = n * sw + 8;
      if (hy - b.h + 14 + sh > hy - 24) return;
      const sp = neon(sw, sh, col, s, (x, w) => {
        x.font = `700 ${(sw * 0.72) | 0}px ${JP}`;
        [...word].forEach((ch, k) => x.fillText(ch, w / 2, 4 + k * sw + sw / 2));
      });
      const left = sr() < 0.5;
      signs.push({
        lx: b.x + (left ? 2 : b.w - sw - 2) - sp.pad,
        y: hy - b.h + 12 + sr() * 26 - sp.pad,
        sp,
        ph: sr() * 6.28,
        sp2: 0.6 + sr() * 1.6,
        bad: sr() < 0.22,
      });
    } else if (b.w > 84 && sr() < 0.3) {
      const sw = Math.min(b.w - 10, 96),
        word = HZ[(sr() * HZ.length) | 0],
        sp = neon(sw, 20, col, s, (x, w, h) => {
          x.font = `700 12px ${JP}`;
          x.fillText(word, w / 2, h / 2 + 1);
        });
      signs.push({
        lx: b.x + (b.w - sw) / 2 - sp.pad,
        y: hy - b.h + 44 + sr() * 40 - sp.pad,
        sp,
        ph: sr() * 6.28,
        sp2: 0.8 + sr(),
        bad: false,
      });
    }
  });
  // holographic billboard
  const hb =
    mid.bl.find((b) => b.x > Lw * 0.15 && b.w > 90 && b.h > hy * 0.5) || mid.bl[3];
  const holo = {
    lx: hb.x + 8,
    y: hy - hb.h + 60,
    w: Math.min(hb.w - 16, 70),
    h: 90,
  };

  // ---- near framing buildings with power lines (static, parallax only) ----
  const near = mk((W + M * 2) * s, hy * s),
    ng = near.getContext("2d");
  ng.scale(s, s);
  const nr = rng(5);
  const frame = (x, w, h, side) => {
    const top = hy - h,
      gg = ng.createLinearGradient(0, top, 0, hy);
    gg.addColorStop(0, "#07051a");
    gg.addColorStop(1, "#0d0828");
    ng.fillStyle = gg;
    ng.fillRect(x, top, w, h);
    ng.fillStyle = side ? "rgba(34,211,238,.55)" : "rgba(232,121,249,.5)";
    ng.fillRect(side ? x : x + w - 2, top, 2, h);
    for (let wy = top + 14; wy < hy - 20; wy += 14)
      for (let wx = x + 8; wx < x + w - 8; wx += 12)
        if (nr() < 0.16) {
          ng.globalAlpha = 0.3 + nr() * 0.5;
          ng.fillStyle = WIN[(nr() * 4) | 0];
          ng.fillRect(wx, wy, 5, 7);
        }
    ng.globalAlpha = 1;
  };
  const lw = W * 0.13,
    rw = W * 0.15;
  frame(M - 20, lw + 20, hy * 0.74, true);
  frame(M + W - rw, rw + 20, hy * 0.9, false);
  ng.strokeStyle = "rgba(10,8,30,.9)";
  ng.lineWidth = 2;
  const polesX = [M + W * 0.2, M + W * 0.82];
  polesX.forEach((px) => {
    ng.beginPath();
    ng.moveTo(px, hy);
    ng.lineTo(px, hy * 0.2);
    ng.stroke();
    ng.fillStyle = "rgba(10,8,30,.9)";
    ng.fillRect(px - 16, hy * 0.2 + 8, 32, 2);
    ng.fillRect(px - 12, hy * 0.2 + 22, 24, 2);
  });
  ng.lineWidth = 1;
  [8, 10, 22, 24].forEach((dy, i) => {
    const x0 = i % 2 ? polesX[0] + 12 : polesX[0] - 16,
      x1 = i % 2 ? polesX[1] + 12 : polesX[1] - 16;
    ng.beginPath();
    ng.moveTo(x0, hy * 0.2 + dy);
    ng.quadraticCurveTo((x0 + x1) / 2, hy * 0.2 + dy + 40, x1, hy * 0.2 + dy);
    ng.stroke();
    ng.beginPath();
    ng.moveTo(x0, hy * 0.2 + dy);
    ng.quadraticCurveTo(x0 - 60, hy * 0.2 + dy + 22, 0, hy * 0.2 + dy + 34);
    ng.stroke();
  });
  const nsign = neon(18, 78, "#22d3ee", s, (x, w) => {
    x.font = `700 14px ${JP}`;
    const ch = cjk ? ["電", "脳", "街", "夜"] : ["B", "A", "R", "!"];
    ch.forEach((c2, k) => x.fillText(c2, w / 2, 12 + k * 18));
  });
  const nsign2 = neon(18, 60, "#e879f9", s, (x, w) => {
    x.font = `700 13px ${JP}`;
    const ch = cjk ? ["バ", "ー", "酒"] : ["2", "4", "H"];
    ch.forEach((c2, k) => x.fillText(c2, w / 2, 12 + k * 18));
  });

  // ---- fog tile (soft drifting bands) ----
  const fog = mk(Lw, 170),
    fgx = fog.getContext("2d"),
    fr = rng(99);
  for (let i = 0; i < 9; i++) {
    const cx = (i / 9) * Lw + fr() * 80,
      cy = 85 + (fr() - 0.5) * 40,
      rx = 180 + fr() * 220;
    fgx.save();
    fgx.translate(cx, cy);
    fgx.scale(rx / 80, 0.55 + fr() * 0.3);
    const rg = fgx.createRadialGradient(0, 0, 0, 0, 0, 80);
    rg.addColorStop(0, "rgba(170,110,230,.30)");
    rg.addColorStop(1, "rgba(170,110,230,0)");
    fgx.fillStyle = rg;
    fgx.fillRect(-80, -80, 160, 160);
    fgx.restore();
    if (cx + rx > Lw) {
      fgx.save();
      fgx.translate(cx - Lw, cy);
      fgx.scale(rx / 80, 0.6);
      fgx.fillStyle = rg;
      fgx.fillRect(-80, -80, 160, 160);
      fgx.restore();
    }
  }

  // ---- traffic, streaks, drones ----
  const tr = rng(321),
    cars = Array.from({ length: 26 }, () => {
      const away = tr() < 0.5;
      return {
        lane: (away ? -1 : 1) * (0.25 + tr() * 1.1),
        t: tr(),
        v: 0.05 + tr() * 0.12,
        away,
      };
    }),
    streaks = Array.from({ length: 12 }, (_, i) => ({
      x: tr() * W,
      v: (i % 2 ? 1 : -1) * (110 + tr() * 220),
      len: 40 + tr() * 110,
      lane: i % 2,
      col: i % 2 ? [255, 70, 90] : [255, 240, 220],
    })),
    drones = Array.from({ length: 3 }, () => ({
      x: tr() * W,
      y: hy * (0.12 + tr() * 0.3),
      v: 8 + tr() * 14,
      ph: tr() * 6,
      c: tr() < 0.5 ? "#22d3ee" : "#fb7185",
    }));

  const sprites = {
    violet: glow("rgba(139,92,246,.9)"),
    cyan: glow("rgba(34,211,238,.9)"),
    magenta: glow("rgba(232,121,249,.9)"),
    red: glow("rgba(255,70,90,.95)", 64),
    white: glow("rgba(255,245,230,.95)", 64),
    amber: glow("rgba(255,120,80,.95)", 64),
  };

  return {
    W,
    H,
    s,
    q,
    hy,
    Lw,
    M,
    sky,
    stars,
    tx,
    tTop,
    far,
    mid,
    signs,
    holo,
    near,
    nsign,
    nsign2,
    fog,
    cars,
    streaks,
    drones,
    sprites,
    Q,
  };
}

export default function CityBackdrop({ variant = "hero" }) {
  const sceneRef = useRef(null),
    fxRef = useRef(null),
    vidRef = useRef(null),
    liveRef = useRef(false),
    [motion, setMotion] = useState(() => {
      try {
        return !matchMedia(RM).matches && localStorage.getItem("p4_motion") !== "off";
      } catch {
        return true;
      }
    }),
    [vid, setVid] = useState("idle");

  // Lazy-load the optional video after the animated scene has painted.
  useEffect(() => {
    if (!BG_VIDEO || !motion) return;
    const sd = navigator.connection && navigator.connection.saveData;
    if (sd) return;
    const id = setTimeout(() => setVid((v) => (v === "fail" ? v : "load")), 900);
    return () => clearTimeout(id);
  }, [motion]);

  useEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    if (motion) {
      v.muted = true;
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    } else v.pause();
  }, [motion, vid]);

  useEffect(() => {
    const cv = sceneRef.current,
      fxc = fxRef.current;
    if (!cv || !fxc) return;
    const g = cv.getContext("2d"),
      fx = fxc.getContext("2d");
    if (!g || !fx) return;
    const cjk = cjkOK();
    let S = null,
      city = null,
      cg = null,
      q = window.innerWidth < 760 ? 1 : 2,
      raf = 0,
      last = 0,
      T = 0,
      slow = 0,
      frames = 0,
      par = { x: 0, y: 0, tx: 0, ty: 0 },
      rain = [],
      ripples = [],
      motes = [],
      lastPx = 99;

    const setup = () => {
      const W = window.innerWidth,
        H = window.innerHeight;
      S = build(W, H, q, cjk);
      cv.width = Math.round(W * S.s);
      cv.height = Math.round(H * S.s);
      city = mk(W * S.s, S.hy * S.s);
      cg = city.getContext("2d");
      const fs = Math.min(window.devicePixelRatio || 1, 1.25);
      fxc.width = Math.round(W * fs);
      fxc.height = Math.round(H * fs);
      fx.setTransform(fs, 0, 0, fs, 0, 0);
      const n = Math.round(clamp((W * H) / 6200, 90, 420) * S.Q.rain);
      rain = Array.from({ length: n }, () => newDrop(true));
      motes = Array.from({ length: Math.round(34 * S.Q.rain) }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        v: 6 + Math.random() * 12,
        ph: Math.random() * 6,
        c: Math.random() < 0.5 ? "#67e8f9" : "#f0abfc",
        z: Math.random(),
      }));
      ripples = [];
    };
    const newDrop = (init) => {
      const near = Math.random() < 0.35;
      return {
        x: Math.random() * (S.W + 120) - 20,
        y: init ? Math.random() * S.H : -30,
        l: near ? 16 + Math.random() * 16 : 7 + Math.random() * 9,
        v: near ? 950 + Math.random() * 400 : 520 + Math.random() * 220,
        near,
      };
    };

    const paintCity = (t, still) => {
      const { W, hy, s, M } = S;
      cg.setTransform(s, 0, 0, s, 0, 0);
      cg.globalCompositeOperation = "source-over";
      cg.globalAlpha = 1;
      const pxs = par.x,
        drift = still ? 0 : t;
      // sky
      cg.drawImage(S.sky, -M + pxs * -8, 0, W + M * 2, hy + M);
      for (const st of S.stars) {
        cg.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(t * 1.3 + st.ph));
        cg.fillStyle = "#fff";
        cg.fillRect(st.x + pxs * -8, st.y, 2, 2);
      }
      cg.globalAlpha = 1;
      // beacon on tower
      const bx = S.tx - M + pxs * -8;
      cg.globalCompositeOperation = "lighter";
      cg.globalAlpha = Math.sin(t * 2.2) > 0.2 ? 1 : 0.15;
      cg.drawImage(S.sprites.red, bx - 14, S.tTop - 14, 28, 28);
      cg.globalAlpha = 1;
      // drifting violet / cyan light sources
      cg.globalAlpha = 0.34;
      cg.drawImage(
        S.sprites.violet,
        W * (0.22 + 0.14 * Math.sin(t * 0.13)) - W * 0.4,
        hy * 0.5 - W * 0.4,
        W * 0.8,
        W * 0.8,
      );
      cg.globalAlpha = 0.26;
      cg.drawImage(
        S.sprites.cyan,
        W * (0.8 + 0.1 * Math.sin(t * 0.09 + 2)) - W * 0.35,
        hy * 0.55 - W * 0.35,
        W * 0.7,
        W * 0.7,
      );
      cg.globalAlpha = 0.22 + 0.06 * Math.sin(t * 0.4);
      cg.drawImage(S.sprites.magenta, W * 0.5 - W * 0.5, hy - W * 0.22, W, W * 0.44);
      cg.globalAlpha = 1;
      cg.globalCompositeOperation = "source-over";
      // drones
      for (const d of S.drones) {
        d.x += still ? 0 : d.v * 0.016;
        if (d.x > W + 20) d.x = -20;
        const on = Math.sin(t * 5 + d.ph) > -0.2;
        cg.globalCompositeOperation = "lighter";
        cg.globalAlpha = on ? 0.9 : 0.25;
        cg.drawImage(
          d.c === "#22d3ee" ? S.sprites.cyan : S.sprites.red,
          d.x + pxs * -10 - 9,
          d.y - 9,
          18,
          18,
        );
        cg.globalCompositeOperation = "source-over";
      }
      cg.globalAlpha = 1;
      // far skyline (slow drift)
      tile(cg, S.far, drift * 3 + pxs * -14, W);
      // elevated train
      const cyc = (t % 26) / 26,
        ty = hy * 0.66;
      cg.fillStyle = "rgba(10,8,32,.8)";
      cg.fillRect(0, ty + 12, W, 2);
      if (cyc < 0.42 || still) {
        const u = still ? 0.45 : cyc / 0.42,
          tx0 = -300 + u * (W + 600);
        cg.fillStyle = "#0c0a26";
        cg.fillRect(tx0, ty, 260, 12);
        cg.fillStyle = "rgba(190,240,255,.9)";
        for (let k = 0; k < 11; k++) cg.fillRect(tx0 + 8 + k * 23, ty + 3, 16, 4);
        cg.globalCompositeOperation = "lighter";
        cg.globalAlpha = 0.35;
        cg.drawImage(S.sprites.cyan, tx0 - 20, ty - 40, 300, 100);
        cg.globalAlpha = 1;
        cg.globalCompositeOperation = "source-over";
      }
      // expressway deck + streaks
      const y0 = hy - hy * 0.14;
      cg.fillStyle = "#07051a";
      cg.fillRect(0, y0, W, 7);
      cg.fillStyle = "rgba(34,211,238,.45)";
      cg.fillRect(0, y0 + 7, W, 1);
      cg.fillStyle = "#07051a";
      for (let x = (pxs * -20) % 90; x < W; x += 90) cg.fillRect(x, y0 + 7, 5, hy - y0);
      cg.globalCompositeOperation = "lighter";
      for (const k of S.streaks) {
        if (!still) {
          k.x += k.v * 0.016;
          if (k.v > 0 && k.x > W + k.len) k.x = -k.len;
          if (k.v < 0 && k.x < -k.len) k.x = W + k.len;
        }
        const yy = y0 + (k.lane ? 2.5 : -1.5),
          x2 = k.x - Math.sign(k.v) * k.len,
          lg = cg.createLinearGradient(k.x, 0, x2, 0);
        lg.addColorStop(0, `rgba(${k.col},.95)`);
        lg.addColorStop(1, `rgba(${k.col},0)`);
        cg.strokeStyle = lg;
        cg.lineWidth = 2;
        cg.beginPath();
        cg.moveTo(k.x, yy);
        cg.lineTo(x2, yy);
        cg.stroke();
        cg.globalAlpha = 0.5;
        cg.drawImage(
          k.lane ? S.sprites.red : S.sprites.white,
          k.x - 10,
          yy - 10,
          20,
          20,
        );
        cg.globalAlpha = 1;
      }
      cg.globalCompositeOperation = "source-over";
      // mid skyline + signs
      const moff = drift * 8 + pxs * -26;
      tile(cg, S.mid, moff, W);
      const x0 = tileX(S.mid, moff);
      for (let ox = x0; ox < W; ox += S.Lw) {
        for (const sg2 of S.signs) {
          const sx = ox + sg2.lx;
          if (sx < -80 || sx > W + 10) continue;
          let a = 0.88 + 0.12 * Math.sin(t * sg2.sp2 * 3 + sg2.ph);
          if (
            sg2.bad &&
            Math.sin(t * 2.7 + sg2.ph) > 0.9 &&
            Math.sin(t * 19 + sg2.ph) > 0
          )
            a = 0.18;
          cg.globalAlpha = a;
          cg.drawImage(sg2.sp.c, sx, sg2.y, sg2.sp.w, sg2.sp.h);
          cg.globalCompositeOperation = "lighter";
          cg.globalAlpha = a * 0.22;
          cg.drawImage(
            S.sprites.magenta,
            sx - 20,
            sg2.y - 20,
            sg2.sp.w + 40,
            sg2.sp.h + 40,
          );
          cg.globalCompositeOperation = "source-over";
        }
        // hologram billboard
        const hx = ox + S.holo.lx;
        if (hx > -100 && hx < W + 10) {
          const h2 = S.holo;
          cg.globalCompositeOperation = "lighter";
          const hg2 = cg.createLinearGradient(hx, h2.y, hx, h2.y + h2.h);
          hg2.addColorStop(0, "rgba(34,211,238,.4)");
          hg2.addColorStop(1, "rgba(232,121,249,.4)");
          cg.globalAlpha = 0.65 + 0.2 * Math.sin(t * 3);
          cg.fillStyle = hg2;
          cg.fillRect(hx, h2.y, h2.w, h2.h);
          cg.fillStyle = "rgba(6,5,20,.5)";
          for (let yy = (t * 14) % 4; yy < h2.h; yy += 4)
            cg.fillRect(hx, h2.y + yy, h2.w, 1.5);
          cg.globalCompositeOperation = "source-over";
        }
      }
      cg.globalAlpha = 1;
      // fog bands
      const fo = tileX({ Lw: S.Lw }, drift * 10);
      cg.globalAlpha = 0.9;
      for (let x = fo; x < W; x += S.Lw) cg.drawImage(S.fog, x, hy - 120, S.Lw, 170);
      // near framing buildings + signs
      cg.globalAlpha = 1;
      cg.drawImage(S.near, -M + pxs * -50, 0, W + M * 2, hy);
      const nx = pxs * -50;
      const f1 = 0.85 + 0.15 * Math.sin(t * 2.1);
      cg.globalAlpha = f1;
      cg.drawImage(
        S.nsign.c,
        W - W * 0.15 + 16 + nx - S.nsign.pad,
        hy * 0.42 - S.nsign.pad,
        S.nsign.w,
        S.nsign.h,
      );
      cg.globalAlpha = Math.sin(t * 1.7) > 0.8 && Math.sin(t * 23) > 0 ? 0.2 : 0.9;
      cg.drawImage(
        S.nsign2.c,
        W * 0.07 + nx - S.nsign2.pad,
        hy * 0.48 - S.nsign2.pad,
        S.nsign2.w,
        S.nsign2.h,
      );
      cg.globalAlpha = 1;
    };

    const paintRoad = (t, still) => {
      const { W, H, hy, s, Q } = S,
        vx = W * 0.5 + par.x * -22;
      g.setTransform(s, 0, 0, s, 0, 0);
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
      g.drawImage(city, 0, 0, W, hy);
      // road base
      const rg = g.createLinearGradient(0, hy, 0, H);
      rg.addColorStop(0, "#2a1348");
      rg.addColorStop(0.35, "#120a2c");
      rg.addColorStop(1, "#080618");
      g.fillStyle = rg;
      g.fillRect(0, hy, W, H - hy);
      // reflections (flipped city, shimmered in strips)
      const rh = Math.min(H - hy, hy * 0.85),
        sh = Q.sh;
      g.save();
      g.translate(0, 2 * hy);
      g.scale(1, -1);
      g.globalAlpha = 0.5;
      for (let j = 0; j * sh < rh; j++) {
        const sy = hy - (j + 1) * sh,
          dep = j * sh,
          dx = still
            ? 0
            : Math.sin(t * 1.6 + j * 0.55) * (1 + dep * 0.02) +
              Math.sin(t * 0.7 + j) * 0.8;
        g.globalAlpha = 0.55 * (1 - dep / (rh * 1.05));
        g.drawImage(city, 0, sy * s, W * s, sh * s, dx, sy, W, sh + 0.5);
      }
      g.restore();
      g.globalAlpha = 1;
      // darken far road for depth
      const dg = g.createLinearGradient(0, hy, 0, H);
      dg.addColorStop(0, "rgba(8,6,24,.1)");
      dg.addColorStop(1, "rgba(5,4,16,.78)");
      g.fillStyle = dg;
      g.fillRect(0, hy, W, H - hy);
      // lane perspective lines
      g.globalCompositeOperation = "lighter";
      g.strokeStyle = "rgba(160,200,255,.10)";
      g.lineWidth = 1;
      for (const k of [-1.6, -0.55, 0.55, 1.6]) {
        g.beginPath();
        g.moveTo(vx, hy);
        g.lineTo(vx + k * (H - hy) * 1.1, H);
        g.stroke();
      }
      // neon puddle glows
      g.globalAlpha = 0.2 + 0.05 * Math.sin(t * 0.8);
      g.drawImage(S.sprites.magenta, W * 0.18, hy + 8, W * 0.34, (H - hy) * 0.7);
      g.globalAlpha = 0.17;
      g.drawImage(S.sprites.cyan, W * 0.58, hy + 12, W * 0.36, (H - hy) * 0.7);
      g.globalAlpha = 1;
      // traffic light trails (perspective)
      for (const c of S.cars) {
        if (!still) {
          c.t += (c.away ? -1 : 1) * c.v * 0.016;
          if (c.t > 1.08) c.t = 0.02;
          if (c.t < 0.01) c.t = 1;
        }
        const f = (u) => ({
          y: hy + (H - hy) * Math.pow(clamp(u, 0, 1.2), 2.1),
        });
        const a = f(c.t),
          b = f(c.t - 0.07),
          xa = vx + c.lane * (a.y - hy) * 1.1,
          xb = vx + c.lane * (b.y - hy) * 1.1,
          wid = 1 + 4.5 * c.t,
          sp = c.away ? S.sprites.red : S.sprites.white,
          col = c.away ? "255,70,90" : "235,248,255",
          lg = g.createLinearGradient(xa, a.y, xb, b.y);
        lg.addColorStop(0, `rgba(${col},.95)`);
        lg.addColorStop(1, `rgba(${col},0)`);
        g.strokeStyle = lg;
        g.lineWidth = wid;
        for (const o of [-1, 1]) {
          const off = o * 7 * c.t;
          g.beginPath();
          g.moveTo(xa + off, a.y);
          g.lineTo(xb + off * 0.6, b.y);
          g.stroke();
          g.globalAlpha = 0.55;
          g.drawImage(
            sp,
            xa + off - 7 - 14 * c.t,
            a.y - 7 - 14 * c.t,
            14 + 28 * c.t,
            14 + 28 * c.t,
          );
          g.globalAlpha = 1;
        }
      }
      g.globalCompositeOperation = "source-over";
      // ripples
      for (const rp of ripples) {
        g.globalAlpha = rp.a * 0.7;
        g.strokeStyle = "rgba(190,225,255,1)";
        g.lineWidth = 1;
        g.beginPath();
        g.ellipse(rp.x, rp.y, rp.r, rp.r * 0.28, 0, 0, 6.2832);
        g.stroke();
      }
      g.globalAlpha = 1;
      // near fog on the street
      const fo = tileX({ Lw: S.Lw }, t * 16 + 300);
      g.globalAlpha = 0.5;
      for (let x = fo; x < W; x += S.Lw) g.drawImage(S.fog, x, hy - 30, S.Lw, 170);
      g.globalAlpha = 1;
    };

    const paintFx = (dt, still) => {
      const { W, H, hy } = S;
      fx.clearRect(0, 0, W, H);
      if (still) return;
      // motes
      for (const m of motes) {
        m.y -= m.v * dt * (0.4 + m.z);
        m.x += Math.sin(T * 0.5 + m.ph) * 6 * dt;
        if (m.y < -4) {
          m.y = H + 4;
          m.x = Math.random() * W;
        }
        fx.globalAlpha = 0.25 + 0.45 * m.z;
        fx.fillStyle = m.c;
        fx.fillRect(m.x, m.y, 1.5 + m.z * 1.5, 1.5 + m.z * 1.5);
      }
      fx.globalAlpha = 1;
      // rain (two depth tiers, two batched strokes)
      const slant = -0.16;
      for (const tier of [false, true]) {
        fx.strokeStyle = tier ? "rgba(205,228,255,.42)" : "rgba(160,190,255,.2)";
        fx.lineWidth = tier ? 1.2 : 0.8;
        fx.beginPath();
        for (const d of rain) {
          if (d.near !== tier) continue;
          d.y += d.v * dt;
          d.x += d.v * dt * slant;
          if (d.y > H + 20 || d.x < -40) {
            if (d.y > hy + 10 && Math.random() < 0.25 && ripples.length < 40)
              ripples.push({
                x: d.x,
                y: d.y > H ? H - Math.random() * (H - hy) : d.y,
                r: 1,
                a: 1,
              });
            Object.assign(d, newDrop(false));
          }
          fx.moveTo(d.x, d.y);
          fx.lineTo(d.x + d.l * slant, d.y - d.l);
        }
        fx.stroke();
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.r += 26 * dt;
        rp.a -= 1.3 * dt;
        if (rp.a <= 0) ripples.splice(i, 1);
      }
      if (Math.random() < 0.5 * S.Q.rain) {
        const y = hy + 12 + Math.random() * (H - hy - 12);
        if (ripples.length < 40)
          ripples.push({ x: Math.random() * W, y, r: 1, a: 0.9 });
      }
    };

    const paint = (t, dt, still) => {
      if (!liveRef.current || still) (paintCity(t, still), paintRoad(t, still));
      paintFx(dt, still);
    };

    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      T += dt;
      par.x += (par.tx - par.x) * Math.min(1, dt * 3);
      par.y += (par.ty - par.y) * Math.min(1, dt * 3);
      if (Math.abs(par.x - lastPx) > 0.004) {
        lastPx = par.x;
        const st = document.documentElement.style;
        st.setProperty("--px", par.x.toFixed(3));
        st.setProperty("--py", par.y.toFixed(3));
      }
      const t0 = performance.now();
      if (liveRef.current) paintFx(dt, false);
      else {
        paintCity(T, false);
        paintRoad(T, false);
        paintFx(dt, false);
      }
      // adaptive quality: drop a level if frames are consistently slow
      const cost = performance.now() - t0;
      frames++;
      slow += cost > 14 || dt > 0.034 ? 1 : 0;
      if (frames === 90) {
        if (slow > 45 && q > 0) {
          q--;
          setup();
        }
        frames = 0;
        slow = 0;
      }
    };

    const start = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const onVis = () =>
      document.hidden ? cancelAnimationFrame(raf) : motion && start();
    const onMove = (e) => {
      par.tx = clamp((e.clientX / window.innerWidth - 0.5) * 2, -1, 1);
      par.ty = clamp((e.clientY / window.innerHeight - 0.5) * 2, -1, 1);
    };
    let rt = 0;
    const onResize = () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        setup();
        if (!motion) paint(3, 0, true);
      }, 150);
    };

    setup();
    paint(3, 0, true); // immediate first frame so the hero is never empty
    if (motion) {
      start();
      addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("visibilitychange", onVis);
    } else {
      document.documentElement.style.setProperty("--px", "0");
      document.documentElement.style.setProperty("--py", "0");
    }
    addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(rt);
      removeEventListener("pointermove", onMove);
      removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [motion]);

  const toggle = () =>
    setMotion((m) => {
      try {
        localStorage.setItem("p4_motion", m ? "off" : "on");
      } catch {}
      return !m;
    });

  return (
    <>
      <div className={"stage stage-" + variant} aria-hidden="true">
        <canvas ref={sceneRef} className="stage-canvas" />
        {BG_VIDEO && (vid === "load" || vid === "live") && (
          <video
            ref={vidRef}
            className={"stage-video" + (vid === "live" ? " on" : "")}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster={BG_POSTER}
            onPlaying={() => {
              liveRef.current = true;
              setVid("live");
            }}
          >
            {BG_VIDEO_WEBM && <source src={BG_VIDEO_WEBM} type="video/webm" />}
            <source
              src={BG_VIDEO}
              type="video/mp4"
              onError={() => {
                liveRef.current = false;
                setVid("fail");
              }}
            />
          </video>
        )}
        <canvas ref={fxRef} className="stage-fx" />
        <div className="stage-grade" />
        <div className="stage-scan" />
      </div>
      <button
        type="button"
        className="motion-toggle"
        onClick={toggle}
        aria-pressed={!motion}
        title="Pause or resume the animated background"
      >
        <span aria-hidden="true">{motion ? "❚❚" : "▶"}</span>{" "}
        {motion ? "Pause motion" : "Play motion"}
      </button>
    </>
  );
}
