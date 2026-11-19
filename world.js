// Builds the whole venue: shell, ceiling, lights, and every station from the site plan.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VENUE as V, FT } from './venue.js';
import * as TX from './textures.js';
import { makeBandMember, makeBartender } from './characters.js';

const L = V.length * FT, D = V.depth * FT, WH = V.wallHeight * FT, PK = V.peakHeight * FT;
const SAG = PK - WH, RAD = (SAG * SAG + (D / 2) ** 2) / (2 * SAG);
export const archY = (z) => WH - (RAD - SAG) + Math.sqrt(Math.max(0, RAD * RAD - (z - D / 2) ** 2));
export const DIM = { L, D, WH, PK };
const f = (v) => v * FT;
const M = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const std = (o) => new THREE.MeshStandardMaterial(o);
const glow = (hex, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });
function scaleUV(geo, su, sv) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return geo; }
// a box stretched between two points (for beams, braces, rails)
function beam(a, b, w, h) {
  const len = a.distanceTo(b), g = new THREE.BoxGeometry(w, h, len);
  const m = new THREE.Matrix4().lookAt(a, b, Math.abs(b.y - a.y) > 0.98 * len ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0));
  m.setPosition(a.clone().add(b).multiplyScalar(0.5));
  return g.applyMatrix4(m);
}
const rnd = TX.rand;

// paper that reads clearly in the red room without glowing
// crisp, evenly lit paper (kept just under the glow threshold so it never blooms)
const menuPaper = (tex) => { tex.anisotropy = 16; return new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.74, 0.72, 0.7) }); };
const menuStand = (tex, mw, mh) => {
  const stand = new THREE.Group();
  const brassF = new THREE.MeshStandardMaterial({ color: '#d6d7db', metalness: 1, roughness: 0.22 });   // silver
  stand.add(M(new THREE.BoxGeometry(mw + 0.03, mh + 0.03, 0.012), brassF, 0, mh / 2 + 0.02, 0));
  stand.add(M(new THREE.PlaneGeometry(mw, mh), menuPaper(tex), 0, mh / 2 + 0.02, 0.0065));
  const leg = M(new THREE.BoxGeometry(0.02, mh * 0.8, 0.008), brassF, 0, mh * 0.4, -0.08); leg.rotation.x = 0.35; stand.add(leg);
  return stand;
};
// ── printed cards, typeset big and bold so they read clearly ──
// line: [text, size, style] where style is 'black' (blackletter), 'script', 'head' (bold italic), 'body' (semibold italic), or 'gap'
const FONTS = { black: (z) => `${z}px "UnifrakturMaguntia", "Old English Text MT", serif`, script: (z) => `${z}px "Great Vibes", "Snell Roundhand", cursive`,
  head: (z) => `italic 800 ${z}px "Playfair Display", Georgia, serif`, body: (z) => `italic 600 ${z}px "Playfair Display", Georgia, serif` };
let doodle = null;   // the little dog drawing from the real menu
const doodleReady = new Promise((res) => { const im = new Image(); im.onload = () => { doodle = im; res(); }; im.onerror = res; im.src = 'images/bar-menu.jpg'; });
export const cardImages = new Map();
const flowerDisplays = [];   // the big flower pieces (bar tower, food-table towers): walking up to one shows "Flowers by Brophy"
function typesetCard(lines, { withDoodle = false } = {}) {
  const W = 1428, Hh = 2000, maxW = W - 110;
  const c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d');
  const total = (k) => lines.reduce((sum, [t, z, st]) => sum + (st === 'gap' ? z : z * 1.22) * k, 0) + (withDoodle && doodle ? 150 : 0);
  let k = Math.min(1.6, (Hh - 120) / total(1));
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#141414'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let y = (Hh - total(k)) / 2;
  for (const [t, z0, st] of lines) {
    if (st === 'gap') { y += z0 * k; continue; }
    let z = z0 * k; g.font = FONTS[st](z);
    while (g.measureText(t).width > maxW && z > 10) { z -= 2; g.font = FONTS[st](z); }
    y += z0 * k * 0.61; g.fillText(t, W / 2, y); y += z0 * k * 0.61;
  }
  if (withDoodle && doodle) { const k = doodle.naturalWidth / 1414; g.drawImage(doodle, 620 * k, 1700 * k, 190 * k, 110 * k, W / 2 - 128, y + 10, 256, 148); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16;
  return { tex, canvas: c };
}
const BAR_MENU = [['Bar Menu', 170, 'black'], ['', 40, 'gap'], ['COCKTAILS', 78, 'head'], ['SUNNY', 58, 'head'], ['tequila, cointreau, agave, lime', 54, 'body'], ['', 18, 'gap'],
  ['JACO', 58, 'head'], ['bourbon, soda, lemon peel', 54, 'body'], ['', 18, 'gap'], ['FLEA', 58, 'head'], ['espresso martini w. cherry cold foam', 54, 'body'], ['', 40, 'gap'],
  ['BEER', 78, 'head'], ['Modelo', 56, 'body'], ['Coors Banquet', 56, 'body'], ['Guiness', 56, 'body'], ['Bero (NA)', 56, 'body'], ['', 40, 'gap'],
  ['CHILLED WINE', 78, 'head'], ['Red: Pinot Noir-ish', 56, 'body'], ['White: Chardonnay-ish', 56, 'body'], ['Orange: Orange', 56, 'body'], ['', 30, 'gap'], ['With Love', 70, 'script']];
const FOOD_MENU = [['Menu', 170, 'black'], ['', 20, 'gap'], ['Curated and prepared by Good Arthur <3', 44, 'body'], ['', 34, 'gap'],
  ['To start! Brown Butter Furikake Popcorn', 56, 'head'], ['', 30, 'gap'],
  ['Pork Belly Bao', 60, 'head'], ['Soft steamed buns stuffed with tender pork belly,', 44, 'body'], ['pickled vegetables, and a punchy sauce', 44, 'body'], ['', 26, 'gap'],
  ['Yakitori Skewers (GF)', 60, 'head'], ['Japanese-styled grilled chicken skewers,', 44, 'body'], ['brushed with a sweet and savory glaze', 44, 'body'], ['', 26, 'gap'],
  ['Karaage Fried Chicken (GF)', 60, 'head'], ['Japanese fried chicken with a light, crispy coating.', 44, 'body'], ['', 26, 'gap'],
  ['Spicy Tuna Onigiri (GF)', 60, 'head'], ['Spicy tuna tucked inside seasoned rice,', 44, 'body'], ['warpped in crisp nori', 44, 'body'], ['', 26, 'gap'],
  ['Noodles, Two Ways', 60, 'head'], ['Stir-fried noodles tossed with tender beef, crunchy', 44, 'body'], ['vegetables, and a savory sauce. Vegetable-only option available.', 44, 'body'], ['', 26, 'gap'],
  ['Dumplings, Two Ways', 60, 'head'], ['Tender pork dumplings served with a tangy soy', 44, 'body'], ['dipping sauce. Vegetable-only option available.', 44, 'body'], ['', 26, 'gap'], ['With Love', 70, 'script']];
const THANK_YOU = [['Thank You!', 190, 'script'], ['', 30, 'gap'], ...['Invitations – Haley Ann Bradley', 'Creative Consulting – Erin Pederson', 'Beauty – Kendell Cotta', 'Eats & Interior Vibes – Good Arthur',
  'Chandelier – Devin Anderson', 'Floral – Brophy Blooms', 'Lighting – Emilio Marcelino', 'Rentals – Yeah! and Form Decor', 'Venue – Era Studio', 'Libations – Danny Rosalas',
  'Tattoos – Kaylyn Ryan & Isa Verri', 'Photos – Tyler Magee', 'Sounds – Elwood & Slow Jamz', 'Magic – Franklin Saint', 'Security – Vinny Mcginty',
  'Coordination – Joyce, Omar, Chet, Isabel', 'Everything else – Basecamp Supply Co.', '&', 'One year of unpaid voice memo consultations for', 'every single detail – Kristin Shultz'].map((t) => [t, 52, 'body'])];
const fontsReady = () => Promise.all(['170px "UnifrakturMaguntia"', '170px "Great Vibes"', 'italic 800 60px "Playfair Display"', 'italic 600 60px "Playfair Display"'].map((f) => document.fonts.load(f))).catch(() => {}).then(() => doodleReady);

export function buildWorld(scene, Q) {
  const bartenders = [];   // [0] = Danny, on the right as you face the bar
  const world = new THREE.Group(); scene.add(world);
  const colliders = [], occluders = [], tick = [], dynamic = new Set(), readables = [];
  const add = (...o) => { world.add(...o); return o[0]; };
  const box = (x1, z1, x2, z2) => colliders.push({ box: [Math.min(x1, x2), Math.min(z1, z2), Math.max(x1, x2), Math.max(z1, z2)] });
  const circle = (x, z, r) => colliders.push({ circle: [x, z], r });

  // ── shared materials ──
  const B = TX.brick();
  const brickMat = std({ map: B.map, bumpMap: B.bump, bumpScale: 2.2, roughness: 0.92, color: '#e2c3b0' });
  const woodTex = TX.woodGrain([28, 42, 44]);
  const woodMat = std({ map: woodTex, emissiveMap: woodTex, emissive: '#8a1606', emissiveIntensity: 0.5, roughness: 0.75, color: '#d9b48c' });
  const ceilTex = TX.planks({ boards: 8, base: [32, 40, 50] });
  const ceilMat = std({ map: ceilTex, emissiveMap: ceilTex, emissive: '#7a1a08', emissiveIntensity: 0.55, roughness: 0.8, side: THREE.DoubleSide, color: '#e0bf98' });
  const steel = std({ color: '#2b2522', roughness: 0.55, metalness: 0.6 });
  const black = std({ color: '#0e0e0e', roughness: 0.45 });
  const chrome = std({ color: '#d8d8d8', roughness: 0.18, metalness: 1 });
  const plaster = std({ map: TX.concrete(205), color: '#c8b8a6', roughness: 0.95 });
  const concreteMat = std({ map: TX.concrete(150), roughness: 0.7, color: '#b9b4ad' });
  const splashTex = TX.uplightSplash();

  // ── floor (with soft, streaky reflections on desktop) ──
  const floorTex = TX.concreteFloor(L, D);
  const floorMat = std({ map: floorTex, roughness: 0.36, metalness: 0.05, color: '#a29e9a' });
  const floorGeo = new THREE.PlaneGeometry(L, D);
  const plainFloor = M(floorGeo, floorMat, L / 2, 0, D / 2); plainFloor.rotation.x = -Math.PI / 2;
  let reflectFloor = null;
  if (Q.reflections) {
    reflectFloor = new Reflector(floorGeo, { textureWidth: Math.round(innerWidth * 0.5), textureHeight: Math.round(innerHeight * 0.5), clipBias: 0.003 });
    const texMatrix = reflectFloor.material.uniforms.textureMatrix.value, rt = reflectFloor.getRenderTarget();
    const rm = floorMat.clone();
    rm.onBeforeCompile = (sh) => {
      sh.uniforms.tReflect = { value: rt.texture }; sh.uniforms.reflMatrix = { value: texMatrix }; sh.uniforms.reflStrength = { value: 0.5 };
      sh.vertexShader = 'uniform mat4 reflMatrix;\nvarying vec4 vReflUv;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vReflUv = reflMatrix * vec4( transformed, 1.0 );');
      sh.fragmentShader = 'uniform sampler2D tReflect;\nuniform float reflStrength;\nvarying vec4 vReflUv;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec2 ruv = vReflUv.xy / vReflUv.w;
        vec3 refl = texture2D(tReflect, ruv).rgb * 0.16;
        refl += texture2D(tReflect, ruv + vec2(0.0, 0.012)).rgb * 0.13;
        refl += texture2D(tReflect, ruv - vec2(0.0, 0.012)).rgb * 0.13;
        refl += texture2D(tReflect, ruv + vec2(0.0, 0.028)).rgb * 0.1;
        refl += texture2D(tReflect, ruv - vec2(0.0, 0.028)).rgb * 0.1;
        refl += texture2D(tReflect, ruv + vec2(0.005, 0.05)).rgb * 0.07;
        refl += texture2D(tReflect, ruv - vec2(0.005, 0.05)).rgb * 0.07;
        refl += texture2D(tReflect, ruv + vec2(0.006, 0.0)).rgb * 0.12;
        refl += texture2D(tReflect, ruv - vec2(0.006, 0.0)).rgb * 0.12;
        totalEmissiveRadiance += refl * reflStrength * (0.55 + 0.6 * diffuseColor.g);`);
    };
    reflectFloor.material.dispose(); reflectFloor.material = rm;
    reflectFloor.position.set(L / 2, 0, D / 2); reflectFloor.rotation.x = -Math.PI / 2;
    add(reflectFloor);
  } else add(plainFloor);

  // ── walls ──
  const wall = (len, h, x, z, ry) => { const g = scaleUV(new THREE.PlaneGeometry(len, h), len / B.size, h / B.size); const m = M(g, brickMat, x, h / 2, z); m.rotation.y = ry; add(m); occluders.push(m); return m; };
  const southWall = wall(L, WH, L / 2, D, Math.PI);          // seating wall (south)
  const northWall = wall(L, WH, L / 2, 0, 0);                  // bar/bathroom wall (north)
  const gable = () => {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(D, 0); s.lineTo(D, WH);
    for (let i = 32; i >= 0; i--) { const z = D * i / 32; s.lineTo(z, archY(z) + 0.02); }
    s.closePath(); const g = new THREE.ShapeGeometry(s); return scaleUV(g, 1 / B.size, 1 / B.size);
  };
  const west = M(gable(), brickMat, 0, 0, D); west.rotation.y = Math.PI / 2; add(west); occluders.push(west);
  const east = M(gable(), brickMat, L, 0, 0); east.rotation.y = -Math.PI / 2; add(east); occluders.push(east);
  colliders.push({ seg: [0, 0, L, 0], r: 0.05 }, { seg: [0, D, L, D], r: 0.05 }, { seg: [0, 0, 0, D], r: 0.05 }, { seg: [L, 0, L, D], r: 0.05 });

  // ── arched plank ceiling ──
  {
    const g = new THREE.PlaneGeometry(L, D, 1, 64), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) + L / 2, z = -p.getY(i) + D / 2; p.setXYZ(i, x, archY(z), z); }
    g.computeVertexNormals(); scaleUV(g, L / 2.4, D / 2.4);
    add(M(g, ceilMat));
  }
  // rafters (dense ribs), purlins, bowstring trusses, steel tie beams
  {
    const wood = [], steelG = [];
    const arcPts = (x, drop, n = 18) => Array.from({ length: n + 1 }, (_, i) => { const z = 0.05 + (D - 0.1) * i / n; return new THREE.Vector3(x, archY(z) - drop, z); });
    for (let x = 0.4; x < L - 0.2; x += 0.75) { const p = arcPts(x, 0.08, 16); for (let i = 0; i < p.length - 1; i++) wood.push(beam(p[i], p[i + 1], 0.06, 0.14)); }
    for (const zf of [0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88]) { const z = D * zf, y = archY(z) - 0.2; wood.push(beam(new THREE.Vector3(0.05, y, z), new THREE.Vector3(L - 0.05, y, z), 0.1, 0.18)); }
    for (const x of [2.7, 8.5, 14.5, 20.5, 26.3]) {
      const top = arcPts(x, 0.32, 20);
      for (let i = 0; i < top.length - 1; i++) wood.push(beam(top[i], top[i + 1], 0.2, 0.32));
      const yb = WH - 0.12;
      steelG.push(beam(new THREE.Vector3(x, yb, 0.05), new THREE.Vector3(x, yb, D - 0.05), 0.16, 0.22));
      for (let i = 1; i < 10; i++) {
        const z = D * i / 10, t = top.reduce((a, b) => Math.abs(b.z - z) < Math.abs(a.z - z) ? b : a);
        wood.push(beam(new THREE.Vector3(x, yb + 0.1, z), t, 0.11, 0.11));
        const z2 = D * (i + (i < 5 ? 1 : -1)) / 10, t2 = top.reduce((a, b) => Math.abs(b.z - z2) < Math.abs(a.z - z2) ? b : a);
        wood.push(beam(new THREE.Vector3(x, yb + 0.1, z), t2, 0.09, 0.09));
      }
    }
    for (let i = 0; i < 4; i++) { const xs = [2.7, 8.5, 14.5, 20.5, 26.3]; steelG.push(beam(new THREE.Vector3(xs[i], WH - 0.1, 0.4), new THREE.Vector3(xs[i + 1], WH - 0.1, D - 0.4), 0.025, 0.025), beam(new THREE.Vector3(xs[i], WH - 0.1, D - 0.4), new THREE.Vector3(xs[i + 1], WH - 0.1, 0.4), 0.025, 0.025)); }
    add(new THREE.Mesh(mergeGeometries(wood), woodMat));
    add(new THREE.Mesh(mergeGeometries(steelG), steel));
    // skylights (night sky through the glass)
    const sky = std({ color: '#0b1324', emissive: '#16223c', emissiveIntensity: 0.7, roughness: 0.2 });
    for (const [x, z] of [[5.6, 4.2], [11.5, 8.6], [17.4, 4.2], [23.4, 8.6]]) { const s = M(new THREE.PlaneGeometry(1.9, 1.3), sky, x, archY(z) - 0.03, z); s.rotation.x = Math.PI / 2; s.rotation.y = 0; add(s); }
    // red sprinkler pipes along the long walls
    const pipe = std({ color: '#8f1b17', roughness: 0.5, metalness: 0.3 });
    for (const z of [0.18, D - 0.18]) { const p = M(new THREE.CylinderGeometry(0.06, 0.06, L, 12), pipe, L / 2, WH - 0.3, z); p.rotation.z = Math.PI / 2; add(p); }
    // fluorescent fixtures (off) + ceiling fans
    for (const x of [5.6, 11.5, 17.4, 23.4]) for (const z of [D * 0.35, D * 0.65]) add(M(new THREE.BoxGeometry(1.2, 0.06, 0.18), std({ color: '#3a3532', roughness: 0.6 }), x, WH - 0.3, z));
    for (const x of [8.5, 20.5]) {
      const fan = new THREE.Group(); fan.position.set(x - 2.9, WH - 0.05, D / 2);
      fan.add(M(new THREE.CylinderGeometry(0.012, 0.012, 0.5), steel, 0, 0.25, 0), M(new THREE.CylinderGeometry(0.11, 0.09, 0.12, 14), steel));
      for (let i = 0; i < 3; i++) { const b = M(new THREE.BoxGeometry(0.75, 0.015, 0.14), black, 0.42, -0.02, 0); const h = new THREE.Group(); h.rotation.y = i * 2.094; h.add(b); fan.add(h); }
      add(fan); dynamic.add(fan); tick.push((dt) => { fan.rotation.y += dt * 0.6; });
    }
  }

  // ── uplights: a can on the floor + a warm cone of light washed up the surface ──
  const AMBER = '#ff8a2c', RED = '#ff2414';
  const matCache = new Map();
  const cached = (key, make) => { if (!matCache.has(key)) matCache.set(key, make()); return matCache.get(key); };
  const splashMat = (color, k) => cached('s' + color + k, () => new THREE.MeshBasicMaterial({ map: splashTex, color: new THREE.Color(color).multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const poolMat = (color) => cached('p' + color, () => new THREE.MeshBasicMaterial({ map: TX.softDisc(), color: new THREE.Color(color).multiplyScalar(0.35), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const upWashes = []; let drapeInfo = null;
  function uplight(x, z, nx, nz, color, { h = 4.0, w = 1.5, off = 0.02, k = 1.15 } = {}) {
    const can = new THREE.Group(); can.position.set(x + nx * 0.32, 0, z + nz * 0.32);
    can.add(M(new THREE.BoxGeometry(0.16, 0.04, 0.12), black, 0, 0.02, 0));
    const body = M(new THREE.CylinderGeometry(0.075, 0.075, 0.16, 14), black, 0, 0.13, 0); body.rotation.x = 0.5; body.rotation.order = 'YXZ'; body.rotation.y = Math.atan2(-nx, -nz); can.add(body);
    const lens = M(new THREE.CircleGeometry(0.062, 16), glow(color, 1.6), 0, 0.08, 0); body.add(lens); lens.rotation.x = -Math.PI / 2;
    add(can);
    // which surface this light washes, and how far along it (in meters from that surface's u = 0 edge)
    let surf, along;
    if (nz === -1) { surf = 'south'; along = L - x; } else if (nx === 1) { surf = 'west'; along = D - z; } else if (nx === -1) { surf = 'east'; along = z; }
    else if (z > 0.3) { surf = 'drape'; along = x - (drapeInfo ? drapeInfo.x1 : 0); } else { surf = 'north'; along = x; }
    upWashes.push({ surf, along, x, color: new THREE.Color(color), h, w, k });
    const pool = M(new THREE.PlaneGeometry(1.1, 1.1), poolMat(color), x + nx * 0.35, 0.006, z + nz * 0.35);
    pool.rotation.x = -Math.PI / 2; pool.scale.set(1, 0.6, 1); add(pool);
  }
  for (let xf = 4; xf < 94; xf += 7.5) { if (xf > 51 && xf < 65) continue; uplight(f(xf), D, 0, -1, (Math.round(xf / 7.5) % 3 === 1) ? RED : AMBER); }
  uplight(f(50.5), D, 0, -1, AMBER); uplight(f(65.5), D, 0, -1, AMBER);
  for (const xf of [27, 34.5, 41.5]) uplight(f(xf), 0, 0, 1, AMBER, { h: 3.6 });
  uplight(f(46), 0, 0, 1, RED, { h: 3.4 });
  for (const zf of [3.5, 9, 13.5, 28.5, 33.5, 39]) uplight(0, f(zf), 1, 0, AMBER, { h: 4.3, w: 1.6, k: zf === 13.5 || zf === 28.5 ? 1.5 : 1.1 });
  for (const zf of [32, 39.5]) uplight(L, f(zf), -1, 0, RED, { h: 3.4 });

  // ── "The Angelos" gobo on the seating wall ──
  TX.goboLogo().then((tex) => {
    const g = M(new THREE.PlaneGeometry(3.2, 2.5), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color('#ffd7a8').multiplyScalar(0.95), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), f(V.gobo.x), f(V.gobo.y), D - 0.025);
    g.rotation.y = Math.PI; g.renderOrder = 4; add(g);
  });

  // ── crushed velvet drape along the north wall (garage end) ──
  {
    const x1 = f(V.drape.x1), x2 = f(V.drape.x2) - 0.05, len = x2 - x1, h = WH - 0.3;
    const g = new THREE.PlaneGeometry(len, h, 360, 12), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const sway = 1 - (y + h / 2) / h * 0.3; p.setZ(i, (0.07 * Math.sin(x * 11) + 0.035 * Math.sin(x * 27 + 1.3) + 0.02 * Math.sin(x * 53)) * sway); }
    g.computeVertexNormals(); scaleUV(g, len / 1.6, h / 1.6);
    const vel = new THREE.MeshPhysicalMaterial({ map: TX.velvet(), color: '#c23848', roughness: 0.78, sheen: 1, sheenColor: new THREE.Color('#ff5868'), sheenRoughness: 0.32 });
    const drape = M(g, vel, x1 + len / 2, h / 2 + 0.02, 0.42); add(drape); occluders.push(drape);
    drapeInfo = { mesh: drape, x1, len, h };
    const rod = M(new THREE.CylinderGeometry(0.025, 0.025, len, 8), black, x1 + len / 2, h + 0.05, 0.42); rod.rotation.z = Math.PI / 2; add(rod);
    for (const xf of [79, 84.5, 90, 94]) uplight(f(xf), 0.42, 0, 1, xf === 84.5 || xf === 94 ? AMBER : RED, { h: 3.8, w: 1.7, off: 0.12, k: 1.3 });
    colliders.push({ seg: [x1, 0.5, x2, 0.5], r: 0.1 });
  }

  // ── east wall: garage door, front door, electrical panels ──
  {
    const gz1 = f(V.garageDoor.z1), gz2 = f(V.garageDoor.z2), gh = f(12);
    const gd = M(scaleUV(new THREE.PlaneGeometry(gz2 - gz1, gh), 1, (gh) / 0.9), std({ map: TX.ribbedMetal(), roughness: 0.55, metalness: 0.5, color: '#9a9a9a' }), L - 0.03, gh / 2, (gz1 + gz2) / 2);
    gd.rotation.y = -Math.PI / 2; add(gd);
    for (const z of [gz1, gz2]) add(M(new THREE.BoxGeometry(0.12, gh, 0.12), steel, L - 0.06, gh / 2, z));
    add(M(new THREE.BoxGeometry(0.12, 0.14, gz2 - gz1 + 0.12), steel, L - 0.06, gh, (gz1 + gz2) / 2));
    const fz1 = f(V.frontDoor.z1), fz2 = f(V.frontDoor.z2);
    const door = M(new THREE.BoxGeometry(0.05, 2.2, fz2 - fz1), std({ color: '#ece6dc', roughness: 0.6 }), L - 0.03, 1.1, (fz1 + fz2) / 2); add(door);
    for (const [y, hh] of [[1.55, 0.8], [0.55, 0.8]]) add(M(new THREE.BoxGeometry(0.02, hh, fz2 - fz1 - 0.25), std({ color: '#ddd5c8', roughness: 0.6 }), L - 0.065, y, (fz1 + fz2) / 2));
    add(M(new THREE.SphereGeometry(0.03, 10, 8), std({ color: '#c9a45c', metalness: 1, roughness: 0.3 }), L - 0.09, 1.05, fz2 - 0.12));
    add(M(new THREE.BoxGeometry(0.06, 0.08, 1.14), std({ color: '#ece6dc' }), L - 0.04, 2.24, (fz1 + fz2) / 2));
    for (const [z, y, hh] of [[f(35), 1.5, 0.7], [f(36.6), 1.6, 0.5]]) add(M(new THREE.BoxGeometry(0.12, hh, 0.4), std({ color: '#6c6a66', metalness: 0.4, roughness: 0.5 }), L - 0.07, y, z));
  }

  // ── two chrome rolling clothing racks in the corner left of the garage door, with chrome hangers ──
  {
    const hangerG = (() => {
      const pts = [new THREE.Vector3(-0.2, -0.13, 0), new THREE.Vector3(0, -0.02, 0), new THREE.Vector3(0.2, -0.13, 0), new THREE.Vector3(-0.2, -0.13, 0)];
      const tri = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.05), 24, 0.004, 5, true);
      const neck = new THREE.CylinderGeometry(0.003, 0.003, 0.03, 5).translate(0, -0.005, 0);
      const hook = new THREE.TorusGeometry(0.022, 0.003, 5, 12, Math.PI * 1.4).rotateZ(-Math.PI * 0.2).translate(0, 0.03, 0);
      return mergeGeometries([tri, neck, hook].map((g) => (g.index ? g.toNonIndexed() : g)));
    })();
    for (const cxf of [86.9, 92.5]) {
      const g = new THREE.Group(); g.position.set(f(cxf), 0, D - 0.42);
      const len = 1.45, h = 1.62, tube = new THREE.CylinderGeometry(0.014, 0.014, 1, 10);
      for (const sx of [-len / 2, len / 2]) {
        const post = M(tube, chrome, sx, h / 2 + 0.06, 0); post.scale.set(1, h, 1); g.add(post);
        const foot = M(tube, chrome, sx, 0.07, 0); foot.scale.set(1, 0.5, 1); foot.rotation.x = Math.PI / 2; g.add(foot);
        for (const sz of [-0.24, 0.24]) {
          g.add(M(new THREE.CylinderGeometry(0.028, 0.028, 0.025, 12), black, sx, 0.03, sz).rotateZ(Math.PI / 2));
          g.add(M(new THREE.BoxGeometry(0.03, 0.03, 0.03), chrome, sx, 0.055, sz));
        }
      }
      const rail = M(tube, chrome, 0, h + 0.06, 0); rail.scale.set(1, len + 0.03, 1); rail.rotation.z = Math.PI / 2; g.add(rail);
      const low = M(tube, chrome, 0, 0.2, 0); low.scale.set(0.8, len, 0.8); low.rotation.z = Math.PI / 2; g.add(low);
      const n = 11;
      for (let i = 0; i < n; i++) {
        const hg = M(hangerG, chrome, -len / 2 + 0.14 + i * (len - 0.28) / (n - 1), h + 0.03, 0);
        hg.rotation.y = Math.PI / 2 + Math.sin(i * 2.3) * 0.12; g.add(hg);
      }
      add(g); box(f(cxf) - len / 2 - 0.05, D - 0.72, f(cxf) + len / 2 + 0.05, D);
    }
  }

  // ── bathrooms (closed boxes) ──
  for (const b of V.bathrooms) {
    const x1 = f(b.x1), x2 = f(b.x2), z2 = f(b.z2), h = f(9.5);
    const g = scaleUV(new THREE.BoxGeometry(x2 - x1, h, z2), 1, 1);
    const m = M(g, plaster, (x1 + x2) / 2, h / 2, z2 / 2); add(m); occluders.push(m);
    add(M(new THREE.BoxGeometry(x2 - x1 + 0.02, 0.12, z2 + 0.02), std({ color: '#efe9df' }), (x1 + x2) / 2, 0.06, z2 / 2));
    const dx = f(b.door);
    add(M(new THREE.BoxGeometry(0.98, 2.12, 0.05), std({ color: '#efe9df', roughness: 0.6 }), dx, 1.06, z2 + 0.025));
    add(M(new THREE.BoxGeometry(0.88, 2.06, 0.03), std({ color: '#e6ded2', roughness: 0.55 }), dx, 1.03, z2 + 0.045));
    add(M(new THREE.SphereGeometry(0.03, 10, 8), std({ color: '#bfbfbf', metalness: 1, roughness: 0.3 }), dx + 0.36, 1.0, z2 + 0.07));
    const sign = M(new THREE.PlaneGeometry(0.3, 0.12), new THREE.MeshBasicMaterial({ map: TX.textCanvas(256, 100, (g2, w, hh) => { g2.fillStyle = '#1a1a1a'; g2.fillRect(0, 0, w, hh); g2.fillStyle = '#eee'; g2.font = '600 40px Helvetica, Arial'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText('RESTROOM', w / 2, hh / 2 + 2); }) }), dx, 1.62, z2 + 0.065);
    add(sign);
    box(x1, 0, x2, z2);
  }

  // ── photo booth ──
  {
    const pb = V.photoBooth, x1 = f(pb.x1), x2 = f(pb.x2), z1 = f(pb.z1), z2 = f(pb.z2);
    const W = z2 - z1, Dp = x2 - x1, H = 2.15;
    const g = new THREE.Group(); g.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2); g.rotation.y = Math.PI / 2;   // front faces the garage door
    const zw = std({ map: TX.zebrawood(), roughness: 0.55, color: '#c9a383' });
    const alu = std({ color: '#b8b8b8', metalness: 0.9, roughness: 0.35 });
    const half = W / 2, d2 = Dp / 2;
    g.add(M(new THREE.BoxGeometry(W, H, 0.04), zw, 0, H / 2, -d2));                 // back
    g.add(M(new THREE.BoxGeometry(0.04, H, Dp), zw, -half, H / 2, 0));            // sides
    g.add(M(new THREE.BoxGeometry(0.04, H, Dp), zw, half, H / 2, 0));
    g.add(M(new THREE.BoxGeometry(W, 0.05, Dp), zw, 0, H, 0));                    // roof
    const leftW = W * 0.38;
    g.add(M(new THREE.BoxGeometry(leftW, H, 0.05), zw, -half + leftW / 2, H / 2, d2));
    g.add(M(new THREE.BoxGeometry(0.22, H, 0.05), zw, half - 0.11, H / 2, d2));
    g.add(M(new THREE.BoxGeometry(W - leftW - 0.22, 0.3, 0.05), zw, (-half + leftW + half - 0.22) / 2, H - 0.15, d2));
    for (const [x, y, w2, h2] of [[0, H, W + 0.03, 0.04], [0, 0.02, W + 0.03, 0.04], [-half, H / 2, 0.04, H], [half, H / 2, 0.04, H], [-half + leftW, H / 2, 0.04, H], [half - 0.22, H / 2, 0.04, H]])
      g.add(M(new THREE.BoxGeometry(w2, h2, 0.03), alu, x, y, d2 + 0.03));
    const screen = TX.textCanvas(640, 760, (c, W2, H2) => { c.scale(2, 2); const w = W2 / 2, h = H2 / 2;
      c.fillStyle = '#f2efe8'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1a1a1a'; c.font = '700 44px Georgia, serif'; c.textAlign = 'center'; c.fillText('PHOTOS', w / 2, 52);
      for (let i = 0; i < 4; i++) { c.fillStyle = '#222'; c.fillRect(22 + i * 72, 78, 60, 280); for (let k = 0; k < 4; k++) { c.fillStyle = `hsl(${10 + k * 8},20%,${55 + ((i + k) % 3) * 10}%)`; c.fillRect(27 + i * 72, 84 + k * 68, 50, 60); } }
    });
    screen.anisotropy = 16;
    g.add(M(new THREE.BoxGeometry(leftW - 0.1, 0.7, 0.012), alu, -half + leftW / 2, 1.55, d2 + 0.034));
    g.add(M(new THREE.PlaneGeometry(leftW - 0.16, 0.62), new THREE.MeshBasicMaterial({ map: screen, color: new THREE.Color(0.78, 0.76, 0.74), polygonOffset: true, polygonOffsetFactor: -2 }), -half + leftW / 2, 1.55, d2 + 0.047));
    g.add(M(new THREE.BoxGeometry(0.14, 0.04, 0.02), black, -half + leftW / 2, 0.98, d2 + 0.035));
    // black curtain doorway
    const cw = W - leftW - 0.22, cg = new THREE.PlaneGeometry(cw, H - 0.35, 60, 4), cp = cg.attributes.position;
    for (let i = 0; i < cp.count; i++) cp.setZ(i, 0.035 * Math.sin(cp.getX(i) * 40));
    cg.computeVertexNormals();
    g.add(M(cg, std({ color: '#0b0b0e', roughness: 0.9, side: THREE.DoubleSide }), -half + leftW + cw / 2, (H - 0.35) / 2 + 0.02, d2 - 0.02));
    for (let i = 0; i < 6; i++) g.add(M(new THREE.TorusGeometry(0.02, 0.005, 6, 12), chrome, -half + leftW + 0.06 + i * (cw - 0.12) / 5, H - 0.36, d2 - 0.02));
    add(g); box(x1, z1, x2, z2);
    readables.push({ obj: g, name: 'Photo booth', open: 'booth' });
    dynamic.add(g);   // keep it its own object so clicks can find it   // click it to step inside the booth gallery
  }

  // ── tattoo lounge: rug, bed, stool, flash art, velvet ropes ──
  {
    const t = V.tattoo, x1 = f(t.x1), x2 = f(t.x2), z1 = f(t.z1), z2 = f(t.z2);
    const rug = M(new THREE.PlaneGeometry(f(8.4), f(5.8)), std({ map: TX.persian('#5e1418'), roughness: 1 }), f(35.6), 0.006, f(3.8)); rug.rotation.x = -Math.PI / 2; add(rug);
    const leather = std({ color: '#121212', roughness: 0.45 });
    // big wood-framed mirror on the brick, reflecting the room
    {
      const mg = new THREE.Group(); mg.position.set(f(34.8), 0.2, 0.32); mg.rotation.x = -0.1;   // bottom on the blocks, top resting on the brick
      mg.add(M(new THREE.BoxGeometry(1.15, 1.85, 0.06), std({ color: '#3b2216', roughness: 0.5 }), 0, 0.925, 0));
      mg.add(M(new THREE.PlaneGeometry(1.0, 1.7), new THREE.MeshStandardMaterial({ color: '#a59a95', metalness: 1, roughness: 0.04, envMapIntensity: 2.4 }), 0, 0.925, 0.032));
      add(mg);
      const block = std({ map: TX.concrete(165), color: '#b9b4ac', roughness: 0.95 });
      for (const dx of [-0.36, 0.36]) {
        add(M(new THREE.BoxGeometry(0.4, 0.2, 0.2), block, f(34.8) + dx, 0.1, 0.33));
        for (const hx of [-0.09, 0.09]) add(M(new THREE.BoxGeometry(0.13, 0.14, 0.005), std({ color: '#3a3836' }), f(34.8) + dx + hx, 0.1, 0.433));   // the two holes
      }
      box(f(34.8) - 0.6, 0, f(34.8) + 0.6, 0.48);
    }
    // two artist stations: black rolling stools, a small side table of inks on the left, an arm rest on the right, gooseneck lamps
    const stool = (x, z) => { const g = new THREE.Group(); g.position.set(x, 0, z);
      g.add(M(new THREE.CylinderGeometry(0.19, 0.19, 0.07, 18), leather, 0, 0.56, 0), M(new THREE.CylinderGeometry(0.022, 0.022, 0.5), chrome, 0, 0.28, 0));
      for (let i = 0; i < 5; i++) { const a = i * 1.2566; g.add(new THREE.Mesh(beam(new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(Math.cos(a) * 0.26, 0.03, Math.sin(a) * 0.26), 0.03, 0.02), black)); g.add(M(new THREE.SphereGeometry(0.025, 8, 6), black, Math.cos(a) * 0.26, 0.025, Math.sin(a) * 0.26)); }
      add(g); circle(x, z, 0.28); };
    stool(f(31.6), f(3.3)); stool(f(37.6), f(3.2));
    { const t = new THREE.Group(); t.position.set(f(30.9), 0, f(1.6));                       // inks table
      t.add(M(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 24), woodMat, 0, 0.62, 0), M(new THREE.CylinderGeometry(0.02, 0.02, 0.6), black, 0, 0.31, 0), M(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 18), black, 0, 0.01, 0));
      ['#e8323c', '#111111', '#2c55c8', '#e8b030', '#1d8a4a', '#ffffff'].forEach((c, i) => t.add(M(new THREE.CylinderGeometry(0.018, 0.016, 0.04, 10), std({ color: c, roughness: 0.3 }), Math.cos(i) * 0.12, 0.655, Math.sin(i) * 0.12)));
      for (let i = 0; i < 3; i++) t.add(M(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 10), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, roughness: 0.1 }), -0.1 + i * 0.08, 0.705, -0.12));
      t.add(M(new THREE.BoxGeometry(0.16, 0.05, 0.1), std({ color: '#2c55c8', roughness: 0.5 }), 0.1, 0.66, -0.1));
      add(t); circle(f(30.9), f(1.6), 0.3); }
    // (no arm rest: Lori is getting her back shoulder done)
    for (const [xf, zf, lean] of [[32.3, 0.9, 0.5], [36.9, 0.9, -0.5]]) {                   // gooseneck floor lamps
      const x = f(xf), z = f(zf);
      add(M(new THREE.CylinderGeometry(0.14, 0.14, 0.025, 18), black, x, 0.013, z), M(new THREE.CylinderGeometry(0.012, 0.012, 1.45), black, x, 0.73, z));
      const neckC = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 1.45, z), new THREE.Vector3(x + lean * 0.12, 1.62, z + 0.12), new THREE.Vector3(x + lean * 0.3, 1.6, z + 0.32)]);
      add(new THREE.Mesh(new THREE.TubeGeometry(neckC, 12, 0.01, 6), black));
      add(M(new THREE.CylinderGeometry(0.045, 0.06, 0.1, 14, 1, true), black, x + lean * 0.3, 1.56, z + 0.32), M(new THREE.CircleGeometry(0.045, 14), glow('#fff3dd', 1.1), x + lean * 0.3, 1.51, z + 0.32).rotateX(Math.PI / 2));
      const l = new THREE.PointLight('#ffe2b8', 0.9, 2.5, 2); l.position.set(x + lean * 0.3, 1.4, z + 0.32); add(l);
    }
    add(M(new THREE.BoxGeometry(0.42, 0.3, 0.3), std({ color: '#141414', roughness: 0.8 }), f(39.4), 0.15, f(1.3)));   // black tote of supplies
    // a pair of guest chairs
    for (const [xf, zf, face] of [[29.6, 4.2, 1], [40.0, 4.2, -1]]   /* one chair each side */) { const c = new THREE.Group(); c.position.set(f(xf), 0, f(zf)); c.rotation.y = xf === 29.6 ? -0.3 : face * Math.PI / 2;   /* left chair turned so Lori's back-left shoulder faces Isa */ c.add(M(new THREE.BoxGeometry(0.46, 0.06, 0.46), leather, 0, 0.45, 0), M(new THREE.BoxGeometry(0.46, 0.5, 0.05), leather, 0, 0.72, -0.21)); for (const [a, b] of [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]]) c.add(M(new THREE.CylinderGeometry(0.012, 0.012, 0.45), chrome, a, 0.22, b)); add(c); circle(f(xf), f(zf), 0.32); }
    // stanchions + red velvet ropes along the front and the open end
    // two runs of rope with an opening in the middle of the front; the left run goes back to the wall
    const runs = [[[28.4, 0.9], [28.4, 4.8], [28.4, 8.3], [30.9, 8.3], [33.2, 8.3]], [[36.4, 8.3], [38.7, 8.3], [41.0, 8.3], [41.0, 4.6]]].map((run) => run.map(([a, b]) => new THREE.Vector3(f(a), 0, f(b))));
    const rope = std({ color: '#8c0f1c', roughness: 0.7 });
    for (const posts of runs) posts.forEach((p, i) => {
      add(M(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 20), chrome, p.x, 0.02, p.z));
      add(M(new THREE.CylinderGeometry(0.025, 0.025, 0.95), chrome, p.x, 0.48, p.z));
      add(M(new THREE.SphereGeometry(0.045, 12, 10), chrome, p.x, 0.97, p.z));
      if (i < posts.length - 1) {
        const q = posts[i + 1], mid = p.clone().lerp(q, 0.5);
        const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(p.x, 0.92, p.z), new THREE.Vector3(mid.x, 0.62, mid.z), new THREE.Vector3(q.x, 0.92, q.z));
        add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.022, 8), rope));
        colliders.push({ seg: [p.x, p.z, q.x, q.z], r: 0.08 });
      }
    });
  }

  // ── arcade cabinets ──
  const screens = [];
  for (const a of V.arcade) {
    const g = new THREE.Group(); g.position.set(f(a.x), 0, 0.5);
    const art = { brawl: ['#1b3f8f', '#f2a12a'], maze: ['#141414', '#ffd23a'], duel: ['#3a0a0a', '#d8322a'] }[a.look];
    const bodyM = std({ color: art[0], roughness: 0.45 }), trim = std({ color: art[1], roughness: 0.4 });
    const prof = new THREE.Shape(); [[-0.42, 0], [0.36, 0], [0.36, 0.86], [0.44, 0.94], [0.2, 1.04], [0.25, 1.52], [0.37, 1.56], [0.37, 1.86], [-0.42, 1.86]].forEach(([z, y], i) => i ? prof.lineTo(z, y) : prof.moveTo(z, y));
    for (const s of [-1, 1]) { const side = M(new THREE.ExtrudeGeometry(prof, { depth: 0.035, bevelEnabled: false }), bodyM, s * 0.34 - (s > 0 ? 0 : 0.035), 0, 0); side.rotation.y = -Math.PI / 2; side.position.x = s * 0.34 + (s < 0 ? 0 : 0.035); add; g.add(side);
      const stripe = M(new THREE.BoxGeometry(0.005, 1.2, 0.08), trim, s * 0.378, 0.9, 0.05); stripe.rotation.x = 0.2; g.add(stripe); }
    g.add(M(new THREE.BoxGeometry(0.68, 0.86, 0.03), bodyM, 0, 0.43, 0.36));
    g.add(M(new THREE.BoxGeometry(0.68, 1.86, 0.03), bodyM, 0, 0.93, -0.41));
    g.add(M(new THREE.BoxGeometry(0.68, 0.03, 0.8), bodyM, 0, 1.86, -0.02));
    const panel = M(new THREE.BoxGeometry(0.68, 0.03, 0.27), trim, 0, 0.99, 0.32); panel.rotation.x = 0.36; g.add(panel);
    for (const s of [-0.18, 0.12]) { g.add(M(new THREE.CylinderGeometry(0.008, 0.008, 0.08), black, s, 1.05, 0.33), M(new THREE.SphereGeometry(0.025, 10, 8), glow('#d01818'), s, 1.09, 0.33)); for (let k = 0; k < 3; k++) g.add(M(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12), glow(['#ffcc22', '#2288ff', '#ff3344'][k], 1.2), s + 0.07 + k * 0.045, 1.03, 0.31)); }
    // screen
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 200;
    const st = new THREE.CanvasTexture(cv); st.colorSpace = THREE.SRGBColorSpace;
    const scr = M(new THREE.PlaneGeometry(0.56, 0.44), new THREE.MeshBasicMaterial({ map: st, color: new THREE.Color(1.25, 1.25, 1.25) }), 0, 1.28, 0.235); scr.rotation.x = -0.2; g.add(scr);
    g.add(M(new THREE.BoxGeometry(0.66, 0.52, 0.02), black, 0, 1.28, 0.22).rotateX(-0.2));
    screens.push({ cv, st, look: a.look });
    const mq = TX.textCanvas(512, 128, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, art[0]); gr.addColorStop(.5, '#000'); gr.addColorStop(1, art[0]); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.font = '900 italic 64px Impact, "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 8; c.strokeStyle = '#000'; c.strokeText(a.name, w / 2, h / 2); c.fillStyle = art[1]; c.fillText(a.name, w / 2, h / 2); });
    g.add(M(new THREE.PlaneGeometry(0.68, 0.28), new THREE.MeshBasicMaterial({ map: mq, color: new THREE.Color(1.4, 1.4, 1.4) }), 0, 1.71, 0.38));
    add(g); box(f(a.x) - 0.4, 0, f(a.x) + 0.4, 0.95);
    readables.push({ obj: g, name: a.name, open: 'game', game: a.look });   // click to play
    dynamic.add(g);
  }
  let scrT = 0;
  tick.push((dt, t) => {
    scrT -= dt; if (scrT > 0) return; scrT = 0.08;
    for (const s of screens) drawArcade(s.cv.getContext('2d'), s.look, t);
    for (const s of screens) s.st.needsUpdate = true;
  });

  // ── bar (L-shaped, concrete) with the flower tower and bartender ──
  {
    const b = V.bar, x1 = f(b.x1), x2 = f(b.x2), z1 = f(b.z1), z2 = f(b.z2), dp = f(b.depth), H = 1.1;
    const barMat = std({ map: TX.concrete(120), color: '#b4aea6', roughness: 0.75 });
    const top = std({ map: TX.concrete(140), color: '#c2bcb4', roughness: 0.55 });   // concrete counter top, a touch smoother than the sides
    add(M(new THREE.BoxGeometry(x2 - x1, H, dp), barMat, (x1 + x2) / 2, H / 2, z2 - dp / 2));
    add(M(new THREE.BoxGeometry(dp, H, z2 - z1 - dp), barMat, x2 - dp / 2, H / 2, (z1 + z2 - dp) / 2));
    add(M(new THREE.BoxGeometry(x2 - x1 + 0.04, 0.04, dp + 0.04), top, (x1 + x2) / 2, H + 0.02, z2 - dp / 2));
    add(M(new THREE.BoxGeometry(dp + 0.04, 0.04, z2 - z1 - dp), top, x2 - dp / 2, H + 0.02, (z1 + z2 - dp) / 2));
    for (let x = x1 + 1.2; x < x2 - 0.2; x += 1.2) add(M(new THREE.BoxGeometry(0.006, H - 0.02, 0.006), std({ color: '#7a756e' }), x, H / 2, z2 + 0.001));
    box(x1, z2 - dp, x2, z2); box(x2 - dp, z1, x2, z2);
    const cx = x2 - dp / 2, cz = z2 - dp / 2;
    add(flowerTower(cx, H + 0.04, cz));
    // red uplight on the floor in front of the corner: a real light aimed up at the bar corner and the flowers
    const fx = x2 + 0.5, fz = z2 + 0.5, aim = new THREE.Vector3(x2 - dp / 2, H + 0.45, z2 - dp / 2);
    const can = new THREE.Group(); can.position.set(fx, 0, fz); add(can); dynamic.add(can);
    can.add(M(new THREE.BoxGeometry(0.22, 0.04, 0.16), black, 0, 0.02, 0));
    const head = M(new THREE.CylinderGeometry(0.085, 0.095, 0.2, 16), black, 0, 0.17, 0);
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), aim.clone().sub(new THREE.Vector3(fx, 0.17, fz)).normalize()); can.add(head);
    { const lensGlow = M(new THREE.CircleGeometry(0.07, 16), glow('#ff2a14', 2.2), 0, 0.17, 0); lensGlow.translateOnAxis(aim.clone().sub(new THREE.Vector3(fx, 0.17, fz)).normalize(), 0.101); can.add(lensGlow); lensGlow.lookAt(aim); }
    const barSpot = new THREE.SpotLight('#ff2414', 22, 4.5, 0.62, 0.55, 1.3);
    barSpot.position.set(fx, 0.22, fz); barSpot.target.position.copy(aim); add(barSpot); add(barSpot.target);
    // counter details
    const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.35 });
    for (let i = 0; i < 3; i++) for (let k = 0; k < 6; k++) add(M(new THREE.CylinderGeometry(0.045, 0.035, 0.11, 14, 1, true), glass, x1 + 0.5 - i * 0.11, H + 0.1 + k * 0.025, z2 - 0.3));
    const disp = new THREE.Group(); disp.position.set(x2 - dp / 2, H + 0.04, z2 - dp - 0.28);   // on the back section, just past the flowers
    disp.add(M(new THREE.CylinderGeometry(0.13, 0.13, 0.36, 20), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, roughness: 0.05 }), 0, 0.2, 0));
    disp.add(M(new THREE.CylinderGeometry(0.12, 0.12, 0.26, 20), std({ color: '#c94a3a', transparent: true, opacity: 0.6, roughness: 0.1 }), 0, 0.15, 0));
    for (let i = 0; i < 5; i++) disp.add(M(new THREE.SphereGeometry(0.03, 8, 6), std({ color: i % 2 ? '#f0b030' : '#4f8a3a' }), Math.sin(i) * 0.06, 0.12 + i * 0.04, Math.cos(i) * 0.06));
    disp.add(M(new THREE.BoxGeometry(0.08, 0.06, 0.06), chrome, 0, 0.06, 0.13));
    add(disp);
    const lamp = new THREE.Group(); lamp.position.set(x1 + 1.45, H + 0.04, z2 - 0.25);
    const brass = std({ color: '#c9a45c', metalness: 1, roughness: 0.3 });
    lamp.add(M(new THREE.CylinderGeometry(0.06, 0.07, 0.02, 16), brass), M(new THREE.CylinderGeometry(0.01, 0.01, 0.28), brass, 0, 0.14, 0), M(new THREE.ConeGeometry(0.08, 0.06, 20, 1, true), brass, 0, 0.3, 0), M(new THREE.CircleGeometry(0.07, 16), glow('#ffe2b0', 2.2), 0, 0.27, 0).rotateX(Math.PI / 2));
    add(lamp);
    const ll = new THREE.PointLight('#ffcf8a', 0.6, 2.2, 2); ll.position.set(x1 + 1.45, H + 0.28, z2 - 0.25); add(ll);
    for (let i = 0; i < 7; i++) add(M(new THREE.CylinderGeometry(0.035, 0.04, 0.24 + (i % 3) * 0.04, 12), std({ color: ['#2f5a2a', '#6a1d1d', '#c9a45c', '#d8d8d8'][i % 4], roughness: 0.15, transparent: true, opacity: 0.9 }), x2 - dp / 2, H + 0.16, z2 - dp - 0.7 - i * 0.12));
    for (let i = 0; i < 2; i++) add(M(new THREE.CylinderGeometry(0.04, 0.035, 0.2, 14), chrome, x2 - 1.3 + i * 0.15, H + 0.14, z2 - 0.4));
    add(M(new THREE.SphereGeometry(0.16, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), black, x2 - 1.75, H + 0.2, z2 - 0.35));
    for (let i = 0; i < 4; i++) add(M(new THREE.SphereGeometry(0.045, 10, 8), std({ color: ['#e8a030', '#c83a2a', '#f0c040', '#d8442a'][i] }), x2 - 1.7 + (i % 2) * 0.08, H + 0.22, z2 - 0.38 + (i > 1 ? 0.07 : 0)));
    // the real bar menu, in a brass frame on a little stand, facing the room
    {
      const mw = 0.2, mh = mw * 2000 / 1428;
      fontsReady().then(() => {
        const card = typesetCard(BAR_MENU, { withDoodle: true });
        const stand = menuStand(card.tex, mw, mh); stand.position.set(x2 - dp - 0.2, H + 0.04, z2 - 0.16); stand.rotation.x = -0.18;
        add(stand); readables.push({ obj: stand, canvas: card.canvas, img: 'images/bar-menu.jpg', name: 'Bar menu' });
      });
    }
    for (const [xf, v] of [[70, 0], [66.2, 1]]) { const bt = makeBartender(v); bt.root.position.set(f(xf), 0, z2 - dp - 0.55); add(bt.root); bartenders.push(bt.root); dynamic.add(bt.root); tick.push((dt, t) => bt.update(dt, t + v * 2.7)); }
    uplight(f(68), 0.42, 0, 1, AMBER, { h: 3.8, w: 1.7, off: 0.12, k: 1.35 });   // glow on the drape behind the bartenders
  }

  // ── band: rug, LED tubes, speakers, monitors, the X and the red door ──
  const band = [];
  {
    const b = V.band, x1 = f(b.x1), x2 = f(b.x2), z1 = f(b.z1), z2 = f(b.z2);
    const rug = M(new THREE.PlaneGeometry(x2 - x1, z2 - z1), std({ map: TX.persian('#4e0f14'), roughness: 1 }), (x1 + x2) / 2, 0.007, (z1 + z2) / 2); rug.rotation.x = -Math.PI / 2; add(rug);
    const strap = std({ color: '#3a2f2a', roughness: 0.6, metalness: 0.4 });
    const bx1 = f(V.brickX.z1), bx2 = f(V.brickX.z2);
    add(new THREE.Mesh(beam(new THREE.Vector3(0.05, 0.4, bx1), new THREE.Vector3(0.05, 3.9, bx2), 0.06, 0.16), strap));
    add(new THREE.Mesh(beam(new THREE.Vector3(0.05, 0.4, bx2), new THREE.Vector3(0.05, 3.9, bx1), 0.06, 0.16), strap));
    const rz1 = f(V.redDoor.z1), rz2 = f(V.redDoor.z2);
    add(M(new THREE.BoxGeometry(0.06, 2.9, rz2 - rz1), std({ color: '#a3161c', roughness: 0.6 }), 0.04, 1.45, (rz1 + rz2) / 2));
    for (let i = 1; i < 5; i++) add(M(new THREE.BoxGeometry(0.02, 2.8, 0.02), std({ color: '#7c1015' }), 0.08, 1.45, rz1 + (rz2 - rz1) * i / 5));
    const tubeM = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.2, 0.05, 0.02) });             // bright enough to bloom, pure red
    const haloM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.02, 0.01), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
    const floorGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.01, 0.0), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    const led = (x, z, h = 1.25) => { add(M(new THREE.CylinderGeometry(0.03, 0.03, h, 10), tubeM, x, h / 2 + 0.08, z)); add(M(new THREE.CylinderGeometry(0.11, 0.11, h + 0.1, 16, 1, true), haloM, x, h / 2 + 0.08, z)); add(M(new THREE.CircleGeometry(0.55, 24), floorGlow, x, 0.009, z).rotateX(-Math.PI / 2)); add(M(new THREE.CylinderGeometry(0.07, 0.08, 0.08, 12), black, x, 0.04, z)); };
    led(f(12.3), f(14.2)); led(f(12.3), f(33.8)); led(f(3.4), f(16.5)); led(f(3.4), f(31.5)); led(f(8), f(12.9)); led(f(8), f(35));
    for (const [za, zb] of [[17.5, 20.5], [26.5, 29.5]]) { const bar = M(new THREE.CylinderGeometry(0.03, 0.03, f(zb - za), 10), tubeM, f(13.2), 0.05, f((za + zb) / 2)); bar.rotation.x = Math.PI / 2; add(bar); }
    const speaker = (x, z) => {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; g.add(new THREE.Mesh(beam(new THREE.Vector3(Math.cos(a) * 0.42, 0.01, Math.sin(a) * 0.42), new THREE.Vector3(0, 0.95, 0), 0.022, 0.022), black)); }
      g.add(M(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10), black, 0, 0.95, 0));
      g.add(M(new THREE.CylinderGeometry(0.018, 0.018, 0.75), black, 0, 1.3, 0));
      const cab = new THREE.Group(); cab.position.y = 1.85; cab.rotation.y = Math.PI / 2; g.add(cab);
      cab.add(M(new THREE.BoxGeometry(0.36, 0.56, 0.32), std({ color: '#141414', roughness: 0.6 })));
      cab.add(M(new THREE.CylinderGeometry(0.12, 0.12, 0.01, 20), std({ color: '#2a2a2a', roughness: 0.9 }), 0, -0.08, 0.162).rotateX(Math.PI / 2), M(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 16), std({ color: '#2a2a2a' }), 0, 0.17, 0.162).rotateX(Math.PI / 2));
      add(g);
    };
    speaker(f(12.8), f(12.6)); speaker(f(12.8), f(35.4));
    // big floor speakers with tan woofer cones (front corners) and tall black columns behind the front line
    const floorSpk = (x, z, ry) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
      g.add(M(new THREE.BoxGeometry(0.62, 0.95, 0.42), std({ color: '#121212', roughness: 0.55 }), 0, 0.475, 0));
      g.add(M(new THREE.CircleGeometry(0.24, 28), std({ color: '#c8a46a', roughness: 0.6, metalness: 0.3 }), 0, 0.33, 0.212));
      g.add(M(new THREE.TorusGeometry(0.245, 0.02, 8, 28), std({ color: '#2a2a2a' }), 0, 0.33, 0.212));
      g.add(M(new THREE.CircleGeometry(0.06, 18), std({ color: '#d8d8d8', metalness: 0.7, roughness: 0.3 }), 0, 0.75, 0.212));
      add(g); box(x - 0.35, z - 0.3, x + 0.35, z + 0.3);
    };
    floorSpk(f(12.2), f(10.8), Math.PI / 2 - 0.3); floorSpk(f(12.2), f(37.4), Math.PI / 2 + 0.3);
    const column = (x, z) => { add(M(new THREE.BoxGeometry(0.42, 1.2, 0.4), std({ color: '#0e0e0e', roughness: 0.5 }), x, 0.6, z)); for (const [y, r] of [[0.85, 0.12], [0.45, 0.12]]) add(M(new THREE.CircleGeometry(r, 20), std({ color: '#262626', roughness: 0.8 }), x + 0.21, y, z).rotateY(Math.PI / 2)); };
    column(f(3.0), f(28.6)); column(f(3.0), f(19.4));
    // music stands in front of guitar and sax, two flutes on stands front and center, and a pedalboard
    const musicStand = (x, z, ry) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
      for (let i = 0; i < 3; i++) { const a = i * 2.094; g.add(new THREE.Mesh(beam(new THREE.Vector3(Math.cos(a) * 0.22, 0.01, Math.sin(a) * 0.22), new THREE.Vector3(0, 0.35, 0), 0.012, 0.012), black)); }
      g.add(M(new THREE.CylinderGeometry(0.01, 0.01, 0.85), black, 0, 0.75, 0));
      const desk = M(new THREE.BoxGeometry(0.48, 0.32, 0.01), black, 0, 1.2, 0.03); desk.rotation.x = -0.35; g.add(desk);
      add(g);
    };
    musicStand(f(12.4), f(28.6), -Math.PI / 2); musicStand(f(12.4), f(19.4), -Math.PI / 2);
    for (const zf of [23.2, 24.8]) { add(M(new THREE.CylinderGeometry(0.11, 0.11, 0.015, 3), black, f(13.0), 0.008, f(zf))); add(M(new THREE.CylinderGeometry(0.009, 0.009, 0.66, 10), chrome, f(13.0), 0.35, f(zf))); add(M(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 10), std({ color: '#d4b04a', metalness: 1, roughness: 0.3 }), f(13.0), 0.03, f(zf))); }
    add(M(new THREE.BoxGeometry(0.5, 0.05, 0.22), std({ color: '#1a1a1a', roughness: 0.5 }), f(12.0), 0.025, f(30.4)));
    for (let i = 0; i < 4; i++) add(M(new THREE.BoxGeometry(0.09, 0.03, 0.12), std({ color: ['#c43a2a', '#e8b030', '#2c6fd0', '#2a2a2a'][i], roughness: 0.4 }), f(12.0), 0.06, f(30.4) - 0.18 + i * 0.12));
    const wedge = (x, z) => { const w = M(new THREE.BoxGeometry(0.3, 0.26, 0.5), std({ color: '#151515', roughness: 0.6 }), x, 0.13, z); w.rotation.z = 0.35; add(w); };
    wedge(f(13.4), f(15.2));   // one floor monitor, front right
    const amp = (x, z) => { add(M(new THREE.BoxGeometry(0.35, 0.55, 0.6), std({ color: '#1a1a1a', roughness: 0.7 }), x, 0.275, z)); add(M(new THREE.PlaneGeometry(0.5, 0.4), std({ color: '#3a3330', roughness: 1 }), x + 0.176, 0.3, z).rotateY(Math.PI / 2)); };
    amp(f(7.6), f(31.2));
    // tall plant
    const plant = new THREE.Group(); plant.position.set(f(2.2), 0, f(26));
    plant.add(M(new THREE.CylinderGeometry(0.22, 0.18, 0.5, 18), std({ color: '#d8d0c4', roughness: 0.7 }), 0, 0.25, 0));
    for (let i = 0; i < 30; i++) { const lf = M(new THREE.SphereGeometry(0.12, 8, 6), std({ color: i % 3 ? '#2d4a26' : '#3b5f30', roughness: 0.8 }), Math.sin(i * 2.4) * (0.1 + i * 0.006), 0.6 + i * 0.05, Math.cos(i * 2.4) * (0.1 + i * 0.006)); lf.scale.set(1.3, 0.35, 0.6); lf.rotation.set(Math.sin(i * 1.7) * 0.9, i * 2.4, Math.cos(i * 1.3) * 0.7); plant.add(lf); }
    add(plant);
    // musicians, facing the room
    for (const [role, xf, zf, turn] of [['guitar', 10.4, 28.6, 0.15], ['sax', 10.4, 19.4, -0.15], ['keys', 5.6, 31, 0.35], ['drums', 4.2, 24, 0], ['bass', 5.6, 16.6, -0.35]]) {
      const m = makeBandMember(role); m.root.position.set(f(xf), 0, f(zf)); m.root.rotation.y = Math.PI / 2 + turn; add(m.root); dynamic.add(m.root); band.push(m);
    }
    box(0, z1, x2, z2);
  }

  // ── pool table on the leopard rug ──
  {
    const r = V.poolRug, rug = M(new THREE.PlaneGeometry(f(r.x2 - r.x1), f(r.z2 - r.z1)), std({ map: TX.leopard(), roughness: 1, color: '#ffffff' }), f((r.x1 + r.x2) / 2), 0.008, f((r.z1 + r.z2) / 2));
    rug.rotation.x = -Math.PI / 2; add(rug);
    const g = new THREE.Group(); g.position.set(f(V.poolTable.x), 0, f(V.poolTable.z));
    const lacquer = std({ color: '#0f0b09', roughness: 0.3, metalness: 0.1 });
    const felt = std({ color: '#1c1c22', roughness: 0.95 });
    const W = 2.72, Dd = 1.45, H = 0.8;
    g.add(M(new THREE.BoxGeometry(W - 0.1, 0.24, Dd - 0.1), lacquer, 0, H - 0.17, 0));
    g.add(M(new THREE.BoxGeometry(W - 0.26, 0.02, Dd - 0.26), felt, 0, H - 0.04, 0));
    for (const [x, z, w, d] of [[0, (Dd - 0.13) / 2, W, 0.13], [0, -(Dd - 0.13) / 2, W, 0.13], [(W - 0.13) / 2, 0, 0.13, Dd - 0.26], [-(W - 0.13) / 2, 0, 0.13, Dd - 0.26]]) g.add(M(new THREE.BoxGeometry(w, 0.08, d), lacquer, x, H - 0.01, z));
    for (const [x, z] of [[-W / 2 + 0.1, -Dd / 2 + 0.1], [W / 2 - 0.1, -Dd / 2 + 0.1], [-W / 2 + 0.1, Dd / 2 - 0.1], [W / 2 - 0.1, Dd / 2 - 0.1], [0, -Dd / 2 + 0.07], [0, Dd / 2 - 0.07]]) {
      g.add(M(new THREE.CylinderGeometry(0.065, 0.065, 0.02, 16), std({ color: '#050505' }), x, H + 0.035, z));
      const pk = M(new THREE.SphereGeometry(0.08, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std({ color: '#2a1a12', roughness: 0.7 }), x * 1.02, H - 0.12, z * 1.04); g.add(pk);
      for (let i = 0; i < 6; i++) g.add(M(new THREE.CylinderGeometry(0.008, 0.004, 0.1, 4), std({ color: '#3b2416' }), x * 1.02 + Math.cos(i) * 0.06, H - 0.24, z * 1.04 + Math.sin(i) * 0.06));
    }
    const legPts = [[0.001, 0], [0.11, 0], [0.12, 0.05], [0.07, 0.1], [0.09, 0.18], [0.13, 0.28], [0.1, 0.38], [0.06, 0.44], [0.08, 0.52], [0.1, 0.56]].map(([a, b]) => new THREE.Vector2(a, b));
    const legG = new THREE.LatheGeometry(legPts, 20);
    for (const [x, z] of [[-W / 2 + 0.22, -Dd / 2 + 0.2], [W / 2 - 0.22, -Dd / 2 + 0.2], [-W / 2 + 0.22, Dd / 2 - 0.2], [W / 2 - 0.22, Dd / 2 - 0.2], [0, -Dd / 2 + 0.2], [0, Dd / 2 - 0.2]]) g.add(M(legG, lacquer, x, 0, z));
    const ballC = ['#f1c40f', '#1f4fbf', '#c0392b', '#5b2c83', '#e67e22', '#1e8449', '#7b241c', '#111', '#f1c40f', '#1f4fbf'];
    ballC.forEach((c, i) => { const row = Math.floor((Math.sqrt(8 * i + 1) - 1) / 2), col = i - row * (row + 1) / 2; g.add(M(new THREE.SphereGeometry(0.029, 16, 12), std({ color: c, roughness: 0.15 }), 0.55 + row * 0.051, H + 0.0, (col - row / 2) * 0.06)); });
    g.add(M(new THREE.SphereGeometry(0.029, 16, 12), std({ color: '#f6f2e8', roughness: 0.15 }), -0.6, H, 0.12));
    for (const s of [-1, 1]) { const cue = M(new THREE.CylinderGeometry(0.007, 0.014, 1.45, 10), std({ color: '#c8a070', roughness: 0.5 }), -0.1, H + 0.03, s * 0.3); cue.rotation.z = Math.PI / 2; cue.rotation.y = s * 0.12; g.add(cue); }
    const warm = new THREE.PointLight('#ffc48a', 5, 6, 1.6); warm.position.set(f(V.poolTable.x), 2.4, f(V.poolTable.z)); add(warm);
    add(g); box(f(V.poolTable.x) - W / 2, f(V.poolTable.z) - Dd / 2, f(V.poolTable.x) + W / 2, f(V.poolTable.z) + Dd / 2);
  }

  // ── concrete food table with red glow underneath ──
  {
    const t = V.foodTable, x1 = f(t.x1), x2 = f(t.x2), z1 = f(t.z1), z2 = f(t.z2), cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, H = 0.78;
    add(M(new THREE.BoxGeometry(x2 - x1, 0.12, z2 - z1), concreteMat, cx, H - 0.06, cz));
    for (const s of [-1, 1]) add(M(new THREE.BoxGeometry(x2 - x1 - 0.35, H - 0.12, 0.28), concreteMat, cx, (H - 0.12) / 2, cz + s * (z2 - z1) * 0.3));
    const under = M(new THREE.PlaneGeometry(x2 - x1 - 0.1, z2 - z1 - 0.1), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff1a10').multiplyScalar(1.1), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }), cx, 0.01, cz);
    under.rotation.x = -Math.PI / 2; add(under);
    add(M(new THREE.BoxGeometry(0.02, 0.03, z2 - z1 - 0.2), glow('#ff2010', 2.5), x1 + 0.15, H - 0.13, cz), M(new THREE.BoxGeometry(0.02, 0.03, z2 - z1 - 0.2), glow('#ff2010', 2.5), x2 - 0.15, H - 0.13, cz));
    const red = new THREE.PointLight('#ff2010', 2.5, 3.5, 2); red.position.set(cx, 0.3, cz); add(red);
    fontsReady().then(() => {
      const card = typesetCard(FOOD_MENU, { withDoodle: true });
      const fm = menuStand(card.tex, 0.2, 0.28); readables.push({ obj: fm, canvas: card.canvas, img: 'images/food-menu.jpg', name: 'Food menu' }); fm.position.set(x2 - 0.1, H, z1 + 0.62); fm.rotation.y = Math.PI / 2; fm.rotateX(-0.18); add(fm);   // faces the garage-door end
    });
    add(foodSpread(cx, H, z1, z2));
    box(x1, z1, x2, z2);
  }

  // ── dining tables: wood tops, black bentwood chairs, two red flower arrangements each ──
  {
    const topMat = std({ map: TX.planks({ w: 512, h: 256, boards: 4, base: [34, 45, 60] }), roughness: 0.6, color: '#f0d3b0' });
    // black bentwood bistro chair: round seat, splayed legs, back legs that sweep up into the
    // backrest loop, and a leg ring tying the legs together. Every part touches the next.
    const chairGeo = (() => {
      const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
      const tube = (pts, r, seg = 24) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 8, false).toNonIndexed();
      const SEAT = 0.46, parts = [];
      parts.push(new THREE.CylinderGeometry(0.205, 0.2, 0.03, 28).translate(0, SEAT, 0).toNonIndexed());                     // seat
      parts.push(new THREE.TorusGeometry(0.195, 0.016, 8, 32).rotateX(Math.PI / 2).translate(0, SEAT - 0.03, 0).toNonIndexed()); // seat rim
      for (const sx of [-1, 1]) {
        parts.push(tube([V3(sx * 0.185, 0, 0.17), V3(sx * 0.165, 0.22, 0.145), V3(sx * 0.14, SEAT - 0.02, 0.12)], 0.014, 10));          // front legs
        parts.push(tube([V3(sx * 0.16, 0, -0.24), V3(sx * 0.145, 0.22, -0.19), V3(sx * 0.14, SEAT - 0.02, -0.15),                      // back legs sweep up
          V3(sx * 0.15, 0.7, -0.19), V3(sx * 0.165, 0.86, -0.22), V3(sx * 0.15, 0.96, -0.23)], 0.014, 30));
      }
      const top = []; for (let k = 0; k <= 16; k++) { const a = Math.PI * k / 16; top.push(V3(-Math.cos(a) * 0.15, 0.96 + Math.sin(a) * 0.07, -0.23)); }
      parts.push(tube(top, 0.014, 24));                                                                                          // top of the back loop
      const inner = []; for (let k = 0; k <= 20; k++) { const a = Math.PI * 2 * k / 20; inner.push(V3(Math.sin(a) * 0.085, 0.76 + Math.cos(a) * 0.12, -0.2 - (Math.cos(a) * 0.012))); }
      parts.push(tube(inner, 0.009, 30));                                                                                        // inner back loop
      parts.push(tube([V3(-0.14, 0.64, -0.17), V3(-0.085, 0.69, -0.19)], 0.008, 4), tube([V3(0.14, 0.64, -0.17), V3(0.085, 0.69, -0.19)], 0.008, 4)); // ties loop to uprights
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(0.165, 0.22, 0.145), V3(0.145, 0.22, -0.19), V3(-0.145, 0.22, -0.19), V3(-0.165, 0.22, 0.145)], true, 'centripetal'), 48, 0.009, 6, true).toNonIndexed()); // leg ring through all four legs
      return mergeGeometries(parts);
    })();
    const seats = [];
    const candleG = new THREE.CylinderGeometry(0.03, 0.03, 0.07, 12);
    const votive = new THREE.MeshPhysicalMaterial({ color: '#ffd9a8', roughness: 0.1, transparent: true, opacity: 0.45 });
    for (const t of V.diningTables) {
      const cx = f(t.x), cz = f(t.z), W = f(8.1), Dd = f(3.3), H = 0.76;
      add(M(scaleUV(new THREE.BoxGeometry(W, 0.05, Dd), 1, 1), topMat, cx, H, cz));
      // black hairpin legs at each corner (two rods meeting in a rounded foot), joined by a bar under each end
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const zc = cz + sz * (Dd / 2 - 0.09), xo = cx + sx * (W / 2 - 0.07), xi = cx + sx * (W / 2 - 0.23), xf = cx + sx * (W / 2 - 0.13);
        const pts = [new THREE.Vector3(xo, H - 0.03, zc), new THREE.Vector3(xo - sx * 0.01, H * 0.5, zc), new THREE.Vector3(xf + sx * 0.035, 0.04, zc), new THREE.Vector3(xf, 0.006, zc),
          new THREE.Vector3(xf - sx * 0.035, 0.04, zc), new THREE.Vector3(xi + sx * 0.01, H * 0.5, zc), new THREE.Vector3(xi, H - 0.03, zc)];
        add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 50, 0.008, 6), black));
      }
      for (const sx of [-1, 1]) { const bar = M(new THREE.CylinderGeometry(0.009, 0.009, Dd - 0.18, 6), black, cx + sx * (W / 2 - 0.15), H - 0.04, cz); bar.rotation.x = Math.PI / 2; add(bar); }
      for (const k of [-1.5, -0.5, 0.5, 1.5]) for (const s of [-1, 1]) {
        seats.push({ x: cx + k * W / 4.3, z: cz + s * (Dd / 2 + 0.2), ry: s > 0 ? Math.PI : 0 });
        add(M(new THREE.CylinderGeometry(0.13, 0.1, 0.015, 20), std({ color: '#6b1724', roughness: 0.35 }), cx + k * W / 4.3, H + 0.033, cz + s * (Dd / 2 - 0.22)));
        add(M(new THREE.PlaneGeometry(0.1, 0.16), std({ color: '#f1e9d8', roughness: 0.9 }), cx + k * W / 4.3, H + 0.045, cz + s * (Dd / 2 - 0.22)).rotateX(-Math.PI / 2));
        add(M(new THREE.CylinderGeometry(0.035, 0.025, 0.12, 12, 1, true), new THREE.MeshPhysicalMaterial({ color: '#fff', transparent: true, opacity: 0.3, roughness: 0.05 }), cx + k * W / 4.3 + 0.17, H + 0.085, cz + s * (Dd / 2 - 0.36)));
      }
      for (const k of [-0.25, 0.25]) add(flowerCluster(cx + k * W, H, cz, 0.18));
      box(cx - W / 2 - 0.1, cz - Dd / 2 - 0.55, cx + W / 2 + 0.1, cz + Dd / 2 + 0.55);
    }
    const chairs = new THREE.InstancedMesh(chairGeo, std({ color: '#0d0b0a', roughness: 0.35 }), seats.length);
    seats.forEach((s, i) => { const m = new THREE.Matrix4().makeRotationY(s.ry); m.setPosition(s.x, 0, s.z); chairs.setMatrixAt(i, m); });
    add(chairs);
  }

  // ── high-top cocktail tables (40" tall, 24" round) ──
  {
    const topH = 40 * 0.0254, r = 12 * 0.0254;
    for (const [xf, zf] of V.blackHighTops) {
      const x = f(xf), z = f(zf);
      if (xf === 34.8) {   // tattoo sign-up table: ornate gold frame of "The Angelos" flash, a small gold frame, and a sign-up clipboard
        const flashTex = TX.textCanvas(900, 680, (c, w, h) => {
          c.fillStyle = '#f6f3ec'; c.fillRect(0, 0, w, h); c.strokeStyle = '#1a1a1a'; c.fillStyle = '#1a1a1a'; c.lineWidth = 4; c.lineCap = 'round';
          c.font = '66px "Great Vibes", cursive'; c.textAlign = 'center'; c.fillText('The Angelos', w / 2, 80);
          const heart = (x, y, k) => { c.beginPath(); c.moveTo(x, y + 30 * k); c.bezierCurveTo(x - 45 * k, y, x - 30 * k, y - 32 * k, x, y - 12 * k); c.bezierCurveTo(x + 30 * k, y - 32 * k, x + 45 * k, y, x, y + 30 * k); c.stroke(); };
          const star = (x, y, r) => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.stroke(); };
          heart(120, 200, 1.4); star(780, 180, 34); heart(450, 260, 1); c.beginPath(); c.arc(300, 210, 18, 0, 7); c.arc(345, 225, 18, 0, 7); c.stroke(); c.beginPath(); c.moveTo(300, 192); c.quadraticCurveTo(320, 140, 360, 150); c.stroke();   // cherries
          c.strokeRect(590, 220, 60, 60); c.strokeRect(630, 250, 60, 60); for (const [dx, dy] of [[610, 240], [630, 260], [660, 270], [670, 290]]) { c.beginPath(); c.arc(dx, dy, 4, 0, 7); c.fill(); }   // dice
          for (const [x, y] of [[150, 420], [450, 450], [760, 430]]) heart(x, y, 1.1);
          c.beginPath(); c.moveTo(280, 520); c.lineTo(330, 420); c.lineTo(340, 430); c.lineTo(292, 528); c.stroke();   // dagger
          c.beginPath(); c.arc(620, 540, 34, 0, 7); c.stroke(); c.beginPath(); c.arc(620, 540, 16, 0, 7); c.stroke();   // rose
          c.font = 'italic 28px Georgia'; c.fillText('no regrets', 150, 310); c.fillText('lucky you', 760, 320);
        });
        const goldF = std({ color: '#c9a45c', metalness: 0.9, roughness: 0.35 });
        const fr = new THREE.Group(); fr.position.set(x - 0.02, topH + 0.02, z - 0.1); fr.rotateX(-0.2);   // faces the room
        fr.add(M(new THREE.BoxGeometry(0.46, 0.36, 0.03), goldF, 0, 0.19, 0));
        for (const [cx2, cy2] of [[-0.23, 0.37], [0.23, 0.37], [-0.23, 0.01], [0.23, 0.01]]) fr.add(M(new THREE.SphereGeometry(0.03, 8, 6), goldF, cx2, cy2, 0));
        // the real flash sheet from the night
        const flashCanvas = document.createElement('canvas'); flashCanvas.width = 1688; flashCanvas.height = 1256;
        const realFlash = new THREE.CanvasTexture(flashCanvas); realFlash.colorSpace = THREE.SRGBColorSpace;
        const flashPlane = M(new THREE.PlaneGeometry(0.38, 0.283), menuPaper(flashTex), 0, 0.19, 0.016); fr.add(flashPlane);
        const fim = new Image(); fim.onload = () => { flashCanvas.getContext('2d').drawImage(fim, 0, 0, 1688, 1256); realFlash.needsUpdate = true; flashPlane.material = menuPaper(realFlash); flashRead.canvas = flashCanvas; }; fim.src = 'images/flash.png';
        add(fr);
        const flashRead = { obj: fr, canvas: flashTex.image, name: 'Tattoo flash' }; readables.push(flashRead);
        dynamic.add(fr);   // keep it separate so the real sheet can swap in once it loads
        // small ornate gold frame with the artists' card
        const artistCard = (label, px, pz, ry) => {
          const g = new THREE.Group(); g.position.set(px, topH + 0.015, pz); g.rotation.y = ry;
          g.add(M(new THREE.BoxGeometry(0.1, 0.15, 0.015), goldF, 0, 0.085, 0));
          g.add(M(new THREE.PlaneGeometry(0.07, 0.11), menuPaper(TX.textCanvas(140, 220, (c, w, h) => {
            c.fillStyle = '#f4efe2'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a1a1a'; c.strokeStyle = '#1a1a1a'; c.lineWidth = 2; c.textAlign = 'center';
            c.font = '700 13px Georgia'; c.fillText(label, w / 2, 24);
            c.beginPath(); c.arc(w / 2, 100, 30, 0, 7); c.stroke(); c.beginPath(); c.moveTo(w / 2 - 22, 160); c.lineTo(w / 2 + 22, 160); c.lineTo(w / 2, 130); c.closePath(); c.stroke();
            c.font = 'italic 12px Georgia'; c.fillText('tattoos', w / 2, 200);
          })), 0, 0.085, 0.008));
          g.add(M(new THREE.BoxGeometry(0.11, 0.015, 0.05), goldF, 0, 0.007, 0.01));
          add(g);
        };
        artistCard('ISA ♥ VERRI', x - 0.22, z - 0.04, 0.25);
        artistCard('KAYLYN ♥ RYAN', x + 0.22, z - 0.08, -0.25);
        // clipboard sign-up sheet with a pen on a red string
        const sheet = TX.textCanvas(420, 560, (c, w, h) => {
          c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a1a1a'; c.textAlign = 'center';
          c.font = '40px "Great Vibes", cursive'; c.fillText('The Angelos', w / 2, 52);
          c.font = '600 13px Helvetica, Arial'; c.fillText('NAME', 80, 92); c.fillText('PHONE NUMBER', 210, 92); c.fillText('DESIGN', 345, 92);
          c.strokeStyle = '#555'; c.lineWidth = 1; for (let y = 100; y < h - 10; y += 26) { c.beginPath(); c.moveTo(18, y); c.lineTo(w - 18, y); c.stroke(); }
          c.beginPath(); c.moveTo(150, 80); c.lineTo(150, h - 14); c.moveTo(280, 80); c.lineTo(280, h - 14); c.stroke();
          const names = ['Sam', 'Amelia', 'Avery', 'Kevin', 'Lena', 'Chris', 'Noel', 'Alina', 'Kai', 'Lucy', 'Stephanie', 'Dave', 'Brett', 'Sylvie', 'Rafa', 'Ruth', 'Brennen', 'Emma'];
          const designs = ['lucky you', 'rose', 'dice', 'cherries', 'stars', 'angel', 'heart', 'swallow', 'devil', 'no regrets', 'padlock', 'rose', 'dice', 'cherub', 'stars', 'heart', 'flame heart', 'kitty'];
          c.font = 'italic 17px "Snell Roundhand", "Brush Script MT", cursive'; c.fillStyle = '#26324a';
          names.forEach((n, i) => { const y = 120 + i * 26; c.textAlign = 'left'; c.fillText(n, 26, y); c.fillText(`${(310 + i * 7) % 999}-${(4401 + i * 373) % 9999}`, 160, y); c.fillText(designs[i], 290, y); });
        });
        const cb = new THREE.Group(); cb.position.set(x + 0.05, topH + 0.02, z + 0.12); cb.rotation.y = -0.15;
        cb.add(M(new THREE.BoxGeometry(0.24, 0.006, 0.33), std({ color: '#1c1c1c', roughness: 0.5 })));
        const pg = M(new THREE.PlaneGeometry(0.21, 0.28), menuPaper(sheet), 0, 0.005, 0.015); pg.rotation.x = -Math.PI / 2; cb.add(pg);
        cb.add(M(new THREE.BoxGeometry(0.1, 0.012, 0.03), chrome, 0, 0.008, -0.145));
        const pen = M(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 8), std({ color: '#b8b8b8', metalness: 0.7, roughness: 0.3 }), 0.01, 0.012, 0.02); pen.rotation.x = Math.PI / 2; pen.rotation.z = 0.1; cb.add(pen);
        cb.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.04, 0.012, -0.14), new THREE.Vector3(0.12, 0.012, -0.05), new THREE.Vector3(0.1, 0.012, 0.06), new THREE.Vector3(0.015, 0.012, 0.09)]), 20, 0.0015, 4), std({ color: '#a01c22' })));
        add(cb); readables.push({ obj: cb, canvas: sheet.image, name: 'Tattoo sign-up sheet' });
        // black ornate card holder and a stack of aftercare cards
        const ch = M(new THREE.BoxGeometry(0.11, 0.07, 0.012), std({ color: '#151515', metalness: 0.6, roughness: 0.4 }), x + 0.26, topH + 0.045, z + 0.06); ch.rotation.set(-0.25, -0.5, 0); add(ch);
        for (let k = 0; k < 6; k++) { const card = M(new THREE.BoxGeometry(0.09, 0.002, 0.13), std({ color: '#efe6d0', roughness: 0.9 }), x + 0.2, topH + 0.017 + k * 0.002, z + 0.19); card.rotation.y = 0.3 + k * 0.02; add(card); }
      }
      if (xf === 84.0) {   // welcome table: thank-you card facing the garage door, plus flowers
        fontsReady().then(() => {
          const card = typesetCard(THANK_YOU);
          const ty = menuStand(card.tex, 0.24, 0.336); readables.push({ obj: ty, canvas: card.canvas, img: 'images/thank-you.jpg', name: 'Thank you' }); ty.position.set(x + 0.04, topH + 0.015, z + 0.08); ty.rotation.y = Math.PI / 2; ty.rotateX(-0.15); add(ty);
        });
        add(flowerCluster(x - 0.1, topH + 0.015, z - 0.12, 0.12));
      }
      add(M(new THREE.CylinderGeometry(0.24, 0.26, 0.03, 24), black, x, 0.015, z), M(new THREE.CylinderGeometry(0.03, 0.03, topH), black, x, topH / 2, z), M(new THREE.CylinderGeometry(r, r, 0.03, 28), black, x, topH, z));
      circle(x, z, 0.36);
    }
    const tw = std({ map: TX.woodGrain([30, 45, 50]), roughness: 0.6, color: '#e2bf96' });
    for (const [xf, zf] of V.woodHighTops) {
      const x = f(xf), z = f(zf);
      add(M(new THREE.CylinderGeometry(r, r, 0.035, 28), tw, x, topH, z));
      // three black hairpin legs: two straight rods drop from under the top, then angle in to a V at the floor
      const rod = (a2, b2) => { const len = a2.distanceTo(b2), m = M(new THREE.CylinderGeometry(0.0065, 0.0065, len, 6), black); m.position.copy(a2).add(b2).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b2.clone().sub(a2).normalize()); add(m); };
      for (let i = 0; i < 3; i++) {
        const a = i * 2.094 + 0.5, P3 = (ang, rr, y) => new THREE.Vector3(x + Math.cos(ang) * rr, y, z + Math.sin(ang) * rr);
        const foot = P3(a, 0.215, 0.004);
        for (const d of [-0.3, 0.3]) { const topP = P3(a + d, 0.2, topH - 0.02), knee = P3(a + d, 0.2, 0.2); rod(topP, knee); rod(knee, foot); add(M(new THREE.SphereGeometry(0.0065, 6, 4), black, knee.x, knee.y, knee.z)); }
        add(M(new THREE.SphereGeometry(0.009, 8, 6), black, foot.x, foot.y + 0.004, foot.z));
      }
      add(M(new THREE.CylinderGeometry(r * 0.72, r * 0.72, 0.012, 24), black, x, topH - 0.024, z));   // mounting plate under the top
      circle(x, z, 0.36);
    }
  }

  // ── tinsel chandelier + disco ball ──
  const C = { x: f(V.chandelier.x), z: f(V.chandelier.z) };
  const chand = new THREE.Group(); chand.position.set(C.x, 0, C.z); add(chand); dynamic.add(chand);
  {
    const topY = 4.95, rad = 1.68;
    chand.add(M(new THREE.TorusGeometry(rad, 0.03, 8, 64), chrome, 0, topY, 0).rotateX(Math.PI / 2));
    chand.add(M(new THREE.TorusGeometry(rad - 0.06, 0.02, 8, 64), chrome, 0, topY - 0.02, 0).rotateX(Math.PI / 2));
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; chand.add(new THREE.Mesh(beam(new THREE.Vector3(Math.cos(a) * rad, topY, Math.sin(a) * rad), new THREE.Vector3(0, archY(C.z) - 0.4, 0), 0.008, 0.008), steel)); }
    const N = Q.strands, strand = new THREE.PlaneGeometry(0.016, 1).translate(0, -0.5, 0);
    const tinsel = new THREE.MeshStandardMaterial({ color: '#f2f2f8', metalness: 1, roughness: 0.16, side: THREE.DoubleSide, envMapIntensity: 1.6 });
    const im = new THREE.InstancedMesh(strand, tinsel, N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    for (let i = 0; i < N; i++) {
      const a = rnd() * Math.PI * 2, r = rad - (i % 3) * 0.035 + rnd() * 0.01, len = 1.55 + rnd() * 0.45;
      p.set(Math.cos(a) * r, topY, Math.sin(a) * r); e.set((rnd() - 0.5) * 0.04, -a + (rnd() - 0.5) * 1.6, (rnd() - 0.5) * 0.04); q.setFromEuler(e); s.set(1, len, 1);
      im.setMatrixAt(i, m.compose(p, q, s));
    }
    chand.add(im);
    const ball = M(new THREE.IcosahedronGeometry(0.3, 3), new THREE.MeshStandardMaterial({ color: '#e8eef6', metalness: 1, roughness: 0.06, flatShading: true, envMapIntensity: 2.2 }), 0, 3.3, 0);
    chand.add(ball);
    chand.add(M(new THREE.CylinderGeometry(0.006, 0.006, topY - 3.6), steel, 0, (topY + 3.6) / 2, 0));
    const inner = new THREE.PointLight('#fff1e2', 7, 5, 1.6); inner.position.set(0, 4.1, 0); chand.add(inner);
    tick.push((dt, t) => { im.rotation.y += dt * 0.035; ball.rotation.y += dt * 0.35; im.position.x = Math.sin(t * 0.7) * 0.01; });
    chand.userData.ball = ball;
  }
  // white downlight under the chandelier (the bright pool in the photos)
  {
    const s = new THREE.SpotLight('#fff4e6', 55, 9, 0.32, 0.7, 1.4); s.position.set(C.x + 0.3, 5.4, C.z - 0.4); s.target.position.set(C.x - 0.8, 0, C.z + 0.6); add(s); add(s.target);
  }
  // disco specks: spotlights that project a dotted texture, slowly turning
  const disco = new THREE.Group(); disco.position.set(C.x, 3.3, C.z); add(disco); dynamic.add(disco);
  {
    const tex = TX.discoSpecks();
    for (let i = 0; i < Q.discoLights; i++) {
      const s = new THREE.SpotLight('#ffffff', Q.discoIntensity, 26, 0.95, 0.15, 1.1);
      s.map = tex; s.castShadow = true; s.shadow.mapSize.set(Q.shadow, Q.shadow); s.shadow.bias = -0.002; s.shadow.camera.near = 0.3;
      const a = i / Q.discoLights * Math.PI * 2, tilt = i === Q.discoLights - 1 && Q.discoLights > 2 ? 1.6 : -0.45;
      s.target.position.set(Math.cos(a) * 5, tilt * 3, Math.sin(a) * 5);
      disco.add(s, s.target);
    }
    tick.push((dt) => { disco.rotation.y += dt * 0.12; });
  }

  // ── lighting: red ceiling washes + amber pools ──
  scene.add(new THREE.HemisphereLight('#4a1810', '#120504', 0.55));
  const washes = Q.lowLights ? [[6, 3.6, D / 2], [16, 3.6, D / 2], [25, 3.6, D / 2]] : [[3.5, 3.7, D / 2], [9.5, 3.7, D / 2], [15.5, 3.7, D / 2], [21.5, 3.7, D / 2], [26.8, 3.7, D / 2]];
  for (const [x, y, z] of washes) { const l = new THREE.PointLight('#ff2a14', Q.lowLights ? 14 : 9, 16, 1.7); l.position.set(x, y, z); add(l); }
  const band1 = new THREE.PointLight('#ff8a2e', 10, 9, 1.6); band1.position.set(2.2, 1.6, D / 2); add(band1);
  const seat1 = new THREE.PointLight('#ff7a2a', 7, 10, 1.6); seat1.position.set(f(76), 1.6, D - 1.2); add(seat1);

  // ── bake the uplights into the brick and the drape, so the light sits ON the surface ──
  {
    const sm = (a0, b0, v) => { const t = Math.min(1, Math.max(0, (v - a0) / (b0 - a0))); return t * t * (3 - 2 * t); };
    const bake = (mesh, surf, lenM, hM, u1) => {
      const ws = upWashes.filter((wv) => wv.surf === surf); if (!ws.length) return;
      if (surf === 'drape') ws.forEach((wv) => { wv.along = wv.x - drapeInfo.x1; });
      const pxPerM = 36, W2 = Math.min(2048, Math.round(lenM * pxPerM)), H2 = Math.round(hM * pxPerM);
      const c = document.createElement('canvas'); c.width = W2; c.height = H2; const g = c.getContext('2d'), d = g.createImageData(W2, H2), px = d.data;
      for (let yy = 0; yy < H2; yy++) {
        const y = (1 - yy / (H2 - 1)) * hM;                                         // meters up the surface
        for (let xx = 0; xx < W2; xx++) {
          const a = (xx / (W2 - 1)) * lenM; let r = 0.02, gg = 0.012, b = 0.008;     // a faint ambient bounce everywhere
          for (const wv of ws) {
            const dx = Math.abs(a - wv.along); if (dx > 2) continue;
            const half = 0.06 + y * 0.3 * (wv.w / 1.5);                                // the beam widens as it climbs
            const side = 1 - sm(half * 0.45, half * 1.05, dx);
            const up = Math.exp(-y / (wv.h * 0.5)) * (1 - sm(wv.h * 0.75, wv.h * 1.1, y)) * sm(0, 0.08, y);
            const hot = Math.exp(-(dx * dx) * 30 - ((y - 0.3) ** 2) * 6) * 0.9;        // bright scallop right above the fixture
            const v = (side * up * 1.1 + hot) * wv.k;
            r += wv.color.r * v; gg += wv.color.g * v; b += wv.color.b * v;
          }
          const o = (yy * W2 + xx) * 4; px[o] = Math.min(255, r * 200); px[o + 1] = Math.min(255, gg * 200); px[o + 2] = Math.min(255, b * 200); px[o + 3] = 255;
        }
      }
      g.putImageData(d, 0, 0);
      const tex = new THREE.CanvasTexture(c); tex.channel = 1;
      const geo = mesh.geometry, pos = geo.attributes.position, uv1 = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) { const [uu, vv] = u1(pos.getX(i), pos.getY(i)); uv1[i * 2] = uu; uv1[i * 2 + 1] = vv; }
      geo.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
      mesh.material = mesh.material.clone(); mesh.material.lightMap = tex; mesh.material.lightMapIntensity = 7.5;   // three.js divides baked light by π, so this is ~2.4x
    };
    // local plane coords: walls are centered planes (x: -len/2..len/2, y: -h/2..h/2); gables are shapes (x: 0..D, y: 0..peak)
    bake(southWall, 'south', L, WH, (x, y) => [x / L + 0.5, y / WH + 0.5]);
    bake(northWall, 'north', L, WH, (x, y) => [x / L + 0.5, y / WH + 0.5]);
    bake(west, 'west', D, PK, (x, y) => [x / D, y / PK]);
    bake(east, 'east', D, PK, (x, y) => [x / D, y / PK]);
    if (drapeInfo) bake(drapeInfo.mesh, 'drape', drapeInfo.len, drapeInfo.h, (x, y) => [x / drapeInfo.len + 0.5, y / drapeInfo.h + 0.5]);
  }

  mergeStatic(world, dynamic, new Set(occluders.concat([plainFloor, reflectFloor].filter(Boolean))));
  return {
    world, colliders, occluders, tick, readables, band, bartenders, flowerDisplays, chand, disco, reflectFloor, plainFloor,
    dropReflections() { if (!reflectFloor) return; world.remove(reflectFloor); world.add(plainFloor); reflectFloor = null; },
  };
}

// Bake every mesh that never moves into one mesh per material, so the GPU draws a few
// big batches instead of ~1,300 little ones.
function mergeStatic(world, dynamic, keep) {
  world.updateMatrixWorld(true);
  const groups = new Map(), victims = [];
  const skip = (o) => { for (let p = o; p; p = p.parent) if (dynamic.has(p)) return true; return false; };
  world.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || keep.has(o) || Array.isArray(o.material) || skip(o)) return;
    const g = o.geometry; if (!g.attributes.normal || !g.attributes.uv) return;
    const mt = o.material;
    const key = mt.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile ? mt.uuid : [mt.type, mt.color?.getHexString(), mt.color?.r.toFixed(3), mt.map?.uuid, mt.emissiveMap?.uuid, mt.bumpMap?.uuid, mt.emissive?.getHexString(), mt.emissiveIntensity, mt.roughness, mt.metalness, mt.transparent, mt.opacity, mt.blending, mt.side, mt.flatShading, mt.depthWrite, mt.sheen, mt.envMapIntensity, o.renderOrder].join('|');
    if (!groups.has(key)) groups.set(key, { mat: o.material, order: o.renderOrder, geos: [] });
    const c = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(o.matrixWorld);
    for (const name of Object.keys(c.attributes)) if (!['position', 'normal', 'uv'].includes(name)) c.deleteAttribute(name);
    c.morphAttributes = {};
    groups.get(key).geos.push(c); victims.push(o);
  });
  for (const o of victims) o.parent.remove(o);
  for (const { mat, order, geos } of groups.values()) {
    const merged = mergeGeometries(geos); if (!merged) continue;
    const m = new THREE.Mesh(merged, mat); m.renderOrder = order; m.matrixAutoUpdate = false; world.add(m);
  }
}

// ── the food: dumplings, takeout boxes, onigiri ──
let takeoutTex = null;
function foodSpread(cx, y, za, zb) {
  // laid out like the photos: steel trays (some up on folded-steel risers), takeout boxes, onigiri, yakitori, bao, karaage, and one big flower piece on the left end (as you face the table from the menu side)
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#d9dadc', metalness: 1, roughness: 0.22 });
  const tray = (x, z, w, d, h = 0) => {      // a rimmed steel tray, optionally up on a folded-steel riser
    if (h) for (const s of [-1, 1]) { const leg = M(new THREE.BoxGeometry(0.01, h, d * 0.75), steel, x + s * w * 0.32, y + h / 2, z); leg.rotation.z = s * 0.18; g.add(leg); }
    const ty = y + h;
    g.add(M(new THREE.BoxGeometry(w, 0.006, d), steel, x, ty + 0.003, z));
    for (const [dx, dz, ww, dd] of [[0, d / 2, w, 0.008], [0, -d / 2, w, 0.008], [w / 2, 0, 0.008, d], [-w / 2, 0, 0.008, d]]) g.add(M(new THREE.BoxGeometry(ww, 0.02, dd), steel, x + dx, ty + 0.012, z + dz));
    return ty + 0.006;
  };
  // takeout boxes: white with the red pagoda, "Thank you" and "Enjoy"
  if (!takeoutTex) takeoutTex = TX.paint(512, 128, (c, w, h) => {
    c.fillStyle = '#fbfaf7'; c.fillRect(0, 0, w, h);
    for (let f = 0; f < 4; f++) {
      const ox = f * 128; c.fillStyle = c.strokeStyle = '#c4161c'; c.lineWidth = 2;
      if (f % 2 === 0) { for (let k = 0; k < 3; k++) { const yy = 92 - k * 16, hw = 22 - k * 5; c.beginPath(); c.moveTo(ox + 64 - hw, yy); c.quadraticCurveTo(ox + 64, yy - 7, ox + 64 + hw, yy); c.stroke(); c.fillRect(ox + 64 - hw * 0.6, yy, hw * 1.2, 4); } c.fillRect(ox + 62, 44, 4, 14); }
      else { c.font = '600 22px "Brush Script MT", "Snell Roundhand", cursive'; c.textAlign = 'center'; c.fillText(f === 1 ? 'Enjoy' : 'Thank you', ox + 64, 72); }
    }
  });
  const boxM = new THREE.MeshStandardMaterial({ map: takeoutTex, roughness: 0.75 }), lidM = new THREE.MeshStandardMaterial({ color: '#fbfaf7', roughness: 0.75 });
  const takeout = (x, ty, z, ry) => {
    const b = new THREE.Group(); b.position.set(x, ty, z); b.rotation.y = ry;
    const body = M(new THREE.CylinderGeometry(0.05, 0.04, 0.08, 4, 1, true), boxM, 0, 0.04, 0); body.rotation.y = Math.PI / 4; b.add(body);
    for (const s of [-1, 1]) { const flap = M(new THREE.BoxGeometry(0.07, 0.003, 0.038), lidM, 0, 0.086, s * 0.016); flap.rotation.x = s * 0.35; b.add(flap); }
    g.add(b);
  };
  const boxesOn = (x, z, w, d, rows, cols, h) => { const ty = tray(x, z, w, d, h); for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) takeout(x - w / 2 + (k + 0.5) * w / cols, ty, z - d / 2 + (r + 0.5) * d / rows, (Math.sin(r * 7 + k * 3) * 0.12)); };
  // onigiri: round rice balls with a nori asterisk on top
  const riceM = new THREE.MeshStandardMaterial({ color: '#f6f4ee', roughness: 0.9 }), noriM = new THREE.MeshStandardMaterial({ color: '#1c2412', roughness: 0.6 });
  const onigiriOn = (x, z, w, d, h) => { const ty = tray(x, z, w, d, h); for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
    const ox = x - w / 2 + (k + 0.5) * w / 4, oz = z - d / 2 + (r + 0.5) * d / 4; const ball = M(new THREE.SphereGeometry(0.03, 14, 10), riceM, ox, ty + 0.025, oz); ball.scale.y = 0.85; g.add(ball);
    for (let q = 0; q < 3; q++) { const st = M(new THREE.BoxGeometry(0.045, 0.002, 0.004), noriM, ox, ty + 0.051, oz); st.rotation.y = q * 1.05 + r; g.add(st); } } };
  // yakitori: glazed chicken on bamboo skewers
  const meatM = new THREE.MeshStandardMaterial({ color: '#6b3a1e', roughness: 0.55 }), stickM = new THREE.MeshStandardMaterial({ color: '#d8b880', roughness: 0.7 });
  const yakitoriOn = (x, z, w, d) => { const ty = tray(x, z, w, d, 0); for (let i = 0; i < 9; i++) {
    const oz = z - d / 2 + 0.03 + i * (d - 0.06) / 8; const st = M(new THREE.CylinderGeometry(0.002, 0.002, w * 1.15, 5), stickM, x + w * 0.08, ty + 0.012, oz); st.rotation.z = Math.PI / 2; g.add(st);
    for (let k = 0; k < 4; k++) { const m = M(new THREE.SphereGeometry(0.014, 8, 6), meatM, x - w * 0.32 + k * 0.035, ty + 0.012, oz); m.scale.set(1.2, 0.8, 0.9); g.add(m); } } };
  // pork belly bao: folded white buns with a red filling
  const bunM = new THREE.MeshStandardMaterial({ color: '#f4f0e6', roughness: 0.85 }), fillM = new THREE.MeshStandardMaterial({ color: '#b2342a', roughness: 0.6 });
  const baoOn = (x, z, w, d) => { const ty = tray(x, z, w, d, 0); for (let r = 0; r < 6; r++) for (let k = 0; k < 3; k++) {
    const bx = x - w / 2 + (k + 0.5) * w / 3, bz = z - d / 2 + (r + 0.5) * d / 6; const bun = M(new THREE.CylinderGeometry(0.03, 0.03, 0.045, 14, 1, false, 0, Math.PI), bunM, bx, ty + 0.003, bz); bun.rotation.z = Math.PI / 2; bun.rotation.y = Math.PI / 2; g.add(bun);
    g.add(M(new THREE.BoxGeometry(0.04, 0.012, 0.012), fillM, bx, ty + 0.024, bz)); } };
  // karaage in little paper boats
  const paperM = new THREE.MeshStandardMaterial({ color: '#efe9de', roughness: 0.9 }), friedM = new THREE.MeshStandardMaterial({ color: '#8a5626', roughness: 0.75 });
  const karaage = (x, z) => { g.add(M(new THREE.CylinderGeometry(0.045, 0.035, 0.025, 12, 1, true), paperM, x, y + 0.013, z)); for (let k = 0; k < 4; k++) { const n = M(new THREE.DodecahedronGeometry(0.016), friedM, x + Math.cos(k * 1.7) * 0.016, y + 0.03, z + Math.sin(k * 1.7) * 0.016); n.rotation.set(k, k * 2, 0); g.add(n); } };

  const L = zb - za, at = (f) => za + L * f;
  baoOn(cx - 0.2, at(0.13), 0.3, 0.4);
  for (let i = 0; i < 6; i++) karaage(cx + 0.06 + (i % 2) * 0.1, at(0.06) + Math.floor(i / 2) * 0.1);
  boxesOn(cx + 0.17, at(0.42), 0.32, 0.4, 4, 4, 0.12);
  boxesOn(cx - 0.12, at(0.64), 0.4, 0.42, 5, 4, 0);
  yakitoriOn(cx + 0.29, at(0.66), 0.2, 0.36);
  onigiriOn(cx - 0.1, at(0.87), 0.3, 0.3, 0.14);
  const roses = flowerTower(cx + 0.24, y, at(0.9)); roses.scale.setScalar(0.65); g.add(roses);
  return g;
}
// tall pink-and-red celosia / carnation piece
function celosiaTower(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); flowerDisplays.push(g);
  g.add(M(new THREE.BoxGeometry(0.12, 0.1, 0.12), new THREE.MeshStandardMaterial({ color: '#d9dadc', metalness: 1, roughness: 0.25 }), 0, 0.05, 0));
  const cols = ['#e2204e', '#ef3d6c', '#d81c3a', '#f25582', '#c8102e'];
  const N = 70, im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.05, 1), new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), N);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  for (let i = 0; i < N; i++) { const h = TX.rand() * 0.5, r = 0.15 * (1 - h * 0.9) * Math.sqrt(TX.rand()), a = TX.rand() * 6.28, s = 0.7 + TX.rand() * 0.7;
    m.makeScale(s, s, s).setPosition(Math.cos(a) * r, 0.14 + h, Math.sin(a) * r); im.setMatrixAt(i, m); im.setColorAt(i, c.set(cols[i % 5])); }
  g.add(im);
  return g;
}

// ── flowers: dark red roses, anthuriums and hanging amaranthus ──
const PETALS = ['#7a0c14', '#9c1420', '#5e0a10', '#b81c28', '#6b0d1a'];
function flowerCluster(x, y, z, size = 0.2) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  g.add(M(new THREE.CylinderGeometry(size * 0.35, size * 0.3, size * 0.6, 14), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, roughness: 0.05 }), 0, size * 0.3, 0));
  const n = Math.round(30 * size / 0.2);
  for (let i = 0; i < n; i++) {
    const a = i * 2.4, r = Math.sqrt(i / n) * size * 0.72;
    const fl = M(new THREE.SphereGeometry(size * (0.13 + TX.rand() * 0.07), 10, 8), new THREE.MeshStandardMaterial({ color: PETALS[i % 5], roughness: 0.7 }), Math.cos(a) * r, size * (0.68 + 0.42 * (1 - r / size)), Math.sin(a) * r);
    fl.scale.y = 0.75; g.add(fl);
  }
  for (let i = 0; i < 5; i++) { const lf = M(new THREE.SphereGeometry(size * 0.14, 6, 4), new THREE.MeshStandardMaterial({ color: '#2a3a20', roughness: 0.8 }), Math.cos(i * 1.3) * size * 0.9, size * 0.6, Math.sin(i * 1.3) * size * 0.9); lf.scale.set(1.6, 0.3, 0.8); g.add(lf); }
  return g;
}
function flowerTower(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); flowerDisplays.push(g);
  const petal = new THREE.MeshStandardMaterial({ roughness: 0.55 });
  // roses: lots of small blooms packed into a tapering column
  const roseG = mergeGeometries([new THREE.SphereGeometry(0.03, 8, 6).scale(1, 0.8, 1), new THREE.TorusGeometry(0.032, 0.014, 6, 12).rotateX(Math.PI / 2).translate(0, -0.006, 0)].map((q) => q.toNonIndexed()));
  const N = 190, roses = new THREE.InstancedMesh(roseG, petal, N), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const h = Math.pow(TX.rand(), 0.8) * 0.95, r = 0.3 * (1 - h * 0.55) * (0.55 + 0.45 * Math.sqrt(TX.rand())), a = TX.rand() * 6.28;
    p.set(Math.cos(a) * r, 0.06 + h * 0.85, Math.sin(a) * r); e.set(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9 - 0.4); q.setFromEuler(e); const s2 = 0.7 + TX.rand() * 0.8; sc.set(s2, s2, s2);
    roses.setMatrixAt(i, m.compose(p, q, sc)); roses.setColorAt(i, col.set(PETALS[i % 5]).multiplyScalar(0.7 + TX.rand() * 0.5));
  }
  g.add(roses);
  // anthuriums: glossy heart-shaped blooms poking out
  const heart = new THREE.Shape(); heart.moveTo(0, -0.07); heart.bezierCurveTo(0.09, -0.02, 0.07, 0.07, 0, 0.04); heart.bezierCurveTo(-0.07, 0.07, -0.09, -0.02, 0, -0.07);
  const anth = new THREE.MeshStandardMaterial({ color: '#b0101c', roughness: 0.2, side: THREE.DoubleSide });
  for (let i = 0; i < 16; i++) { const a = i * 2.39, h = 0.15 + (i / 16) * 0.65, r = 0.3 * (1 - h * 0.5); const an = M(new THREE.ShapeGeometry(heart), anth, Math.cos(a) * r, h, Math.sin(a) * r); an.rotation.set(-0.3, -a + Math.PI / 2, 0.3); g.add(an); }
  // greenery tucked in
  const leaf = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4).scale(1.8, 0.25, 0.8), new THREE.MeshStandardMaterial({ color: '#1f2a16', roughness: 0.8 }), 40);
  for (let i = 0; i < 40; i++) { const h = TX.rand() * 0.8, r = 0.31 * (1 - h * 0.5), a = TX.rand() * 6.28; p.set(Math.cos(a) * r, 0.05 + h, Math.sin(a) * r); e.set(TX.rand(), -a, 0.4); q.setFromEuler(e); leaf.setMatrixAt(i, m.compose(p, q, sc.set(1, 1, 1))); }
  g.add(leaf);
  // tall arching orchid stems
  for (let i = 0; i < 5; i++) {
    const a = i * 1.35 + 0.3, c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(Math.cos(a) * 0.12, 1.15, Math.sin(a) * 0.12), new THREE.Vector3(Math.cos(a) * 0.32, 1.45 + (i % 2) * 0.15, Math.sin(a) * 0.32), new THREE.Vector3(Math.cos(a) * 0.45, 1.35, Math.sin(a) * 0.45)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 20, 0.006, 5), new THREE.MeshStandardMaterial({ color: '#3a1a10' })));
    for (let k = 0; k < 9; k++) { const o = M(new THREE.SphereGeometry(0.028, 8, 6), new THREE.MeshStandardMaterial({ color: PETALS[(k + i) % 5], roughness: 0.5 }), ...c.getPoint(0.45 + k * 0.065).toArray()); o.scale.set(1.3, 0.6, 1.3); g.add(o); }
  }
  // amaranthus strands spilling down the two bar faces
  const beadG = new THREE.SphereGeometry(0.018, 6, 4), beads = [];
  for (let i = 0; i < 26; i++) {
    const face = i % 2, along = -0.3 + TX.rand() * 0.6, len = 0.35 + TX.rand() * 0.85;
    const sx = face ? along : 0.37, sz = face ? 0.37 : along;
    for (let k = 0; k < len / 0.032; k++) beads.push([sx + Math.sin(k * 0.5 + i) * 0.012 + (face ? 0 : k * 0.002), 0.06 - k * 0.032, sz + Math.cos(k * 0.5 + i) * 0.012 + (face ? k * 0.002 : 0), 1 - k * 0.015]);
  }
  const bead = new THREE.InstancedMesh(beadG, new THREE.MeshStandardMaterial({ roughness: 0.6 }), beads.length);
  beads.forEach(([bx, by, bz, s2], i) => { bead.setMatrixAt(i, m.compose(p.set(bx, by, bz), q.identity(), sc.set(s2, s2 * 1.3, s2))); bead.setColorAt(i, col.set(PETALS[(i >> 3) % 5])); });
  g.add(bead);
  return g;
}

// ── arcade screens (simple animated drawings, no real game art) ──
function drawArcade(c, look, t) {
  const w = 256, h = 200;
  if (look === 'brawl') {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f08a3a'); gr.addColorStop(.6, '#7a2a6a'); gr.addColorStop(1, '#2a1030'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = '#3a2a2a'; c.fillRect(0, 160, w, 40);
    const b = Math.abs(Math.sin(t * 6)) * 6, j = Math.sin(t * 9) > 0.6;
    c.fillStyle = '#f5f5f5'; c.fillRect(70, 100 - b, 26, 60); c.fillStyle = '#e0b090'; c.fillRect(74, 82 - b, 18, 18); c.fillStyle = '#c82020'; c.fillRect(72, 82 - b, 22, 5);
    if (j) { c.fillStyle = '#e0b090'; c.fillRect(96, 110 - b, 34, 10); }
    c.fillStyle = '#2244cc'; c.fillRect(160, 100, 26, 60); c.fillStyle = '#d0a080'; c.fillRect(164, 82, 18, 18);
    c.fillStyle = '#ffd23a'; c.fillRect(10, 10, 100 - (t * 3 % 60), 10); c.fillRect(146, 10, 100, 10);
    c.font = '900 22px Impact, sans-serif'; c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText('ROUND 1', w / 2, 46);
  } else if (look === 'maze') {
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#2f5bff'; c.lineWidth = 4;
    for (let i = 0; i < 6; i++) { c.strokeRect(12 + i * 40, 14, 28, 40); c.strokeRect(12 + i * 40, 146, 28, 40); }
    c.strokeRect(4, 4, w - 8, h - 8); c.strokeRect(60, 80, 136, 40);
    c.fillStyle = '#ffd9b0'; for (let x = 16; x < w - 10; x += 14) { c.fillRect(x, 68, 3, 3); c.fillRect(x, 132, 3, 3); }
    const px = (t * 60) % (w - 20) + 10;
    c.fillStyle = '#ff4fd8'; c.beginPath(); c.arc(px, 69, 7, 0, 7); c.fill();
    c.fillStyle = '#4fffe0'; c.beginPath(); c.arc((px + 120) % (w - 20) + 10, 133, 7, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.font = '700 14px monospace'; c.textAlign = 'left'; c.fillText('SCORE ' + (Math.floor(t * 70) % 99999), 10, 22 + 0);
  } else {
    c.fillStyle = '#1a0a08'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#3a1a14'; for (let x = 0; x < w; x += 32) for (let y = 0; y < 150; y += 20) c.fillRect(x + ((y / 20) % 2) * 16, y, 30, 18);
    c.fillStyle = '#2a120e'; c.fillRect(0, 160, w, 40);
    c.fillStyle = '#e8c020'; c.fillRect(60, 95, 24, 65); c.fillStyle = '#20a0e8'; c.fillRect(170, 95, 24, 65);
    c.fillStyle = '#c8a080'; c.fillRect(64, 78, 16, 18); c.fillRect(174, 78, 16, 18);
    c.fillStyle = '#d82020'; c.fillRect(10, 10, 100, 10); c.fillRect(146, 10, 100 - (t * 4 % 50), 10);
    if (Math.sin(t * 3) > 0) { c.font = '900 40px Impact, sans-serif'; c.fillStyle = '#ff2a1a'; c.textAlign = 'center'; c.strokeStyle = '#000'; c.lineWidth = 5; c.strokeText('FIGHT!', w / 2, 70); c.fillText('FIGHT!', w / 2, 70); }
  }
  if (Math.sin(t * 4) > 0) { c.fillStyle = '#fff'; c.font = '700 12px monospace'; c.textAlign = 'center'; c.fillText('INSERT COIN', w / 2, h - 8); }
}
