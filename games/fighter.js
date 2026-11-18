// fighter.js - a tiny original 2D fighting game (player vs CPU) for the arcade cabinet.
// Two themes share one engine: 'fistfury' (rooftop at dusk) and 'bloodduel' (torch-lit temple).
// Everything is drawn with plain canvas rectangles. No libraries, no assets, no audio.

const W = 640, H = 480;
const GROUND = 400;          // y of the fighters' feet
const GRAV = 1700, WALK = 150, JUMP = 600;
const MAXHP = 100, ROUND_TIME = 60;

// Attack data. "top"/"bot" are how high above the feet the hit band sits (punch is high, so crouching dodges it).
const ATK = {
  punch:    { start: .07, active: .08, rec: .17, dmg: 6,  reach: 50, top: 92, bot: 66, stun: .36, knock: 90 },
  kick:     { start: .13, active: .10, rec: .25, dmg: 9,  reach: 64, top: 64, bot: 22, stun: .42, knock: 160 },
  finisher: { start: .12, active: .12, rec: .32, dmg: 15, reach: 74, top: 70, bot: 18, stun: .70, knock: 340 },
};

// Theme settings: colours, title and the two fighters (index 0 = player, 1 = CPU).
const THEMES = {
  fistfury: {
    title: 'FIST FURY', titleCol: '#ffcc33', titleShadow: '#c82a1a', accent: '#2f6bff',
    barCol: '#ffd23a', hudBg: '#10204f', text: '#ffffff',
    fighters: [
      { name: 'BRAWLER', skin: '#e8a878', top: '#d8342c', pants: '#2c3f8f', trim: '#ffe066', shoes: '#f4f4f4', band: '#ff3b3b', cover: false },
      { name: 'KICKER',  skin: '#b97a50', top: '#14b8a6', pants: '#1c2b3a', trim: '#e6fffa', shoes: '#ff9a2e', band: '#ffffff', cover: false },
    ],
  },
  bloodduel: {
    title: 'BLOOD DUEL', titleCol: '#d8222c', titleShadow: '#2a0408', accent: '#e8c050',
    barCol: '#d8222c', hudBg: '#1a0508', text: '#f3e3c0',
    fighters: [
      { name: 'AUREUS', skin: '#d9a070', top: '#3b1a1a', pants: '#241012', trim: '#f0c030', shoes: '#f0c030', band: '#e8b828', cover: true },
      { name: 'AZURE',  skin: '#d9a070', top: '#1a2340', pants: '#10162b', trim: '#8ab4ff', shoes: '#8ab4ff', band: '#3a70e0', cover: true },
    ],
  },
};

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mkRng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// Blend two '#rrggbb' colours (t = 0..1).
function lerpCol(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16));
  return 'rgb(' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',') + ')';
}

// ---------------------------------------------------------------- stages
// The unchanging part of each stage is painted once into an offscreen canvas.
function buildStage(variant) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rnd = mkRng(variant === 'bloodduel' ? 11 : 7);
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };

  if (variant === 'bloodduel') {
    // Dark brick wall.
    R(0, 0, W, H, '#140608');
    for (let row = 0; row < 17; row++) {
      const off = (row % 2) * 24;
      for (let x = -48; x < W; x += 48) {
        R(x + off, row * 24, 46, 22, rnd() < .5 ? '#2a0d10' : '#220a0d');
        if (rnd() < .15) R(x + off + 6, row * 24 + 4, 14, 4, '#33121a');
      }
    }
    // Big dim sigil in the middle (a diamond made of rectangles).
    for (let i = -6; i <= 6; i++) {
      const half = (6 - Math.abs(i)) * 8 + 4;
      R(320 - half, 190 + i * 8, half * 2, 4, i % 2 ? '#4a0f16' : '#5e141c');
    }
    // Stone pillars.
    [20, 300, 596].forEach(x => {
      R(x, 0, 44, 392, '#3a2a2e'); R(x, 0, 6, 392, '#52393f'); R(x + 38, 0, 6, 392, '#241519');
      R(x - 6, 0, 56, 14, '#4a353a'); R(x - 6, 380, 56, 14, '#4a353a');
    });
    // Floor.
    R(0, 388, W, 92, '#2b1c20'); R(0, 388, W, 6, '#5a3a40');
    for (let x = 0; x < W; x += 64) R(x, 394, 2, 86, '#150b0e');
    for (let y = 420; y < H; y += 30) R(0, y, W, 2, '#150b0e');
    // Torch brackets (flames are drawn live).
    [110, 530].forEach(x => { R(x - 4, 222, 8, 30, '#6b5a4a'); R(x - 9, 214, 18, 8, '#8a7360'); });
  } else {
    // Dusk sky: purple at top blending to orange at the horizon.
    for (let y = 0; y < 340; y += 8) {
      const t = y / 340;
      R(0, y, W, 8, t < .55 ? lerpCol('#2b1760', '#8a3a8c', t / .55) : lerpCol('#8a3a8c', '#ff8a3c', (t - .55) / .45));
    }
    for (let i = 0; i < 40; i++) R(Math.floor(rnd() * W), Math.floor(rnd() * 150), 2, 2, rnd() < .5 ? '#ffffff' : '#ffd9ff');
    // Retro striped sun.
    for (let dy = -56; dy < 56; dy += 4) {
      if (dy > 8 && (dy / 4) % 2 === 0) continue;
      const half = Math.floor(Math.sqrt(56 * 56 - dy * dy));
      R(450 - half, 300 + dy, half * 2, 4, '#ffd878');
    }
    // Two layers of city skyline with lit windows.
    const skyline = (col, minH, maxH, base, lit, dark) => {
      for (let x = 0; x < W;) {
        const w = 36 + Math.floor(rnd() * 36), h = minH + Math.floor(rnd() * (maxH - minH));
        R(x, base - h, w, h, col);
        if (rnd() < .3) R(x + w / 2 - 1, base - h - 14, 3, 14, col);
        for (let wy = base - h + 8; wy < base - 8; wy += 14)
          for (let wx = x + 6; wx < x + w - 8; wx += 12) R(wx, wy, 5, 6, rnd() < .3 ? lit : dark);
        x += w + 2;
      }
    };
    skyline('#4a2a78', 70, 150, 340, '#ffb86b', '#5a3590');
    skyline('#241547', 110, 210, 388, '#ffd27a', '#33205e');
    // Rooftop floor, railing.
    R(0, 388, W, 92, '#3d3560'); R(0, 388, W, 5, '#7a6fb0');
    for (let x = 0; x < W; x += 64) R(x, 393, 2, 87, '#2c2548');
    for (let y = 426; y < H; y += 34) R(0, y, W, 2, '#2c2548');
    for (let x = 12; x < W; x += 40) R(x, 350, 6, 38, '#b9aee8');
    R(0, 350, W, 4, '#d6ccff'); R(0, 368, W, 4, '#b9aee8');
  }
  return c;
}

// ---------------------------------------------------------------- the game
export function startFighter(canvas, { variant = 'fistfury', onExit } = {}) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const theme = THEMES[variant] || THEMES.fistfury;
  const isBlood = variant === 'bloodduel';
  const stage = buildStage(isBlood ? 'bloodduel' : 'fistfury');

  // Soft dark edges for the temple (made once).
  const vignette = ctx.createRadialGradient(320, 240, 170, 320, 240, 420);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,.65)');

  let running = true, raf = 0, last = performance.now(), time = 0;
  let mode = 'title', modeT = 0;       // title | intro | fight | roundEnd | matchEnd
  let P, C;                            // player and CPU fighters
  let pw = 0, cw = 0, roundNo = 1, timer = ROUND_TIME;
  let shake = 0, hitStop = 0, banner = '';
  let fx = [];                         // sparks, bursts and floating texts

  // ------------------------------------------------ input
  const held = { left: false, right: false, up: false, down: false, punch: false, kick: false, start: false };
  const edge = { punch: false, kick: false, start: false };   // "just pressed" flags, cleared every update
  const KEYS = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    KeyJ: 'punch', KeyZ: 'punch', KeyK: 'kick', KeyX: 'kick', Enter: 'start', Space: 'start',
  };
  function setAction(a, down) {
    if (!(a in held)) return;
    if (down && !held[a] && a in edge) edge[a] = true;
    held[a] = !!down;
  }
  function onKeyDown(e) {
    const a = KEYS[e.code];
    if (!a || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault(); setAction(a, true);
  }
  function onKeyUp(e) {
    const a = KEYS[e.code];
    if (!a) return;
    e.preventDefault(); setAction(a, false);
  }
  function onBlur() { for (const k in held) held[k] = false; }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  const NOIN = { left: false, right: false, up: false, down: false, punch: false, kick: false };
  function readPlayerInput() {
    const i = { left: held.left, right: held.right, up: held.up, down: held.down, punch: edge.punch, kick: edge.kick };
    const start = edge.start;
    edge.punch = edge.kick = edge.start = false;
    return { i, start };
  }

  // ------------------------------------------------ fighters
  function makeFighter(def, x, face) {
    return {
      col: def, name: def.name, x, y: GROUND, vx: 0, vy: 0, face, hp: MAXHP, hpGhost: MAXHP,
      state: 'idle', stun: 0, stunBlock: false, atk: null, low: false, blocking: false,
      combo: 0, comboT: 0, bufP: 0, bufK: 0, flash: 0, koT: 0, walkT: 0, seed: Math.random() * 6,
    };
  }
  function makeFighters() {
    P = makeFighter(theme.fighters[0], 200, 1);
    C = makeFighter(theme.fighters[1], 440, -1);
  }
  makeFighters();

  // One tick of one fighter. f = this fighter, o = the opponent, inp = what buttons it pressed.
  function step(f, o, inp, dt) {
    f.flash = Math.max(0, f.flash - dt);
    f.comboT -= dt; if (f.comboT <= 0) f.combo = 0;
    if (inp.punch) f.bufP = .12;      // small input buffer so attacks feel forgiving
    if (inp.kick) f.bufK = .12;
    f.bufP -= dt; f.bufK -= dt;
    f.blocking = false;
    const air = f.y < GROUND;
    let lowNow = false;

    if (f.state === 'ko') {
      f.koT += dt;
      if (!air) f.vx *= Math.pow(.01, dt);
    } else if (f.stun > 0) {
      f.stun -= dt;
      if (f.stun <= 0) { f.stun = 0; f.state = 'idle'; f.stunBlock = false; }
      f.vx *= Math.pow(.02, dt);
    } else if (f.atk) {
      const a = f.atk;
      a.t += dt;
      lowNow = a.crouch;
      if (!air) f.vx = 0;
      if (!a.hit && a.t >= a.start && a.t < a.start + a.active) tryHit(f, o, a);
      if (a.t >= a.start + a.active + a.rec) f.atk = null;
    } else {
      if (!air) f.face = o.x >= f.x ? 1 : -1;
      const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      if (!air) {
        if (inp.up) { f.vy = -JUMP; f.vx = dir * WALK; }
        else if (inp.down) { lowNow = true; f.vx = 0; f.blocking = true; }
        else {
          const back = dir !== 0 && dir === -f.face;
          f.vx = dir * WALK * (back ? .8 : 1);
          f.blocking = back;              // walking backward = blocking
        }
      }
      f.state = Math.abs(f.vx) > 20 ? 'walk' : 'idle';
      if (f.bufP > 0) startAttack(f, 'punch', lowNow);
      else if (f.bufK > 0) startAttack(f, 'kick', lowNow);
    }
    f.low = lowNow;
    f.walkT += Math.abs(f.vx) * dt * .08;

    // Physics.
    f.vy += GRAV * dt;
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.y >= GROUND) { f.y = GROUND; f.vy = 0; }
    f.x = clamp(f.x, 28, W - 28);
    f.hpGhost = f.hpGhost > f.hp ? Math.max(f.hp, f.hpGhost - 40 * dt) : f.hp;
  }

  function startAttack(f, type, crouch) {
    let def = ATK[type], finisher = false;
    if (type === 'kick' && f.combo >= 2) { def = ATK.finisher; finisher = true; }  // punch-punch-kick bonus
    f.atk = Object.assign({ t: 0, type, hit: false, crouch, finisher }, def);
    f.bufP = f.bufK = 0;
  }

  // Does attacker f's attack a reach opponent o right now?
  function tryHit(f, o, a) {
    if (o.state === 'ko') return;
    const dx = (o.x - f.x) * f.face;
    if (dx < -10 || dx > a.reach + 16) return;
    const oH = o.low ? 64 : 100;
    const bandTop = f.y - a.top, bandBot = f.y - a.bot;
    if (bandBot < o.y - oH || bandTop > o.y) return;
    a.hit = true;
    applyHit(f, o, a, (bandTop + bandBot) / 2);
  }

  function applyHit(f, o, a, hy) {
    const dir = f.face, hx = o.x - dir * 12;
    if (o.blocking && o.stun <= 0) {            // blocked: tiny damage, no hit-stun
      o.hp = Math.max(0, o.hp - Math.max(1, Math.round(a.dmg * .15)));
      o.stun = .14; o.stunBlock = true; o.state = 'hit'; o.vx = dir * 130;
      sparks(hx, hy, 6, ['#9fb6d9', '#ffffff']);
      shake = Math.max(shake, 1);
      return;
    }
    o.hp = Math.max(0, o.hp - a.dmg);
    o.stun = a.stun; o.stunBlock = false; o.atk = null; o.state = 'hit';
    o.vx = dir * a.knock; o.combo = 0; o.flash = .16;
    if (o.y >= GROUND && a.finisher) o.vy = -260;
    f.comboT = .9;
    f.combo = a.type === 'punch' ? f.combo + 1 : 0;
    const big = a.finisher;
    sparks(hx, hy, big ? 18 : 10, ['#ffffff', '#ffe066', isBlood ? '#ff5a3c' : '#ff9a2e']);
    fx.push({ type: 'burst', x: hx, y: hy, life: big ? .3 : .18, max: big ? .3 : .18, size: big ? 34 : 20 });
    if (big) fx.push({ type: 'text', str: 'COMBO!', x: hx, y: hy - 30, life: 1, col: theme.titleCol });
    shake = Math.max(shake, big ? 10 : a.type === 'kick' ? 4 : 2);
    hitStop = big ? .09 : .035;
    if (o.hp <= 0) {                             // knocked out
      o.state = 'ko'; o.koT = 0; o.stun = 0; o.vy = -380; o.vx = dir * 230;
      hitStop = .18; shake = 14;
    }
  }

  function sparks(x, y, n, cols) {
    for (let i = 0; i < n; i++) {
      const ang = rand(0, Math.PI * 2), sp = rand(80, 300);
      fx.push({ type: 'spark', x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 60, life: rand(.2, .45), col: cols[i % cols.length], s: Math.random() < .5 ? 4 : 6 });
    }
  }

  // Keep the fighters from standing inside each other and inside the screen edges.
  function separate() {
    if (Math.abs(P.y - C.y) < 60 && P.state !== 'ko' && C.state !== 'ko') {
      const d = C.x - P.x, min = 34;
      if (Math.abs(d) < min) {
        const push = (min - Math.abs(d)) / 2 * (d >= 0 ? 1 : -1);
        P.x -= push; C.x += push;
      }
    }
    P.x = clamp(P.x, 28, W - 28); C.x = clamp(C.x, 28, W - 28);
  }

  // ------------------------------------------------ CPU brain
  const ai = { t: .5, move: 0, jump: false, blockT: 0, blockDown: false, q: [] };
  function aiInput(f, o, dt) {
    const inp = { left: false, right: false, up: false, down: false, punch: false, kick: false };
    const lvl = Math.min(roundNo, 3);             // gets a bit sharper each round
    if (ai.q.length) {                            // queued combo presses
      ai.q[0].d -= dt;
      if (ai.q[0].d <= 0) inp[ai.q.shift().a] = true;
    }
    ai.blockT -= dt; ai.t -= dt;
    if (ai.t <= 0) {
      ai.t = rand(.12, .3) * (1.2 - lvl * .13);
      const dist = Math.abs(o.x - f.x), toward = o.x > f.x ? 1 : -1;
      ai.move = 0;
      if (o.atk && dist < 110 && Math.random() < .2 + .15 * lvl) {
        ai.blockT = .4; ai.blockDown = Math.random() < .5;
      } else if (dist > 95) {
        ai.move = toward;
        if (dist > 150 && Math.random() < .06) ai.jump = true;
      } else if (!ai.q.length && f.stun <= 0 && !f.atk) {
        const r = Math.random();
        if (r < .35 + .1 * lvl) {
          const pick = Math.random();
          if (pick < .35) ai.q.push({ a: 'punch', d: 0 });
          else if (pick < .65) ai.q.push({ a: 'kick', d: 0 });
          else if (lvl >= 2) ai.q.push({ a: 'punch', d: 0 }, { a: 'punch', d: .24 }, { a: 'kick', d: .24 });
          else ai.q.push({ a: 'punch', d: 0 }, { a: 'kick', d: .3 });
          ai.t = .65 - lvl * .1;                  // breathe after an attack
        } else if (r < .6) ai.move = -toward;     // back off a little
      }
    }
    if (ai.blockT > 0) {
      if (ai.blockDown) inp.down = true;
      else if (o.x > f.x) inp.left = true; else inp.right = true;
    } else {
      if (ai.move > 0) inp.right = true; else if (ai.move < 0) inp.left = true;
      if (ai.jump) { inp.up = true; ai.jump = false; }
    }
    return inp;
  }

  // ------------------------------------------------ match flow
  function setMode(m) { mode = m; modeT = 0; }
  function beginMatch() { pw = cw = 0; roundNo = 1; startRound(); }
  function startRound() {
    makeFighters();
    ai.q = []; ai.blockT = 0; ai.t = .5; ai.move = 0;
    timer = ROUND_TIME; fx = []; hitStop = 0; banner = '';
    setMode('intro');
  }
  function endRound() {
    const ko = P.hp <= 0 || C.hp <= 0;
    if (P.hp > C.hp) pw++; else if (C.hp > P.hp) cw++;
    banner = ko ? 'K.O.' : (P.hp === C.hp ? 'DRAW' : 'TIME UP');
    setMode('roundEnd');
  }

  function simulate(dt, live, pin) {
    if (hitStop > 0) { hitStop -= dt; return; }
    const pi = live ? pin : NOIN;
    const ci = live ? aiInput(C, P, dt) : NOIN;
    step(P, C, pi, dt); step(C, P, ci, dt);
    separate();
  }

  function update(dt) {
    time += dt; modeT += dt;
    const { i: pin, start } = readPlayerInput();
    shake = Math.max(0, shake - 30 * dt);
    for (const p of fx) {                         // move effects
      p.life -= dt;
      if (p.type === 'spark') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 700 * dt; }
      if (p.type === 'text') p.y -= 30 * dt;
    }
    fx = fx.filter(p => p.life > 0);

    if (mode === 'title') {
      if (start) beginMatch();
    } else if (mode === 'intro') {
      simulate(dt, false, pin);
      banner = modeT < 1.3 ? 'ROUND ' + roundNo : 'FIGHT!';
      if (modeT >= 1.9) { banner = ''; setMode('fight'); }
    } else if (mode === 'fight') {
      simulate(dt, true, pin);
      if (hitStop <= 0) timer = Math.max(0, timer - dt);
      if (P.state === 'ko' || C.state === 'ko' || timer <= 0) endRound();
    } else if (mode === 'roundEnd') {
      simulate(dt, false, pin);
      if (modeT > 2.4) {
        if (pw >= 2 || cw >= 2) { banner = pw >= 2 ? 'YOU WIN' : 'YOU LOSE'; setMode('matchEnd'); }
        else { roundNo++; startRound(); }
      }
    } else if (mode === 'matchEnd') {
      simulate(dt, false, pin);
      if (modeT > 3.8 || (start && modeT > 1)) { makeFighters(); fx = []; banner = ''; setMode('title'); }
    }
  }

  // ------------------------------------------------ drawing
  function text(str, x, y, size, col, align, shadow) {
    ctx.font = 'bold ' + size + 'px "Courier New", monospace';
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    const o = Math.max(2, Math.round(size / 12));
    ctx.fillStyle = shadow || '#000'; ctx.fillText(str, x + o, y + o);
    ctx.fillStyle = col; ctx.fillText(str, x, y);
  }

  function drawDynamicBackground() {
    if (isBlood) {
      // Torch flames and warm glow that flicker.
      [110, 530].forEach((x, n) => {
        const fl = Math.sin(time * 13 + n * 2) * .5 + Math.sin(time * 7.3 + n) * .5 + Math.random() * .4;
        const g = ctx.createRadialGradient(x, 205, 4, x, 205, 190 + fl * 14);
        g.addColorStop(0, 'rgba(255,140,40,' + (.38 + fl * .08) + ')');
        g.addColorStop(1, 'rgba(255,60,10,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 220, 0, 440, 400);
        const h = Math.round(18 + fl * 5);
        ctx.fillStyle = '#d83a10'; ctx.fillRect(x - 8, 212 - h, 16, h);
        ctx.fillStyle = '#ff8a1a'; ctx.fillRect(x - 5, 212 - h + 4, 10, h - 4);
        ctx.fillStyle = '#ffe070'; ctx.fillRect(x - 2, 212 - Math.round(h * .6), 4, Math.round(h * .6));
      });
    } else {
      // Slow drifting cloud streaks.
      ctx.fillStyle = 'rgba(255,170,120,.35)';
      for (let i = 0; i < 4; i++) {
        const x = ((time * (6 + i * 3) + i * 190) % (W + 120)) - 120;
        ctx.fillRect(Math.round(x), 60 + i * 38, 90 + i * 14, 8);
      }
    }
  }

  function drawFighter(f) {
    const c = f.col, fl = f.flash > 0 && (Math.floor(f.flash * 40) & 1) === 0;
    const k = (col) => (fl ? '#ffffff' : col);
    const R = (x, y, w, h, col) => { ctx.fillStyle = k(col); ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const air = f.y < GROUND - 2, a = f.atk;
    const crouch = f.low && !air;
    const moving = !a && f.stun <= 0 && !air && Math.abs(f.vx) > 20 && f.state !== 'ko';
    const idle = !moving && !crouch && !a && f.stun <= 0 && f.state !== 'ko';
    const bob = idle ? Math.round(Math.sin(time * 5 + f.seed) * 1.6) : 0;
    const lo = moving ? Math.round(Math.sin(f.walkT * 2) * 7) : 0;

    // Ground shadow.
    const sw = 44 * (1 - clamp((GROUND - f.y) / 300, 0, .6));
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(Math.round(f.x - sw / 2), GROUND + 2, Math.round(sw), 6);

    ctx.save();
    ctx.translate(Math.round(f.x), Math.round(f.y));
    ctx.scale(f.face, 1);
    if (f.state === 'ko') {                       // fall over backward
      const r = Math.min(1, f.koT * 4);
      ctx.translate(0, -14 * r); ctx.rotate(-r * Math.PI / 2);
    }
    const legH = crouch ? 20 : 36, torsoH = crouch ? 24 : 34;
    const legTop = -legH, torsoTop = legTop - torsoH + bob;
    const lean = (f.stun > 0 && !f.stunBlock) ? -5 : (a && a.type === 'punch' ? 3 : 0);
    let ext = 0;                                  // how far the current attack is stretched out (0..1)
    if (a) {
      if (a.t < a.start) ext = a.t / a.start * .6;
      else if (a.t < a.start + a.active) ext = 1;
      else ext = 1 - (a.t - a.start - a.active) / a.rec;
      ext = clamp(ext, 0, 1);
    }
    const kicking = a && a.type === 'kick';

    // Legs.
    if (air) {
      R(-12, legTop + 6, 10, legH - 14, c.pants); R(-14, -14, 14, 7, c.shoes);
    } else {
      R(-13 - lo, legTop, 10, legH, c.pants); R(-15 - lo, -7, 14, 7, c.shoes);
    }
    if (kicking) {
      const L = Math.round(ext * (a.reach - 18));
      if (a.finisher && ext > .9) { ctx.globalAlpha = .5; R(2, legTop - 12, L + 20, 24, c.trim); ctx.globalAlpha = 1; }
      R(4, legTop - 6, L, 11, c.pants); R(4 + L - 2, legTop - 9, 14, 15, c.shoes);
    } else if (air) {
      R(4, legTop + 2, 10, legH - 16, c.pants); R(4, -18, 15, 7, c.shoes);
    } else {
      R(3 + lo, legTop, 10, legH, c.pants); R(3 + lo, -7, 15, 7, c.shoes);
    }

    // Back arm, torso, belt, collar.
    R(-18 + lean, torsoTop + 4, 8, 20, c.skin);
    R(-14 + lean, torsoTop, 28, torsoH, c.top);
    R(-14 + lean, torsoTop, 28, 4, c.trim);
    R(-14 + lean, legTop - 5, 28, 5, c.trim);

    // Head.
    const hx = -10 + lean, hy = torsoTop - 18;
    if (c.cover) {
      R(hx, hy, 20, 20, c.band); R(hx + 7, hy + 7, 13, 5, '#0a0a0a'); R(hx + 13, hy + 8, 3, 3, '#ffffff');
      R(hx + 6, hy - 4, 8, 4, c.trim);
    } else {
      R(hx - 1, hy - 3, 22, 6, '#2a1a14'); R(hx, hy, 20, 20, c.skin);
      R(hx, hy + 3, 20, 5, c.band); R(hx - 8, hy + 4 + Math.round(Math.sin(time * 9)), 9, 3, c.band);
      R(hx + 12, hy + 9, 3, 4, '#111111'); R(hx + 10, hy + 16, 8, 2, '#7a3a2a');
    }

    // Front arm: punch, block or guard.
    const blockPose = f.blocking || (f.stunBlock && f.stun > 0);
    if (a && a.type === 'punch') {
      const len = Math.round(10 + ext * (a.reach - 28));
      R(8 + lean, torsoTop + 7, len, 9, c.skin); R(6 + lean + len, torsoTop + 5, 12, 13, c.trim);
    } else if (blockPose) {
      R(8, torsoTop - 2, 9, 22, c.skin); R(8, torsoTop - 8, 13, 12, c.trim);
    } else {
      R(8 + lean, torsoTop + 7, 16, 8, c.skin); R(20 + lean, torsoTop + 5, 11, 11, c.trim);
    }
    ctx.restore();
  }

  function drawEffects() {
    for (const p of fx) {
      if (p.type === 'spark') {
        ctx.globalAlpha = clamp(p.life * 4, 0, 1);
        ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
        ctx.globalAlpha = 1;
      } else if (p.type === 'burst') {
        const s = Math.round(p.size * (1.2 - p.life / p.max * .5)), x = Math.round(p.x), y = Math.round(p.y);
        ctx.fillStyle = '#ffe066'; ctx.fillRect(x - s, y - 3, s * 2, 6); ctx.fillRect(x - 3, y - s, 6, s * 2);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - s / 2, y - 6, s, 12); ctx.fillRect(x - 6, y - s / 2, 12, s);
      } else if (p.type === 'text') {
        text(p.str, p.x, p.y, 20, p.col);
      }
    }
  }

  function drawBar(x, w, f, rightAlign) {
    const y = 22, h = 20;
    ctx.fillStyle = theme.accent; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = theme.hudBg; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    const gw = Math.round(w * f.hpGhost / MAXHP), fw = Math.round(w * f.hp / MAXHP);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(rightAlign ? x + w - gw : x, y, gw, h);
    ctx.fillStyle = f.hp / MAXHP > .3 ? theme.barCol : '#ff5030';
    ctx.fillRect(rightAlign ? x + w - fw : x, y, fw, h);
    text(f.name, rightAlign ? x + w : x, y + 36, 14, theme.text, rightAlign ? 'right' : 'left');
  }

  function drawHUD() {
    drawBar(24, 262, P, false); drawBar(354, 262, C, true);
    ctx.fillStyle = theme.accent; ctx.fillRect(292, 14, 56, 36);
    ctx.fillStyle = theme.hudBg; ctx.fillRect(295, 17, 50, 30);
    text(String(Math.ceil(timer)).padStart(2, '0'), 320, 33, 28, timer <= 10 ? '#ff5030' : theme.text);
    for (let i = 0; i < 2; i++) {                 // round-win pips
      ctx.fillStyle = i < pw ? theme.titleCol : theme.hudBg; ctx.fillRect(24 + i * 18, 76, 12, 12);
      ctx.fillStyle = i < cw ? theme.titleCol : theme.hudBg; ctx.fillRect(616 - 12 - i * 18, 76, 12, 12);
      ctx.strokeStyle = theme.accent; ctx.lineWidth = 2;
      ctx.strokeRect(25 + i * 18, 77, 10, 10); ctx.strokeRect(616 - 11 - i * 18, 77, 10, 10);
    }
  }

  function drawBanner() {
    if (!banner) return;
    const pulse = 1 + Math.max(0, .25 - (modeT % 1.3)) * 2;
    const big = banner.length > 8 ? 56 : 72;
    text(banner, 320, 190, Math.round(big * pulse), banner === 'YOU LOSE' ? '#ff5030' : theme.titleCol, 'center', theme.titleShadow);
  }

  function drawTitle() {
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 70, W, 140);
    for (let i = 7; i >= 1; i--) text(theme.title, 320 + i, 130 + i, 64, theme.titleShadow, 'center', 'rgba(0,0,0,0)');
    text(theme.title, 320, 130, 64, theme.titleCol, 'center', theme.titleShadow);
    text('1P VS CPU  -  BEST OF 3', 320, 185, 18, theme.text);
    if (Math.floor(time * 2) % 2 === 0) text('PRESS START', 320, 290, 30, theme.titleCol, 'center', theme.titleShadow);
    text('MOVE: ARROWS / WASD   (UP = JUMP, DOWN = BLOCK)', 320, 440, 13, theme.text);
    text('PUNCH: J / Z    KICK: K / X    START: ENTER', 320, 460, 13, theme.text);
    text('TRY PUNCH, PUNCH, KICK FOR A COMBO!', 320, 335, 14, theme.accent);
  }

  function render() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate(Math.round(rand(-shake, shake) / 2), Math.round(rand(-shake, shake) / 2));
    ctx.drawImage(stage, 0, 0);
    drawDynamicBackground();
    // Draw the one who is attacking last so the punch is on top.
    if (P.atk && !C.atk) { drawFighter(C); drawFighter(P); } else { drawFighter(P); drawFighter(C); }
    drawEffects();
    ctx.restore();
    if (isBlood) { ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H); }
    if (mode === 'title') drawTitle(); else { drawHUD(); drawBanner(); }
  }

  // ------------------------------------------------ main loop
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, .033);   // clamp so a lag spike can't teleport anyone
    last = now;
    update(dt);
    render();
  }
  raf = requestAnimationFrame(frame);

  return {
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
    press(action, isDown) { setAction(action, isDown); },
  };
}
