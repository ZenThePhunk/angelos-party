// ─────────────────────────────────────────────────────────────
// The tattoo lounge at work: Isa tattooing Lori's back left shoulder (left station),
// Kaylyn kneeling on the rug tattooing Alaine's leg (right station, by the arcade).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { buildPerson, reach, toon, leopardCloth } from './characters.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion();

const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
function machine() {   // little black coil tattoo machine with a grip
  const g = new THREE.Group();
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.045), toon('#1a1a1a')), {}));
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.09, 8), new THREE.MeshStandardMaterial({ color: '#bbbbbb', metalness: 0.9, roughness: 0.3 }));
  grip.position.set(0, -0.05, 0.01); g.add(grip);
  return g;
}

// seat someone: hips on the seat, thighs forward, shins down
function sit(p, seatY) {
  const k = p.root.scale.y;
  p.root.position.y = seatY - 0.92 * k;
  p.P.legL.rotation.set(-1.45, 0, 0.05); p.P.legR.rotation.set(-1.45, 0, -0.05);
  p.P.kneeL.rotation.set(1.45, 0, 0); p.P.kneeR.rotation.set(1.45, 0, 0);
}

export function placeTattooArtists({ scene, W, FT, labelSprite }) {
  const f = (v) => v * FT;
  const tag = (p, name, y) => { const s = labelSprite(name, { size: 70 }); s.position.set(0, y, 0); p.root.add(s); };

  // ── Lori: redhead in the left chair, left arm out on the arm rest ──
  const lori = buildPerson({ build: 'f', height: 1.65, skin: '#f1cdb4', hair: '#d0904f', hairStyle: 'long', bangs: false, blush: true,
    top: '#0d0d0f', sleeves: 'mesh', bareShoulder: 'L', pants: '#0d0d0f', shoes: '#111' });   // fitted black square-neck midi dress, sheer mesh sleeves (left one slipped off the shoulder for the tattoo)
  lori.root.position.set(f(29.6), 0, f(4.2)); lori.root.rotation.y = -0.3;   // facing the room, back-left shoulder toward Isa
  scene.add(lori.root);
  sit(lori, 0.48); tag(lori, 'Lori', 1.95);
  { const skinM = toon('#f1cdb4');   // square neckline
    // square neckline: a skin panel following the curve of the chest
    const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.13, 0.07, 16, 1, true, -0.55, 1.1), skinM); nk.position.set(0, 1.41, 0); nk.scale.z = 0.74; lori.P.upper.add(nk);
    const lips = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.008, 0.006), toon('#b3122a')); lips.position.set(0, 1.635 - 0.06, 0.13); lori.P.head.add(lips);
    for (const el of [lori.P.handL, lori.P.handR]) { const nails = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), toon('#a8101e')); nails.position.set(0, -0.035, 0.012); nails.scale.set(1.4, 0.6, 0.6); el.add(nails); } }

  // ── Isa: dark hair with bangs, black velvet top, tattooed arms, black gloves, on the rolling stool ──
  const isa = buildPerson({ build: 'f', height: 1.66, skin: '#efc9ad', hair: '#1a1210', hairStyle: 'long', blush: true, top: '#0e0b10', sleeves: 'none', armTattoos: true, gloves: '#0a0a0a', pants: '#121212', shoes: '#0d0d0d' });
  isa.root.position.set(f(31.6), 0, f(3.3)); scene.add(isa.root);
  lori.root.updateWorldMatrix(true, true);
  const shoulder = lori.P.armL.getWorldPosition(new THREE.Vector3());
  isa.root.rotation.y = Math.atan2(shoulder.x - isa.root.position.x, shoulder.z - isa.root.position.z);   // faces Lori's shoulder
  sit(isa, 0.6); isa.P.sway.rotation.x = 0.35; isa.P.neck.rotation.x = 0.35; tag(isa, 'Isa', 2.0);
  const gunI = machine(); isa.P.handR.add(gunI); gunI.position.set(0, -0.03, 0.02);
  W.colliders.push({ circle: [f(29.6), f(4.2)], r: 0.34 });

  // ── Alaine: blonde, black jacket, red skirt slit to bare her right leg, stretched out onto the stool ──
  const alaine = buildPerson({ build: 'f', height: 1.68, skin: '#f2cfb3', hair: '#d9b56a', hairStyle: 'long', bangs: false, blush: true, top: '#121212', openJacket: true, shirt: '#c8141c', shirtPlain: true, pants: '#c8141c', bareLeg: 'R', shoes: '#151515' });
  alaine.root.position.set(f(40), 0, f(4.2)); alaine.root.rotation.y = -Math.PI / 2; scene.add(alaine.root);
  sit(alaine, 0.48); tag(alaine, 'Alane', 1.95);
  // a long red skirt draped over the lap and down the left side
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.26, 0.45, 20, 1, true), new THREE.MeshToonMaterial({ color: '#c8141c', side: THREE.DoubleSide }));
  skirt.position.set(0.09, 0.66, 0.2); skirt.rotation.x = -1.2; skirt.scale.z = 0.7; alaine.P.body.add(skirt);
  // ...and falling from her left knee to the floor, slit open on the right where her leg comes out
  const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.52, 20, 1, true, -Math.PI * 0.85, Math.PI * 1.55), skirt.material);
  drop.position.set(0.07, 0.68, 0.42); alaine.P.body.add(drop);
  // aim the bare right leg at the stool top
  {
    alaine.root.updateWorldMatrix(true, true);
    const hip = alaine.P.legR.getWorldPosition(_a), foot = _b.set(f(37.6), 0.66, f(3.25));
    const dirW = _c.subVectors(foot, hip).normalize();
    alaine.P.legR.parent.getWorldQuaternion(_q); dirW.applyQuaternion(_q.invert());
    alaine.P.legR.quaternion.setFromUnitVectors(DOWN, dirW); alaine.P.kneeR.rotation.set(0.12, 0, 0);
  }
  // rest the arms on the lap / chair
  for (const [arm, el, sd] of [[alaine.P.armL, alaine.P.elbowL, 1], [alaine.P.armR, alaine.P.elbowR, -1]]) { arm.rotation.set(-0.35, 0, 0.12 * sd); el.rotation.set(-1.0, 0, 0); }

  // ── Kaylyn: blonde ponytail, leopard slip dress, tattooed arms, kneeling on the rug beside Alaine's shin ──
  const kaylyn = buildPerson({ build: 'f', height: 1.65, skin: '#f0cbb0', hair: '#d8bc7c', hairStyle: 'ponytail', blush: true, topMap: leopardCloth(), pantsMap: leopardCloth(), sleeves: 'none', armTattoos: true, gloves: '#0a0a0a', shoes: '#2a1d12' });
  alaine.root.updateWorldMatrix(true, true);
  const shinMid = alaine.P.kneeR.getWorldPosition(new THREE.Vector3()).lerp(_b.set(f(37.6), 0.62, f(3.25)), 0.45);
  kaylyn.root.position.set(shinMid.x, 0, shinMid.z - 0.48); kaylyn.root.rotation.y = 0; scene.add(kaylyn.root);   // on the wall side, facing the room
  { const k = kaylyn.root.scale.y; kaylyn.root.position.y = -0.4 * k;                // kneeling: knees on the floor, shins back
    kaylyn.P.legL.rotation.set(-0.15, 0, 0.06); kaylyn.P.legR.rotation.set(-0.15, 0, -0.06); kaylyn.P.kneeL.rotation.set(1.55, 0, 0); kaylyn.P.kneeR.rotation.set(1.55, 0, 0);
    kaylyn.P.sway.rotation.x = 0.4; kaylyn.P.neck.rotation.x = 0.4; }
  tag(kaylyn, 'Kaylyn', 1.75);
  const gunK = machine(); kaylyn.P.handR.add(gunK); gunK.position.set(0, -0.03, 0.02);
  W.colliders.push({ circle: [kaylyn.root.position.x, kaylyn.root.position.z], r: 0.34 });

  const pole = new THREE.Vector3(0, -1, 0), hold = new THREE.Vector3();
  const tip = new THREE.Vector3();
  return (dt, t) => {
    // Lori sits still, hands in her lap, head turned a little away from the needle
    lori.P.armL.rotation.set(-0.2, 0, 0.1); lori.P.elbowL.rotation.set(-1.25, 0, 0);
    lori.P.armR.rotation.set(-0.2, 0, -0.1); lori.P.elbowR.rotation.set(-1.25, 0, 0);
    lori.P.neck.rotation.set(0.12, -0.3, 0);
    // Isa works over the back of Lori's left shoulder: machine hand moves in small passes, other hand stretches the skin
    lori.root.updateWorldMatrix(true, true);
    const sh = lori.P.armL.getWorldPosition(_a);
    const back = _b.set(-Math.sin(lori.root.rotation.y), 0, -Math.cos(lori.root.rotation.y));   // behind Lori
    const side = _c.set(Math.cos(lori.root.rotation.y), 0, -Math.sin(lori.root.rotation.y));   // her left
    tip.copy(sh).addScaledVector(back, 0.07).addScaledVector(side, -0.04 + Math.sin(t * 0.4) * 0.03); tip.y += 0.02 + Math.sin(t * 0.7) * 0.025 + Math.sin(t * 40) * 0.003;
    reach(isa.P.armR, isa.P.elbowR, tip, pole);
    hold.copy(sh).addScaledVector(back, 0.06).addScaledVector(side, -0.12); hold.y += 0.08;
    reach(isa.P.armL, isa.P.elbowL, hold, pole);
    isa.P.neck.rotation.y = Math.sin(t * 0.4) * 0.06;
    // Kaylyn works along Alaine's shin
    alaine.root.updateWorldMatrix(true, true);
    const kn = alaine.P.kneeR.getWorldPosition(_a), ft = _b.set(f(37.6), 0.66, f(3.25));
    const v = 0.35 + Math.sin(t * 0.3 + 1) * 0.15;
    tip.lerpVectors(kn, ft, v); tip.y += 0.12 + Math.sin(t * 40) * 0.003; tip.z -= 0.04;
    reach(kaylyn.P.armR, kaylyn.P.elbowR, tip, pole);
    // hold the machine like a pen: needle pointing down into the skin, top tipped back toward her
    kaylyn.root.updateWorldMatrix(true, true);
    kaylyn.P.handR.getWorldQuaternion(_qa); kaylyn.root.getWorldQuaternion(_qb);
    gunK.quaternion.copy(_qa.invert().multiply(_qb)); gunK.rotateX(-0.4);
    reach(kaylyn.P.armL, kaylyn.P.elbowL, _c.lerpVectors(kn, ft, v - 0.18).add(_a.set(0, 0.05, -0.05)), pole);
    alaine.P.neck.rotation.set(0.15, Math.sin(t * 0.2) * 0.3, 0);
  };
}
