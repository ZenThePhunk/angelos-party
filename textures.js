// Every surface texture is painted in code, so the whole site has no image files to load.
import * as THREE from 'three';

let maxAniso = 8;
export function setAniso(n) { maxAniso = n; }

export function paint(w, h, draw, { repeat = false, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// seeded random so textures look the same every visit
let seed = 7;
export const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const R = (a, b) => a + rand() * (b - a);
function speckle(g, w, h, n, colors, size = [1, 3]) {
  for (let i = 0; i < n; i++) { g.fillStyle = colors[(rand() * colors.length) | 0]; const s = R(...size); g.fillRect(rand() * w, rand() * h, s, s); }
}

// ── brick: one tile = 8 bricks × 22 rows ≈ 1.68 m square ──
export function brick() {
  const W = 1024, cols = 8, rows = 22, bw = W / cols, bh = W / rows, m = 7;
  const bricks = [];
  for (let r = 0; r < rows; r++) for (let c = -1; c < cols; c++) {
    const x = c * bw + (r % 2 ? bw / 2 : 0);
    bricks.push({ x, y: r * bh, hue: R(6, 20), sat: R(38, 58), lit: R(28, 44) - (rand() < 0.08 ? 8 : 0) });
  }
  const map = paint(W, W, (g) => {
    g.fillStyle = '#9b8b78'; g.fillRect(0, 0, W, W);
    speckle(g, W, W, 9000, ['#7d6f60', '#b3a28c', '#8c7d6b']);
    for (const b of bricks) {
      g.fillStyle = `hsl(${b.hue},${b.sat}%,${b.lit}%)`;
      g.fillRect(b.x + m / 2, b.y + m / 2, bw - m, bh - m);
      const gr = g.createLinearGradient(0, b.y, 0, b.y + bh);
      gr.addColorStop(0, 'rgba(255,220,190,.10)'); gr.addColorStop(1, 'rgba(0,0,0,.18)');
      g.fillStyle = gr; g.fillRect(b.x + m / 2, b.y + m / 2, bw - m, bh - m);
      for (let i = 0; i < 70; i++) { g.fillStyle = rand() < .5 ? 'rgba(0,0,0,.12)' : 'rgba(255,230,200,.08)'; g.fillRect(b.x + R(m, bw - m), b.y + R(m / 2, bh - m), R(1, 4), R(1, 3)); }
      if (rand() < 0.25) { g.fillStyle = 'rgba(30,15,10,.25)'; g.fillRect(b.x + R(m, bw / 2), b.y + R(m, bh / 2), R(8, 30), R(3, 9)); }
    }
  }, { repeat: true });
  const bump = paint(W, W, (g) => {
    g.fillStyle = '#202020'; g.fillRect(0, 0, W, W);
    for (const b of bricks) {
      g.fillStyle = `rgb(${R(170, 210)},${R(170, 210)},${R(170, 210)})`;
      g.beginPath(); g.roundRect(b.x + m / 2, b.y + m / 2, bw - m, bh - m, 4); g.fill();
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${R(.1, .4)})`; g.fillRect(b.x + R(m, bw - m), b.y + R(m / 2, bh - m), R(2, 7), R(1, 4)); }
    }
  }, { repeat: true, srgb: false });
  return { map, bump, size: 1.68 };
}

// ── polished concrete for the whole floor (one big texture so the saw-cuts line up) ──
export function concreteFloor(Lm, Dm) {
  const W = 2048, H = Math.round(W * Dm / Lm), px = W / Lm;
  return paint(W, H, (g) => {
    g.fillStyle = '#8d8984'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 1400; i++) {
      const r = R(10, 90); const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
      const c = rand() < .5 ? '60,55,50' : '170,165,158'; gr.addColorStop(0, `rgba(${c},.08)`); gr.addColorStop(1, `rgba(${c},0)`);
      g.save(); g.translate(rand() * W, rand() * H); g.fillStyle = gr; g.fillRect(-r, -r, 2 * r, 2 * r); g.restore();
    }
    speckle(g, W, H, 26000, ['rgba(40,35,30,.25)', 'rgba(230,225,215,.2)']);
    // dark stains
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(40,30,25,${R(.05, .14)})`; g.beginPath(); g.ellipse(rand() * W, rand() * H, R(4, 26), R(3, 16), R(0, 3), 0, 7); g.fill(); }
    // saw-cut joints every ~3.7 m
    g.strokeStyle = 'rgba(35,30,28,.75)'; g.lineWidth = 2;
    for (let x = 3.7; x < Lm; x += 3.7) { g.beginPath(); g.moveTo(x * px, 0); g.lineTo(x * px, H); g.stroke(); }
    for (let z = 3.2; z < Dm; z += 3.2) { g.beginPath(); g.moveTo(0, z * px); g.lineTo(W, z * px); g.stroke(); }
    // hairline cracks
    g.strokeStyle = 'rgba(30,25,22,.6)';
    for (let k = 0; k < 14; k++) {
      let x = rand() * W, y = rand() * H, a = R(0, 6.28); g.lineWidth = R(.8, 1.6); g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < R(20, 70); s++) { a += R(-.5, .5); x += Math.cos(a) * 6; y += Math.sin(a) * 6; g.lineTo(x, y); }
      g.stroke();
    }
  });
}

// ── wood ──
export function planks({ w = 512, h = 1024, boards = 7, base = [30, 45, 52] } = {}) {
  return paint(w, h, (g) => {
    const bw = w / boards;
    for (let i = 0; i < boards; i++) {
      g.fillStyle = `hsl(${base[0] + R(-4, 4)},${base[1] + R(-8, 8)}%,${base[2] + R(-8, 6)}%)`; g.fillRect(i * bw, 0, bw, h);
      g.strokeStyle = 'rgba(60,30,10,.22)';
      for (let k = 0; k < 9; k++) { g.lineWidth = R(.5, 2); g.beginPath(); let x = i * bw + R(3, bw - 3); g.moveTo(x, 0); for (let y = 0; y < h; y += 40) { x += R(-1.5, 1.5); g.lineTo(x, y); } g.stroke(); }
      for (let k = 0; k < 2; k++) { g.fillStyle = 'rgba(70,35,15,.35)'; g.beginPath(); g.ellipse(i * bw + R(8, bw - 8), R(0, h), R(3, 6), R(8, 14), 0, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(25,12,5,.55)'; g.fillRect(i * bw, 0, 2, h);
    }
  }, { repeat: true });
}
export function woodGrain(base = [32, 50, 48]) { return planks({ w: 256, h: 512, boards: 1, base }); }
export function zebrawood() {
  return paint(256, 512, (g, w, h) => {
    g.fillStyle = '#4a3324'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += R(2, 6)) { g.fillStyle = rand() < .5 ? 'rgba(20,12,8,.6)' : 'rgba(120,85,55,.35)'; g.fillRect(x, 0, R(1, 4), h); }
  }, { repeat: true });
}

// ── crushed velvet ──
export function velvet() {
  return paint(512, 512, (g, w, h) => {
    g.fillStyle = '#4b0a12'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const x = rand() * w, y = rand() * h, l = R(10, 70);
      g.strokeStyle = rand() < .5 ? `rgba(150,30,45,${R(.08, .3)})` : `rgba(15,0,3,${R(.1, .35)})`;
      g.lineWidth = R(1, 5); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + R(-10, 10), y + l / 3, x + R(-10, 10), y + 2 * l / 3, x + R(-6, 6), y + l); g.stroke();
    }
  }, { repeat: true });
}

// ── rugs ──
export function leopard() {
  // light-brown leopard: tan base, dense broken black rosettes with caramel centers, little spots between
  return paint(2048, 1536, (g, w, h) => {
    g.fillStyle = '#d6b07a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const r = R(20, 90), gr = g.createRadialGradient(0, 0, 0, 0, 0, r); const c = rand() < .5 ? '190,140,80' : '235,205,160'; gr.addColorStop(0, `rgba(${c},.35)`); gr.addColorStop(1, `rgba(${c},0)`); g.save(); g.translate(rand() * w, rand() * h); g.fillStyle = gr; g.fillRect(-r, -r, 2 * r, 2 * r); g.restore(); }
    speckle(g, w, h, 40000, ['rgba(120,80,40,.18)', 'rgba(250,225,185,.18)'], [1, 2]);
    const cell = 64;
    for (let y = -cell; y < h + cell; y += cell * 0.86) for (let x = -cell; x < w + cell; x += cell) {
      const cx = x + (Math.round(y / cell) % 2 ? cell / 2 : 0) + R(-14, 14), cy = y + R(-12, 12), rx = R(17, 25), ry = rx * R(0.65, 0.9), rot = R(0, 3.14);
      g.save(); g.translate(cx, cy); g.rotate(rot);
      g.fillStyle = `hsl(${R(24, 32)},${R(50, 62)}%,${R(36, 46)}%)`; g.beginPath(); g.ellipse(0, 0, rx * 0.8, ry * 0.75, 0, 0, 7); g.fill();
      g.fillStyle = '#17110c';
      const parts = 3 + (rand() * 3 | 0), gap = 0.28 + rand() * 0.25;
      for (let p = 0; p < parts; p++) {
        const a0 = p / parts * 6.283 + R(-0.2, 0.2), a1 = a0 + 6.283 / parts - gap, th = R(4.5, 8);
        g.beginPath(); g.ellipse(0, 0, rx + th / 2, ry + th / 2, 0, a0, a1); g.ellipse(0, 0, rx - th / 2, ry - th / 2, 0, a1, a0, true); g.closePath(); g.fill();
      }
      g.restore();
      for (let k = 0; k < 2; k++) { g.fillStyle = '#1d150e'; g.beginPath(); g.ellipse(cx + R(-34, 34), cy + R(-30, 30), R(2.5, 5), R(2, 4), R(0, 3), 0, 7); g.fill(); }
    }
    // soft woven edge
    g.strokeStyle = 'rgba(80,55,30,.6)'; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
  });
}
export function persian(base = '#6e1a1c') {
  return paint(1024, 1024, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const bands = ['#1d2a44', '#c79a52', '#3a0c10', '#d9c3a0'];
    for (let i = 0; i < 4; i++) { g.strokeStyle = bands[i]; g.lineWidth = 18 - i * 3; g.strokeRect(30 + i * 26, 30 + i * 26, w - 60 - i * 52, h - 60 - i * 52); }
    g.save(); g.translate(w / 2, h / 2);
    for (let r = 6; r > 0; r--) { g.fillStyle = r % 2 ? '#1d2a44' : '#c79a52'; g.beginPath(); for (let a = 0; a < 6.3; a += .05) { const rr = r * 42 * (1 + .18 * Math.sin(a * 8)); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.fill(); }
    g.restore();
    for (let i = 0; i < 160; i++) { g.fillStyle = bands[i % 4]; g.globalAlpha = .55; g.beginPath(); g.arc(R(140, w - 140), R(140, h - 140), R(4, 10), 0, 7); g.fill(); }
    g.globalAlpha = 1;
    speckle(g, w, h, 15000, ['rgba(0,0,0,.12)', 'rgba(255,220,180,.06)']);
  });
}

// ── light effects ──
// Soft cone of light, computed pixel by pixel (no canvas blur filter, which iPhones don't support).
export function uplightSplash() {
  return paint(128, 256, (g, w, h) => {
    const d = g.createImageData(w, h), px = d.data;
    const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let y = 0; y < h; y++) {
      const up = 1 - y / (h - 1);                              // 0 at the floor, 1 at the top
      const half = 0.07 + up * 0.38;                           // cone widens as it rises
      const fall = Math.pow(1 - up, 1.4) * 0.85 + 0.15 * (1 - up);
      for (let x = 0; x < w; x++) {
        const dx = Math.abs(x / (w - 1) - 0.5);
        const edge = 1 - sm(half * 0.55, half, dx);            // soft sides
        const hot = Math.exp(-((dx * dx) * 90 + (up * up) * 40)) * 0.9;   // bright spot at the base
        const v = Math.min(1, edge * fall + hot) * sm(0, 0.04, 1 - up) * sm(0, 0.12, 1 - up + 0.05);
        const o = (y * w + x) * 4; px[o] = px[o + 1] = px[o + 2] = Math.round(v * 255); px[o + 3] = 255;
      }
    }
    g.putImageData(d, 0, 0);
  }, { srgb: false });
}
// soft round glow for the floor around each light
let glowDisc = null;
export function softDisc() {
  if (glowDisc) return glowDisc;
  glowDisc = paint(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { srgb: false });
  return glowDisc;
}
export function discoSpecks() {
  return paint(512, 512, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) {
      const x = rand() * w, y = rand() * h, r = R(1.5, 4.5);
      const gr = g.createRadialGradient(x, y, 0, x, y, r * 1.8); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
    }
    // soft edge so the projection has no hard square border
    const v = g.createRadialGradient(w / 2, h / 2, w * .3, w / 2, h / 2, w * .5);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
}
export async function goboLogo() {
  // If the real logo file is in the project (images/gobo.jpg, white on black), project that; otherwise draw a close match.
  const img = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'images/gobo.jpg'; });
  try { await document.fonts.load('200px "Great Vibes"'); } catch { /* any script font */ }
  return paint(1024, 800, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    if (img) {
      g.drawImage(img, 0, 0, w, h);
      // the file has a dark-gray background: push it to pure black so only the script and stars throw light
      const d = g.getImageData(0, 0, w, h), px = d.data;
      for (let i = 0; i < px.length; i += 4) { const v = (px[i] + px[i + 1] + px[i + 2]) / 3, o = Math.max(0, Math.min(255, (v - 60) * 255 / 170)); px[i] = px[i + 1] = px[i + 2] = o; px[i + 3] = 255; }
      g.putImageData(d, 0, 0);
      g.filter = 'blur(1.5px)'; g.drawImage(g.canvas, 0, 0); g.filter = 'none';   // a touch soft, like a real projection
      return;
    }
    g.translate(w / 2, h / 2);
    g.shadowColor = 'rgba(255,225,180,1)'; g.shadowBlur = 14; g.fillStyle = '#fff';
    const star = (x, y, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .42 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
    // twelve stars in an oval: five across the top, five across the bottom, one at each side
    for (const [x, y] of [[-275, -195], [-130, -245], [0, -265], [148, -245], [262, -195], [-405, 20], [415, 20], [-262, 220], [-130, 268], [0, 290], [148, 268], [262, 220]]) star(x * 1.0, y * 1.0, 24);
    g.font = '150px "Great Vibes", "Snell Roundhand", cursive'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.save(); g.rotate(-0.12);
    g.font = '170px "Great Vibes", "Snell Roundhand", cursive'; g.fillText('The', -215, 40);
    g.font = '230px "Great Vibes", "Snell Roundhand", cursive'; g.fillText('Angelos', 110, -10);
    g.lineWidth = 5; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(-430, 70); g.bezierCurveTo(-330, -40, -200, 130, -60, 70); g.stroke();   // flourish under "The"
    g.beginPath(); g.moveTo(-40, 90); g.bezierCurveTo(120, 150, 300, 70, 400, 20); g.stroke();                                                // flourish under "Angelos"
    g.restore();
  }, { srgb: false });
}
export function concrete(tone = 150) {
  return paint(512, 512, (g, w, h) => {
    g.fillStyle = `rgb(${tone},${tone - 4},${tone - 8})`; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { const r = R(8, 60); const c = rand() < .5 ? '0,0,0' : '255,255,255'; const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, `rgba(${c},.06)`); gr.addColorStop(1, `rgba(${c},0)`); g.save(); g.translate(rand() * w, rand() * h); g.fillStyle = gr; g.fillRect(-r, -r, 2 * r, 2 * r); g.restore(); }
    speckle(g, w, h, 9000, ['rgba(0,0,0,.18)', 'rgba(255,255,255,.12)']);
    for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(30,30,30,.35)'; g.beginPath(); g.arc(rand() * w, rand() * h, R(1, 3), 0, 7); g.fill(); }
  }, { repeat: true });
}
export function ribbedMetal() {
  return paint(256, 256, (g, w, h) => {
    for (let y = 0; y < h; y += 16) { const gr = g.createLinearGradient(0, y, 0, y + 16); gr.addColorStop(0, '#5a5a5c'); gr.addColorStop(.5, '#3c3c3e'); gr.addColorStop(1, '#2a2a2c'); g.fillStyle = gr; g.fillRect(0, y, w, 16); }
    speckle(g, w, h, 1500, ['rgba(0,0,0,.2)', 'rgba(255,255,255,.08)']);
  }, { repeat: true });
}
export function textCanvas(w, h, fn) { return paint(w, h, fn); }
