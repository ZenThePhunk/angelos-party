// ─────────────────────────────────────────────────────────────
// Sunny, Austin & Bre's dog: blue-gray pitbull, white chest, four white paws,
// thin white face stripe, silver chain collar (from Austin's photos).
// He hangs around the couple: stands and looks around, sits, lies down, and paces
// little loops around them. Legs are posed with simple two-bone IK so every pose
// keeps his paws planted on the floor.
//   makeSunny(ctx) → { update(dt, t) }   ctx = { scene, W, FT, VENUE, labelSprite, player? }
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { toon } from './characters.js';

const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => k * k * (3 - 2 * k);

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const SPH = new THREE.SphereGeometry(1, 20, 14);
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const part = (parent, geo, mat, pos, scl = [1, 1, 1], rot = [0, 0, 0]) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.scale.set(...scl); m.rotation.set(...rot); parent.add(m); return m; };
// (the sculpted Sunny from the Sunny park game: smooth lofted body, soft painted markings)
  function loft(sections, ref, colorFn, seg = 28) {
  const pos = [], col = [], idx = [];
  const n = sections.length;
  const P = sections.map(s => new THREE.Vector3(s[0], s[1], s[2]));
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const t = new THREE.Vector3().subVectors(P[Math.min(n - 1, i + 1)], P[Math.max(0, i - 1)]).normalize();
    const side = new THREE.Vector3().crossVectors(ref, t).normalize();
    const up = new THREE.Vector3().crossVectors(t, side).normalize();
    const [, , , w, ht, hb] = sections[i];
    for (let j = 0; j < seg; j++) {
      const a = j / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const v = P[i].clone().addScaledVector(side, ca * w).addScaledVector(up, sa * (sa >= 0 ? ht : hb));
      pos.push(v.x, v.y, v.z);
      colorFn(v, sa, c); col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * seg + j, b = i * seg + (j + 1) % seg, cc = (i + 1) * seg + j, d = (i + 1) * seg + (j + 1) % seg;
    idx.push(a, b, cc, b, d, cc);
  }
  [[0, true], [n - 1, false]].forEach(([i, start]) => {
    const center = pos.length / 3;
    pos.push(P[i].x, P[i].y, P[i].z);
    colorFn(P[i], 0, c); col.push(c.r, c.g, c.b);
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = i * seg + (j + 1) % seg;
      if (start) idx.push(center, b, a); else idx.push(center, a, b);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}


export function makeSunny(ctx) {
  const { scene, W, FT, VENUE } = ctx;
  const GREY = new THREE.Color('#7e828d'), GREY_D = new THREE.Color('#6a6e79'), WHITE = new THREE.Color('#eeece6'), PINK = new THREE.Color('#b88786');
  const furM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, side: THREE.DoubleSide });
  const dark = M('#1f1f23', { roughness: 0.3 }), eyeM = M('#c7842c', { roughness: 0.15 }), browM = M('#62666f');
  const chrome = M('#eef1f5', { metalness: 1, roughness: 0.16 }), whiteM = M('#eeece6', { roughness: 0.8 });
  const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  const mesh = (geo, parent, mat = furM) => { const m = new THREE.Mesh(geo, mat); parent.add(m); return m; };

  const K = 0.5;                          // the park model is twice life size: scale him to a real pitbull (~50 cm at the shoulder)
  const dog = new THREE.Group();
  const torso = new THREE.Group(); dog.add(torso);   // pivots at the hips so he can sit back onto them
  const rig = new THREE.Group(); rig.scale.setScalar(K); rig.position.set(0, -1.0 * K, 0.52 * K); torso.add(rig);

  // torso and neck in one piece: deep chest, tucked waist, muscular rump
  const bodyM = mesh(loft([
    [0, 1.03, -0.88, 0.05, 0.05, 0.05], [0, 1.03, -0.83, 0.17, 0.17, 0.18], [0, 1.04, -0.72, 0.25, 0.23, 0.26], [0, 1.05, -0.56, 0.27, 0.25, 0.28],
    [0, 1.05, -0.36, 0.25, 0.24, 0.23], [0, 1.05, -0.16, 0.26, 0.25, 0.25], [0, 1.04, 0.04, 0.29, 0.26, 0.33], [0, 1.03, 0.24, 0.31, 0.28, 0.4],
    [0, 1.04, 0.41, 0.31, 0.28, 0.41], [0, 1.08, 0.55, 0.28, 0.27, 0.36], [0, 1.17, 0.67, 0.23, 0.23, 0.27], [0, 1.3, 0.77, 0.2, 0.2, 0.21],
    [0, 1.42, 0.85, 0.17, 0.17, 0.18], [0, 1.5, 0.89, 0.1, 0.1, 0.1],
  ], Y, (v, sa, c) => {
    c.copy(GREY).lerp(GREY_D, smooth(1.12, 1.3, v.y) * 0.7);
    const ax = Math.abs(v.x);
    const chest = smooth(0.28, 0.42, v.z) * (1 - smooth(0.12, 0.2, ax)) * (1 - smooth(0.98, 1.1, v.y));
    const throat = smooth(0.6, 0.7, v.z) * (1 - smooth(0.08, 0.13, ax)) * smooth(-0.3, -0.6, sa);
    const under = smooth(0.74, 0.68, v.y) * smooth(-0.1, 0.05, v.z) * (1 - smooth(0.12, 0.17, ax));
    c.lerp(WHITE, clamp01(Math.max(chest, throat, under)));
  }), rig);

  // head: broad skull, strong cheeks, clear stop, blunt muzzle
  const head = new THREE.Group(); head.position.set(0, 1.53, 0.9); rig.add(head);
  mesh(loft([
    [0, 0.03, -0.23, 0.08, 0.07, 0.07], [0, 0.04, -0.17, 0.22, 0.2, 0.18], [0, 0.04, -0.06, 0.3, 0.25, 0.23], [0, 0.03, 0.05, 0.31, 0.25, 0.25],
    [0, 0.01, 0.14, 0.27, 0.21, 0.24], [0, -0.03, 0.22, 0.22, 0.15, 0.21], [0, -0.06, 0.3, 0.2, 0.12, 0.18], [0, -0.07, 0.4, 0.19, 0.11, 0.16],
    [0, -0.075, 0.48, 0.17, 0.1, 0.14], [0, -0.08, 0.53, 0.13, 0.08, 0.1], [0, -0.08, 0.56, 0.05, 0.04, 0.05],
  ], Y, (v, sa, c) => {
    c.copy(GREY).lerp(GREY_D, smooth(0.24, 0.36, v.z) * 0.8);
    const ax = Math.abs(v.x);
    const stripeW = 0.03 + 0.035 * smooth(0.26, 0.42, v.z);
    const blaze = smooth(0.35, 0.7, sa) * (1 - smooth(stripeW, stripeW + 0.025, ax)) * smooth(-0.02, 0.06, v.z) * (1 - smooth(0.5, 0.54, v.z));
    const chin = smooth(-0.35, -0.7, sa) * smooth(0.3, 0.4, v.z);
    c.lerp(WHITE, clamp01(Math.max(blaze, chin)));
  }, 32), head);
  part(head, SPH, dark, [0, -0.02, 0.555], [0.085, 0.063, 0.05]);                 // nose
  part(head, SPH, dark, [0, -0.15, 0.47], [0.1, 0.012, 0.06], [0.1, 0, 0]);        // mouth line
  const mouth = new THREE.Object3D(); mouth.position.set(0, -0.12, 0.5); head.add(mouth);   // where his speech bubble points
  const tongue = part(head, SPH, M('#d8838c', { roughness: 0.5 }), [0, -0.17, 0.43], [0.06, 0.015, 0.08]);   // panting
  const ears = [];
  [1, -1].forEach((sd) => {
    part(head, SPH, eyeM, [sd * 0.13, 0.075, 0.24], [0.042, 0.042, 0.042]);
    part(head, SPH, dark, [sd * 0.135, 0.075, 0.277], [0.022, 0.024, 0.012]);
    part(head, SPH, browM, [sd * 0.13, 0.115, 0.235], [0.055, 0.018, 0.035], [0.3, 0, -sd * 0.2]);   // brow
    const ear = new THREE.Group(); head.add(ear); ears.push(ear);
    mesh(loft([   // rose ears: lift off the skull then fold forward and down, pink inside
      [sd * 0.18, 0.2, -0.07, 0.085, 0.016, 0.016], [sd * 0.27, 0.3, -0.05, 0.085, 0.016, 0.016], [sd * 0.34, 0.29, -0.01, 0.07, 0.015, 0.015],
      [sd * 0.37, 0.21, 0.02, 0.05, 0.013, 0.013], [sd * 0.37, 0.14, 0.035, 0.02, 0.01, 0.01],
    ], Y, (v, sa, c) => { c.copy(sa * sd < -0.2 ? PINK : GREY_D); }, 16), ear);
  });

  // chrome choke chain around the neck, ring hanging at the front
  const chain = new THREE.Group(); chain.position.set(0, 1.24, 0.72); chain.rotation.x = 0.66; rig.add(chain);
  const linkG = new THREE.TorusGeometry(0.03, 0.01, 6, 12);
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2, l = new THREE.Mesh(linkG, chrome);
    l.position.set(Math.cos(a) * 0.228, 0, Math.sin(a) * 0.25);
    const t = new THREE.Vector3(-Math.sin(a) * 0.228, 0, Math.cos(a) * 0.25).normalize();
    const side = new THREE.Vector3().crossVectors(t, Y), yAxis = i % 2 ? Y : side;
    l.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(t, yAxis, new THREE.Vector3().crossVectors(t, yAxis)));
    l.scale.set(1.5, 1, 1); chain.add(l);
  }
  for (let i = 0; i < 3; i++) part(rig, linkG, chrome, [0, 1.06 - i * 0.045, 0.93 + i * 0.008], [1, 1.5, 1], [0, i % 2 ? Math.PI / 2 : 0, 0]);
  part(rig, new THREE.TorusGeometry(0.062, 0.013, 8, 20), chrome, [0, 0.95, 0.945]);

  // legs: split at the elbow/knee so they can bend; white socks and paws
  const KN = 0.46;   // joint height below the shoulder/hip, in model units
  const legColorU = (v, sa, c) => c.copy(GREY);
  const legColorL = (v, sa, c) => c.copy(GREY).lerp(WHITE, smooth(-0.24, -0.32, v.y));
  const FRONT = [[0, 0.05, 0, 0.12, 0.14, 0.14], [0, -0.15, 0.02, 0.12, 0.13, 0.14], [0, -0.35, 0, 0.09, 0.09, 0.1], [0, -0.46, -0.02, 0.072, 0.07, 0.08],
    [0, -0.65, 0, 0.06, 0.058, 0.058], [0, -0.82, 0.01, 0.052, 0.05, 0.05], [0, -0.9, 0.03, 0.05, 0.05, 0.05], [0, -0.94, 0.05, 0.04, 0.04, 0.04]];
  const HIND = [[0, 0.05, 0, 0.14, 0.2, 0.2], [0, -0.15, 0.02, 0.14, 0.2, 0.2], [0, -0.34, 0.05, 0.1, 0.12, 0.12], [0, -0.45, 0.06, 0.075, 0.08, 0.08],
    [0, -0.6, -0.02, 0.06, 0.06, 0.06], [0, -0.72, -0.08, 0.055, 0.055, 0.055], [0, -0.85, -0.05, 0.05, 0.05, 0.05], [0, -0.94, 0, 0.04, 0.04, 0.04]];
  const legs = [];
  const mkLeg = (x, z, secs, front) => {
    const base = new THREE.Group(); base.position.set(x, 1.0, z); rig.add(base);
    const j = secs[3];
    mesh(loft(secs.slice(0, 4).concat([[0, j[1] - 0.04, j[2], j[3] * 0.95, j[4] * 0.95, j[5] * 0.95]]), Z, legColorU, 20), base);
    const knee = new THREE.Group(); knee.position.set(0, -KN, j[2]); base.add(knee);
    part(knee, SPH, new THREE.MeshStandardMaterial({ color: GREY, roughness: 0.72 }), [0, 0, 0], [j[3] * 0.98, j[4] * 0.98, j[5] * 0.98]);   // smooth joint
    mesh(loft(secs.slice(3).map(([sx, sy, sz, w, ht, hb]) => [sx, sy + KN, sz - j[2], w, ht, hb]), Z, legColorL, 20), knee);
    const last = secs[secs.length - 1];
    const paw = new THREE.Group(); paw.position.set(0, -0.955 + KN, last[2] - j[2]); knee.add(paw);
    part(paw, SPH, whiteM, [0, 0, 0.04], [0.078, 0.048, 0.11]);
    const leg = { base, knee, paw, a: KN * K, b: (0.955 - KN) * K, front, x: x * K, z: (z + 0.52) * K - 0.0 };
    legs.push(leg); return leg;
  };
  const LF = mkLeg(0.19, 0.42, FRONT, true), RF = mkLeg(-0.19, 0.42, FRONT, true);
  const LH = mkLeg(0.18, -0.52, HIND, false), RH = mkLeg(-0.18, -0.52, HIND, false);

  // tail hangs low with a slight curve
  const tailG = new THREE.Group(); tailG.position.set(0, 1.03, -0.85); rig.add(tailG);
  mesh(loft([[0, 0, 0, 0.06, 0.06, 0.06], [0, -0.05, -0.12, 0.05, 0.05, 0.05], [0, -0.2, -0.22, 0.04, 0.04, 0.04],
    [0, -0.4, -0.26, 0.03, 0.03, 0.03], [0, -0.56, -0.24, 0.012, 0.012, 0.012]], Y, (v, sa, c) => c.copy(GREY), 12), tailG);

  // ── where he hangs out: around Austin & Bre ──
  const C = new THREE.Vector3(VENUE.spouseSpot.x * FT, 0, VENUE.spouseSpot.z * FT);
  const st = { x: C.x + 0.95, z: C.z, yaw: Math.PI / 2, state: 'sit', timer: 14, ang: 0,   /* starts sitting in front of Austin & Bre, facing the door you come in */ tgtAng: 0, phase: 0, speed: 0, pose: 1, poseTo: 1 };
  // pose blend: 0 = standing, 1 = sitting, 2 = lying down
  dog.position.set(st.x, 0, st.z); scene.add(dog); dog.userData.sunny = st;   // st exposed for testing poses
  const col = { circle: [st.x, st.z], r: 0.33 }; W.colliders.push(col);
  // (no name tag for Sunny: Austin took it out)

  // petting: walk up and click/tap him → he flops down and rolls belly-up for rubs
  let belly = 0;           // 0..1 roll onto his back
  const rubBubble = ctx.speechBubble('♡ Belly rubs! ♡', { once: false });   // shows every time you pet him rubBubble.anchors = [mouth];
  const pet = () => { if (st.state === 'belly') { st.timer = Math.max(st.timer, 4); return; } st.state = 'belly'; st.timer = 7; st.tgtAng = st.ang; };
  W.readables.push({ obj: dog, name: 'Sunny', open: 'pet', pet });
  const pick = () => {     // what to do next: mostly pace a little or stand, sometimes sit or lie down
    const r = Math.random();
    if (r < 0.4) { st.state = 'pace'; st.tgtAng = Math.max(-1.15, Math.min(1.15, st.ang + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 1.0))); if (Math.abs(st.tgtAng - st.ang) < 0.2) st.tgtAng = -st.ang * 0.8; }   // stays on the front side (toward the door), where you can see him
    else if (r < 0.62) { st.state = 'stand'; st.timer = 3 + Math.random() * 3; }
    else if (r < 0.85) { st.state = 'sit'; st.timer = 6 + Math.random() * 5; }
    else { st.state = 'lie'; st.timer = 8 + Math.random() * 6; }
  };
  const R = 0.95;           // pacing circle around the couple
  const V = new THREE.Vector3(), B = new THREE.Vector3(), T = new THREE.Vector3(), E = new THREE.Vector3();

  // two-bone IK in the dog's side plane: plant the paw at target (dog-root coords)
  const solve = (leg, target, phi) => {
    leg.base.getWorldPosition(B); dog.worldToLocal(B);
    const dy = target.y - B.y, dz = target.z - B.z;
    let L = Math.hypot(dy, dz); const a = leg.a, b = leg.b;
    L = Math.max(0.05, Math.min(L, a + b - 0.001));
    const beta = Math.atan2(-dz, -dy);
    const g = Math.acos(Math.max(-1, Math.min(1, (a * a + L * L - b * b) / (2 * a * L))));
    const a1 = leg.front ? beta + g : beta - g;          // front elbows point back, hind knees point forward
    const ey = B.y - Math.cos(a1) * a, ez = B.z - Math.sin(a1) * a;
    const a2 = Math.atan2(-(target.z - ez), -(target.y - ey));
    leg.base.rotation.x = a1 - phi; leg.knee.rotation.x = a2 - a1;
    leg.paw.rotation.x = -a2;                              // paw stays flat on the floor
  };

  return { update(dt, t) {
    // ── decide ──
    st.timer -= dt;
    if (st.state === 'pace') {
      const d = st.tgtAng - st.ang, step = Math.sign(d) * Math.min(Math.abs(d), (0.55 / R) * dt);
      st.ang += step; st.speed = Math.abs(step) * R / Math.max(dt, 1e-4);
      const nx = C.x + Math.cos(st.ang) * R, nz = C.z + Math.sin(st.ang) * R;
      const want = Math.atan2(nx - st.x, nz - st.z); if (st.speed > 0.01) st.yaw += Math.atan2(Math.sin(want - st.yaw), Math.cos(want - st.yaw)) * Math.min(1, dt * 8);
      st.x = nx; st.z = nz;
      if (Math.abs(d) < 0.01) pick();
      st.poseTo = 0;
    } else if (st.state === 'belly') {
      st.speed = 0; st.poseTo = 2;
      if (st.timer <= 0) { st.state = 'stand'; st.timer = 3 + Math.random() * 2; }
    } else {
      st.speed = 0;
      if (st.timer <= 0) pick();
      st.poseTo = st.state === 'sit' ? 1 : st.state === 'lie' ? 2 : 0;
      // face out toward the room most of the time, with the odd glance back at his people
      const out = Math.atan2(st.x - C.x, st.z - C.z) + Math.sin(t * 0.13) * 0.6;
      st.yaw += Math.atan2(Math.sin(out - st.yaw), Math.cos(out - st.yaw)) * Math.min(1, dt * 1.5);
    }
    // settle into the pose smoothly
    st.pose += Math.sign(st.poseTo - st.pose) * Math.min(Math.abs(st.poseTo - st.pose), dt * 1.4);
    belly += Math.sign((st.state === 'belly' && st.pose > 1.6 ? 1 : 0) - belly) * Math.min(Math.abs((st.state === 'belly' && st.pose > 1.6 ? 1 : 0) - belly), dt * 1.6);
    const bK = ease(belly); rubBubble.visible = bK > 0.6;
    const sitK = ease(Math.max(0, Math.min(1, st.pose))), lieK = ease(Math.max(0, Math.min(1, st.pose - 1)));
    dog.position.set(st.x, 0, st.z); dog.rotation.y = st.yaw; col.circle[0] = st.x; col.circle[1] = st.z;

    // ── body pose ──
    st.phase += dt * (st.speed > 0.02 ? st.speed * 13 : 0);
    const walkK = Math.min(1, st.speed / 0.4), bob = Math.abs(Math.sin(st.phase)) * 0.012 * walkK;
    const breathe = Math.sin(t * 6.5) * 0.004;
    const hipY = lerp(lerp(0.49, 0.22, sitK), 0.17, lieK) + bob;
    const phi = lerp(lerp(0, -0.72, sitK), 0, lieK);                  // nose-up when sitting
    torso.position.set(0, hipY, lerp(-0.23, -0.15, lieK)); torso.rotation.x = phi;
    torso.rotation.z = Math.sin(st.phase) * 0.03 * walkK + bK * (2.3 + Math.sin(t * 3.2) * 0.1);   // rolls onto his back and wiggles
    torso.position.y = lerp(torso.position.y, 0.19, bK); torso.rotation.x = lerp(phi, -0.3, bK);   // chest tipped up a little so his head stays above the floor
    bodyM.scale.y = 1 + breathe * 3;

    // ── legs ──
    dog.updateWorldMatrix(true, true);
    for (const leg of legs) {
      const diag = (leg === LF || leg === RH) ? 0 : Math.PI;           // trot: diagonal pairs move together
      const s = Math.sin(st.phase + diag), lift = Math.max(0, Math.cos(st.phase + diag)) * 0.06 * walkK;
      // standing: paw under its joint; sitting: hind paws tucked forward, front paws planted ahead; lying: front paws stretched out
      let tz, ty = 0.024;
      if (leg.front) tz = lerp(lerp(0.24, 0.16, sitK), 0.5, lieK);
      else tz = lerp(lerp(-0.23, -0.06, sitK), -0.05, lieK);
      tz += s * 0.09 * walkK;
      T.set(leg.x, ty + lift, tz);
      if (!leg.front && sitK > 0.01) { T.x = leg.x * lerp(1, 1.5, sitK); }   // haunches splay a touch when he sits
      if (lieK > 0.01 && !leg.front) { T.set(leg.x * lerp(1, 1.9, lieK), lerp(ty, 0.05, lieK), lerp(tz, 0.1, lieK)); }
      solve(leg, T, phi);
      if (bK > 0.001) {      // belly up: paws curled in the air, one back leg doing the happy kick
        const kick = leg === RH ? Math.max(0, Math.sin(t * 9)) * 0.5 : 0;
        const bx = leg.front ? -0.9 : 0.7 + kick, kx = leg.front ? 1.5 : -1.3 - kick * 0.6;
        leg.base.rotation.x = lerp(leg.base.rotation.x, bx, bK); leg.knee.rotation.x = lerp(leg.knee.rotation.x, kx, bK);
        leg.paw.rotation.x = lerp(leg.paw.rotation.x, leg.front ? -0.8 : 0.6, bK);
      }
    }

    // ── head, ears, tail ──
    let look = Math.sin(t * 0.45) * 0.45, tilt = Math.sin(t * 0.8) * 0.05;
    const P = ctx.player;
    if (P) {                                   // glance at you when you're near
      const dx = P.x - st.x, dz = P.z - st.z, d = Math.hypot(dx, dz);
      if (d < 3.5) { const rel = Math.atan2(Math.sin(Math.atan2(dx, dz) - st.yaw), Math.cos(Math.atan2(dx, dz) - st.yaw)); look = Math.max(-0.65, Math.min(0.65, rel)); tilt = -0.12 + Math.sin(t * 0.7) * 0.08; }
    }
    head.rotation.y += (look - head.rotation.y) * Math.min(1, dt * 3);
    head.rotation.x = -phi * 0.75 + lerp(0, 0.12, lieK) + tilt + Math.sin(st.phase * 2) * 0.03 * walkK;   // keeps his head level as the body tips
    head.rotation.z = Math.sin(t * 0.31) * 0.06 - bK * 1.3;   // head turned sideways on the floor, looking up at you
    if (bK > 0.01) head.rotation.y = lerp(head.rotation.y, 0, bK);
    for (const [i, e] of ears.entries()) e.rotation.x = Math.sin(t * 1.7 + i) * 0.03;
    const wag = st.state === 'belly' ? Math.sin(t * 16) * 0.7 : Math.sin(t * (st.state === 'lie' ? 5 : 11)) * (st.state === 'lie' ? 0.3 : 0.55);
    tailG.rotation.x = lerp(lerp(0, 1.0, sitK), 0.6, lieK);   // hangs low; swept back along the floor when he sits or lies
    tailG.rotation.z = wag;
    tongue.position.y = -0.17 + Math.sin(t * 6.5) * 0.008;
  } };
}
