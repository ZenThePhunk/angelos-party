import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VENUE, FT } from './venue.js';
import { buildWorld } from './world.js';
import { setAniso } from './textures.js';
import { makeCharacter, makePhotographer, makeGuest } from './characters.js';
import { placeGuests } from './guests.js';
import { placeTattooArtists } from './tattoo.js';

const $ = (s) => document.querySelector(s);
const isTouch = matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);
const low = isTouch || params.has('low');
const Q = low
  ? { reflections: false, strands: 1000, discoLights: 2, discoIntensity: 34, shadow: 256, lowLights: true, pixelRatio: Math.min(devicePixelRatio, 1.5), bloomScale: 0.5 }
  : { reflections: true, strands: 2200, discoLights: 3, discoIntensity: 30, shadow: 512, lowLights: false, pixelRatio: Math.min(devicePixelRatio, 2), bloomScale: 1 };

// ── renderer + post effects ──
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Q.pixelRatio);
renderer.setSize(innerWidth || 1, innerHeight || 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;   // 5% brighter (Austin, 11/18)
renderer.shadowMap.enabled = true;     // only used so the disco ball can project its specks
renderer.shadowMap.type = THREE.PCFShadowMap;
setAniso(renderer.capabilities.getMaxAnisotropy());
const canvas = renderer.domElement;
$('#stage').appendChild(canvas);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a0303');
scene.fog = new THREE.FogExp2('#1a0604', 0.018);
const camera = new THREE.PerspectiveCamera(68, (innerWidth || 1) / (innerHeight || 1), 0.05, 80);
camera.rotation.order = 'YXZ';
camera.layers.enable(1);   // name tags / speech bubbles (kept out of floor reflections)

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth * Q.bloomScale, innerHeight * Q.bloomScale), 0.55, 0.55, 0.78);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ── the venue ──
const W = buildWorld(scene, Q);

// reflections for the tinsel & disco ball: a snapshot of the room itself
{
  const pm = new THREE.PMREMGenerator(renderer);
  const c = new THREE.Vector3(VENUE.chandelier.x * FT, 3.2, VENUE.chandelier.z * FT);
  W.world.position.sub(c);
  scene.environment = pm.fromScene(scene, 0.03, 0.1, 60).texture;
  scene.environmentIntensity = 0.35;
  W.world.position.add(c);
  pm.dispose();
}

// ── player ──
const player = { x: VENUE.spawn.x * FT, z: VENUE.spawn.z * FT, yaw: Math.atan2(-VENUE.spawn.facing[0], -VENUE.spawn.facing[1]), pitch: -0.02, speed: 0 };
let me = null, spouse = null, bubble = null, view = 'first', playing = false;   // first person; your own body stays hidden

const nameTags = [];   // every name tag: shown only when you're close to that person
function labelSprite(text, { size = 64, w = 512, h = 128 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,246,236,.94)'; g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, h / 2.4); g.fill();
  g.fillStyle = '#5a0e14'; g.font = `italic ${size}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  // dimmed just under the glow threshold so the text stays crisp, and on layer 1 so the floor doesn't reflect it
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, toneMapped: false, fog: false, color: new THREE.Color(0.68, 0.66, 0.64) }));
  s.layers.set(1);
  s.scale.set(w / h * 0.16, 0.16, 1); nameTags.push(s); return s;   // name tags and speech bubbles
}

// comic-book speech bubbles: drawn on the page (not in 3D) so they stay crisp and readable,
// sitting just up and to the side of the speaker's head with a tail running right to their mouth.
// speechBubble(text) → { visible, anchors: [Object3D at each speaker's mouth] }  (two anchors = a shared line with two tails)
const bubbles = [];
const tailSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); tailSvg.id = 'tails'; document.body.appendChild(tailSvg);
function speechBubble(text, { side = 'right', once = true, secs = 4 } = {}) {   // once: says it only the first time, for `secs` seconds   // side: which side of the speaker's face the bubble sits on
  const el = document.createElement('div'); el.className = 'cbubble'; el.textContent = text; el.hidden = true; document.body.appendChild(el);
  const b = { el, visible: false, anchors: [], tails: [], side, once, secs, t0: -1 }; bubbles.push(b); return b;
}
function mouthAt(head, y = 1.575, z = 0.135) { const o = new THREE.Object3D(); o.position.set(0, y, z); head.add(o); return o; }
const _bp = new THREE.Vector3();
function updateBubbles() {
  for (const b of bubbles) {
    let show = b.visible && playing && !reading;
    if (b.once) {                       // first time they get to talk: start the clock; after it runs out they stay quiet
      const now = performance.now() / 1000;
      if (show && b.t0 < 0) b.t0 = now;
      show = show && b.t0 >= 0 && now - b.t0 < b.secs;
      if (b.t0 >= 0 && now - b.t0 >= b.secs) show = false;
    }
    const pts = [];
    if (show) for (const a of b.anchors) {
      a.getWorldPosition(_bp); const d = _bp.distanceTo(camera.position); _bp.project(camera);
      if (_bp.z > 1 || Math.abs(_bp.x) > 1.2 || Math.abs(_bp.y) > 1.2) continue;
      pts.push({ x: (_bp.x + 1) / 2 * innerWidth, y: (1 - _bp.y) / 2 * innerHeight, d });
    }
    if (!pts.length) show = false;
    b.el.hidden = !show;
    while (b.tails.length < b.anchors.length) { const t = document.createElementNS('http://www.w3.org/2000/svg', 'polygon'); tailSvg.appendChild(t); b.tails.push(t); }
    b.tails.forEach((t) => t.setAttribute('visibility', show ? 'visible' : 'hidden'));
    if (!show) continue;
    const d = Math.min(...pts.map((p) => p.d)), k = Math.max(0.62, Math.min(1.15, 2.2 / d));   // a little bigger as you get close
    b.el.style.fontSize = (19 * k).toFixed(1) + 'px';
    const w = b.el.offsetWidth, h = b.el.offsetHeight;
    const mx = Math.max(...pts.map((p) => p.x)), my = Math.min(...pts.map((p) => p.y));
    const cxm = pts.reduce((q, p) => q + p.x, 0) / pts.length;
    const hr0 = 0.15 * innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * d);
    const minX = Math.min(...pts.map((p) => p.x));
    let left = pts.length > 1 ? cxm - w / 2 : b.side === 'left' ? minX - hr0 - 30 * k - w : mx + hr0 + 30 * k, top = my - h - 26 * k;   // one speaker: up and to the right of the mouth; two: centered between them
    if (pts.length === 1 && b.side !== 'left' && left + w > innerWidth - 8) left = minX - hr0 - 30 * k - w;   // flip sides near the screen edge
    if (pts.length === 1 && b.side === 'left' && left < 8) left = mx + hr0 + 30 * k;
    left = Math.max(8, Math.min(innerWidth - w - 8, left)); top = Math.max(8, top);
    b.el.style.left = left + 'px'; b.el.style.top = top + 'px';
    pts.forEach((p, i) => {      // tail: a wedge from the bubble's lower edge to the mouth
      const bx = Math.max(left + 22, Math.min(left + w - 22, p.x + (left > p.x ? 26 : -26) * k)), by = top + h - 4;
      const half = 11 * k;
      // the tip stops just beside their face (on the bubble's side), not over it
      const hr = 0.15 * innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * p.d), side = bx >= p.x ? 1 : -1;
      b.tails[i].setAttribute('points', `${bx - half},${by} ${bx + half},${by} ${p.x + side * hr},${p.y - hr * 0.35}`);
    });
    for (let i = pts.length; i < b.tails.length; i++) b.tails[i].setAttribute('visibility', 'hidden');
  }
}

let spouseCollider = null, myKind = null;
const _fwd = new THREE.Vector3(), _fp = new THREE.Vector3();
// glowing hover words: g = { el, objs: () => [Object3D], look: height to aim at, at: height to pin the words, range }
function glowLabel(g) {
  let see = null, dist = 1;
  if (playing && !reading) {
    camera.getWorldDirection(_fwd);
    for (const o of g.objs()) {
      o.getWorldPosition(_fp); _fp.y += g.look; _fp.sub(camera.position);
      const d = _fp.length(); if (d < g.range && _fp.normalize().dot(_fwd) > 0.82) { see = o; dist = d; break; }
    }
  }
  if (see) {   // follow it on screen, a little bigger as you get closer
    see.getWorldPosition(_fp); _fp.y += g.at; _fp.project(camera);
    g.el.style.left = ((_fp.x + 1) / 2 * innerWidth) + 'px'; g.el.style.top = ((1 - _fp.y) / 2 * innerHeight) + 'px';
    g.el.style.setProperty('--s', Math.max(0.45, Math.min(1.25, 1.5 / dist)).toFixed(3));
  }
  if (!!see !== g.on) { g.on = !!see; g.el.classList.toggle('on', g.on); }
}
const glowFlowers = { el: $('#brophy'), objs: () => W.flowerDisplays, look: 0.4, at: 0.35, range: 2.6, on: false };
const glowKristin = { el: $('#bestDressed'), objs: () => guests.map((g) => g.root), look: 1.2, at: 1.4, range: 3.0, on: false };   // Kristin
// Austin and Bre dance together on the dance floor; guests walk in as themselves (first person)
const couple = [];
function placeCouple() {
  const cx = VENUE.spouseSpot.x * FT, cz = VENUE.spouseSpot.z * FT;
  [['austin', -0.42], ['bre', 0.42]].forEach(([kind, off], i) => {
    const c = makeCharacter(kind); c.root.position.set(cx, 0, cz + off); c.root.rotation.y = i ? Math.PI : 0; scene.add(c.root);
    const tag = labelSprite(c.name, { size: 70 }); tag.position.set(0, kind === 'austin' ? 2.2 : 2.02, 0); c.root.add(tag);
    c.home = { x: cx, z: cz + off, face: i ? Math.PI : 0 };
    couple.push(c);
    W.colliders.push({ circle: [cx, cz + off], r: 0.32 });
  });
  bubble = speechBubble('You made it! ♡', { side: 'left' }); bubble.anchors = [mouthAt(couple[1].head)];   // Bre says it; the bubble sits off to the left of her face
}
placeCouple();
{ const tag = labelSprite('Danny', { size: 70 }); tag.position.set(0, 2.2, 0); W.bartenders[0].add(tag); }   // the bartender on the right
// a guest dancing on the floor in front of the band
const guests = [];
{ const g = makeGuest(); const gx = 23 * FT, gz = 27 * FT; g.root.position.set(gx, 0, gz); g.root.rotation.y = -Math.PI / 2; scene.add(g.root);
  { const tag = labelSprite('Kristin', { size: 70 }); tag.position.set(0, 2.2, 0); g.root.add(tag); }
  g.home = { x: gx, z: gz, face: -Math.PI / 2 }; guests.push(g); W.colliders.push({ circle: [gx, gz], r: 0.32 }); }

const guestTick = placeGuests({ scene, W, FT, VENUE, labelSprite, speechBubble, player, isPlaying: () => playing });
const tattooTick = placeTattooArtists({ scene, W, FT, labelSprite });   // artists at work in the tattoo lounge (tattoo.js)

// ── Tyler, the photographer, wandering the party with his flash camera ──
const tyler = makePhotographer();
const T = { x: 6.2, z: 6.4, yaw: -Math.PI / 2, speed: 0, state: 'walk', wp: 0, timer: 0, greetedAt: -99, fired: false, look: null, stuck: 0, stuckDir: 1 };
// his opening route: shoot the band, then the pool table, then the tattoo area, then come find you
const tylerRoute = [{ at: [6.2, 6.4], look: [2.0, 7.2] }, { at: [9.4, 8.9], look: [11.0, 10.8] }, { at: [10.6, 4.6], look: [10.6, 1.0] }];
// after that he roams the party between these spots, shooting whatever's in front of him
const tylerSpots = [[16, 6.5], [20.5, 8.6], [12.5, 10.2], [9.5, 7.6], [14.5, 4.6], [22.5, 6.2], [18, 11.2], [11, 5.4]];
let tylerOnRoute = true;
tyler.root.position.set(T.x, 0, T.z); scene.add(tyler.root);
{ const tag = labelSprite('Tyler', { size: 70 }); tag.position.set(0, 2.18, 0); tyler.root.add(tag); }
const tylerBubble = speechBubble('Check out my photos!'); tylerBubble.anchors = [mouthAt(tyler.head)];   // the click/tap hint under the crosshair tells you how
const tylerCollider = { circle: [T.x, T.z], r: 0.3 }; W.colliders.push(tylerCollider);
const tylerReadable = { obj: tyler.root, name: 'Tyler', open: 'tyler' }; W.readables.push(tylerReadable);
const TYLER_NEAR = 3.2;   // walk this close and he stops what he's doing and turns to you
// after you've looked through his photos, Tyler heads back out to keep shooting the party
function tylerResume() { tylerOnRoute = false; T.state = 'walk'; T.greetedAt = clock.elapsedTime; T.wp = Math.floor(Math.random() * tylerSpots.length); }
function cameraFlash() { const f = $('#flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function updateTyler(dt, t) {
  if (!playing) { tyler.root.position.set(T.x, 0, T.z); tyler.root.rotation.y = T.yaw; tyler.update(dt, 0, t, 'idle'); return; }   // waits by the band until you walk in
  const toP = Math.hypot(player.x - T.x, player.z - T.z);
  const goTo = (x, z, stopAt, speed) => {
    const dx = x - T.x, dz = z - T.z, d = Math.hypot(dx, dz);
    if (d <= stopAt) { T.speed = 0; return true; }
    const want = Math.atan2(dx, dz); let diff = Math.atan2(Math.sin(want - T.yaw), Math.cos(want - T.yaw)); T.yaw += diff * Math.min(1, dt * 5);
    const step = Math.min(d - stopAt, speed * dt); const ox = T.x, oz = T.z;
    T.x += Math.sin(T.yaw) * step; T.z += Math.cos(T.yaw) * step;
    const me2 = { x: T.x, z: T.z }; collide(me2, tylerCollider); T.x = me2.x; T.z = me2.z;
    T.speed = Math.hypot(T.x - ox, T.z - oz) / Math.max(dt, 1e-4);
    // blocked by a table or a person? step around it, and if he still can't get there, call it close enough
    if (T.speed < speed * 0.35) { T.stuck += dt; T.yaw += (T.stuckDir || 1) * dt * 2.5; if (T.stuck > 2.2) { T.stuck = 0; T.stuckDir = -(T.stuckDir || 1); T.speed = 0; return true; } }
    else T.stuck = Math.max(0, T.stuck - dt);
    return false;
  };
  const faceP = () => { const want = Math.atan2(player.x - T.x, player.z - T.z); T.yaw += Math.atan2(Math.sin(want - T.yaw), Math.cos(want - T.yaw)) * Math.min(1, dt * 6); };
  let mode = 'idle';
  // looking at his photos: he stands right there and waits for you
  if (reading && galleryKey === 'tyler' && !$('#booth').hidden) { T.speed = 0; finishTyler(dt, t, mode, toP); return; }
  // you walked up to him: he stops shooting/wandering and faces you so he's easy to tap
  if (toP < TYLER_NEAR && (T.state === 'walk' || T.state === 'shoot')) { T.speed = 0; faceP(); finishTyler(dt, t, mode, toP); return; }
  if (playing && !reading && !tylerOnRoute && T.state !== 'hang' && T.state !== 'snapYou' && T.state !== 'seek' && toP < 2.5 && t - T.greetedAt > 150) { T.state = 'approach'; }   // only now and then, and only if you're already close by
  switch (T.state) {
    case 'walk': { const stop = tylerOnRoute ? tylerRoute[T.wp] : null; const [x, z] = stop ? stop.at : tylerSpots[T.wp]; if (goTo(x, z, 0.2, 1.05)) { T.state = 'shoot'; T.timer = 0; T.fired = false; T.look = stop ? stop.look : null; } break; }
    case 'shoot': mode = 'shoot'; T.timer += dt;
      if (T.look) { const want = Math.atan2(T.look[0] - T.x, T.look[1] - T.z); T.yaw += Math.atan2(Math.sin(want - T.yaw), Math.cos(want - T.yaw)) * Math.min(1, dt * 5); }
      if (!T.fired && T.timer > 0.9) { tyler.fire(); T.fired = true; }
      if (T.timer > 2.4) {
        if (tylerOnRoute) { T.wp++; if (T.wp >= tylerRoute.length) { tylerOnRoute = false; T.wp = 0; T.state = playing ? 'seek' : 'walk'; break; } }
        else T.wp = (T.wp + 1 + Math.floor(Math.random() * 3)) % tylerSpots.length;
        T.state = 'walk';
      }
      break;
    case 'seek': if (goTo(player.x, player.z, 1.7, 1.15)) { T.state = 'snapYou'; T.timer = 0; T.fired = false; } break;
    case 'approach': if (goTo(player.x, player.z, 1.7, 1.4)) { T.state = 'snapYou'; T.timer = 0; T.fired = false; } if (toP > 7) T.state = 'walk'; break;
    case 'snapYou': mode = 'shoot'; faceP(); T.timer += dt; if (!T.fired && T.timer > 0.8) { tyler.fire(); cameraFlash(); T.fired = true; } if (T.timer > 1.6) { T.state = 'hang'; T.greetedAt = t; } break;
    case 'hang': faceP(); if (toP > 5.5 || t - T.greetedAt > 8) { T.state = 'walk'; T.greetedAt = t; } break;   // chats for a few seconds, then gets back to shooting
  }
  finishTyler(dt, t, mode, toP);
}
function finishTyler(dt, t, mode, toP) {
  tylerBubble.visible = ((T.state === 'hang' || (T.state === 'snapYou' && T.fired)) && toP < 5.5) || toP < 2.8;   // also whenever you walk up to him
  tyler.root.position.set(T.x, 0, T.z); tyler.root.rotation.y = T.yaw; tylerCollider.circle[0] = T.x; tylerCollider.circle[1] = T.z;
  tyler.update(dt, T.speed, t, mode);
}
// phones: while you're near Tyler and he's anywhere on screen, keep his photos button up (no need to aim right at him)
const _ty = new THREE.Vector3();
function tylerOnScreen() {
  if (Math.hypot(player.x - T.x, player.z - T.z) > TYLER_NEAR) return false;
  _ty.set(T.x, 1.3, T.z).project(camera);
  return _ty.z < 1 && Math.abs(_ty.x) < 0.95 && Math.abs(_ty.y) < 1;
}

// start-screen portraits, drawn with the same 3D characters
function portrait(kind, close = false, turn = 0.25) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(300, 400); r.outputColorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight('#fff4ea', '#5a2a22', 2.4));
  const d = new THREE.DirectionalLight('#ffffff', 1.6); d.position.set(2, 3, 4); s.add(d);
  const rim = new THREE.DirectionalLight('#ff4030', 2.2); rim.position.set(-3, 2, -3); s.add(rim);
  const c = kind === 'tyler' ? Object.assign(makePhotographer(), { update() {} }) : makeCharacter(kind); c.root.rotation.y = kind === 'austin' ? 0.3 : -0.3; c.update(0, 0, 0); s.add(c.root);
  const cam = new THREE.PerspectiveCamera(28, 300 / 400, 0.1, 20); cam.position.set(0, 1.05, kind === 'austin' ? 3.85 : 3.6); cam.lookAt(0, kind === 'austin' ? 0.95 : 0.88, 0);
  if (close) { c.root.rotation.y = turn; cam.position.set(0, c.eye, 0.9); cam.lookAt(0, c.eye - 0.02, 0); }
  r.render(s, cam); const url = r.domElement.toDataURL('image/png'); r.dispose(); r.forceContextLoss(); return url;
}
// the start-screen pictures are pre-rendered files (images/couple-*.png, made by tools/make_portraits.sh) so they show instantly

// ── music: "Them Changes" through YouTube's own player ──
const SONG = 'GNCd_ERZvZM';
let yt = null, ytReady = false, musicOn = false;
window.onYouTubeIframeAPIReady = () => {
  yt = new YT.Player('yt', {
    videoId: SONG, width: '100%', height: '100%',
    playerVars: { playsinline: 1, rel: 0, loop: 1, playlist: SONG },
    events: {
      onReady: () => { ytReady = true; if (playing && !$('#music').classList.contains('min')) startMusic(); },
      onError: (e) => { window.__ytError = e.data; console.warn('YouTube error', e.data); },
      onStateChange: (e) => { musicOn = e.data === YT.PlayerState.PLAYING; $('#music').classList.toggle('on', musicOn); if (musicOn) $('#music .tap').hidden = true; },
    },
  });
};
{ const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s); }
function startMusic() {
  if (!ytReady) return;
  yt.setVolume(60); if (params.has('muted')) yt.mute(); else yt.unMute();
  yt.playVideo();
  // browsers sometimes refuse sound until you tap: fall back to playing muted with a "tap for sound" chip
  setTimeout(() => { if (!musicOn && !$('#music').classList.contains('min')) { yt.mute(); yt.playVideo(); setTimeout(() => { if (musicOn && !params.has('muted')) $('#music .unmute').hidden = false; else if (!musicOn) $('#music .tap').hidden = false; }, 1200); } }, 1500);
}
$('#music .unmute').onclick = (e) => { e.stopPropagation(); yt.unMute(); yt.setVolume(60); $('#music .unmute').hidden = true; };
$('#music .hide').onclick = () => { $('#music').classList.add('min'); if (ytReady) yt.pauseVideo(); };
$('#music .show').onclick = () => { $('#music').classList.remove('min'); startMusic(); };

// ── reading the cards (menus + thank-you) up close ──
const _me = new THREE.Vector3(), readRay = new THREE.Raycaster(); readRay.far = 3.2;   // walk up close (about 7 ft) to use something; big things like the pool table reach a little further
function readableAt(nx, ny) {
  readRay.setFromCamera({ x: nx, y: ny }, camera); readRay.far = view === 'first' ? 3.2 : 7;
  _me.set(player.x, camera.position.y, player.z); if (view !== 'first') _me.y = me ? me.eye : 1.6;
  for (const r of W.readables) { const h = readRay.intersectObject(r.obj, true); if (h.length && h[0].point.distanceTo(_me) <= (r.reach || 2.2) + (view === 'first' ? 0 : 0.3)) return r; }   // measured from you, not the camera, so it works in both views
  return null;
}
let reading = false, tapTarget = null;
$('#tapBtn').addEventListener('click', (e) => { e.stopPropagation(); if (tapTarget) { const r = tapTarget; tapTarget = null; $('#tapBtn').hidden = true; openCard(r); } });
function openCard(r) {
  if (r.open === 'booth') { openBooth('booth'); return; }
  if (r.open === 'tyler') { openBooth('tyler'); return; }
  if (r.open === 'game') { openArcade(r); return; }
  if (r.open === 'pet') { r.pet(); return; }   // Sunny: belly rubs
  $('#reader img').src = r.img || r.canvas.toDataURL('image/jpeg', 0.92); $('#reader').hidden = false; reading = true;   // menus open as the original printed files
  if (document.pointerLockElement) { suppressPause = true; document.exitPointerLock(); }
  for (const k in keys) keys[k] = false;
}
// ── arcade: play the cabinet's game full-screen ──
let arcadeGame = null, arcadeOpen = false;
async function openArcade(r) {
  reading = true; arcadeOpen = true; $('#arcade').hidden = false; $('#arcade .ttl').textContent = r.name;
  $('#arcade').dataset.look = r.game;
  if (document.pointerLockElement) { suppressPause = true; document.exitPointerLock(); }
  for (const k in keys) keys[k] = false;
  if (ytReady && musicOn) yt.setVolume(30);                       // turn the party down a bit while you play
  const cv = $('#arcade canvas');
  try {
    if (r.game === 'pool') { const m = await import('./games/pool.js'); arcadeGame = m.startPool(cv, { onExit: closeArcade }); }
    else if (r.game === 'maze') { const m = await import('./games/maze.js'); arcadeGame = m.startMaze(cv, { onExit: closeArcade }); }
    else { const m = await import('./games/fighter.js'); arcadeGame = m.startFighter(cv, { variant: r.game === 'brawl' ? 'fistfury' : 'bloodduel', onExit: closeArcade }); }
  } catch (e) { console.error(e); const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 640, 480); g.fillStyle = '#fff'; g.font = '20px monospace'; g.fillText('Out of order — check back soon!', 140, 240); }
  $('#arcade .ctl').textContent = r.game === 'pool' ? (isTouch ? 'Drag on the table to aim · pull the power bar down and let go to shoot' : 'Drag on the table to aim (← → to fine-tune) · pull the power bar down or hold Space, let go to shoot · Esc to leave') : r.game === 'maze' ? 'Arrows / WASD to move · Enter to start · Esc to leave' : 'Arrows / WASD move & jump · J punch · K kick · Enter to start · Esc to leave';
}
function closeArcade() {
  if (arcadeGame) { arcadeGame.stop(); arcadeGame = null; }
  $('#arcade').hidden = true; arcadeOpen = false; reading = false;
  if (ytReady && musicOn) yt.setVolume(60);
  if (!isTouch) tryLock();
}
$('#arcade .x').onclick = closeArcade;
addEventListener('keydown', (e) => { if (arcadeOpen && e.key === 'Escape') { e.preventDefault(); closeArcade(); } });
// phone joystick → left/right/up/down (8 directions), like an arcade stick
{
  const stick = $('#arcStick'), ball = $('#arcStick .ball'), held = { left: false, right: false, up: false, down: false };
  let id = null;
  const set = (dir, on) => { if (held[dir] !== on) { held[dir] = on; if (arcadeGame) arcadeGame.press(dir, on); } };
  const move = (t) => {
    const r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = t.clientX - cx, dy = t.clientY - cy; const d = Math.hypot(dx, dy), max = r.width * 0.32;
    if (d > max) { dx *= max / d; dy *= max / d; }
    ball.style.transform = `translate(${dx}px,${dy}px)`;
    const dead = max * 0.35;
    set('left', dx < -dead); set('right', dx > dead); set('up', dy < -dead); set('down', dy > dead);
  };
  const release = () => { id = null; ball.style.transform = ''; for (const k in held) set(k, false); };
  stick.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; id = t.identifier; move(t); }, { passive: false });
  stick.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === id) move(t); }, { passive: false });
  stick.addEventListener('touchend', (e) => { for (const t of e.changedTouches) if (t.identifier === id) release(); });
  stick.addEventListener('touchcancel', release);
}
// phone buttons → the game's virtual input
for (const b of document.querySelectorAll('#arcade [data-act]')) {
  const act = b.dataset.act, go = (down) => (e) => { e.preventDefault(); if (arcadeGame) arcadeGame.press(act, down); };
  b.addEventListener('touchstart', go(true), { passive: false }); b.addEventListener('touchend', go(false), { passive: false });
  b.addEventListener('mousedown', go(true)); b.addEventListener('mouseup', go(false)); b.addEventListener('mouseleave', go(false));
}

// ── photo booth gallery: a grid of the booth pictures; click one to see it big ──
let boothPhotos = null, boothIdx = -1, galleryKey = null;
const GALLERIES = {
  booth: { title: 'Photo Booth', url: 'photos/booth/booth.json', empty: 'The photo booth pictures are on their way. Check back soon!' },
  tyler: { title: "Tyler's Photos", url: 'photos/tyler/gallery.json', empty: "Tyler's photos are still in the darkroom. Check back soon!" },
};
async function openBooth(key = 'booth') {
  const G = GALLERIES[key];
  reading = true; $('#booth').hidden = false; fitBooth(); $('#booth .ttl').textContent = G.title; $('#booth').dataset.g = key;   // the photo booth shows whole strips, Tyler's shows squares
  if (document.pointerLockElement) { suppressPause = true; document.exitPointerLock(); }
  for (const k in keys) keys[k] = false;
  if (galleryKey !== key) {
    galleryKey = key; boothPhotos = [];
    const grid = $('#booth .grid'); grid.innerHTML = ''; $('#booth .count').textContent = '';
    try { const r = await fetch(G.url, { cache: 'no-cache' }); boothPhotos = r.ok ? await r.json() : []; } catch { boothPhotos = []; }
    if (!boothPhotos.length) grid.innerHTML = `<p class="soon">${G.empty}</p>`;
    boothPhotos.forEach((ph, i) => { const im = document.createElement('img'); im.loading = 'lazy'; im.src = ph.thumb; im.alt = `${G.title} ${i + 1}`; im.onclick = () => showBooth(i); grid.appendChild(im); });
    $('#booth .count').textContent = boothPhotos.length ? `${boothPhotos.length} pictures` : '';
  }
}
function showBooth(i) {
  boothIdx = (i + boothPhotos.length) % boothPhotos.length;
  $('#boothBig img').src = boothPhotos[boothIdx].full; $('#boothBig .n').textContent = `${boothIdx + 1} / ${boothPhotos.length}`; $('#boothBig').hidden = false; fitBooth();
  for (const n of [boothIdx + 1, boothIdx - 1]) new Image().src = boothPhotos[(n + boothPhotos.length) % boothPhotos.length].full;
}
function closeBooth() { if (!$('#boothBig').hidden) { $('#boothBig').hidden = true; return; } $('#booth').hidden = true; reading = false; if (galleryKey === 'tyler') tylerResume(); if (!isTouch) tryLock(); }
$('#booth .x').onclick = () => { $('#boothBig').hidden = true; closeBooth(); };
// full-size viewer: arrows, close and tap-outside. Phones get handled right on the touch (no waiting on a click,
// which some phones drop when sideways), and a sideways swipe flips photos too.
function boothAct(t) {
  if (t.closest('.x')) $('#boothBig').hidden = true;   // back to the grid of photos
  else if (t.closest('.prev')) showBooth(boothIdx - 1);
  else if (t.closest('.next')) showBooth(boothIdx + 1);
  else if (!t.closest('img')) $('#boothBig').hidden = true;
}
$('#boothBig').addEventListener('click', (e) => { e.stopPropagation(); boothAct(e.target); });
{ let sx = null, sy = null; $('#boothBig').addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  $('#boothBig').addEventListener('touchend', (e) => {
    if (sx === null) return; const t0 = e.changedTouches[0], dx = t0.clientX - sx, dy = t0.clientY - sy; sx = null;
    e.preventDefault(); e.stopPropagation();   // we handle it here, so no extra click afterwards
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) showBooth(boothIdx + (dx < 0 ? 1 : -1));
    else if (Math.hypot(dx, dy) < 14) boothAct(e.target);
  }, { passive: false }); }
$('#booth .x').addEventListener('touchend', (e) => { e.preventDefault(); $('#boothBig').hidden = true; closeBooth(); }, { passive: false });
// keep the viewer exactly over the part of the screen you can see, even if the phone zoomed or shifted when it turned
function fitBooth() {
  const vv = window.visualViewport; if (!vv) return;
  for (const el of [$('#booth'), $('#boothBig')]) Object.assign(el.style, { left: vv.offsetLeft + 'px', top: vv.offsetTop + 'px', width: vv.width + 'px', height: vv.height + 'px', right: 'auto', bottom: 'auto' });
}
if (window.visualViewport) { visualViewport.addEventListener('resize', fitBooth); visualViewport.addEventListener('scroll', fitBooth); }
addEventListener('orientationchange', () => setTimeout(fitBooth, 350));

function closeCard() { $('#reader').hidden = true; reading = false; if (!isTouch) tryLock(); }
$('#reader').addEventListener('click', closeCard);
addEventListener('keydown', (e) => { if (reading && !arcadeOpen && $('#booth').hidden && (e.key === 'Escape' || e.key === ' ')) closeCard(); });

// ── input ──
const keys = {};
addEventListener('keydown', (e) => { keys[e.code] = true; });
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

const locked = () => document.pointerLockElement === canvas;
let canLock = !isTouch && !!canvas.requestPointerLock, drag = null;
// Capture the mouse so moving it looks around. Browsers sometimes refuse right after Esc;
// then we show a small "click to look around" note and the next click captures it.
function tryLock() {
  if (!canLock || locked()) return;
  const fail = (err) => {
    if (err && (err.name === 'WrongDocumentError' || err.name === 'NotSupportedError')) { canLock = false; $('#relock').hidden = true; return; }   // this browser can't do it: drag to look instead
    if (playing && !paused && !reading) $('#relock').hidden = false;
  };
  try { const p = canvas.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch((e) => { try { const q = canvas.requestPointerLock(); if (q && q.catch) q.catch(fail); } catch (e2) { fail(e2); } }); }
  catch (e) { fail(e); }
}
const look = (dx, dy) => { player.yaw -= dx * 0.0022; player.pitch = Math.max(-1.3, Math.min(1.3, player.pitch - dy * 0.0022)); };
canvas.addEventListener('mousedown', (e) => { if (playing && !isTouch && !locked()) drag = { x: e.clientX, y: e.clientY, moved: 0 }; });
addEventListener('mouseup', () => { setTimeout(() => { drag = null; }); });
canvas.addEventListener('click', (e) => {
  if (!playing || isTouch || reading) return;
  const r = locked() ? readableAt(0, 0) : readableAt((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (r && (locked() || !drag || drag.moved < 6)) { openCard(r); return; }
  if (!locked() && (!drag || drag.moved < 6)) tryLock();
});
const mouseN = { x: 0, y: 0 };
addEventListener('mousemove', (e) => { mouseN.x = (e.clientX / innerWidth) * 2 - 1; mouseN.y = -(e.clientY / innerHeight) * 2 + 1; });
document.addEventListener('mousemove', (e) => {
  if (locked()) look(e.movementX, e.movementY);
  else if (drag && e.buttons) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy); look(dx * 2.2, dy * 2.2); }
});
// ── pause menu (Esc): resume, music, switch character, view ──
let paused = false;
function syncPauseButtons() {
  $('#pause [data-act=music]').textContent = musicOn ? '⏸ Pause the music' : '▶ Play the music';
}
function openPause() { if (!playing || reading) return; paused = true; syncPauseButtons(); $('#pause').hidden = false; for (const k in keys) keys[k] = false; if (locked()) document.exitPointerLock(); }
function closePause() { paused = false; $('#pause').hidden = true; tryLock(); }
let unlockedAt = 0;
document.addEventListener('pointerlockchange', () => { if (locked()) $('#relock').hidden = true; if (!locked()) unlockedAt = performance.now(); if (playing && !locked() && !reading && !suppressPause) openPause(); suppressPause = false; });
document.addEventListener('pointerlockerror', () => { setTimeout(() => { if (canLock && playing && !paused && !reading && !locked()) $('#relock').hidden = false; }, 80); });
let suppressPause = false;
addEventListener('keydown', (e) => { if (e.key === 'Escape' && playing && !reading && !locked() && performance.now() - unlockedAt > 400) { paused ? closePause() : openPause(); } });
$('#menuBtn').onclick = (e) => { e.stopPropagation(); openPause(); };
$('#pause').addEventListener('click', (e) => {
  const act = e.target.dataset && e.target.dataset.act;
  if (!act) { if (e.target === $('#pause')) closePause(); return; }
  if (act === 'resume') closePause();
  else if (act === 'music') { if (musicOn) { if (ytReady) yt.pauseVideo(); musicOn = false; } else { $('#music').classList.remove('min'); startMusic(); musicOn = true; } syncPauseButtons(); }
});

// touch: left side walks, right side looks
let joy = null, lookT = null;
const joyEl = $('#joy'), knob = $('#joy .knob');
canvas.addEventListener('touchstart', (e) => {
  if (!playing) return; e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth * 0.45 && !joy) { joy = { id: t.identifier, x0: t.clientX, y0: t.clientY, dx: 0, dy: 0 }; joyEl.style.left = t.clientX + 'px'; joyEl.style.top = t.clientY + 'px'; joyEl.hidden = false; knob.style.transform = ''; $('#touchHelp').classList.add('walking'); }
    else if (!lookT) { lookT = { id: t.identifier, x: t.clientX, y: t.clientY, x0: t.clientX, y0: t.clientY, t0: performance.now() }; $('#touchHelp').classList.add('looking'); }
  }
  $('#hint').classList.add('fade');
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (joy && t.identifier === joy.id) { let dx = t.clientX - joy.x0, dy = t.clientY - joy.y0; const d = Math.hypot(dx, dy); if (d > 55) { dx *= 55 / d; dy *= 55 / d; } joy.dx = dx; joy.dy = dy; knob.style.transform = `translate(${dx}px,${dy}px)`; }
    else if (lookT && t.identifier === lookT.id) { look((t.clientX - lookT.x) * 5.04, (t.clientY - lookT.y) * 4.08); lookT.x = t.clientX; lookT.y = t.clientY; }
  }
}, { passive: false });
const tEnd = (e) => { for (const t of e.changedTouches) { if (joy && t.identifier === joy.id) { joy = null; joyEl.hidden = true; $('#touchHelp').classList.remove('walking'); } if (lookT && t.identifier === lookT.id) { $('#touchHelp').classList.remove('looking'); if (Math.hypot(t.clientX - lookT.x0, t.clientY - lookT.y0) < 12 && performance.now() - lookT.t0 < 350) { const r = readableAt((t.clientX / innerWidth) * 2 - 1, -(t.clientY / innerHeight) * 2 + 1); if (r) openCard(r); } lookT = null; } } };
canvas.addEventListener('touchend', tEnd); canvas.addEventListener('touchcancel', tEnd);

function toggleView() {
  view = view === 'first' ? 'third' : 'first';
  if (me) me.root.visible = view === 'third';
}


// ── start screen ──
$('#enter').addEventListener('click', () => {
  $('#start').classList.add('gone'); $('#hud').hidden = false; $('#music').hidden = false;
  $('#hint').innerHTML = 'Welcome in! Austin & Bre are right up ahead. Controls are in the top corner.';
  playing = true; startMusic(); tryLock();   // music starts with the Enter tap on phones and computers (the tap lets phones play sound)
  if (isTouch) $('#touchHelp').hidden = false;
  checkRotate();
  setTimeout(() => $('#hint').classList.add('fade'), 10000);
});

let rotateDismissed = false;
function checkRotate() { $('#rotate').hidden = !(isTouch && playing && !rotateDismissed && innerHeight > innerWidth); }
addEventListener('resize', checkRotate); addEventListener('orientationchange', () => setTimeout(checkRotate, 300));
$('#rotate button').onclick = () => { rotateDismissed = true; checkRotate(); };

function fitView() {
  const w = innerWidth, h = innerHeight; if (!w || !h) return;
  const s = renderer.getSize(new THREE.Vector2()); if (s.x === w && s.y === h) return;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h); composer.setSize(w, h); bloom.resolution.set(w * Q.bloomScale, h * Q.bloomScale);
}
addEventListener('resize', fitView);

// ── movement + collisions ──
const PR = 0.28;
const playerRef = player;
function collide(player = playerRef, skip = null) {
  for (let pass = 0; pass < 3; pass++) for (const c of W.colliders) {
    if (c === skip) continue;
    let cx, cz; const r = c.r || 0;
    if (c.circle) [cx, cz] = c.circle;
    else if (c.box) {
      const [x1, z1, x2, z2] = c.box;
      cx = Math.max(x1, Math.min(x2, player.x)); cz = Math.max(z1, Math.min(z2, player.z));
      if (cx === player.x && cz === player.z) {   // inside the box: pop out the nearest side
        const dl = player.x - x1, dr = x2 - player.x, dtp = player.z - z1, db = z2 - player.z, m = Math.min(dl, dr, dtp, db);
        if (m === dl) player.x = x1 - PR; else if (m === dr) player.x = x2 + PR; else if (m === dtp) player.z = z1 - PR; else player.z = z2 + PR;
        continue;
      }
    } else { const [x1, z1, x2, z2] = c.seg, dx = x2 - x1, dz = z2 - z1; const tt = Math.max(0, Math.min(1, ((player.x - x1) * dx + (player.z - z1) * dz) / (dx * dx + dz * dz))); cx = x1 + dx * tt; cz = z1 + dz * tt; }
    const ox = player.x - cx, oz = player.z - cz, d = Math.hypot(ox, oz), R = r + PR;
    if (d < R && d > 1e-6) { player.x = cx + ox / d * R; player.z = cz + oz / d * R; }
  }
}

const ray = new THREE.Raycaster();
const camTarget = new THREE.Vector3(), camWanted = new THREE.Vector3(), camDir = new THREE.Vector3();
const clock = new THREE.Clock();
let bob = 0, frames = 0, slowTime = 0, checked = false;
function frame() {
  fitView();
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (playing && !reading && !paused) {
    let fw = 0, st = 0, turn = 0;
    if (keys.KeyW || keys.ArrowUp) fw += 1;
    if (keys.KeyS || keys.ArrowDown) fw -= 1;
    if (keys.KeyA) st -= 1;
    if (keys.KeyD) st += 1;
    if (keys.ArrowLeft) turn += 1;
    if (keys.ArrowRight) turn -= 1;
    if (joy) { fw -= joy.dy / 55; st += joy.dx / 55; }
    const mag = Math.hypot(fw, st); if (mag > 1) { fw /= mag; st /= mag; }
    player.yaw += turn * 2.1 * dt;
    const sp = keys.ShiftLeft || keys.ShiftRight ? 4.6 : 2.6, sn = Math.sin(player.yaw), cs = Math.cos(player.yaw);
    const px = player.x, pz = player.z;
    player.x += (-sn * fw + cs * st) * sp * dt; player.z += (-cs * fw - sn * st) * sp * dt;
    collide();
    player.speed = Math.hypot(player.x - px, player.z - pz) / Math.max(dt, 1e-4);
    if (fw || st) $('#hint').classList.add('fade');
  }

  if (me) {
    me.root.position.set(player.x, 0, player.z); me.root.rotation.y = player.yaw + Math.PI;
    me.update(dt, player.speed, t, 'idle');
    bob += dt * player.speed * 2.5;
    const eye = me.eye + Math.sin(bob) * 0.022 * Math.min(1, player.speed / 3);
    if (view === 'first') { camera.position.set(player.x, eye, player.z); camera.rotation.set(player.pitch, player.yaw, 0); }
    else {
      camTarget.set(player.x, eye + 0.05, player.z);
      camDir.set(Math.sin(player.yaw) * Math.cos(player.pitch), -Math.sin(player.pitch) + 0.42, Math.cos(player.yaw) * Math.cos(player.pitch)).normalize();
      ray.set(camTarget, camDir); ray.far = 3.4;
      const hit = ray.intersectObjects(W.occluders, false)[0];
      const dist = hit ? Math.max(0.6, hit.distance - 0.25) : 3.4;
      camWanted.copy(camTarget).addScaledVector(camDir, dist);
      camera.position.lerp(camWanted, 1 - Math.exp(-dt * 12));
      camera.lookAt(camTarget.x - Math.sin(player.yaw) * 2, camTarget.y + Math.sin(player.pitch) * 2 - 0.25, camTarget.z - Math.cos(player.yaw) * 2);   // look past yourself into the room
    }
  } else {
    bob += dt * player.speed * 2.5;
    camera.position.set(player.x, 1.66 + Math.sin(bob) * 0.022 * Math.min(1, player.speed / 3), player.z); camera.rotation.set(player.pitch, player.yaw, 0);
  }

  if (couple.length) {
    let near = false;
    couple.forEach((c, i) => {
      const dx = player.x - c.home.x, dz = player.z - c.home.z, d = Math.hypot(dx, dz);
      const close = playing && d < 3.2; near = near || close;
      // dancing face to face, turning to greet you when you walk up
      const target = close ? Math.atan2(dx, dz) : c.home.face + Math.sin(t * 0.9 + i) * 0.5;
      let diff = target - c.root.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      c.root.rotation.y += diff * Math.min(1, dt * 3);
      c.update(dt, 0, t + i * 0.4, close ? 'wave' : 'dance');
    });
    bubble.visible = near;
  }
  for (const g of guests) { g.root.rotation.y = g.home.face + Math.sin(t * 0.6) * 0.45; g.update(dt, 0, t + 1.3, 'dance'); }
  guestTick(dt, t); tattooTick(dt, t);
  for (const b of W.band) b.update(dt, t);
  updateTyler(dt, t);
  for (const fn of W.tick) fn(dt, t);

  if (playing && isTouch && !reading) {            // phones: show a tap button for whatever is in the middle of the view
    const r = readableAt(0, 0) || (tylerOnScreen() ? tylerReadable : null);
    if (r !== tapTarget) { tapTarget = r; $('#tapBtn').hidden = !r; if (r) $('#tapBtn').textContent = r.open === 'game' ? `▶ Tap to play ${r.name}` : r.open === 'booth' ? '📸 Tap to see the photo booth pictures' : r.open === 'tyler' ? "📷 Tap to see Tyler's photos" : r.open === 'pet' ? '🐾 Tap to pet Sunny' : `Tap to read the ${r.name.toLowerCase()}`; }
  } else if (tapTarget) { tapTarget = null; $('#tapBtn').hidden = true; }
  if (playing && !isTouch && !reading) { const r = locked() ? readableAt(0, 0) : readableAt(mouseN.x, mouseN.y); $('#readHint').hidden = !r; if (r) $('#readHint').textContent = r.open === 'game' ? `Click to play ${r.name}` : r.open === 'booth' ? 'Click to see the photo booth pictures' : r.open === 'tyler' ? "Click to see Tyler's photos" : r.open === 'pet' ? 'Click to pet Sunny' : `Click to read the ${r.name.toLowerCase()}`; }
  // walk up to something and look at it: glowing words pinned in front of it
  //   big flower pieces → "Flowers by Brophy Blooms"; Kristin → "Best Dressed"
  glowLabel(glowFlowers, dt); glowLabel(glowKristin, dt);
  for (const tg of nameTags) { tg.getWorldPosition(_fp); const dx = _fp.x - camera.position.x, dz = _fp.z - camera.position.z; tg.visible = !playing || dx * dx + dz * dz < 4.2 * 4.2; }   // names only up close (about 14 ft)
  updateBubbles();
  if (!arcadeOpen) composer.render();

  // if the computer is struggling, drop the floor reflections
  if (!checked && playing) { frames++; if (dt > 1 / 32) slowTime += dt; if (frames > 150) { checked = true; if (slowTime > 2.2) W.dropReflections(); } }
  requestAnimationFrame(frame);
}
frame();
document.body.classList.add('ready');
window.__venue = { openCard, portrait, player, camera, scene, W, toggleView, renderer, T, tylerBubble };
