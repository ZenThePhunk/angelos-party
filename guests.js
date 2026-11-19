// ─────────────────────────────────────────────────────────────
// Party guests around the room (built from Austin's photos).
// placeGuests(ctx) is called once from main.js; return a function
// that main.js calls every frame as tick(dt, t).
//   ctx = { scene, W, FT, VENUE, labelSprite }
//   W.colliders.push({ circle: [xMeters, zMeters], r: 0.32 }) so you can't walk through people
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { buildPerson, toon, reach, animator } from './characters.js';
import { paint } from './textures.js';
import { makeSunny } from './sunny.js';

const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const lathe = (pts, seg = 32, phi0 = 0, phiLen = Math.PI * 2) =>
  new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg, phi0, phiLen);

// smooth 0→1 easing, and a 0→1 ramp between times a and b of the loop
const sstep = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const ph = (s, a, b) => sstep((s - a) / (b - a));
const silverMat = () => new THREE.MeshStandardMaterial({ color: '#cfcfd4', metalness: 0.9, roughness: 0.3 });

function jacketShell(pts, color) {
  const m = toon(color); m.side = THREE.DoubleSide;
  const j = mesh(lathe(pts, 28, 0.5, Math.PI * 2 - 1.0), m); j.scale.z = 0.8; return j;
}
const BLAZER_PTS = [[0.07, 1.48], [0.14, 1.46], [0.205, 1.38], [0.198, 1.2], [0.19, 1.05], [0.2, 0.9], [0.205, 0.8]];

function cowboyHat(color, bandColor, y) {
  const hat = new THREE.Group(); hat.position.set(0, y, 0.004);
  const hm = toon(color); hm.side = THREE.DoubleSide;
  hat.add(mesh(lathe([[0.15, 0.0], [0.2, 0.002], [0.26, 0.02], [0.295, 0.06], [0.29, 0.068], [0.255, 0.034], [0.2, 0.012], [0.15, 0.012]], 36), hm));
  hat.add(mesh(lathe([[0.152, 0.0], [0.15, 0.06], [0.14, 0.11], [0.125, 0.135], [0.1, 0.14], [0.06, 0.128], [0.0001, 0.12]], 28), hm));
  hat.add(mesh(new THREE.CylinderGeometry(0.153, 0.155, 0.014, 28, 1, true), new THREE.MeshToonMaterial({ color: bandColor, side: THREE.DoubleSide }), 0, 0.02, 0));
  return hat;
}

function makeFranklin() {
  const p = buildPerson({ height: 1.8, skin: '#e0b08e', hair: '#2a1d15', hairStyle: 'swept', mustache: true, shortBeard: true, beardColor: '#34302d',
    top: '#0c0c0d', pants: '#17171a', shoes: '#0b0b0b' });
  p.P.upper.add(jacketShell(BLAZER_PTS, '#101013'));
  for (const s of [1, -1]) { const l = mesh(new THREE.BoxGeometry(0.03, 0.3, 0.01), toon('#07070a'), 0.075 * s, 1.27, 0.15); l.rotation.z = -0.22 * s; l.rotation.y = 0.5 * s; p.P.upper.add(l); }
  const cuff = mesh(new THREE.CylinderGeometry(0.052, 0.05, 0.03, 14, 1, true), new THREE.MeshToonMaterial({ color: '#f4f2ec', side: THREE.DoubleSide }), 0, -0.262, 0);
  p.P.elbowL.add(cuff);
  return p;
}
function makeMichael() {
  const p = buildPerson({ height: 1.83, skin: '#d4a07a', hair: '#2b211b', hairStyle: 'long', bangs: false, stubble: true, beardColor: '#3b332d',
    top: '#101011', openCollar: true, pants: '#121214', shoes: '#0d0d0d', blush: false });   // regular (broader) build, long dark-brown hair, stubble
  { // loose black button-down worn untucked: the shirt tail hangs over the hips
    const tail = mesh(new THREE.CylinderGeometry(0.168, 0.182, 0.24, 24, 1, true), new THREE.MeshToonMaterial({ color: '#101011', side: THREE.DoubleSide }), 0, 0.86, 0); tail.scale.z = 0.76; p.P.upper.add(tail);
    for (const y of [0.8, 0.9]) p.P.upper.add(mesh(new THREE.SphereGeometry(0.007, 6, 4), toon('#2a2a2c'), 0, y, 0.182 * 0.76 + 0.003)); }
  const sv = silverMat();
  for (let i = 0; i < 3; i++) { const b = mesh(new THREE.TorusGeometry(0.047, 0.004, 6, 18), sv, 0, -0.245 - i * 0.012, 0); b.rotation.x = Math.PI / 2; p.P.elbowR.add(b); }   // silver bangles, right wrist
  const bead = mesh(new THREE.TorusGeometry(0.047, 0.006, 6, 18), toon('#6b4a2b'), 0, -0.25, 0); bead.rotation.x = Math.PI / 2; p.P.elbowL.add(bead);                        // beaded bracelet, left wrist
  const ring = mesh(new THREE.TorusGeometry(0.012, 0.003, 5, 10), sv, 0.02, -0.34, 0.01); p.P.elbowL.add(ring);
  return p;
}
function makeKyp() {
  const p = buildPerson({ height: 1.88, skin: '#dcae8a', hair: '#9b9a98', hairStyle: 'short', stubble: true, beardColor: '#8f8e8c',
    top: '#1b1814', pants: '#1c1c20', shoes: '#0b0b0b', shoeStyle: 'boots' });
  p.P.upper.add(jacketShell(BLAZER_PTS.map(([r, y]) => [r, y - 0.03 * (y < 1 ? 1 : 0)]), '#1d1a15'));
  const yoke = toon('#2e2923');
  for (const s of [1, -1]) { const y = mesh(new THREE.BoxGeometry(0.15, 0.012, 0.006), yoke, 0.062 * s, 1.27, -0.163); y.rotation.z = -0.5 * s; y.rotation.y = 0.45 * s; p.P.upper.add(y); }   // pointed western yoke
  p.P.head.add(cowboyHat('#0a0a0a', '#5a3a22', 1.635 + 0.095));
  return p;
}

function makeCardTrick(ctx) {
  const { scene, W, FT } = ctx;
  const Cx = 49 * FT, Cz = 34 * FT, D = 0.45;   // standing in the open between the pool table and the food table, no table
  const ppl = [];
  const fr = makeFranklin(), mi = makeMichael(), ky = makeKyp();
  // Franklin on the west side, facing the table; Michael and Kyp side by side on the east side
  const F = new THREE.Group(); F.position.set(Cx - D, 0, Cz); F.rotation.y = Math.PI / 2; scene.add(F);
  F.add(fr.root);
  const place = (g, x, z) => { g.root.position.set(x, 0, z); g.root.rotation.y = Math.atan2(Cx - x, Cz - z); scene.add(g.root); };
  const mx = Cx + 0.45, mz = Cz - 0.32, kx = Cx + 0.45, kz = Cz + 0.32;   // Michael and Kyp side by side, facing Franklin
  place(mi, mx, mz); place(ky, kx, kz); ky.root.scale.setScalar(1.88 / 1.8);
  for (const [n, x, z, g] of [['Franklin the Magician', Cx - D, Cz, fr], ['Michael', mx, mz, mi], ['Kyp', kx, kz, ky]]) {
    W.colliders.push({ circle: [x, z], r: 0.32 });
    if (n === 'Michael' || n === 'Kyp') continue;   // no name tags for Michael and Kyp
    const tag = ctx.labelSprite(n, { size: 70, w: n.length > 12 ? 860 : 512 }); if (tag) { tag.position.set(x, n === 'Kyp' ? 2.48 : 2.2, z); scene.add(tag); }   // Kyp's tag sits higher so it doesn't overlap Michael's
  }

  // cards (in Franklin's frame F: +z = toward the table centre, +x = his left)
  const white = toon('#f4f1ea'), red = toon('#c01c28'), blk = toon('#15151a');
  const cardGeo = new THREE.BoxGeometry(0.057, 0.089, 0.0015);
  const card = (red2) => { const c = new THREE.Group(); c.add(mesh(cardGeo, white)); c.add(mesh(new THREE.BoxGeometry(0.02, 0.026, 0.002), red2 ? red : blk)); return c; };
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.063, 0.018, 0.09), white); F.add(deck);
  deck.add(mesh(new THREE.BoxGeometry(0.0635, 0.004, 0.0905), blk, 0, 0.004, 0));
  const held = card(true); F.add(held);
  const fan = new THREE.Group(); F.add(fan);
  const fanCards = []; for (let i = 0; i < 6; i++) { const c = mesh(cardGeo, white, 0, 0.045, 0); const piv = new THREE.Group(); piv.add(c); fan.add(piv); fanCards.push(piv); }

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const L0 = V(0.13, 1.1, 0.36);                                      // left hand holds the deck
  const R = [[0, V(-0.14, 1.1, 0.4)], [0.9, V(0.1, 1.13, 0.4)], [1.1, V(0.1, 1.1, 0.4)], [1.3, V(0.1, 1.13, 0.4)], [1.8, V(0.0, 1.2, 0.4)], [2.6, V(0.03, 1.28, 0.44)],
    [3.3, V(-0.1, 1.28, 0.42)], [4.0, V(-0.1, 1.4, 0.46)], [4.6, V(-0.1, 1.4, 0.46)], [4.8, V(-0.17, 1.44, 0.46)], [5.0, V(-0.02, 1.43, 0.46)], [5.2, V(-0.1, 1.39, 0.46)],
    [5.65, V(-0.03, 1.32, 0.5)], [5.95, V(-0.05, 1.35, 0.52)], [6.8, V(-0.14, 1.1, 0.4)], [7.2, V(-0.14, 1.1, 0.4)]];   // 5.65–5.95: holds the revealed card out to them
  const path = (s) => { for (let i = 1; i < R.length; i++) if (s <= R[i][0]) { const a = R[i - 1], b = R[i]; return new THREE.Vector3().lerpVectors(a[1], b[1], sstep((s - a[0]) / (b[0] - a[0]))); } return R[R.length - 1][1]; };
  const T = 7.2, tmp = new THREE.Vector3();
  const wp = (g, v) => g.localToWorld(tmp.copy(v));
  const crossL = V(-0.15, 1.21, 0.17), crossR = V(0.15, 1.12, 0.2);

  ppl.push({
    update(dt, t) {
      const s = t % T;
      // Franklin: hands on the cards
      const rt = path(s), lt = L0.clone(); lt.y += (s > 0.9 && s < 1.5 ? -Math.abs(Math.sin((s - 0.9) * 10)) * 0.01 : 0);
      F.updateMatrixWorld(true);
      const Pf = fr.P;
      Pf.neck.rotation.set(0.22 + ph(s, 5.1, 6.0) * -0.2 + ph(s, 6.4, 7.0) * 0.2, ph(s, 3.2, 4.2) * 0.12 * (s < 5 ? 1 : 0), 0);
      reach(Pf.armR, Pf.elbowR, wp(F, rt), V(-0.5, -1, -0.3)); reach(Pf.armL, Pf.elbowL, wp(F, lt), V(0.5, -1, -0.3));
      deck.position.set(lt.x, lt.y + 0.04, lt.z); deck.rotation.y = 0;
      const fanAmt = ph(s, 1.8, 2.6) * (1 - ph(s, 2.9, 3.4));
      fan.visible = fanAmt > 0.02; fan.position.set(rt.x, rt.y + 0.02, rt.z); fanCards.forEach((c, i) => c.rotation.z = (i - 2.5) * 0.28 * fanAmt);
      const holdAmt = ph(s, 3.4, 3.9) * (1 - ph(s, 6.4, 6.7));
      held.visible = holdAmt > 0.01; held.position.set(rt.x, rt.y + 0.06, rt.z + 0.02); held.scale.setScalar(1 + ph(s, 5.6, 5.8) * (1 - ph(s, 5.8, 6.1)) * 0.25);
      held.rotation.set(0, ph(s, 5.2, 5.6) * Math.PI, Math.sin(s * 6) * 0.05 * ph(s, 4.6, 5.0));   // turns the card around to show them
      // Michael: leans in, then laughs and gestures at the reveal
      const lean = ph(s, 2.8, 3.8) * (1 - ph(s, 5.2, 5.8)), laugh = ph(s, 5.3, 5.8) * (1 - ph(s, 6.8, 7.2));
      const Pm = mi.P, lb = Math.sin(t * 17) * 0.012 * laugh;
      Pm.sway.rotation.set(0.04 + lean * 0.16 - laugh * 0.1, 0, Math.sin(t * 1.0) * 0.012);
      Pm.neck.rotation.set(0.3 + lean * 0.08 - laugh * 0.35 + lb, 0, 0);
      Pm.body.position.y = Math.abs(Math.sin(t * 8)) * 0.012 * laugh;
      Pm.armL.rotation.set(-0.3 - lean * 0.2, 0, -0.06); Pm.elbowL.rotation.set(-0.9, 0, 0);
      Pm.armR.rotation.set(-0.3 - laugh * 0.8, 0, 0.06 + laugh * 0.55); Pm.elbowR.rotation.set(-0.9 - laugh * 0.2, 0, 0);
      // Kyp: arms folded, nods along, tips his hat at the reveal
      const Pk = ky.P;
      ky.root.updateMatrixWorld(true);
      Pk.sway.rotation.set(0.03 + lean * 0.06, 0, 0);
      Pk.neck.rotation.set(0.32 + lean * 0.06 + Math.max(0, Math.sin((s - 5.6) * 7)) * 0.12 * (s > 5.6 && s < 6.3 ? 1 : 0), 0, 0);
      reach(Pk.armL, Pk.elbowL, wp(ky.root, V(-0.12, 1.21, 0.19)), V(0.4, -1, 0.5));
      reach(Pk.armR, Pk.elbowR, wp(ky.root, V(0.12, 1.12, 0.21)), V(-0.4, -1, 0.5));
    },
  });
  return ppl;
}


// ── Joyce, the wedding coordinator: long black hair, black midi dress with a sheer lace yoke and lace hem, drink in hand, by the welcome table ──
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
function makeJoyce(ctx) {
  const { scene, W, FT } = ctx;
  const skin = '#e6bc98';
  const p = buildPerson({ build: 'f', height: 1.62, skin, hair: '#0d0a09', hairStyle: 'long', bangs: false, blush: true,
    top: '#0b0b0d', sleeves: 'mesh', pants: skin, shoes: '#0c0c0c' });
  const P = p.P, blk = new THREE.MeshToonMaterial({ color: '#0b0b0d', side: THREE.DoubleSide });
  const lace = new THREE.MeshToonMaterial({ color: '#0b0b0d', transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide });
  // sheer lace yoke over the upper chest: skin underneath, black lace on top
  const yokePts = [[0.162, 1.31], [0.152, 1.38], [0.104, 1.45], [0.045, 1.47]];
  const yk = mesh(lathe(yokePts.map(([r, y]) => [r + 0.003, y]), 20, -0.95, 1.9), new THREE.MeshToonMaterial({ color: skin, side: THREE.DoubleSide })); yk.scale.z = 0.72; P.upper.add(yk);
  const yl = mesh(lathe(yokePts.map(([r, y]) => [r + 0.007, y]), 20, -0.95, 1.9), lace); yl.scale.z = 0.72; yl.renderOrder = 2; P.upper.add(yl);
  const collar = mesh(new THREE.TorusGeometry(0.05, 0.007, 5, 20), blk, 0, 1.475, 0); collar.rotation.x = Math.PI / 2; P.upper.add(collar);   // little high lace collar
  // skirt: solid black to just below the knee, then a sheer lace hem to mid-calf
  const sk = mesh(new THREE.CylinderGeometry(0.162, 0.2, 0.4, 24, 1, true), blk, 0, 0.765, 0); sk.scale.z = 0.8; P.upper.add(sk);
  const hem = mesh(new THREE.CylinderGeometry(0.2, 0.214, 0.3, 24, 1, true), lace, 0, 0.415, 0); hem.scale.z = 0.8; hem.renderOrder = 2; P.upper.add(hem);
  // small gold earrings
  const gold = new THREE.MeshStandardMaterial({ color: '#d8b25a', metalness: 1, roughness: 0.3 });
  for (const sd of [1, -1]) p.head.add(mesh(new THREE.SphereGeometry(0.009, 8, 6), gold, 0.104 * sd, 1.635 - 0.035, 0));
  // Joyce is working the room: straightening the welcome table and the dining tables.
  // When you walk up she stops, turns, waves and says "Welcome!"
  const stations = [
    { at: [85.5, 19.2], look: [84.0, 17.9], h: 1.08, d: 0.34 },     // welcome table: straightening the cards and flowers
    { at: [87.5, 28.3], look: [85.9, 28.3], h: 0.8, d: 0.4 },       // end of a dining table: fixing a place setting
    { at: [87.5, 35.5], look: [85.9, 35.5], h: 0.8, d: 0.4 },
  ].map((o) => ({ ...o, at: [o.at[0] * FT, o.at[1] * FT], yaw: Math.atan2((o.look[0] - o.at[0]), (o.look[1] - o.at[1])) }));
  const st = { x: stations[0].at[0], z: stations[0].at[1], yaw: stations[0].yaw, i: 0, mode: 'work', timer: 6, speed: 0, greetT: 0, greetedAt: -1 };
  p.root.position.set(st.x, 0, st.z); p.root.rotation.y = st.yaw; scene.add(p.root);
  const col = { circle: [st.x, st.z], r: 0.32 }; W.colliders.push(col);
  const tag = ctx.labelSprite('Joyce', { size: 70 }); if (tag) { tag.position.set(0, 2.02 * 1.8 / 1.62, 0); p.root.add(tag); }
  const hello = ctx.speechBubble ? ctx.speechBubble('Welcome!', { side: 'left' }) : null;
  if (hello) { const m = new THREE.Object3D(); m.position.set(0, 1.575, 0.135); p.head.add(m); hello.anchors = [m]; }
  const anim = animator(p), tgt = new THREE.Vector3(), poleR = new THREE.Vector3(-1, -0.5, -0.4), poleL = new THREE.Vector3(1, -0.5, -0.4);
  const turn = (want, k) => { st.yaw += Math.atan2(Math.sin(want - st.yaw), Math.cos(want - st.yaw)) * Math.min(1, k); };
  return { update(dt, t) {
    const P0 = ctx.player, live = ctx.isPlaying ? ctx.isPlaying() : true;
    const toP = P0 ? Math.hypot(P0.x - st.x, P0.z - st.z) : 99;
    if (live && st.mode !== 'greet' && toP < 3.4 && st.greetedAt < 0) { st.mode = 'greet'; st.greetT = 3.2; st.greetedAt = t; }   // greets you once, the first time you come close
    if (st.mode === 'greet') {               // turn to you, wave, "Welcome!"
      st.speed = 0; turn(Math.atan2(P0.x - st.x, P0.z - st.z), dt * 6); st.greetT -= dt;
      if (st.greetT <= 0) { st.mode = 'walk'; st.i = 1; }   // after welcoming you she heads over to fix up the dining tables
    } else if (st.mode === 'walk') {
      const [tx, tz] = stations[st.i].at, dx = tx - st.x, dz = tz - st.z, d = Math.hypot(dx, dz);
      if (d < 0.06) { st.mode = 'work'; st.timer = 6 + Math.random() * 5; st.speed = 0; }
      else { turn(Math.atan2(dx, dz), dt * 5); const step = Math.min(d, 0.85 * dt); st.x += dx / d * step; st.z += dz / d * step; st.speed = step / Math.max(dt, 1e-4); }
    } else {                                 // working at a station
      st.speed = 0; turn(stations[st.i].yaw, dt * 4); st.timer -= dt;
      if (st.timer <= 0) { st.i = (st.i + 1 + Math.floor(Math.random() * 2)) % stations.length; st.mode = 'walk'; }
    }
    p.root.position.set(st.x, 0, st.z); p.root.rotation.y = st.yaw; col.circle[0] = st.x; col.circle[1] = st.z;
    anim(dt, st.speed, t, st.mode === 'greet' ? 'wave' : 'idle');
    if (hello) hello.visible = st.mode === 'greet';
    if (st.mode === 'work') {                // both hands busy at the station: small tidying moves
      const s0 = stations[st.i], k = p.root.scale.y || 1;
      p.root.updateWorldMatrix(true, true);
      const h = s0.h / k, dd = s0.d / k;
      const fx = Math.sin(t * 1.7) * 0.07, fy = Math.sin(t * 2.3) * 0.03;
      tgt.set(-0.12 + fx, h + fy, dd); p.root.localToWorld(tgt); reach(P.armR, P.elbowR, tgt, poleR);
      tgt.set(0.12 + fx * 0.6, h - fy, dd - 0.03); p.root.localToWorld(tgt); reach(P.armL, P.elbowL, tgt, poleL);
      P.sway.rotation.x = s0.h < 1 ? 0.28 : 0.05;     // leans over the low dining tables
      P.neck.rotation.x = s0.h < 1.2 ? 0.3 : 0.05;
    } else { P.sway.rotation.x = 0; P.neck.rotation.x = 0; }
  } };
}

// ── Emilio: open cream/burgundy plaid flannel over a black tee, dark rectangular glasses, kneeling to fix an uplight on the wall by the pool table ──
function makeEmilio(ctx) {
  const { scene, W, FT } = ctx;
  const plaid = paint(256, 256, (g, w, h) => {
    g.fillStyle = '#e4dcd6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 32) {
      g.fillStyle = 'rgba(110,22,30,.75)'; g.fillRect(i, 0, 10, h); g.fillRect(0, i, w, 10);
      g.fillStyle = 'rgba(20,14,16,.8)'; g.fillRect(i + 14, 0, 4, h); g.fillRect(0, i + 14, w, 4);
      g.fillStyle = 'rgba(110,22,30,.35)'; g.fillRect(i + 22, 0, 3, h); g.fillRect(0, i + 22, w, 3);
    }
  }, { repeat: true });
  plaid.repeat.set(3, 3);
  const p = buildPerson({ height: 1.78, skin: '#cf9a74', hair: '#17110e', hairStyle: 'short', stubble: true, beardColor: '#1c1512',
    topMap: plaid, openJacket: true, shirt: '#0d0d0f', shirtPlain: true, pants: '#2b2e36', shoes: '#111' });
  const P = p.P, HY = 1.635;
  // dark rectangular glasses
  const fr = toon('#0c0b0b');
  for (const sd of [1, -1]) {
    const cx = 0.047 * sd;
    for (const [w, h, x, y] of [[0.05, 0.006, 0, 0.016], [0.05, 0.006, 0, -0.016], [0.006, 0.036, -0.025, 0], [0.006, 0.036, 0.025, 0]])
      p.head.add(mesh(new THREE.BoxGeometry(w, h, 0.006), fr, cx + x, HY + 0.022 + y, 0.132));
    p.head.add(mesh(new THREE.BoxGeometry(0.005, 0.005, 0.12), fr, 0.075 * sd, HY + 0.03, 0.075));   // arms back to the ears
  }
  p.head.add(mesh(new THREE.BoxGeometry(0.022, 0.005, 0.005), fr, 0, HY + 0.028, 0.133));
  // ring on the left hand, handheld light meter (grey body, white dome) in the right
  P.handL.add(mesh(new THREE.TorusGeometry(0.01, 0.003, 5, 10), new THREE.MeshStandardMaterial({ color: '#9a9a9a', metalness: 1, roughness: 0.3 }), 0, -0.05, 0.01));
  const meter = new THREE.Group();
  meter.add(mesh(new THREE.BoxGeometry(0.05, 0.1, 0.025), toon('#3a3d42')));
  meter.add(mesh(new THREE.BoxGeometry(0.036, 0.03, 0.002), new THREE.MeshBasicMaterial({ color: '#9fd0a8' }), 0, 0.015, 0.0135));   // little lit screen
  meter.add(mesh(new THREE.SphereGeometry(0.019, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon('#f4f4f2'), 0, 0.05, 0));         // white dome on top
  P.handR.add(meter); meter.position.set(0, -0.07, 0.015); meter.scale.setScalar(1.3);
  // wanders a loop around the whole room (clear of tables and people), stopping now and then to take a reading
  const big = [[32, 14], [42, 16], [50, 13], [64, 12], [76, 15], [72, 22], [64, 25], [52, 26], [44, 27], [36, 22]].map(([x, z]) => [x * FT, z * FT]);
  const backArea = [[34, 13], [20, 12], [18, 20], [26, 22], [36, 22]].map(([x, z]) => [x * FT, z * FT]);   // the back of the room near the band, so he's not walking at you with Tyler
  let route = backArea, laps = 0;
  const st = { x: route[0][0], z: route[0][1], yaw: -Math.PI / 2, i: 1, wait: 2, speed: 0, look: 0 };
  p.root.position.set(st.x, 0, st.z); scene.add(p.root);
  const col = { circle: [st.x, st.z], r: 0.32 }; W.colliders.push(col);
  const tag = ctx.labelSprite('Emilio', { size: 70 }); if (tag) { tag.position.set(0, 2.2, 0); p.root.add(tag); }
  const anim = animator(p), tgt = new THREE.Vector3(), pole = new THREE.Vector3(-1, -0.4, -0.6);
  const turn = (want, k) => { st.yaw += Math.atan2(Math.sin(want - st.yaw), Math.cos(want - st.yaw)) * Math.min(1, k); };
  return { update(dt, t) {
    let metering = false;
    if (st.wait > 0) {                    // stopped: turns a little toward the light he's reading, meter up
      st.wait -= dt; st.speed = 0; metering = true; turn(st.look, dt * 3);
    } else {
      const [tx, tz] = route[st.i], dx = tx - st.x, dz = tz - st.z, d = Math.hypot(dx, dz);
      if (d < 0.08) {
        st.i = (st.i + 1) % route.length;
        if (st.i === 0 && route === backArea && ++laps >= 3) { route = big; st.i = 0; }   // after a few laps at the back, he works the whole room
        if (Math.random() < 0.65) { st.wait = 2.5 + Math.random() * 2; st.look = st.yaw + (Math.random() - 0.5) * 2.4; }
      } else {
        turn(Math.atan2(dx, dz), dt * 5);
        const step = Math.min(d, 0.7 * dt); st.x += dx / d * step; st.z += dz / d * step; st.speed = step / Math.max(dt, 1e-4);
      }
    }
    p.root.position.set(st.x, 0, st.z); p.root.rotation.y = st.yaw; col.circle[0] = st.x; col.circle[1] = st.z;
    anim(dt, st.speed, t, 'idle');
    // meter held up in front of him, dome toward the light; he glances down at the reading
    p.root.updateWorldMatrix(true, true);
    const up = metering ? 1.38 + Math.sin(t * 0.9) * 0.04 : 1.05;   // held up near eye level while reading
    tgt.set(-0.08, up, metering ? 0.36 : 0.28); p.root.localToWorld(tgt);
    reach(P.armR, P.elbowR, tgt, pole);
    // meter stands upright in his grip: dome on top toward the light, screen turned back toward him and tipped so he can read it
    p.root.updateWorldMatrix(true, true);
    P.handR.getWorldQuaternion(_qa); p.root.getWorldQuaternion(_qb);
    meter.quaternion.copy(_qa.invert().multiply(_qb)); meter.rotateY(Math.PI); meter.rotateX(metering ? -0.35 : -0.1);
    P.neck.rotation.x = metering ? 0.3 : 0.12; P.neck.rotation.y = metering ? -0.15 : 0;
  } };
}


// ── Ashleigh: long dark hair, no bangs, navy knit sweater thrown over her shoulders, strapless paisley bustier, wide black pants, scattered arm tattoos. Setting out and straightening the food. ──
function makeAshleigh(ctx) {
  const { scene, W, FT } = ctx;
  const skin = '#ecc3a3';
  const p = buildPerson({ build: 'f', height: 1.65, skin, hair: '#2a1d17', hairStyle: 'long', bangs: false, blush: true,
    top: skin, sleeves: 'none', armTattoos: 'sparse', pants: '#0d0c0e', pantsStyle: 'wide', shoes: '#0c0c0c' });
  const P = p.P;
  // strapless paisley bustier
  const paisley = paint(256, 256, (g, w, h) => {
    g.fillStyle = '#263547'; g.fillRect(0, 0, w, h);
    let seed = 3; const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 22; i++) {
      const x = r() * w, y = r() * h, k = 9 + r() * 12, a = r() * 6.3;
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = ['#7a5236', '#a5814f', '#3f5e6b', '#5b3a2a'][i % 4];
      g.beginPath(); g.moveTo(0, -k * 1.4); g.bezierCurveTo(k, -k * 0.6, k, k, 0, k); g.bezierCurveTo(-k, k, -k * 0.9, -k * 0.2, 0, -k * 1.4); g.fill();   // paisley teardrop
      g.strokeStyle = '#d8c08a'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, k * 0.15, k * 0.45, 0, 6.3); g.stroke();
      g.restore();
    }
    g.fillStyle = 'rgba(230,214,170,.7)'; for (let i = 0; i < 140; i++) g.fillRect(r() * w, r() * h, 2, 2);   // little gold flecks
  }, { repeat: true });
  paisley.repeat.set(3, 1);
  const bodicePts = [[0.157, 0.93], [0.161, 0.98], [0.132, 1.08], [0.147, 1.2], [0.166, 1.3], [0.162, 1.345], [0.14, 1.35]];
  const bodice = mesh(lathe(bodicePts), new THREE.MeshToonMaterial({ map: paisley, side: THREE.DoubleSide })); bodice.scale.z = 0.73; P.upper.add(bodice);
  // navy ribbed sweater thrown over the shoulders, sleeves hanging down the front
  const knit = paint(128, 128, (g, w, h) => { g.fillStyle = '#1f2550'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,35,.55)'; for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 3, h); }, { repeat: true });
  knit.repeat.set(6, 1);
  const kn = new THREE.MeshToonMaterial({ map: knit, side: THREE.DoubleSide });
  const roll = mesh(new THREE.TorusGeometry(0.165, 0.042, 10, 32), kn, 0, 1.43, -0.01); roll.rotation.x = Math.PI / 2; roll.scale.y = 0.78; P.upper.add(roll);   // bunched around the shoulders
  const back = mesh(lathe([[0.2, 1.44], [0.215, 1.36], [0.205, 1.24], [0.19, 1.16]], 24, Math.PI - 1.5, 3.0), kn); back.scale.z = 0.8; P.upper.add(back);   // body of the sweater hanging down her back
  for (const sd of [1, -1]) {             // the two sleeves draped down over the chest
    const a = new THREE.Vector3(0.12 * sd, 1.43, 0.08), b = new THREE.Vector3(0.05 * sd, 1.17, 0.14);
    const sl = mesh(new THREE.CylinderGeometry(0.034, 0.03, a.distanceTo(b), 12), kn); sl.position.copy(a).add(b).multiplyScalar(0.5);
    sl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.clone().sub(b).normalize()); P.upper.add(sl);
    const cuff = mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.04, 12), toon('#181d42'), b.x, b.y - 0.01, b.z); cuff.quaternion.copy(sl.quaternion); P.upper.add(cuff);
  }
  // black watch on the left wrist, little silver hoops
  const wb = mesh(new THREE.TorusGeometry(0.037, 0.008, 6, 16), toon('#111'), 0, -0.25, 0); wb.rotation.x = Math.PI / 2; P.elbowL.add(wb);
  const sv = silverMat();
  for (const sd of [1, -1]) { const h = mesh(new THREE.TorusGeometry(0.012, 0.0025, 5, 12), sv, 0.106 * sd, 1.635 - 0.045, 0.005); h.rotation.y = Math.PI / 2; p.head.add(h); }
  // working along the far side of the food table: straightening trays, setting things out
  const stations = [[60.9, 32.6], [60.9, 35.0], [60.9, 37.3]].map(([x, z]) => ({ at: [x * FT, z * FT], yaw: -Math.PI / 2 }));
  const st = { x: stations[1].at[0], z: stations[1].at[1], yaw: -Math.PI / 2, i: 1, mode: 'work', timer: 5, speed: 0, far: 0 };
  p.root.position.set(st.x, 0, st.z); p.root.rotation.y = st.yaw; scene.add(p.root);
  const col = { circle: [st.x, st.z], r: 0.32 }; W.colliders.push(col);
  const tag = ctx.labelSprite('Ashleigh', { size: 70 }); if (tag) { tag.position.set(0, 2.02 * 1.8 / 1.65, 0); p.root.add(tag); }
  const hi = ctx.speechBubble ? ctx.speechBubble('Grab a Plate!', { side: 'left' }) : null;   // says it once, the first time you come up to the table
  if (hi) { const m = new THREE.Object3D(); m.position.set(0, 1.575, 0.135); p.head.add(m); hi.anchors = [m]; }
  const anim = animator(p), tgt = new THREE.Vector3(), poleR = new THREE.Vector3(-1, -0.5, -0.4), poleL = new THREE.Vector3(1, -0.5, -0.4);
  const turn = (want, k) => { st.yaw += Math.atan2(Math.sin(want - st.yaw), Math.cos(want - st.yaw)) * Math.min(1, k); };
  return { update(dt, t) {
    const P0 = ctx.player;
    if (hi) hi.visible = !!P0 && Math.hypot(P0.x - st.x, P0.z - st.z) < 3.2;
    if (st.mode === 'walk') {
      const [tx, tz] = stations[st.i].at, dx = tx - st.x, dz = tz - st.z, d = Math.hypot(dx, dz);
      if (d < 0.06) { st.mode = 'work'; st.timer = 5 + Math.random() * 5; st.speed = 0; st.far = Math.random() < 0.5 ? 1 : 0; }
      else { turn(Math.atan2(dx, dz), dt * 5); const step = Math.min(d, 0.7 * dt); st.x += dx / d * step; st.z += dz / d * step; st.speed = step / Math.max(dt, 1e-4); }
    } else {
      st.speed = 0; turn(stations[st.i].yaw, dt * 4); st.timer -= dt;
      if (st.timer <= 0) { st.i = (st.i + (Math.random() < 0.5 ? 1 : 2)) % stations.length; st.mode = 'walk'; }
    }
    p.root.position.set(st.x, 0, st.z); p.root.rotation.y = st.yaw; col.circle[0] = st.x; col.circle[1] = st.z;
    anim(dt, st.speed, t, 'idle');
    if (st.mode === 'work') {                 // both hands on the food: nudging trays into line, reaching across to set something down
      const k = p.root.scale.y || 1;
      p.root.updateWorldMatrix(true, true);
      const reachOut = st.far ? 0.5 + 0.08 * Math.max(0, Math.sin(t * 0.9)) : 0.4;
      const fx = Math.sin(t * 1.5) * 0.08, fy = Math.max(0, Math.sin(t * 2.1)) * 0.05;
      tgt.set(-0.13 + fx, (0.84 + fy) / k, reachOut / k); p.root.localToWorld(tgt); reach(P.armR, P.elbowR, tgt, poleR);
      tgt.set(0.13 + fx * 0.5, (0.84 + 0.05 - fy) / k, (reachOut - 0.04) / k); p.root.localToWorld(tgt); reach(P.armL, P.elbowL, tgt, poleL);
      P.sway.rotation.x = st.far ? 0.36 : 0.24;   // leaning over the table
      P.neck.rotation.x = 0.32;
    } else { P.sway.rotation.x = 0; P.neck.rotation.x = 0; }
  } };
}


export function placeGuests(ctx) {
  const { scene, W, FT } = ctx;
  const people = [];
  people.push(...makeCardTrick(ctx));
  people.push(makeJoyce(ctx));
  people.push(makeEmilio(ctx));
  people.push(makeAshleigh(ctx));
  people.push(makeSunny(ctx));

  return (dt, t) => { for (const p of people) p.update(dt, t); };
}
