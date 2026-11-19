// Cartoon people: Austin, Bre, the band and the bartender. All built from simple shapes.
import * as THREE from 'three';
import { paint } from './textures.js';

const gradientMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([95, 165, 220, 255]), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const matCache = new Map();
export const toon = (c, extra = {}) => {
  const k = c + JSON.stringify(extra);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshToonMaterial({ color: c, gradientMap, ...extra }));
  return matCache.get(k);
};
const M = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const cap = (r, len, seg = 10) => new THREE.CapsuleGeometry(r, len, 6, seg);
const lathe = (pts, seg = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

export const LOOKS = {
  austin: { name: 'Austin', height: 1.86 },
  bre: { name: 'Bre', height: 1.68 },
};

// ─────────────────────────────────────────────────────────────
// buildPerson(spec) → { root, head, P } — one generic body everyone shares.
// Built for a 1.80 m person, then scaled to spec.height.
// ─────────────────────────────────────────────────────────────
// skin with dark tattoo linework, for tattooed hands
const tattooCache = new Map();
export function tattooSkin(skinHex) {
  if (tattooCache.has(skinHex)) return tattooCache.get(skinHex);
  const t = paint(128, 64, (g, w, h) => {
    g.fillStyle = skinHex; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(30,30,40,.85)'; g.fillStyle = 'rgba(30,30,40,.85)'; g.lineWidth = 2;
    for (let i = 0; i < 9; i++) { const x = 6 + i * 14, y = 16 + (i % 3) * 12; if (i % 3 === 0) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.stroke(); } else if (i % 3 === 1) { g.beginPath(); g.moveTo(x - 5, y + 4); g.lineTo(x, y - 6); g.lineTo(x + 5, y + 4); g.closePath(); g.stroke(); } else { g.fillRect(x - 1, y - 6, 2, 12); g.fillRect(x - 5, y - 1, 10, 2); } }
    for (let x = 4; x < w; x += 9) g.fillRect(x, 48, 5, 3);   // little marks across the knuckles
  });
  tattooCache.set(skinHex, t); return t;
}

// full tattoo sleeves: roses, daggers, swallows, hearts packed together in black linework
const inkCache = new Map();
function sleeveInk(skinHex, sparse = false) {
  const key = skinHex + (sparse ? ':sparse' : '');
  if (inkCache.has(key)) return inkCache.get(key);
  const t = paint(256, 256, (g, w, h) => {
    g.fillStyle = skinHex; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(25,25,35,.9)'; g.fillStyle = 'rgba(25,25,35,.75)'; g.lineWidth = 2.5;
    let seed = 7; const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < (sparse ? 11 : 26); i++) {   // sparse: scattered traditional pieces with skin between them
      const x = r() * w, y = r() * h, k = 8 + r() * 14, type = i % 5;
      g.beginPath();
      if (type === 0) { for (let a = 0; a < 3; a++) { g.moveTo(x + k, y); g.arc(x, y, k * (1 - a * 0.3), 0, 6.3); } }                          // rose
      else if (type === 1) { g.moveTo(x, y - k * 1.6); g.lineTo(x + k * 0.3, y + k); g.lineTo(x - k * 0.3, y + k); g.closePath(); g.moveTo(x - k * 0.7, y + k); g.lineTo(x + k * 0.7, y + k); }   // dagger
      else if (type === 2) { g.moveTo(x - k, y); g.quadraticCurveTo(x - k * 0.3, y - k, x, y); g.quadraticCurveTo(x + k * 0.3, y - k, x + k, y); g.lineTo(x, y + k * 0.6); g.closePath(); }       // swallow
      else if (type === 3) { g.moveTo(x, y + k * 0.8); g.bezierCurveTo(x - k * 1.4, y - k * 0.2, x - k * 0.5, y - k * 1.1, x, y - k * 0.3); g.bezierCurveTo(x + k * 0.5, y - k * 1.1, x + k * 1.4, y - k * 0.2, x, y + k * 0.8); }   // heart
      else { g.arc(x, y, k * 0.9, 0, 6.3); g.moveTo(x - k * 0.4, y - k * 0.1); g.arc(x - k * 0.35, y - k * 0.15, k * 0.15, 0, 6.3); g.moveTo(x + k * 0.5, y - k * 0.1); g.arc(x + k * 0.35, y - k * 0.15, k * 0.15, 0, 6.3); }   // skull-ish face
      g.stroke(); if (r() < 0.35) g.fill();
    }
    g.lineWidth = 1.2; for (let i = 0; i < (sparse ? 0 : 60); i++) { const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + r() * 10 - 5, y + r() * 10 - 5); g.stroke(); }   // filler marks
  }, { repeat: true });
  t.repeat.set(1, 1.4); inkCache.set(key, t); return t;
}
// small leopard print for clothes
let leoTex = null;
export function leopardCloth() {
  if (!leoTex) leoTex = paint(256, 256, (g, w, h) => {
    g.fillStyle = '#7a5532'; g.fillRect(0, 0, w, h);
    let seed = 3; const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 70; i++) { const x = r() * w, y = r() * h, rx = 6 + r() * 6; g.fillStyle = '#a57a48'; g.beginPath(); g.ellipse(x, y, rx, rx * 0.8, r() * 3, 0, 7); g.fill();
      g.strokeStyle = '#1b120a'; g.lineWidth = 3; for (let p = 0; p < 3; p++) { const a = p * 2.1 + r() * 0.5; g.beginPath(); g.ellipse(x, y, rx + 2, rx * 0.8 + 2, 0, a, a + 1.5); g.stroke(); } }
  }, { repeat: true });
  leoTex.repeat.set(2, 2); return leoTex;
}

// black faux fur: short soft strands
let furTex = null;
function furMat() {
  if (!furTex) furTex = paint(256, 256, (g, w, h) => {
    g.fillStyle = '#0c0c0e'; g.fillRect(0, 0, w, h); g.lineCap = 'round';
    for (let i = 0; i < 4200; i++) { const x = Math.random() * w, y = Math.random() * h, a = Math.PI / 2 + (Math.random() - 0.5) * 1.6, l = 3 + Math.random() * 7;
      g.strokeStyle = Math.random() < 0.5 ? 'rgba(80,80,90,.55)' : 'rgba(0,0,0,.8)'; g.lineWidth = 1 + Math.random(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  }, { repeat: true });
  return new THREE.MeshToonMaterial({ map: furTex, gradientMap, color: '#ffffff' });
}
// black panels held together by silver chains, skin showing through the gaps
const cageCache = new Map();
function cageMat(skinHex) {
  if (!cageCache.has(skinHex)) cageCache.set(skinHex, paint(256, 256, (g, w, h) => {
    g.fillStyle = skinHex; g.fillRect(0, 0, w, h);
    const cw = 64, ch = 60;
    for (let y = 0; y < h; y += ch) for (let x = 0; x < w; x += cw) { g.fillStyle = '#0d0d0f'; g.fillRect(x + 10, y + 5, cw - 20, ch - 10); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x + 7, y + 5, cw - 14, 3); }
    g.fillStyle = '#d8dce2';
    for (let y = 0; y < h; y += ch) for (let x = 0; x < w; x += cw) {
      for (let k = 0; k <= 10; k++) { const t = k / 10; g.beginPath(); g.arc(x + 7 + t * (cw - 14), y + ch - 4 + Math.sin(t * Math.PI) * 9, 1.8, 0, 7); g.fill(); }   // drooping chain swags
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + 3.5, y + 6 + k * 10, 1.6, 0, 7); g.fill(); }                                        // links across the gaps
    }
  }, { repeat: true }));
  const t = cageCache.get(skinHex); t.repeat.set(2, 1.15);
  return new THREE.MeshToonMaterial({ map: t, gradientMap });
}

export function buildPerson(s) {
  const root = new THREE.Group(), body = new THREE.Group(), upper = new THREE.Group(), head = new THREE.Group();
  // the upper body bends and sways from the hips (not the feet), so it never pulls away from the legs
  const sway = new THREE.Group(); sway.position.y = 0.92; upper.position.y = -0.92;
  // the head nods and turns from the neck (not the feet), so it stays on the shoulders
  const neck = new THREE.Group(); neck.position.y = 1.47; head.position.y = -1.47;
  root.add(body); body.add(sway); sway.add(upper); upper.add(neck); neck.add(head);
  const P = { body, upper, sway, neck, head };
  const skin = toon(s.skin), hairM = toon(s.hair), shoe = toon(s.shoes || '#141210');
  const top = s.fur ? furMat() : s.topMap ? new THREE.MeshToonMaterial({ map: s.topMap, gradientMap }) : toon(s.top);
  const pants = s.cagePants ? cageMat(s.skin) : s.pantsMap ? new THREE.MeshToonMaterial({ map: s.pantsMap, gradientMap }) : toon(s.pants);
  const armSkin = s.armTattoos ? new THREE.MeshToonMaterial({ gradientMap, map: sleeveInk(s.skin, s.armTattoos === 'sparse') }) : skin;
  const fem = s.build === 'f';

  // legs: thigh + knee joint + shin, so people can sit
  const heavy = s.build === 'heavy', slim = s.build === 'slim', lw = heavy ? 1.3 : slim ? 0.85 : 1;
  for (const side of [1, -1]) {
    const leg = new THREE.Group(); leg.position.set((heavy ? 0.115 : 0.092) * side, 0.92, 0);
    const knee = new THREE.Group(); knee.position.y = -0.44; leg.add(knee);
    if (s.pantsStyle === 'wide') {
      leg.add(M(new THREE.CylinderGeometry(0.082, 0.105, 0.46, 16), pants, 0, -0.22, 0));
      knee.add(M(new THREE.CylinderGeometry(0.105, 0.14, 0.46, 16), pants, 0, -0.22, 0));
    } else {
      const lr = (s.bareLeg === (side > 0 ? 'L' : 'R') ? 0.058 : 0.068) * lw, pm = s.bareLeg === (side > 0 ? 'L' : 'R') ? skin : pants;
      leg.add(M(new THREE.CylinderGeometry(lr, lr, 0.44, 16), pm, 0, -0.22, 0));
      leg.add(M(new THREE.SphereGeometry(lr, 16, 12), pm));                                // round hip end
      knee.add(M(new THREE.CylinderGeometry(lr, lr * 0.93, 0.44, 16), pm, 0, -0.22, 0));
      knee.add(M(new THREE.SphereGeometry(lr, 16, 12), pm));                               // knee joint: same width, no seam
    }
    if (s.shoeStyle === 'boots') {
      knee.add(M(new THREE.CylinderGeometry(0.05, 0.052, 0.2, 12), shoe, 0, -0.33, 0));                    // shaft hidden inside the jeans
      knee.add(M(new THREE.CylinderGeometry(0.068, 0.082, 0.13, 14, 1, true), pants, 0, -0.355, 0));       // bootcut hem falling over the boot
      knee.add(M(new THREE.BoxGeometry(0.1, 0.07, 0.22), shoe, 0, -0.42, 0.05));
      const toe = M(new THREE.ConeGeometry(0.05, 0.1, 10), shoe, 0, -0.425, 0.2); toe.rotation.x = Math.PI / 2; knee.add(toe);
      knee.add(M(new THREE.BoxGeometry(0.075, 0.05, 0.06), shoe, 0, -0.46, -0.04));
    } else if (s.shoeStyle === 'clearWedge') {
      knee.add(M(new THREE.BoxGeometry(0.075, 0.05, 0.2), skin, 0, -0.42, 0.05));
      knee.add(M(new THREE.BoxGeometry(0.085, 0.06, 0.22), toon('#e8f4ff', { transparent: true, opacity: 0.45 }), 0, -0.46, 0.05));
      knee.add(M(new THREE.BoxGeometry(0.09, 0.02, 0.05), toon('#ffffff', { transparent: true, opacity: 0.7 }), 0, -0.4, 0.1));
    } else {
      knee.add(M(new THREE.BoxGeometry(0.1 * lw, 0.08, 0.24), shoe, 0, -0.43, 0.04));
    }
    body.add(leg); P[side > 0 ? 'legL' : 'legR'] = leg; P[side > 0 ? 'kneeL' : 'kneeR'] = knee;
  }

  // low-rise pants: a smooth hip piece so the legs flow into the waist (no gap where the belly meets the pants)
  if (s.pantsStyle === 'wide') {
    const hips = M(lathe([[0.001, 0.72], [0.1, 0.73], [0.158, 0.8], [0.164, 0.88], [0.158, 0.95], [0.152, 0.965], [0.001, 0.965]], 32), pants);
    hips.scale.z = 0.78; body.add(hips);
    const band = M(new THREE.TorusGeometry(0.155, 0.007, 6, 40), pants, 0, 0.958, 0); band.rotation.x = Math.PI / 2; band.scale.y = 0.78; body.add(band);
  }

  // torso (lathe, flattened front-to-back)
  const torsoPts = fem
    ? [[0.001, 0.9], [0.15, 0.91], [0.155, 0.98], [0.125, 1.08], [0.14, 1.2], [0.158, 1.3], [0.15, 1.38], [0.1, 1.45], [0.04, 1.47]]
    : heavy ? [[0.001, 0.9], [0.2, 0.91], [0.235, 1.0], [0.25, 1.1], [0.235, 1.22], [0.22, 1.34], [0.15, 1.45], [0.05, 1.48]]
    : [[0.001, 0.9], [0.158, 0.91], [0.16, 1.0], [0.152, 1.1], [0.168, 1.24], [0.185, 1.36], [0.13, 1.45], [0.05, 1.48]].map(([r, y]) => [slim ? r * 0.86 : r, y]);
  if (s.fur) {
    const belly = M(lathe([[0.001, 0.93], [0.146, 0.935], [0.15, 0.97], [0.14, 1.02], [0.128, 1.07], ...torsoPts.filter(([, y]) => y > 1.08)], 32), skin); belly.scale.z = 0.74; upper.add(belly);
    const open = 0.0001;  // wrapped closed over the chest
    const furPts = [[0.145, 1.15], [0.17, 1.17], ...torsoPts.filter(([, y]) => y > 1.18).map(([r, y]) => [r + 0.038, y + 0.01])];
    const jk = M(new THREE.LatheGeometry(furPts.map(([r, y]) => new THREE.Vector2(r, y)), 32, open, Math.PI * 2 - open * 2), top.clone()); jk.material.side = THREE.DoubleSide; jk.scale.z = 0.8; upper.add(jk);
    const collar = M(new THREE.TorusGeometry(0.13, 0.04, 8, 24, Math.PI * 2 - open * 2.4), top); collar.rotation.x = Math.PI / 2; collar.rotation.z = Math.PI / 2 + open * 1.2; collar.position.y = 1.42; collar.scale.y = 0.85; upper.add(collar);
    for (const r of [0.062, 0.075]) { const n = M(new THREE.TorusGeometry(r, 0.0025, 4, 28), chrome(), 0, 1.43 - r * 0.6, 0.012); n.rotation.x = Math.PI / 2 - 0.5; n.scale.y = 0.8; upper.add(n); }   // layered silver necklaces
    if (s.backTattoo) {    // tramp stamp on the lower back, just above the thong
            const mat = new THREE.MeshToonMaterial({ gradientMap, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide });
      const im = new Image(); im.onload = () => {            // keep only the ink: the paper background turns see-through
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
        for (let i = 0; i < px.length; i += 4) { const l = (px[i] + px[i + 1] + px[i + 2]) / 3; px[i + 3] = Math.max(0, Math.min(255, (200 - l) * 2.2)); px[i] = px[i + 1] = px[i + 2] = Math.min(l, 40); }
        g.putImageData(d, 0, 0); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; mat.map = tex; mat.opacity = 0.92; mat.needsUpdate = true;
      }; im.src = s.backTattoo;
      const tp = [[0.151, 0.975], [0.149, 0.99], [0.143, 1.01], [0.137, 1.035], [0.131, 1.055], [0.128, 1.07]].map(([r, y]) => new THREE.Vector2(r + 0.003, y));
      const tt = M(new THREE.LatheGeometry(tp, 16, Math.PI - 0.45, 0.9), mat); tt.scale.z = 0.74; tt.renderOrder = 3; upper.add(tt);
    }
    if (s.thong) {         // thong string pulled up high over the hips, visible from every side, with the T at the back
      const pts = [];
      for (let i = 0; i < 48; i++) {
        const th = i / 48 * Math.PI * 2, sn = Math.abs(Math.sin(th)), c = Math.cos(th);
        const y = 0.955 + 0.075 * Math.pow(sn, 0.8) + (c < 0 ? 0.035 * c * c : 0);
        const r = 0.161 - (y - 0.955) * 0.2;
        pts.push(new THREE.Vector3(Math.sin(th) * r, y, c * r * 0.77));
      }
      const tm = toon('#050505');
      upper.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.0035, 5, true), tm));
      const tb = M(new THREE.BoxGeometry(0.014, 0.04, 0.004), tm, 0, 0.972, -0.156 * 0.77 - 0.001); upper.add(tb);   // the little T at the back
    }
  } else if (s.topStyle === 'crop') {
    const belly = M(lathe([[0.001, 0.93], [0.146, 0.935], [0.15, 0.97], [0.14, 1.02], [0.128, 1.07], [0.126, 1.1]], 32), skin); belly.scale.z = 0.76; upper.add(belly);
    const tee = M(lathe([[0.13, 1.06], ...torsoPts.filter(([, y]) => y > 1.08)].map(([r, y]) => [r + 0.006, y])), top); tee.scale.z = 0.72; upper.add(tee);
  } else {
    if (s.openJacket) {
      // plaid button-down underneath, jacket hanging open at the front
      const plaid = paint(256, 256, (g, w, h) => {
        g.fillStyle = s.shirt || '#c9d0dc'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < w; i += 16) { g.fillStyle = 'rgba(40,60,110,.45)'; g.fillRect(i, 0, 6, h); g.fillRect(0, i, w, 6); }
        for (let i = 8; i < w; i += 16) { g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(i, 0, 2, h); g.fillRect(0, i, w, 2); }
      }, { repeat: true });
      plaid.repeat.set(3, 2);
      const shirtT = M(lathe(torsoPts), s.shirtPlain ? toon(s.shirt) : new THREE.MeshToonMaterial({ map: plaid, gradientMap })); shirtT.scale.z = heavy ? 0.85 : 0.72; upper.add(shirtT);
      if (!s.shirtPlain) for (let y = 1.0; y < 1.38; y += 0.07) upper.add(M(new THREE.SphereGeometry(0.007, 6, 4), toon('#e8e8e8'), 0, y, 0.117));
      const open = 0.42;   // gap at the front, in radians either side
      const jacket = M(new THREE.LatheGeometry(torsoPts.filter(([, y]) => y >= 0.95).map(([r, y]) => new THREE.Vector2(r + 0.014, y)), 32, open, Math.PI * 2 - open * 2), new THREE.MeshToonMaterial({ color: top.color, map: top.map || null, gradientMap, side: THREE.DoubleSide }));
      jacket.scale.z = heavy ? 0.85 : 0.72; upper.add(jacket);
      for (const sd of [1, -1]) { const lap = M(new THREE.BoxGeometry(0.035, 0.26, 0.012), toon(new THREE.Color(s.top).multiplyScalar(0.8).getStyle()), Math.sin(open) * 0.17 * sd, 1.29, 0.105); lap.rotation.z = 0.12 * sd; lap.rotation.y = -0.5 * sd; upper.add(lap); }
    } else {
      const torso = M(lathe(torsoPts), top); torso.scale.z = heavy ? 0.85 : 0.72; upper.add(torso);
    }
  }
  if (s.belt) { const b = M(new THREE.CylinderGeometry(0.162, 0.162, 0.045, 24), toon(s.belt), 0, 0.93, 0); b.scale.z = 0.72; upper.add(b); }
  if (s.shirt && !s.openJacket) {        // shirt showing in the V of a jacket (+ optional tie)
    const v = M(new THREE.ConeGeometry(0.07, 0.3, 3), toon(s.shirt), 0, 1.3, 0.104); v.rotation.z = Math.PI; v.rotation.y = Math.PI; v.scale.z = 0.3; upper.add(v);
    if (s.tie) { const t = M(new THREE.BoxGeometry(0.03, 0.22, 0.01), toon(s.tie), 0, 1.3, 0.122); upper.add(t); upper.add(M(new THREE.BoxGeometry(0.035, 0.03, 0.015), toon(s.tie), 0, 1.42, 0.124)); }
    for (const sd of [1, -1]) { const lap = M(new THREE.BoxGeometry(0.05, 0.26, 0.012), toon(new THREE.Color(s.top).multiplyScalar(0.8).getStyle()), 0.05 * sd, 1.3, 0.118); lap.rotation.z = 0.25 * sd; upper.add(lap); }
  }
  if (s.openCollar) {
    // skin V that hugs the chest (follows the torso's curve, so it isn't a flat piece floating in front)
    const rAt = (y) => { for (let i = 1; i < torsoPts.length; i++) { const [r0, y0] = torsoPts[i - 1], [r1, y1] = torsoPts[i]; if (y <= y1) return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return torsoPts[torsoPts.length - 1][0]; };
    const sz = heavy ? 0.85 : 0.72, rows = 10, cols = 8, pos = [], idx = [];
    for (let i = 0; i <= rows; i++) {
      const t = i / rows, y = 1.27 + t * 0.2, a = 0.02 + t * 0.42, r = rAt(y) + 0.003;
      for (let j = 0; j <= cols; j++) { const th = -a + 2 * a * j / cols; pos.push(Math.sin(th) * r, y, Math.cos(th) * r * sz); }
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const k = i * (cols + 1) + j; idx.push(k, k + 1, k + cols + 1, k + 1, k + cols + 2, k + cols + 1); }
    const vg = new THREE.BufferGeometry(); vg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); vg.setIndex(idx); vg.computeVertexNormals();
    const v = new THREE.Mesh(vg, skin.clone()); v.material.side = THREE.DoubleSide; v.material.polygonOffset = true; v.material.polygonOffsetFactor = -2; upper.add(v);
    const bGeo = new THREE.SphereGeometry(0.008, 6, 4);
    for (let y = 1.0; y < 1.25; y += 0.075) upper.add(M(bGeo, toon('#555049'), 0, y, rAt(y) * sz + 0.004));   // buttons sit on the shirt, stopping below the open V
  }
  if (s.decal) {
    // wraps around the whole front of the shirt, following its shape
    const pts = torsoPts.filter(([, y]) => y >= 1.08 && y <= 1.44).map(([r, y]) => new THREE.Vector2(r + 0.016, y));
    const dg = new THREE.LatheGeometry(pts, 24, -Math.PI * 0.36, Math.PI * 0.72);
    const d = M(dg, new THREE.MeshToonMaterial({ map: s.decal, gradientMap, transparent: true, depthWrite: false })); d.scale.z = 0.72; d.renderOrder = 2;
    upper.add(d);
  }

  // arms
  for (const side of [1, -1]) {
    const arm = new THREE.Group(); arm.position.set((fem ? 0.175 : heavy ? 0.255 : slim ? 0.18 : 0.2) * side, 1.41, 0);
    const sleeve = s.sleeves === 'short' ? 0.18 : 0.52;
    const ar = fem ? 0.04 : heavy ? 0.062 : slim ? 0.042 : 0.048;
    const elbow = new THREE.Group(); elbow.position.y = -0.28; arm.add(elbow);
    // smooth limbs: straight tubes that meet in joint balls of exactly the same width (no bulges)
    const fr = ar * 0.86;
    arm.add(M(new THREE.SphereGeometry(ar, 16, 12), armSkin));                                           // shoulder
    arm.add(M(new THREE.CylinderGeometry(ar, ar, 0.28, 16, 1, true), armSkin, 0, -0.14, 0));            // upper arm
    elbow.add(M(new THREE.SphereGeometry(ar, 16, 12), armSkin));                                         // elbow
    elbow.add(M(new THREE.CylinderGeometry(ar, fr, 0.27, 16, 1, true), armSkin, 0, -0.135, 0));          // forearm, tapering to the wrist
    if (s.sleeves === 'mesh') {      // sheer black mesh sleeves, skin showing through
      const mm = new THREE.MeshToonMaterial({ color: '#0c0c0e', gradientMap, transparent: true, opacity: 0.6, depthWrite: false }), sl = ar + 0.004;
      if (!(s.bareShoulder === 'L' && side > 0)) { arm.add(M(new THREE.SphereGeometry(sl, 16, 12), mm)); arm.add(M(new THREE.CylinderGeometry(sl, sl, 0.28, 16, 1, true), mm, 0, -0.14, 0)); }
      elbow.add(M(new THREE.SphereGeometry(sl, 16, 12), mm));
      elbow.add(M(new THREE.CylinderGeometry(sl, fr + 0.004, 0.26, 16, 1, true), mm, 0, -0.13, 0));
    } else if (s.sleeves === 'none') {
      if (s.straps) { const st = M(new THREE.BoxGeometry(0.012, 0.004, 0.16), top, -0.02 * side, 0.035, 0); arm.add(st); }   // thin slip-dress strap over the shoulder
    } else if (s.sleeves === 'short') {
      const sl = ar + 0.008;
      arm.add(M(new THREE.SphereGeometry(sl, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), top));        // sleeve cap over the shoulder
      arm.add(M(new THREE.CylinderGeometry(sl, sl + 0.006, 0.12, 16, 1, true), top, 0, -0.06, 0));
    } else {
      const sl = ar + (s.fur ? 0.04 : 0.009), cuff = s.fur ? sl + 0.012 : fr + 0.01;
      arm.add(M(new THREE.SphereGeometry(sl + (s.fur ? 0.01 : 0), 16, 12), top));
      arm.add(M(new THREE.CylinderGeometry(sl, sl, 0.28, 16, 1, true), top, 0, -0.14, 0));
      elbow.add(M(new THREE.SphereGeometry(sl, 16, 12), top));
      elbow.add(M(new THREE.CylinderGeometry(sl, cuff, 0.25, 16, 1, true), top, 0, -0.125, 0));
      if (s.fur) elbow.add(M(new THREE.CircleGeometry(cuff, 16).rotateX(Math.PI / 2), top, 0, -0.25, 0));
    }
    const handMat = s.gloves ? toon(s.gloves) : s.handTattoos ? new THREE.MeshToonMaterial({ gradientMap, map: tattooSkin(s.skin) }) : skin;
    const hand = M(new THREE.SphereGeometry(fem ? 0.045 : 0.052, 16, 10), handMat, 0, -0.3, 0); hand.scale.set(0.85, 1.1, 0.7); elbow.add(hand);
    arm.rotation.z = 0.08 * side;
    upper.add(arm); P[side > 0 ? 'armL' : 'armR'] = arm; P[side > 0 ? 'elbowL' : 'elbowR'] = elbow; P[side > 0 ? 'handL' : 'handR'] = hand;
  }

  // neck + head
  const HY = 1.635;
  head.add(M(new THREE.CylinderGeometry(0.048, 0.055, 0.12, 12), skin, 0, 1.49, 0));
  const skull = M(new THREE.SphereGeometry(0.135, 32, 22), skin, 0, HY, 0); skull.scale.set(0.95, 1.1, 1); head.add(skull);
  const ear = new THREE.SphereGeometry(0.028, 8, 6);
  head.add(M(ear, skin, 0.128, HY - 0.01, 0), M(ear, skin, -0.128, HY - 0.01, 0));
  head.add(M(new THREE.SphereGeometry(0.02, 10, 8), skin, 0, HY - 0.012, 0.133));          // nose
  const dark = toon('#22180f');
  const eye = new THREE.SphereGeometry(0.0145, 10, 8);
  head.add(M(eye, dark, -0.045, HY + 0.022, 0.118), M(eye, dark, 0.045, HY + 0.022, 0.118));
  const brow = new THREE.BoxGeometry(0.04, 0.009, 0.01);
  const b1 = M(brow, hairM, -0.046, HY + 0.058, 0.118), b2 = M(brow, hairM, 0.046, HY + 0.058, 0.118); b1.rotation.z = 0.12; b2.rotation.z = -0.12; head.add(b1, b2);
  const smile = M(new THREE.TorusGeometry(0.03, 0.006, 6, 14, Math.PI), toon('#7a3b32'), 0, HY - 0.05, 0.122); smile.rotation.z = Math.PI; head.add(smile);
  if (s.blush) { const bl = toon('#e98f8a', { transparent: true, opacity: 0.55 }); const g = new THREE.SphereGeometry(0.022, 8, 6); const c1 = M(g, bl, -0.075, HY - 0.02, 0.105), c2 = M(g, bl, 0.075, HY - 0.02, 0.105); c1.scale.z = c2.scale.z = 0.3; head.add(c1, c2); }
  if (s.stubble) {
    const st = M(new THREE.SphereGeometry(0.137, 24, 12, Math.PI * 0.12, Math.PI * 0.76, Math.PI * 0.52, Math.PI * 0.3), toon(s.hair, { transparent: true, opacity: 0.4 }), 0, HY, 0);
    st.scale.set(0.95, 1.1, 1); head.add(st);
  }
  if (s.beard) {
    // full beard: follows the jaw from the sideburns, covers the chin, and leaves a gap for the mouth
    const bg = new THREE.SphereGeometry(0.146, 48, 22, 0.02 * Math.PI, 0.96 * Math.PI, 0.46 * Math.PI, 0.46 * Math.PI), bp = bg.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < bp.count; i++) {
      v.fromBufferAttribute(bp, i); const r = v.length(), th = Math.acos(v.y / r), ph = Math.atan2(v.z, -v.x);
      const front = 1 - Math.min(1, Math.abs(ph - Math.PI / 2) / (0.5 * Math.PI));     // 1 at the chin, 0 at the ears
      const top = (0.53 + 0.1 * Math.pow(front, 1.5)) * Math.PI;                         // up the cheeks at the sides, just under the mouth in front
      let t2 = Math.max(th, top);
      let rr = r * (1 + 0.05 * front * Math.max(0, (t2 / Math.PI - 0.62)) * 4);          // a little fuller at the chin
      rr *= 1 + 0.025 * Math.sin(ph * 23 + t2 * 17) * Math.sin(ph * 7 - t2 * 11);            // a little uneven, like real hair
      const edge = Math.min(1, (t2 - top) / (0.05 * Math.PI));                               // feather the top edge in toward the skin
      rr *= 0.975 + 0.025 * edge;
      bp.setXYZ(i, -Math.cos(ph) * Math.sin(t2) * rr, Math.cos(t2) * rr - 0.01 * front * Math.max(0, t2 / Math.PI - 0.72) * 6, Math.sin(ph) * Math.sin(t2) * rr);
    }
    bg.computeVertexNormals();
    const beardTex = paint(256, 128, (g, w, h) => {
      const base = new THREE.Color(s.hair); g.fillStyle = '#' + base.getHexString(); g.fillRect(0, 0, w, h);
      for (let k = 0; k < 900; k++) { const x = Math.random() * w, y = Math.random() * h, l = 4 + Math.random() * 9, c = base.clone().multiplyScalar(Math.random() < 0.5 ? 0.7 : 1.35);
        g.strokeStyle = '#' + c.getHexString(); g.globalAlpha = 0.55; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y + l); g.stroke(); }
      g.globalAlpha = 1;
    });
    beardTex.wrapS = beardTex.wrapT = THREE.RepeatWrapping; beardTex.repeat.set(3, 2);
    const bd = M(bg, new THREE.MeshToonMaterial({ map: beardTex, gradientMap }), 0, HY, 0); bd.scale.set(0.955, 1.08, 1.0); head.add(bd);
    smile.position.z = 0.138; smile.position.y = HY - 0.056; smile.scale.setScalar(0.8);   // mouth showing between mustache and beard
  }
  if (s.shortBeard) {
    // neat, short beard along the jaw and chin, joined to the sideburns
    const bm = toon(s.beardColor || s.hair);
    // one piece: high along the cheeks/jaw, curving down under the mouth in front
    const bg = new THREE.SphereGeometry(0.1415, 48, 18, 0.03 * Math.PI, 0.94 * Math.PI, 0.48 * Math.PI, 0.38 * Math.PI), bp = bg.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < bp.count; i++) {
      v.fromBufferAttribute(bp, i); const r = v.length(), th = Math.acos(v.y / r), ph = Math.atan2(v.z, -v.x);
      const f = Math.min(1, Math.max(0, (Math.abs(ph - Math.PI / 2) - 0.12 * Math.PI) / (0.22 * Math.PI)));   // 0 = chin, 1 = cheek
      const s2 = f * f * (3 - 2 * f), top = (0.645 - 0.155 * s2) * Math.PI;
      if (th < top) { const t2 = top; bp.setXYZ(i, -Math.cos(ph) * Math.sin(t2) * r, Math.cos(t2) * r, Math.sin(ph) * Math.sin(t2) * r); }
    }
    bg.computeVertexNormals();
    // barely-there stubble: fine dots, mostly see-through
    const dots = paint(256, 256, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.65})`; g.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4); } }, { srgb: false });
    dots.wrapS = dots.wrapT = THREE.RepeatWrapping; dots.repeat.set(3, 2);
    const stubbleMat = new THREE.MeshToonMaterial({ color: s.beardColor || s.hair, gradientMap, alphaMap: dots, transparent: true, opacity: 0.32, depthWrite: false });
    const jaw = M(bg, stubbleMat, 0, HY, 0); jaw.scale.set(0.962, 1.1, 1.035); head.add(jaw);
    smile.position.z = 0.137; smile.position.y = HY - 0.054; smile.scale.setScalar(0.85);
  }
  if (s.mustache) {
    const mz = s.shortBeard ? 0.147 : s.beard ? 0.142 : 0.128, mm = toon(s.beardColor || s.hair);
    // a full, flat mustache across the upper lip: thickest in the middle, tapering at the corners
    const g = new THREE.SphereGeometry(1, 24, 12), gp = g.attributes.position;
    for (let i = 0; i < gp.count; i++) { const x = gp.getX(i); gp.setY(i, gp.getY(i) * (1 - 0.45 * x * x) + 0.18 * x * x); }   // corners taper and turn very slightly down at the very ends
    g.computeVertexNormals();
    const must = M(g, mm, 0, HY - 0.034, mz - 0.004); must.scale.set(0.05, -0.017, 0.016); must.rotation.x = 0.15; head.add(must);
  }
  if (s.noseRing) {     // small hoop through the side of the nostril
    const ring = M(new THREE.TorusGeometry(0.0075, 0.0018, 6, 16), new THREE.MeshStandardMaterial({ color: '#d8d8d8', metalness: 1, roughness: 0.2 }), 0.0135, HY - 0.024, 0.146);
    ring.rotation.set(0.25, Math.PI / 2 - 0.35, 0); head.add(ring);
  }
  if (s.cap) {          // newsboy cap
    const cm = toon(s.cap);
    const crown = M(new THREE.SphereGeometry(0.155, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), cm, 0, HY + 0.045, -0.005); crown.scale.set(1.08, 0.62, 1.12); head.add(crown);
    const brim = M(new THREE.CylinderGeometry(0.09, 0.1, 0.012, 20, 1, false, -Math.PI / 2, Math.PI), cm, 0, HY + 0.06, 0.12); brim.rotation.x = 0.18; head.add(brim);
    head.add(M(new THREE.SphereGeometry(0.012, 8, 6), cm, 0, HY + 0.145, 0));
  }
  if (s.shades) {        // big black wraparound sunglasses
    // two big dark lenses with a flat brow line, dipping low at the cheeks, a thin bridge and arms back to the ears
    const lensShape = new THREE.Shape();
    lensShape.moveTo(-0.03, 0.017); lensShape.lineTo(0.026, 0.02); lensShape.quadraticCurveTo(0.036, 0.019, 0.034, 0.006);
    lensShape.quadraticCurveTo(0.03, -0.022, 0.004, -0.022); lensShape.quadraticCurveTo(-0.022, -0.021, -0.028, -0.006); lensShape.quadraticCurveTo(-0.032, 0.006, -0.03, 0.017);
    const lensGeo = new THREE.ExtrudeGeometry(lensShape, { depth: 0.003, bevelEnabled: false, curveSegments: 10 });
    const lensMat = new THREE.MeshStandardMaterial({ color: '#120b09', roughness: 0.06, metalness: 0.55, side: THREE.DoubleSide }), frameMat = toon('#1a1a1a');
    for (const sd of [1, -1]) {
      const l = M(lensGeo, lensMat, 0.047 * sd, HY + 0.02, 0.137); l.scale.x = sd; l.rotation.y = 0.22 * sd; head.add(l);
      const arm = M(new THREE.BoxGeometry(0.004, 0.005, 0.13), frameMat, 0.112 * sd, HY + 0.034, 0.065); arm.rotation.y = 0.32 * sd; head.add(arm);
    }
    head.add(M(new THREE.BoxGeometry(0.03, 0.005, 0.004), frameMat, 0, HY + 0.035, 0.145));
    if (s.redLiner) for (const sd of [1, -1]) { const w = M(new THREE.BoxGeometry(0.05, 0.007, 0.004), toon('#d4141c'), 0.052 * sd, HY + 0.055, 0.124); w.rotation.z = 0.28 * sd; w.rotation.y = 0.35 * sd; head.add(w); }
  }
  if (s.glasses) {
    const fr = toon('#111111'); const lens = new THREE.TorusGeometry(0.022, 0.004, 6, 16);
    head.add(M(lens, fr, -0.045, HY + 0.022, 0.13), M(lens, fr, 0.045, HY + 0.022, 0.13), M(new THREE.BoxGeometry(0.03, 0.004, 0.004), fr, 0, HY + 0.025, 0.132));
  }

  // hair
  const hs = s.hairStyle;
  if (hs !== 'bald' && hs !== 'swept' && hs !== 'long' && hs !== 'cap') {
    const top = M(new THREE.SphereGeometry(0.143, 30, 18, 0, Math.PI * 2, 0, Math.PI * 0.42), hairM, 0, HY + 0.035, -0.012);
    top.scale.set(1, hs === 'buzz' ? 0.92 : 1.06, 1.06); top.rotation.x = hs === 'swept' ? -0.42 : -0.28; head.add(top);
    const back = M(new THREE.SphereGeometry(0.139, 24, 14, Math.PI * 1.1, Math.PI * 0.8, Math.PI * 0.3, Math.PI * 0.42), hairM, 0, HY, -0.004);
    back.scale.set(1, 1.1, 1.03); head.add(back);
  }
  if (hs === 'swept') {    // wavy, medium length, pushed back off the forehead with volume, flipping out at the neck
    const g = new THREE.SphereGeometry(1, 64, 48), gp = g.attributes.position;
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i), y = gp.getY(i), z = gp.getZ(i);
      let X = x * 0.153, Y = y * (y < 0 ? 0.13 + 0.13 * Math.max(0, -z) : 0.13) + 0.06, Z = z * 0.17 - 0.028;   // reaches down to the nape at the back
      if (y > 0) { Y += 0.03 * Math.max(0, z) * y + 0.005 * Math.sin(x * 9 + z * 4) * y; Z += 0.012 * y; }   // lift at the front, soft waves on top
      const hairline = Z > 0.06 ? 0.112 + Math.abs(X) * 0.1 - Math.max(0, Math.abs(X) - 0.08) * 1.2 : Z > -0.04 ? 0.112 - (0.06 - Z) / 0.1 * 0.115 : -0.003 - Math.min(1, (-0.04 - Z) / 0.08) * 0.15;              // high forehead, over the ear tops, down to the nape
      if (Z < -0.02 && Y < 0.02) { const fl = Math.min(1, (0.02 - Y) / 0.12); X *= 1 + 0.16 * fl * fl; Z = Z * (1 + 0.1 * fl) - 0.012 * fl; }   // soft outward flip at the nape
            if (Y < hairline) { const k = Math.min(1, (hairline - Y) / 0.04); Y = hairline - k * 0.012; X *= 1 - 0.12 * k; Z *= 1 - 0.12 * k; }   // fold the edge under for a clean hairline
      gp.setXYZ(i, X, Y, Z);
    }
    g.computeVertexNormals();
    const strands = paint(512, 256, (c, w, h) => {
      const base = new THREE.Color(s.hair); c.fillStyle = '#' + base.getHexString(); c.fillRect(0, 0, w, h);
      for (let i = 0; i < 420; i++) {        // strands running from the crown down and back
        const x = Math.random() * w, dark = Math.random() < 0.55, col = base.clone().multiplyScalar(dark ? 0.7 + Math.random() * 0.15 : 1.15 + Math.random() * 0.2);
        c.strokeStyle = '#' + col.getHexString(); c.globalAlpha = 0.5; c.lineWidth = 1 + Math.random() * 2.5;
        c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + (Math.random() - 0.5) * 30, h * 0.35, x + (Math.random() - 0.5) * 40, h * 0.7, x + (Math.random() - 0.5) * 30, h); c.stroke();
      }
      c.globalAlpha = 1;
    });
    strands.wrapS = THREE.RepeatWrapping; strands.repeat.set(3, 1);
    head.add(M(g, new THREE.MeshToonMaterial({ map: strands, gradientMap }), 0, HY, 0));
  } else if (hs === 'long') {
    // one continuous shell of long hair: over the top, down the sides past the shoulders and down the back, open only for the face
    const g = new THREE.SphereGeometry(1, 64, 48), gp = g.attributes.position;
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i), y = gp.getY(i), z = gp.getZ(i);
      let X = x * 0.158, Y = y * 0.152 + 0.03, Z = z * 0.163 - 0.012;
      if (y < 0) {
        const len = s.hairLen || (0.16 + 0.28 * Math.min(1, Math.max(0, 0.6 - z)));   // longer at the back and sides (hairLen = an even bob)
        Y = 0.03 + y * len;
        const fl = -y;                                                          // falls outward a little as it gets longer
        X *= 1 + 0.12 * fl; Z = Z * (1 + 0.05 * fl) - 0.04 * fl * Math.max(0, -z);
      }
      { const ss = (a0, b0, v) => { const t2 = Math.min(1, Math.max(0, (v - a0) / (b0 - a0))); return t2 * t2 * (3 - 2 * t2); };   // smooth opening for the face
        const w = ss(0.135, 0.105, Math.abs(X)) * ss(0.02, 0.06, Z) * ss(0.1, 0.07, Y);
        Z = Z + (Math.min(Z, 0.015) - Z) * w; X *= 1 - 0.08 * w; }
      gp.setXYZ(i, X, Y, Z);
    }
    g.computeVertexNormals();
    const strands = paint(512, 256, (c, w, h) => {
      const base = new THREE.Color(s.hair); c.fillStyle = '#' + base.getHexString(); c.fillRect(0, 0, w, h);
      for (let k = 0; k < 360; k++) { const x = Math.random() * w, col = base.clone().lerp(new THREE.Color('#ffffff'), Math.random() < 0.5 ? 0.025 : 0.06); c.strokeStyle = '#' + col.getHexString(); c.globalAlpha = 0.45; c.lineWidth = 1 + Math.random() * 2; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + (Math.random() - 0.5) * 20, h * 0.4, x + (Math.random() - 0.5) * 30, h * 0.75, x + (Math.random() - 0.5) * 20, h); c.stroke(); }
      c.globalAlpha = 1;
    });
    strands.wrapS = THREE.RepeatWrapping; strands.repeat.set(3, 1);
    head.add(M(g, new THREE.MeshToonMaterial({ map: strands, gradientMap, side: THREE.DoubleSide }), 0, HY, 0));
    if (s.bangs !== false) {
    // full bangs: a fringe across the forehead ending just above the brows
    const bangs = M(new THREE.SphereGeometry(0.149, 32, 10, 0.06 * Math.PI, 0.88 * Math.PI, 0.1 * Math.PI, 0.27 * Math.PI), hairM, 0, HY + 0.012, 0.004);
    bangs.scale.set(0.97, 1.1, 1.04); head.add(bangs);
    for (let i = 0; i < 9; i++) {          // soft, piecey ends
      const a = Math.PI * (0.2 + i * 0.075), x = -Math.cos(a) * 0.118, z = Math.sin(a) * 0.118 + 0.035;
      const piece = M(cap(0.016, 0.03, 6), hairM, x, HY + 0.079 - Math.abs(i - 4) * 0.003, z); piece.rotation.z = (i - 4) * 0.06; head.add(piece);
    }
    }
  } else if (hs === 'cap') {          // ball cap with a leather patch, short hair showing at the sides and back
    const cm = toon(s.capColor || '#4a4d55');
    const crown = M(new THREE.SphereGeometry(0.147, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), cm, 0, HY + 0.035, -0.008); crown.scale.set(1.02, 0.95, 1.06); head.add(crown);
    const brim = M(new THREE.CylinderGeometry(0.11, 0.115, 0.01, 24, 1, false, -Math.PI / 2, Math.PI), cm, 0, HY + 0.045, 0.1); brim.rotation.x = 0.12; brim.scale.z = 1.25; head.add(brim);   // brim reaches 25% further forward
    head.add(M(new THREE.BoxGeometry(0.045, 0.03, 0.006), toon('#7a4a26'), 0, HY + 0.1, 0.143).rotateX(-0.45));
    head.add(M(new THREE.SphereGeometry(0.011, 8, 6), cm, 0, HY + 0.178, -0.008));
    const back = M(new THREE.SphereGeometry(0.139, 24, 12, Math.PI * 1.05, Math.PI * 0.9, Math.PI * 0.42, Math.PI * 0.2), hairM, 0, HY, -0.004); back.scale.set(1, 1.1, 1.03); head.add(back);
  } else if (hs === 'dreads') {
    for (let i = 0; i < 36; i++) {
      const ring = i % 2, ang = Math.PI * (0.92 + (i / 35) * 1.16);   // around the sides and back
      const len = 0.22 + ((i * 37) % 11) / 100, r = 0.128 + ring * 0.012;
      const d = M(cap(0.017, len, 6), hairM, Math.cos(ang) * r, HY + 0.05 - len / 2 - ring * 0.03, Math.sin(ang) * r - 0.01);
      d.rotation.z = Math.cos(ang) * 0.22; d.rotation.x = Math.sin(ang) * 0.22; head.add(d);
    }
  } else if (hs === 'spikes') {   // slicked back into a bun with long black spikes fanning out of it
    // tight glossy bun on the crown; long thin spikes shooting out of it in every direction, mostly sideways
    const bx = 0, by = HY + 0.155, bz = -0.035, sm = new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.2, metalness: 0.35 });
    const bun = M(new THREE.SphereGeometry(0.048, 16, 12), sm, bx, by, bz); bun.scale.set(1.15, 0.75, 1.1); head.add(bun);
    const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
    const SP = [[0.0, 0.5, 0.3], [0.55, 0.15, 0.24], [1.1, 0.35, 0.2], [1.6, 0.05, 0.3], [2.1, 0.3, 0.22], [2.6, 0.1, 0.26], [3.14, 0.45, 0.2],
      [3.7, 0.12, 0.28], [4.2, 0.35, 0.22], [4.7, 0.02, 0.3], [5.2, 0.4, 0.24], [5.75, 0.2, 0.27], [0.8, 1.1, 0.18], [3.9, 1.0, 0.2]];   // [around, up-tilt, length]
    for (const [az, el, len] of SP) {
      const g = new THREE.ConeGeometry(0.007, len, 5).translate(0, len / 2, 0);
      dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
      const sp = M(g, sm, bx + dir.x * 0.04, by + dir.y * 0.02, bz + dir.z * 0.04); sp.quaternion.setFromUnitVectors(up, dir); head.add(sp);
    }
  } else if (hs === 'ponytail') {   // pulled back into a high ponytail hanging down the back
    head.add(M(new THREE.SphereGeometry(0.03, 10, 8), hairM, 0, HY + 0.1, -0.12));
    const tail = M(cap(0.032, 0.2, 8), hairM, 0, HY - 0.03, -0.16); tail.rotation.x = 0.25; head.add(tail);
  } else if (hs === 'bun') {
    head.add(M(new THREE.SphereGeometry(0.065, 14, 10), hairM, 0, HY + 0.1, -0.12));
  } else if (hs === 'curly') {
    for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, y = 0.03 + (i % 3) * 0.04; head.add(M(new THREE.SphereGeometry(0.05, 10, 8), hairM, Math.cos(a) * 0.12, HY + y + 0.02, Math.sin(a) * 0.12 - 0.02)); }
  } else if (hs === 'beanie') {
    const b = M(new THREE.SphereGeometry(0.148, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), toon(s.hat || '#222'), 0, HY + 0.025, -0.005); b.scale.y = 1.12; head.add(b);
  }

  root.scale.setScalar(s.height / 1.8);
  return { root, head, P, eye: HY * s.height / 1.8 };
}

// ── Bre's shirt: white baby tee with the airbrushed heart and "Austin" ──
let breTee = null;
function breDecal() {
  if (breTee) return breTee;
  breTee = paint(512, 512, (g, w, h) => {
    // airbrushed tee from the photo: big glossy pink-red heart, chrome-black "Austin" script, sparkles, a little white-rimmed heart
    const heart = (cx, cy, sx, sy) => { g.beginPath(); g.moveTo(cx, cy + sy * 0.95); g.bezierCurveTo(cx - sx * 1.25, cy + sy * 0.05, cx - sx * 0.95, cy - sy * 1.0, cx, cy - sy * 0.45); g.bezierCurveTo(cx + sx * 0.95, cy - sy * 1.0, cx + sx * 1.25, cy + sy * 0.05, cx, cy + sy * 0.95); };
    const HX = 238, HY = 236, SX = 205, SY = 215;
    g.filter = 'blur(9px)'; g.fillStyle = 'rgba(232,40,70,.6)'; heart(HX, HY, SX + 14, SY + 14); g.fill();                 // overspray
    g.filter = 'blur(2px)';
    const grd = g.createRadialGradient(HX - 50, HY - 40, 10, HX, HY, SX * 1.1);
    grd.addColorStop(0, '#ffe3ea'); grd.addColorStop(0.35, '#ff8ea4'); grd.addColorStop(0.75, '#f0405e'); grd.addColorStop(1, '#d81f3e');
    g.fillStyle = grd; heart(HX, HY, SX, SY); g.fill();
    g.filter = 'blur(10px)'; g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(HX - 95, HY - 95, 46, 22, -0.6, 0, 7); g.fill();   // gloss
    // little heart with a white rim, and a tiny one below
    g.filter = 'blur(5px)'; g.fillStyle = 'rgba(255,255,255,.95)'; heart(400, 362, 56, 58); g.fill();
    g.filter = 'blur(1.5px)'; const g2 = g.createRadialGradient(390, 350, 4, 400, 362, 60); g2.addColorStop(0, '#ffc2cf'); g2.addColorStop(1, '#ee3a58'); g.fillStyle = g2; heart(400, 362, 42, 44); g.fill();
    g.fillStyle = '#e8304e'; heart(378, 448, 14, 14); g.fill();
    g.filter = 'none';
    // sparkles
    const spark = (x, y, r) => { const sg = g.createRadialGradient(x, y, 0, x, y, r); sg.addColorStop(0, 'rgba(255,255,255,1)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sg; g.fillRect(x - r, y - r, 2 * r, 2 * r); g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(x - r, y - 1.5, 2 * r, 3); g.fillRect(x - 1.5, y - r, 3, 2 * r); };
    spark(108, 300, 26); spark(222, 392, 22); spark(430, 300, 24); spark(330, 150, 14);
    // "Austin" in chrome-black airbrush script, running past the heart's edges
    g.save(); g.translate(250, 236); g.rotate(-0.06);
    g.font = 'bold 170px "Great Vibes", "Snell Roundhand", "Brush Script MT", cursive'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.filter = 'blur(3px)'; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillText('Austin', 4, 6);
    g.filter = 'none';
    const tg = g.createLinearGradient(0, -60, 0, 60); tg.addColorStop(0, '#5a5f66'); tg.addColorStop(0.45, '#0b0b0d'); tg.addColorStop(0.6, '#2c3036'); tg.addColorStop(1, '#050505');
    g.fillStyle = tg; g.lineWidth = 5; g.strokeStyle = '#0b0b0d'; g.strokeText('Austin', 0, 0); g.fillText('Austin', 0, 0);
    g.fillStyle = 'rgba(255,255,255,.95)';
    for (const [x, y] of [[-150, -52], [-60, -18], [-6, -30], [46, -48], [92, -40], [140, -28]]) { g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); }   // chrome glints
    g.restore();
  });
  return breTee;
}

export function makeCharacter(kind) {
  let spec;
  if (kind === 'austin') {
    spec = { height: 1.86, skin: '#e9b896', hair: '#6b4428', hairStyle: 'swept', mustache: true, shortBeard: true, beardColor: '#4a2e1a',
      top: '#2a2320', openCollar: true, pants: '#8eb0d0', belt: '#3b2416', shoes: '#0e0d0c', shoeStyle: 'boots' };
  } else {
    spec = { build: 'f', height: 1.68, skin: '#f0c7a8', hair: '#141110', hairStyle: 'long', blush: true,
      top: '#f7f4f0', topStyle: 'crop', sleeves: 'short', decal: breDecal(), pants: '#111111', pantsStyle: 'wide', shoeStyle: 'clearWedge' };
  }
  const p = buildPerson(spec);
  return { ...p, name: LOOKS[kind].name, update: animator(p) };
}

// party guests dancing near the band
export function makeGuest(kind = 'spikes') {
  const p = buildPerson({ build: 'f', height: 1.74, skin: '#eac2a4', hair: '#121010', hairStyle: 'spikes', shades: true, redLiner: true, thong: true, backTattoo: 'images/kristin-tattoo.png', blush: true,
    fur: true, cagePants: true, pantsStyle: 'wide', shoes: '#0a0a0a' });
  return { ...p, update: animator(p) };
}

// shared animation: walk / idle / dance / wave
export function animator(p) {
  let phase = 0;
  const P = p.P;
  return (dt, speed, t, mode = 'idle') => {
    phase += dt * (speed > 0.05 ? 2.4 * speed + 2 : 0);
    const k = Math.min(1, speed / 3);
    P.body.position.y = Math.abs(Math.sin(phase)) * 0.035 * k;
    P.legL.rotation.x = Math.sin(phase) * 0.6 * k;
    P.legR.rotation.x = -Math.sin(phase) * 0.6 * k;
    P.armL.rotation.set(-Math.sin(phase) * 0.45 * k, 0, 0.08);
    P.armR.rotation.set(Math.sin(phase) * 0.45 * k, 0, -0.08);
    P.sway.rotation.set(0, 0, 0);
    P.elbowL.rotation.set(-0.15 - 0.25 * k, 0, 0); P.elbowR.rotation.set(-0.15 - 0.25 * k, 0, 0);
    if (speed < 0.05 && mode === 'dance') {
      const b = t * 4.4;
      P.body.position.y = Math.abs(Math.sin(b)) * 0.05;
      P.sway.rotation.z = Math.sin(b / 2) * 0.12;
      P.sway.rotation.y = Math.sin(b / 4) * 0.25;
      P.elbowL.rotation.x = -1.1; P.elbowR.rotation.x = -1.1;
      P.armL.rotation.set(-0.6 + Math.sin(b) * 0.4, 0, 0.5 + Math.sin(b / 2) * 0.3);
      P.armR.rotation.set(-0.6 - Math.sin(b) * 0.4, 0, -0.5 + Math.sin(b / 2) * 0.3);
      P.legL.rotation.x = Math.max(0, Math.sin(b / 2)) * 0.3;
      P.legR.rotation.x = Math.max(0, -Math.sin(b / 2)) * 0.3;
    } else if (speed < 0.05 && mode === 'wave') {
      // friendly wave: upper arm out to the side, elbow bent so the forearm points up, hand rocking side to side
      P.armL.rotation.set(-0.25, 0, 1.2);
      P.elbowL.rotation.set(0, 0, 1.85 + Math.sin(t * 7) * 0.35);
      P.body.position.y = Math.abs(Math.sin(t * 3)) * 0.02;
    } else if (speed < 0.05) {
      P.sway.rotation.z = Math.sin(t * 1.3) * 0.015;
    }
  };
}

// ─────────────────────────────────────────────────────────────
// The band: guitar, keys, bass, drums, sax. Plus a bartender.
// ─────────────────────────────────────────────────────────────
const gold = () => new THREE.MeshStandardMaterial({ color: '#d4a64a', metalness: 1, roughness: 0.28 });
const chrome = () => new THREE.MeshStandardMaterial({ color: '#dddddd', metalness: 1, roughness: 0.2 });
const blackGloss = () => new THREE.MeshStandardMaterial({ color: '#0d0d0d', roughness: 0.35 });

function guitarBody(color, neckLen = 0.48, { neck = '#3a2414', guard = null } = {}) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.2); shape.bezierCurveTo(0.2, -0.2, 0.2, 0.02, 0.1, 0.06); shape.bezierCurveTo(0.16, 0.16, 0.08, 0.2, 0, 0.17);
  shape.bezierCurveTo(-0.08, 0.2, -0.16, 0.16, -0.1, 0.06); shape.bezierCurveTo(-0.2, 0.02, -0.2, -0.2, 0, -0.2);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.1 }));
  body.position.z = -0.025; g.add(body);
  g.add(M(new THREE.BoxGeometry(0.045, neckLen, 0.025), new THREE.MeshStandardMaterial({ color: neck, roughness: 0.5 }), 0, 0.17 + neckLen / 2, 0));
  if (guard) { const pg = M(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: guard, roughness: 0.4 }), 0.02, -0.02, 0.034); pg.scale.set(0.55, 0.6, 1); g.add(pg); }
  g.add(M(new THREE.BoxGeometry(0.06, 0.12, 0.03), new THREE.MeshStandardMaterial({ color: neck }), 0, 0.2 + neckLen, 0));
  g.add(M(new THREE.BoxGeometry(0.08, 0.02, 0.012), chrome(), 0, -0.08, 0.035));
  for (let i = 0; i < 4; i++) g.add(M(new THREE.CylinderGeometry(0.0015, 0.0015, neckLen + 0.3, 4), chrome(), -0.012 + i * 0.008, 0.07 + neckLen / 2, 0.034));   // strings
  g.add(M(new THREE.CylinderGeometry(0.032, 0.032, 0.006, 20), new THREE.MeshStandardMaterial({ color: '#111' }), 0, 0.02, 0.03).rotateX(Math.PI / 2));
  g.userData.strum = new THREE.Object3D(); g.userData.strum.position.set(0, 0.0, 0.07); g.add(g.userData.strum);
  g.userData.fret = new THREE.Object3D(); g.userData.fret.position.set(0, 0.17 + neckLen * 0.7, 0.04); g.add(g.userData.fret);
  g.userData.neckLen = neckLen;
  return g;
}
function drumKit() {
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: '#c88a3c', roughness: 0.25, metalness: 0.15 });   // natural wood finish
  const head = new THREE.MeshStandardMaterial({ color: '#efe9de', roughness: 0.7 });
  const kick = M(new THREE.CylinderGeometry(0.28, 0.28, 0.4, 28), shell, 0, 0.3, 0.35); kick.rotation.x = Math.PI / 2; g.add(kick);
  const kf = M(new THREE.CircleGeometry(0.27, 28), head, 0, 0.3, 0.552); g.add(kf);
  const drum = (r, h, x, y, z, tilt = 0.2) => { const d = new THREE.Group(); d.position.set(x, y, z); d.rotation.x = tilt; d.add(M(new THREE.CylinderGeometry(r, r, h, 24), shell)); d.add(M(new THREE.CylinderGeometry(r * 0.98, r * 0.98, 0.005, 24), head, 0, h / 2, 0)); g.add(d); return d; };
  drum(0.18, 0.14, 0.05, 0.62, 0.15, 0.15);      // snare
  drum(0.13, 0.12, -0.12, 0.78, 0.32, 0.35);     // rack toms
  drum(0.14, 0.12, 0.18, 0.78, 0.32, 0.35);
  drum(0.2, 0.35, -0.38, 0.45, 0.12, 0);         // floor tom
  const cym = (r, x, y, z, tilt) => { const st = M(new THREE.CylinderGeometry(0.008, 0.008, y, 6), chrome(), x, y / 2, z); g.add(st); const c = M(new THREE.CylinderGeometry(r, r * 0.2, 0.012, 28), gold(), x, y, z); c.rotation.x = tilt; g.add(c); return c; };
  const hat = cym(0.17, 0.42, 0.85, 0.1, 0.05); cym(0.21, -0.35, 1.1, 0.42, 0.3); cym(0.25, 0.3, 1.12, 0.48, 0.3);
  g.add(M(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 18), blackGloss(), 0, 0.5, -0.38));       // throne
  g.add(M(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), chrome(), 0, 0.25, -0.38));
  g.userData.hat = hat;
  return g;
}
function keyboard() {
  const g = new THREE.Group();
  const stand = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.5 });
  for (const s of [1, -1]) { const leg = M(new THREE.BoxGeometry(0.03, 0.95, 0.03), stand, 0, 0.42, 0); leg.rotation.x = 0.55 * s; g.add(leg); }
  g.add(M(new THREE.BoxGeometry(1.05, 0.08, 0.3), new THREE.MeshStandardMaterial({ color: '#b3202a', roughness: 0.35 }), 0, 0.85, 0));
  g.add(M(new THREE.BoxGeometry(0.98, 0.02, 0.14), new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.4 }), 0, 0.9, 0.06));
  for (let i = 0; i < 26; i++) if (i % 7 !== 2 && i % 7 !== 6) g.add(M(new THREE.BoxGeometry(0.018, 0.02, 0.08), new THREE.MeshStandardMaterial({ color: '#111' }), -0.47 + i * 0.0375 + 0.019, 0.91, 0.03));
  return g;
}
// a tube whose radius changes along its length (sax body, neck, bow)
function taperTube(pts, r0, r1, mat, seg = 48, rad = 18, ease = (t) => t) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), fr = curve.computeFrenetFrames(seg, false);
  const pos = [], idx = [], p = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, r = r0 + (r1 - r0) * ease(t); curve.getPointAt(t, p);
    for (let j = 0; j <= rad; j++) {
      const a = (j / rad) * Math.PI * 2, n = fr.normals[i], b = fr.binormals[i];
      pos.push(p.x + (n.x * Math.cos(a) + b.x * Math.sin(a)) * r, p.y + (n.y * Math.cos(a) + b.y * Math.sin(a)) * r, p.z + (n.z * Math.cos(a) + b.z * Math.sin(a)) * r);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) { const k = i * (rad + 1) + j; idx.push(k, k + rad + 1, k + 1, k + 1, k + rad + 1, k + rad + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.userData.curve = curve; return m;
}
// Tenor sax, built in the player's torso space at real size: mouthpiece at his lips, neck curving forward and down,
// body running down in front of him toward his right hip, the bow, and the bell turning up and out. Lacquered brass with pearl key touches.
function sax() {
  const g = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: '#e2b95c', metalness: 0.78, roughness: 0.24, emissive: '#3a2408', emissiveIntensity: 0.35 });
  const brassD = brass.clone(); brassD.side = THREE.DoubleSide;
  const pearl = new THREE.MeshStandardMaterial({ color: '#f3ecdc', roughness: 0.25, metalness: 0.1 });
  const black = new THREE.MeshStandardMaterial({ color: '#0c0c0c', roughness: 0.3 });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // mouthpiece (black) + silver ligature
  const mpA = V(0, 1.567, 0.13), mpB = V(0, 1.53, 0.205);
  const mp = taperTube([mpA, mpA.clone().lerp(mpB, 0.5), mpB], 0.007, 0.0115, black, 8, 12); g.add(mp);
  const lig = M(new THREE.CylinderGeometry(0.0125, 0.0125, 0.012, 14, 1, true), new THREE.MeshStandardMaterial({ color: '#d8d8d8', metalness: 1, roughness: 0.2, side: THREE.DoubleSide }), 0, 0, 0);
  lig.position.copy(mpA.clone().lerp(mpB, 0.62)); lig.quaternion.setFromUnitVectors(V(0, 1, 0), mpB.clone().sub(mpA).normalize()); g.add(lig);
  // neck (crook): curves forward then down into the body
  const neckPts = [V(0, 1.53, 0.2), V(-0.004, 1.5, 0.245), V(-0.016, 1.445, 0.262), V(-0.028, 1.39, 0.258)];
  g.add(taperTube(neckPts, 0.0115, 0.016, brass, 20, 14));
  g.add(M(new THREE.BoxGeometry(0.004, 0.004, 0.05), brass, 0.012, 1.485, 0.24).rotateX(0.7));   // octave key along the neck
  // body: a cone getting wider toward the bottom
  const bodyPts = [V(-0.028, 1.39, 0.258), V(-0.05, 1.22, 0.24), V(-0.078, 1.04, 0.222), V(-0.1, 0.89, 0.205)];
  const body = taperTube(bodyPts, 0.016, 0.04, brass, 40, 18); g.add(body);
  g.add(M(new THREE.CylinderGeometry(0.019, 0.019, 0.014, 16), brass, -0.028, 1.385, 0.258));   // neck joint collar
  // bow: the U-bend at the bottom
  const bowPts = [V(-0.1, 0.89, 0.205), V(-0.112, 0.815, 0.222), V(-0.116, 0.79, 0.27), V(-0.118, 0.82, 0.318), V(-0.122, 0.88, 0.33)];
  g.add(taperTube(bowPts, 0.04, 0.046, brass, 30, 18));
  // bell: rises up the front and flares open
  const bellPts = [V(-0.122, 0.88, 0.33), V(-0.126, 0.95, 0.338), V(-0.13, 1.02, 0.345)];
  g.add(taperTube(bellPts, 0.046, 0.058, brass, 12, 18));
  const flare = M(new THREE.LatheGeometry([[0.056, 0], [0.06, 0.018], [0.066, 0.034], [0.076, 0.05], [0.086, 0.058], [0.09, 0.06]].map(([r, y]) => new THREE.Vector2(r, y)), 28), brassD);
  flare.position.set(-0.13, 1.02, 0.345); flare.quaternion.setFromUnitVectors(V(0, 1, 0), V(-0.03, 1, 0.22).normalize()); g.add(flare);
  const rim = M(new THREE.TorusGeometry(0.09, 0.0035, 6, 32), brass); rim.position.copy(flare.position).add(V(-0.03, 1, 0.22).normalize().multiplyScalar(0.06)); rim.quaternion.copy(flare.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2)); g.add(rim);
  const throat = M(new THREE.CircleGeometry(0.056, 20), new THREE.MeshBasicMaterial({ color: '#120b04' })); throat.position.copy(flare.position); throat.quaternion.copy(flare.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -Math.PI / 2)); g.add(throat);
  // keys: pearl touches down the front, gold key cups on the side, a rod tying them together
  const bc = body.userData.curve, pt = new THREE.Vector3(), tg = new THREE.Vector3();
  const along = (t, side, out) => { bc.getPointAt(t, pt); bc.getTangentAt(t, tg); const r = 0.016 + 0.024 * t; return pt.clone().add(V(side * r, 0, 0)).add(V(0, 0, out * r)); };
  for (const t of [0.14, 0.24, 0.34, 0.5, 0.6, 0.7]) {                       // finger keys with pearl touches (front of the body)
    const at = along(t, 0, 1.05), cup = M(new THREE.CylinderGeometry(0.011, 0.011, 0.006, 16), brass); cup.position.copy(at); cup.rotation.x = Math.PI / 2; g.add(cup);
    const pr = M(new THREE.CylinderGeometry(0.0075, 0.0075, 0.004, 14), pearl); pr.position.copy(at).add(V(0, 0, 0.005)); pr.rotation.x = Math.PI / 2; g.add(pr);
  }
  for (let i = 0; i < 9; i++) {                                               // big tone-hole cups on the right side
    const t = 0.08 + i * 0.105, at = along(Math.min(0.97, t), -1.02, 0.15), r = 0.012 + 0.012 * t;
    const cup = M(new THREE.CylinderGeometry(r, r, 0.007, 16), brass); cup.position.copy(at); cup.rotation.z = Math.PI / 2; g.add(cup);
  }
  const rodA = along(0.06, 0.75, 0.75), rodB = along(0.95, 0.75, 0.75);       // key rod
  const rod = M(new THREE.CylinderGeometry(0.0025, 0.0025, rodA.distanceTo(rodB), 6), brass); rod.position.copy(rodA).lerp(rodB, 0.5); rod.quaternion.setFromUnitVectors(V(0, 1, 0), rodB.clone().sub(rodA).normalize()); g.add(rod);
  const guard = taperTube([along(0.84, -0.4, 1.3), along(0.92, -0.6, 1.6), along(1, -0.4, 1.3)], 0.003, 0.003, brass, 8, 6); g.add(guard);   // low key guard
  // neck strap: from the hook on the back of the body, up around the back of his neck
  const hook = along(0.12, 0, -1.1);
  const strapM = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.8 });
  for (const sd of [1, -1]) g.add(taperTube([hook, V(0.045 * sd, 1.36, 0.15), V(0.075 * sd, 1.46, 0.05), V(0.06 * sd, 1.5, -0.04), V(0, 1.51, -0.075)], 0.005, 0.007, strapM, 24, 6));
  // where the hands go (torso space): left hand on the upper stack, right hand on the lower stack
  g.userData.handL = along(0.32, 0.9, 0.9); g.userData.handR = along(0.74, -0.9, 0.9);
  return g;
}
function micStand(h = 1.5) {
  const g = new THREE.Group();
  g.add(M(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 16), blackGloss(), 0, 0.01, 0));
  g.add(M(new THREE.CylinderGeometry(0.012, 0.012, h, 8), chrome(), 0, h / 2, 0));
  g.add(M(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.6, roughness: 0.5 }), 0, h + 0.03, 0.03));
  return g;
}

const BAND = {
  guitar: { spec: { height: 1.74, skin: '#c9946c', hair: '#120e0b', hairStyle: 'short', glasses: true, mustache: true, top: '#4a2c1e', shirt: '#f2efe9', tie: '#111111', pants: '#141414' } },
  sax: { spec: { height: 1.82, skin: '#f1c9aa', hair: '#4e321e', hairStyle: 'long', bangs: false, mustache: true, cap: '#151515', top: '#4a3026', shirt: '#f2efe9', pants: '#3e2820' } },
  keys: { spec: { build: 'heavy', height: 1.8, skin: '#5e3a28', hair: '#0f0c0a', hairStyle: 'buzz', beard: true, top: '#1b1b1b', pants: '#202020' } },
  drums: { spec: { build: 'slim', height: 1.8, skin: '#5a3626', hair: '#1a1410', hairStyle: 'beanie', hat: '#121212', top: '#121212', sleeves: 'short', pants: '#1a1a1a' } },
  bass: { spec: { build: 'heavy', height: 1.82, skin: '#4e2f20', hair: '#0e0b09', hairStyle: 'dreads', beard: true, top: '#151515', pants: '#141414' } },
};

const BPM = 81;   // "Them Changes"

// Two-bone arm solver: aims shoulder + elbow so the hand lands on a point (given in world space).
const _v = { s: new THREE.Vector3(), t: new THREE.Vector3(), d: new THREE.Vector3(), e: new THREE.Vector3(), p: new THREE.Vector3(), f: new THREE.Vector3() };
const DOWN = new THREE.Vector3(0, -1, 0), _q = new THREE.Quaternion(), _qi = new THREE.Quaternion();
export function reach(arm, elbow, targetWorld, pole) {
  const parent = arm.parent; parent.updateWorldMatrix(true, false);
  const s = _v.s.copy(arm.position), t = parent.worldToLocal(_v.t.copy(targetWorld));
  const a = 0.28, b = 0.3, d = _v.d.subVectors(t, s); let dist = d.length();
  dist = Math.min(dist, a + b - 0.002); d.normalize();
  const cosA = (a * a + dist * dist - b * b) / (2 * a * dist), A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const p = _v.p.copy(pole).addScaledVector(d, -pole.dot(d)).normalize();
  const e = _v.e.copy(s).addScaledVector(d, a * Math.cos(A)).addScaledVector(p, a * Math.sin(A));
  arm.quaternion.setFromUnitVectors(DOWN, _v.f.subVectors(e, s).normalize());
  const hand = _v.f.copy(s).addScaledVector(d, dist);
  const fore = hand.sub(e).normalize().applyQuaternion(_qi.copy(arm.quaternion).invert());
  elbow.quaternion.setFromUnitVectors(DOWN, fore);
}
export function makeBandMember(role) {
  const p = buildPerson({ shoes: '#0c0c0c', ...BAND[role].spec });
  const P = p.P, rig = new THREE.Group(); rig.add(p.root);
  const seated = role === 'drums' || role === 'bass';
  const anchors = {}; let inst = null;
  const A = (parent, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };
  if (role === 'guitar' || role === 'bass') {
    inst = role === 'guitar' ? guitarBody('#2fb3b0', 0.48, { neck: '#d9b46e', guard: '#f4f1ea' }) : guitarBody('#efeae0', 0.66, { neck: '#d9b46e', guard: '#111111' });
    if (role === 'guitar') { inst.position.set(-0.03, 1.06, 0.17); inst.rotation.set(0.12, 0.18, -1.12); }
    else { inst.position.set(-0.04, 1.0, 0.2); inst.rotation.set(0.22, 0.12, -1.18); }
    P.upper.add(inst);
    // strap over the left shoulder
    const strap = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.17, 0.98, 0.13), new THREE.Vector3(-0.12, 1.25, -0.11), new THREE.Vector3(0.12, 1.46, -0.04), new THREE.Vector3(0.2, 1.38, 0.1)]);
    P.upper.add(new THREE.Mesh(new THREE.TubeGeometry(strap, 20, 0.012, 5), new THREE.MeshStandardMaterial({ color: role === 'bass' ? '#d99a2a' : '#1a1a1a', roughness: 0.8 })));
    anchors.L = inst.userData.fret; anchors.R = inst.userData.strum;
  } else if (role === 'keys') {
    inst = keyboard(); inst.position.set(0, 0, 0.48); rig.add(inst);
    anchors.L = A(inst, 0.2, 0.935, 0.05); anchors.R = A(inst, -0.2, 0.935, 0.05);
  } else if (role === 'drums') {
    inst = drumKit(); inst.position.set(0, 0, 0.42); rig.add(inst);
    anchors.L = A(inst, 0.1, 0.84, -0.12); anchors.R = A(inst, -0.25, 0.9, -0.05);
    // sticks live in the band rig and are aimed every frame from the hand to the drum they're hitting
    const stickM = new THREE.MeshStandardMaterial({ color: '#e2c89a', roughness: 0.55 });
    const stickG = new THREE.CylinderGeometry(0.0055, 0.0085, 1, 8).translate(0, 0.5, 0);    // butt at 0, tip at 1
    anchors.sticks = [new THREE.Mesh(stickG, stickM), new THREE.Mesh(stickG, stickM)];
    for (const st of anchors.sticks) { st.add(M(new THREE.SphereGeometry(0.009, 8, 6), stickM, 0, 1, 0)); rig.add(st); }
    // where each stick lands, in the kit's own space
    anchors.hits = { snare: new THREE.Vector3(0.05, 0.7, 0.13), hat: new THREE.Vector3(0.38, 0.87, 0.06), ride: new THREE.Vector3(-0.3, 1.1, 0.36), floor: new THREE.Vector3(-0.36, 0.64, 0.1) };
  } else if (role === 'sax') {
    inst = sax(); P.upper.add(inst);                              // built at real size in his torso space: mouthpiece at his lips, hanging straight down his front
    const hl = inst.userData.handL, hr = inst.userData.handR;
    anchors.L = A(inst, hl.x + 0.012, hl.y, hl.z + 0.02); anchors.R = A(inst, hr.x - 0.012, hr.y, hr.z + 0.02);
  }
  if (role === 'bass') {     // sitting on his bass amp
    const amp = new THREE.Group(); amp.position.set(0, 0, -0.08);
    amp.add(M(new THREE.BoxGeometry(0.62, 0.56, 0.46), new THREE.MeshStandardMaterial({ color: '#161616', roughness: 0.7 }), 0, 0.28, 0));
    amp.add(M(new THREE.PlaneGeometry(0.52, 0.42), new THREE.MeshStandardMaterial({ color: '#2e2a28', roughness: 1 }), 0, 0.27, 0.232));
    amp.add(M(new THREE.BoxGeometry(0.4, 0.035, 0.02), new THREE.MeshStandardMaterial({ color: '#c9c9c9', metalness: 0.8, roughness: 0.3 }), 0, 0.5, 0.235));
    rig.add(amp);
  }
  // where each elbow should point (in the torso's space)
  const poles = {
    guitar: [new THREE.Vector3(0.2, -1, -0.3), new THREE.Vector3(-0.7, -0.7, -0.4)],
    bass: [new THREE.Vector3(0.2, -1, -0.3), new THREE.Vector3(-0.7, -0.7, -0.4)],
    keys: [new THREE.Vector3(0.8, -1, -0.5), new THREE.Vector3(-0.8, -1, -0.5)],
    drums: [new THREE.Vector3(0.9, -0.6, -0.6), new THREE.Vector3(-0.9, -0.6, -0.6)],
    sax: [new THREE.Vector3(0.9, -1, 0.1), new THREE.Vector3(-0.9, -1, 0.1)],
  }[role];
  const seatH = role === 'bass' ? 0.58 : 0.54;
  const sit = () => { p.root.position.y = seatH - 0.92 * p.root.scale.y; P.legL.rotation.x = P.legR.rotation.x = -1.45; P.kneeL.rotation.x = P.kneeR.rotation.x = 1.45; };
  if (seated) sit();
  const offset = Math.random() * 6, tw = new THREE.Vector3(), base = {};
  for (const k of ['L', 'R']) base[k] = anchors[k].position.clone();
  return {
    root: rig, head: p.head, anchors, P, inst,
    update(dt, t) {
      const beat = t * Math.PI * 2 * BPM / 60, b = Math.sin(beat), half = Math.sin(beat / 2), sway = Math.sin(beat / 4 + offset);
      // body groove
      P.sway.rotation.set(0, sway * 0.07, half * 0.05);
      P.neck.rotation.set(Math.max(0, b) * 0.13 - 0.02, sway * 0.1, 0);
      if (seated) { sit(); p.root.position.y += Math.max(0, b) * 0.015; P.kneeL.rotation.x = 1.45 + Math.max(0, b) * 0.15; }
      else {
        p.root.position.y = Math.abs(b) * 0.025;
        P.legL.rotation.x = -Math.max(0, b) * 0.08; P.kneeL.rotation.x = Math.max(0, b) * 0.16;
        P.legR.rotation.x = -Math.max(0, -b) * 0.08; P.kneeR.rotation.x = Math.max(0, -b) * 0.16;
      }
      // hands follow the music
      const L = anchors.L.position.copy(base.L), R = anchors.R.position.copy(base.R);
      if (role === 'guitar') {
        R.y += Math.sin(beat * 2) * 0.055; R.z += Math.abs(Math.sin(beat * 2)) * 0.015;               // strumming 8ths
        L.y += [0, -0.07, 0.05, -0.03][Math.floor(t * BPM / 60 / 2) % 4];                              // chord changes up the neck
        P.neck.rotation.y += 0.3; P.neck.rotation.x += 0.18;                                            // watching his hands
      } else if (role === 'bass') {
        R.y += Math.sin(beat) * 0.02; R.x += Math.max(0, Math.sin(beat * 2)) * 0.02;                  // plucking
        L.y += [0, -0.1, -0.05, 0.04][Math.floor(t * BPM / 60) % 4];
        P.sway.rotation.x = 0.12; P.neck.rotation.y += 0.2;
      } else if (role === 'keys') {
        L.x += Math.sin(beat / 2) * 0.06; L.y += Math.max(0, Math.sin(beat)) * 0.025;
        R.x += Math.sin(beat * 0.75 + 1) * 0.1; R.y += Math.max(0, Math.sin(beat * 2 + 0.7)) * 0.02;
        P.sway.rotation.x = 0.16; P.neck.rotation.x += 0.15;
      } else if (role === 'drums') {
        // groove: right hand rides 8ths (ride cymbal, floor tom on fills), left hand backbeat on the snare (+ hi-hat between)
        const beats = t * BPM / 60, bar = Math.floor(beats / 4), e8 = (beats * 2) % 1, q = beats % 2;
        const fill = bar % 4 === 3 && beats % 4 > 3;
        const rTarget = fill ? anchors.hits.floor : anchors.hits.ride, lTarget = q > 0.5 && q < 1.5 ? anchors.hits.snare : anchors.hits.hat;
        const rLift = 0.13 * Math.sin(Math.PI * e8), lLift = (lTarget === anchors.hits.snare ? 0.2 : 0.08) * Math.sin(Math.PI * ((beats + 0.5) % 1));
        const place = (anchor, hit, lift, side) => anchor.position.set(hit.x - side * 0.06, hit.y + 0.12 + lift * 0.6, hit.z - 0.3);
        place(anchors.L, lTarget, lLift, 1); place(anchors.R, rTarget, rLift, -1);
        P.sway.rotation.x = 0.12; P.sway.rotation.y = fill ? -0.15 : 0;
        inst.userData.hat.rotation.z = lTarget === anchors.hits.hat ? Math.sin(Math.PI * ((beats + 0.5) % 1)) * 0.05 : 0;
        anchors._tips = [[lTarget, lLift], [rTarget, rLift]];
      } else if (role === 'sax') {
        L.y += Math.sin(beat * 3) * 0.006; R.y += Math.cos(beat * 2.5) * 0.008;                        // fingers working the keys
        P.sway.rotation.x = -0.08 + Math.sin(beat / 2) * 0.09;                                         // leaning into the phrase
        P.neck.rotation.x = 0.05; P.neck.rotation.y = 0;
      }
      rig.updateWorldMatrix(true, true);
      reach(P.armL, P.elbowL, anchors.L.getWorldPosition(tw), poles[0]);
      reach(P.armR, P.elbowR, anchors.R.getWorldPosition(tw), poles[1]);
      if (anchors.sticks) {                     // aim each stick from the hand to its drum, tip lifting between hits
        rig.updateWorldMatrix(true, true);
        [P.handL, P.handR].forEach((hand, i) => {
          const st = anchors.sticks[i], [hit, lift] = anchors._tips[i];
          const h = rig.worldToLocal(hand.getWorldPosition(new THREE.Vector3()));
          const tip = rig.worldToLocal(inst.localToWorld(hit.clone().add(new THREE.Vector3(0, lift * 0.9 + 0.015, 0))));
          const dir = tip.clone().sub(h), len = dir.length() + 0.06; dir.normalize();
          st.position.copy(h).addScaledVector(dir, -0.06); st.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); st.scale.set(1, len, 1);
        });
      }
    },
  };
}

export function makeBartender(variant = 0) {
  const p = buildPerson(variant
    ? { build: 'f', height: 1.68, skin: '#c99272', hair: '#2a1a12', hairStyle: 'bun', top: '#0f0f0f', pants: '#151515', shoes: '#0c0c0c', blush: true }
    : { height: 1.8, skin: '#ebbd9f', hair: '#3a2b20', hairStyle: 'short', top: '#0c0c0d', pants: '#151515', shoes: '#0c0c0c' });   // Danny: clean-shaven, short dark hair, black tee
  if (!variant) {        // Danny's dark grey bib apron over the black shirt
    const ap = new THREE.MeshToonMaterial({ color: '#3d3e42', gradientMap, side: THREE.DoubleSide });
    const bib = M(new THREE.LatheGeometry([[0.168, 0.99], [0.16, 1.1], [0.176, 1.24], [0.192, 1.35]].map(([r, y]) => new THREE.Vector2(r, y)), 20, -0.62, 1.24), ap); bib.scale.z = 0.74; p.P.upper.add(bib);
    const skirt = M(new THREE.CylinderGeometry(0.172, 0.2, 0.46, 20, 1, true, -1.0, 2.0), ap, 0, 0.77, 0); skirt.scale.z = 0.78; p.P.upper.add(skirt);
    const tie = M(new THREE.TorusGeometry(0.166, 0.008, 5, 32), ap, 0, 0.985, 0); tie.rotation.x = Math.PI / 2; tie.scale.y = 0.74; p.P.upper.add(tie);   // waist ties wrapping round the back
    for (const sd of [1, -1]) { const st = M(new THREE.BoxGeometry(0.02, 0.16, 0.006), ap, 0.075 * sd, 1.42, 0.085); st.rotation.z = -0.35 * sd; st.rotation.x = -0.5; p.P.upper.add(st); }   // neck strap
  }
  const shaker = M(new THREE.CylinderGeometry(0.035, 0.03, 0.18, 14), chrome(), 0, -0.34, 0.02);
  p.P.elbowR.add(shaker);
  return {
    root: p.root, head: p.head,
    update(dt, t) {
      const s = (t % 6) < 2.2;
      p.P.armR.rotation.set(s ? -1.9 + Math.sin(t * 22) * 0.25 : -0.5, 0, -0.2);
      p.P.armL.rotation.set(s ? -1.7 + Math.sin(t * 22) * 0.25 : -0.35, 0, 0.25);
      p.P.elbowR.rotation.x = s ? -1.3 : -0.9; p.P.elbowL.rotation.x = s ? -1.4 : -0.8;
      p.P.neck.rotation.y = Math.sin(t * 0.4) * 0.4;
    },
  };
}

// ── Tyler the photographer: point-and-shoot flash camera ──
const _camR = new THREE.Vector3(), _camL = new THREE.Vector3(), _poleR = new THREE.Vector3(-1, -1, -0.3), _poleL = new THREE.Vector3(1, -1, -0.3);
export function makePhotographer(spec = {}) {
  const p = buildPerson({ height: 1.8, skin: '#efc4a6', hair: '#3e2a1c', hairStyle: 'cap', capColor: '#4b4f58', hair: '#4a3020', beard: true, mustache: true, noseRing: true, handTattoos: true,
    top: '#22325e', shirt: '#b9c2d2', openJacket: true, pants: '#2a3242', shoes: '#141414', ...spec });
  const P = p.P;
  // the camera: small black body, silver lens, flash window
  const cam = new THREE.Group();
  cam.add(M(new THREE.BoxGeometry(0.11, 0.065, 0.04), toon('#8a8d93')));   // grey point-and-shoot
  const lens = M(new THREE.CylinderGeometry(0.019, 0.022, 0.03, 16), new THREE.MeshStandardMaterial({ color: '#bbbbbb', metalness: 0.9, roughness: 0.3 }), -0.015, 0, 0.03); lens.rotation.x = Math.PI / 2; cam.add(lens);
  const flashWin = M(new THREE.PlaneGeometry(0.03, 0.014), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1) }), 0.035, 0.02, 0.021); cam.add(flashWin);
  const strap = M(new THREE.TorusGeometry(0.03, 0.004, 4, 12), toon('#222'), 0.055, 0, 0); cam.add(strap);
  P.handR.add(cam); cam.position.set(0, -0.03, 0.05);
  const flash = new THREE.PointLight('#ffffff', 0, 6, 1.6); cam.add(flash); flash.position.set(0.035, 0.02, 0.08);
  let flashT = 0, phase = 0;
  return {
    root: p.root, head: p.head, P, cam, eye: p.eye,
    // mode: 'walk' (speed>0), 'idle', 'shoot' (camera up at the face)
    update(dt, speed, t, mode) {
      phase += dt * (speed > 0.05 ? 2.4 * speed + 2 : 0);
      const k = Math.min(1, speed / 2);
      P.body.position.y = Math.abs(Math.sin(phase)) * 0.03 * k;
      P.legL.rotation.x = Math.sin(phase) * 0.55 * k; P.legR.rotation.x = -Math.sin(phase) * 0.55 * k;
      P.sway.rotation.set(0, 0, 0); P.neck.rotation.set(0, 0, 0);
      if (mode === 'shoot') {               // camera held up in front of his eye, a hand gripping each end
        P.neck.rotation.x = 0.06;
        if (cam.parent !== P.body) { P.body.add(cam); cam.position.set(-0.03, 1.6, 0.25); }
        cam.quaternion.identity(); cam.rotateX(-0.08);
        P.body.updateWorldMatrix(true, true);
        reach(P.armR, P.elbowR, P.body.localToWorld(_camR.set(-0.1, 1.585, 0.235)), _poleR);
        reach(P.armL, P.elbowL, P.body.localToWorld(_camL.set(0.04, 1.585, 0.235)), _poleL);
      } else {
        if (cam.parent !== P.handR) { P.handR.add(cam); cam.position.set(0, -0.03, 0.05); }                              // camera down at his side, arms swinging
        P.armR.rotation.set(Math.sin(phase) * 0.35 * k - 0.15, 0, -0.08); P.elbowR.rotation.set(-0.5, 0, 0);
        P.armL.rotation.set(-Math.sin(phase) * 0.35 * k, 0, 0.08); P.elbowL.rotation.set(-0.2, 0, 0);
      }
      // keep the lens pointing the way Tyler faces, whatever his arms are doing
      if (mode !== 'shoot') {
        p.root.updateWorldMatrix(true, true);
        const qParent = new THREE.Quaternion(), qRoot = new THREE.Quaternion();
        cam.parent.getWorldQuaternion(qParent); p.root.getWorldQuaternion(qRoot);
        cam.quaternion.copy(qParent.invert().multiply(qRoot));
      }
      flashT = Math.max(0, flashT - dt);
      flash.intensity = flashT > 0 ? 60 * (flashT / 0.12) : 0;
      flashWin.material.color.setScalar(flashT > 0 ? 6 : 1);
    },
    fire() { flashT = 0.12; },
  };
}
