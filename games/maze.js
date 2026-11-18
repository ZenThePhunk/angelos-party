// PELLET PANIC - an original neon maze-chase arcade game.
// You are a glowing disco ball in sunglasses. Eat the sparkles, dodge the four
// party-crasher critters, grab champagne to make them dizzy, and catch cake!
// Everything is drawn with Canvas 2D. No libraries, no assets, no audio.

export function startMaze(canvas, { onExit } = {}) {
  const ctx = canvas.getContext('2d');
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- maze
  // '#' wall, '.' sparkle, 'o' champagne, ' ' empty, '-' pen door (critters only)
  const MAP = [
    '#####################',
    '#o........#........o#',
    '#.###.###.#.###.###.#',
    '#...................#',
    '#.###.#.#####.#.###.#',
    '#.....#...#...#.....#',
    '#####.###.#.###.#####',
    '#####.#.......#.#####',
    '#####.#.##-##.#.#####',
    '#####.#.#   #.#.#####',
    '......#.#   #.#......', // row 10 is the wrap-around tunnel
    '#####.#.#####.#.#####',
    '#.........#.........#',
    '#.###.###.#.###.###.#',
    '#...#...........#...#',
    '###.#.#.#####.#.#.###',
    '#.....#...#...#.....#',
    '#.###.###.#.###.###.#',
    '#...................#',
    '#o...#.........#...o#',
    '#.###.#.#####.#.###.#',
    '#.....#.......#.....#',
    '#####################',
  ];
  const W = 21, H = 23, T = 18;            // grid size and tile size in pixels
  const OX = Math.floor((canvas.width - W * T) / 2); // maze top-left on canvas
  const OY = Math.floor((canvas.height - H * T) / 2);
  const TUNNEL_ROW = 10;
  const DIRS = [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }];
  const DIRMAP = { up: DIRS[0], left: DIRS[1], down: DIRS[2], right: DIRS[3] };
  const COLORS = ['#ff3b4e', '#19d6c8', '#9be03a', '#a45bff']; // red teal lime violet
  const CORNERS = [{ x: 19, y: 1 }, { x: 1, y: 1 }, { x: 19, y: 21 }, { x: 1, y: 21 }];
  const PHASES = [['scatter', 7], ['chase', 20], ['scatter', 7], ['chase', 20],
                  ['scatter', 5], ['chase', 20], ['scatter', 5], ['chase', Infinity]];

  // Can an actor standing on tile (x,y) step one tile in direction (dx,dy)?
  function open(x, y, dx, dy, door) {
    const nx = x + dx, ny = y + dy;
    if (ny < 0 || ny >= H) return false;
    if (nx < 0 || nx >= W) return ny === TUNNEL_ROW;  // tunnel wraps around
    const c = MAP[ny][nx];
    if (c === '#') return false;
    if (c === '-') return !!door;
    return true;
  }
  const wrapX = (x) => (x < 0 ? W - 1 : x >= W ? 0 : x);

  // Distance maps (breadth-first) so eaten critters find the pen and
  // pen critters find the exit without getting stuck.
  function bfs(sx, sy) {
    const d = Array.from({ length: H }, () => Array(W).fill(999));
    d[sy][sx] = 0;
    const q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      for (const dir of DIRS) {
        if (!open(x, y, dir.x, dir.y, true)) continue;
        const nx = wrapX(x + dir.x), ny = y + dir.y;
        if (d[ny][nx] === 999) { d[ny][nx] = d[y][x] + 1; q.push([nx, ny]); }
      }
    }
    return d;
  }
  const fieldHome = bfs(10, 9);   // the middle of the pen
  const fieldExit = bfs(10, 7);   // just outside the pen door

  // ---------------------------------------------------------------- state
  let running = true, raf = 0, last = 0, time = 0;
  let state = 'title', stateT = 0;  // title ready play dying clear over
  let score = 0, lives = 3, level = 1, lifeGiven = false;
  let high = 0;
  try { high = parseInt(localStorage.getItem('pelletPanicHigh'), 10) || 0; } catch (e) { /* no storage */ }
  let dots, dotsLeft, dotsEaten, cake;
  let hero, chasers, want = null, wantT = 0, heroRoll = 0;
  let phaseIdx, phaseT, mode, frightT, combo, freeze;
  let popups = [];
  const wallCache = {};

  function setState(s) { state = s; stateT = 0; }
  function saveHigh() {
    if (score > high) {
      high = score;
      try { localStorage.setItem('pelletPanicHigh', String(high)); } catch (e) { /* ignore */ }
    }
  }
  function addScore(n) {
    score += n; saveHigh();
    if (!lifeGiven && score >= 10000) { lifeGiven = true; lives++; }
  }

  function newGame() {
    score = 0; lives = 3; level = 1; lifeGiven = false;
    resetLevel(); resetActors(); setState('ready');
  }
  function resetLevel() {
    dots = MAP.map((row) => [...row].map((c) => (c === '.' ? 1 : c === 'o' ? 2 : 0)));
    dotsLeft = dots.flat().filter(Boolean).length;
    dotsEaten = 0; cake = null; popups = [];
  }
  function resetActors() {
    hero = { tx: 10, ty: 18, dx: -1, dy: 0, t: 0 };
    want = null;
    const rel = (s) => Math.max(0.4, s - (level - 1) * 0.6); // release gets quicker
    chasers = [
      { kind: 0, tx: 10, ty: 7, dx: -1, dy: 0, t: 0, state: 'normal', wait: 0 },
      { kind: 1, tx: 9, ty: 10, dx: 0, dy: 0, t: 0, state: 'wait', wait: rel(1.5) },
      { kind: 2, tx: 10, ty: 10, dx: 0, dy: 0, t: 0, state: 'wait', wait: rel(5) },
      { kind: 3, tx: 11, ty: 10, dx: 0, dy: 0, t: 0, state: 'wait', wait: rel(9) },
    ];
    chasers.forEach((c) => { c.rev = false; c.fright = false; });
    phaseIdx = 0; phaseT = PHASES[0][1]; mode = PHASES[0][0];
    frightT = 0; combo = 0; freeze = 0;
  }

  // ---------------------------------------------------------------- movement
  // An actor sits on tile (tx,ty) and slides toward the next tile by t (0..1).
  // Whenever t is 0 it is exactly on a tile centre and may pick a new direction.
  function advance(a, dist, choose) {
    let guard = 10;
    while (dist > 1e-6 && guard-- > 0) {
      if (a.t === 0) { choose(a); if (!a.dx && !a.dy) return; }
      const need = 1 - a.t;
      if (dist < need) { a.t += dist; return; }
      dist -= need;
      a.tx = wrapX(a.tx + a.dx); a.ty += a.dy; a.t = 0;
    }
  }
  const posX = (a) => a.tx + a.dx * a.t;
  const posY = (a) => a.ty + a.dy * a.t;

  function heroChoose(h) {
    if (want && time - wantT > 1.0) want = null;   // old buffered turns expire
    if (want && open(h.tx, h.ty, want.x, want.y, false)) { h.dx = want.x; h.dy = want.y; }
    else if (!open(h.tx, h.ty, h.dx, h.dy, false)) { h.dx = 0; h.dy = 0; }
  }

  function chaserTarget(c) {
    const hx = Math.round(posX(hero)), hy = Math.round(posY(hero));
    if (mode === 'scatter') return CORNERS[c.kind];
    if (c.kind === 0) return { x: hx, y: hy };                           // straight at you
    if (c.kind === 1) return { x: hx + hero.dx * 4, y: hy + hero.dy * 4 }; // ahead of you
    if (c.kind === 2) return { x: hx, y: hy };                           // (mostly random, see choose)
    const far = Math.hypot(c.tx - hx, c.ty - hy) > 6;                    // violet: chase when far,
    return far ? { x: hx, y: hy } : CORNERS[3];                          // sulk in its corner when near
  }

  function chaserChoose(c) {
    if (c.state === 'wait') { c.dx = 0; c.dy = 0; return; }
    if (c.state === 'leaving' && c.tx === 10 && c.ty === 7) c.state = 'normal';
    if (c.state === 'eaten' && c.tx === 10 && c.ty === 9) { c.state = 'leaving'; c.fright = false; }
    const door = c.state !== 'normal';
    if (c.rev && c.state === 'normal') {            // forced about-face on mode change
      c.rev = false;
      if (open(c.tx, c.ty, -c.dx, -c.dy, door)) { c.dx = -c.dx; c.dy = -c.dy; return; }
    }
    c.rev = false;
    // Eyes heading home and critters leaving the pen follow the distance maps.
    if (c.state === 'eaten' || c.state === 'leaving') {
      const f = c.state === 'eaten' ? fieldHome : fieldExit;
      let best = null, bv = 9999;
      for (const d of DIRS) {
        if (!open(c.tx, c.ty, d.x, d.y, true)) continue;
        const v = f[c.ty + d.y][wrapX(c.tx + d.x)];
        if (v < bv) { bv = v; best = d; }
      }
      if (best) { c.dx = best.x; c.dy = best.y; } else { c.dx = 0; c.dy = 0; }
      return;
    }
    let opts = DIRS.filter((d) => open(c.tx, c.ty, d.x, d.y, false) && !(d.x === -c.dx && d.y === -c.dy));
    if (!opts.length) opts = DIRS.filter((d) => open(c.tx, c.ty, d.x, d.y, false));
    if (!opts.length) { c.dx = 0; c.dy = 0; return; }
    let pick;
    if (c.fright || (c.kind === 2 && Math.random() < 0.5)) {
      pick = opts[Math.floor(Math.random() * opts.length)];   // dizzy / wandering
    } else {
      const tg = chaserTarget(c);
      let bv = Infinity;
      for (const d of opts) {                                 // closest to target wins
        const v = (c.tx + d.x - tg.x) ** 2 + (c.ty + d.y - tg.y) ** 2;
        if (v < bv) { bv = v; pick = d; }
      }
    }
    c.dx = pick.x; c.dy = pick.y;
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
    popups.forEach((p) => { p.t -= dt; p.y -= dt * 12; });
    popups = popups.filter((p) => p.t > 0);
    if (state === 'title') return;
    stateT += dt;
    if (state === 'ready') { if (stateT >= 2) setState('play'); return; }
    if (state === 'clear') {
      if (stateT >= 2.2) { level++; resetLevel(); resetActors(); setState('ready'); }
      return;
    }
    if (state === 'dying') {
      if (stateT >= 2) {
        lives--;
        if (lives <= 0) { saveHigh(); setState('over'); } else { resetActors(); setState('ready'); }
      }
      return;
    }
    if (state === 'over') { if (stateT >= 4) setState('title'); return; }

    // ---- state === 'play'
    if (freeze > 0) { freeze -= dt; return; }

    // scatter / chase timer (paused while critters are dizzy)
    if (frightT > 0) {
      frightT -= dt;
      if (frightT <= 0) chasers.forEach((c) => { c.fright = false; });
    } else {
      phaseT -= dt;
      if (phaseT <= 0 && phaseIdx < PHASES.length - 1) {
        phaseIdx++; phaseT = PHASES[phaseIdx][1]; mode = PHASES[phaseIdx][0];
        chasers.forEach((c) => { if (c.state === 'normal') c.rev = true; });
      }
    }
    if (cake) { cake.t -= dt; if (cake.t <= 0) cake = null; }

    // hero: allow instant U-turns mid-tile, then slide along
    const hs = 5.0 * (1 + 0.03 * (level - 1));
    if (want && (hero.dx || hero.dy) && hero.t > 0 && want.x === -hero.dx && want.y === -hero.dy
        && hero.tx + hero.dx >= 0 && hero.tx + hero.dx < W) {
      hero.tx += hero.dx; hero.ty += hero.dy; hero.t = 1 - hero.t;
      hero.dx = -hero.dx; hero.dy = -hero.dy;
    }
    advance(hero, hs * dt, heroChoose);
    if (hero.dx || hero.dy) heroRoll += hs * dt * T / 7;

    // chasers
    const scale = Math.min(1.35, 1 + 0.045 * (level - 1));
    for (const c of chasers) {
      if (c.state === 'wait') {
        c.wait -= dt;
        if (c.wait <= 0) c.state = 'leaving';
        continue;
      }
      let sp = 4.4 * scale;
      if (c.state === 'eaten') sp = 10;
      else if (c.state === 'leaving') sp = 3.5;
      else if (c.fright) sp = 2.8;
      else if (c.ty === TUNNEL_ROW && (c.tx < 5 || c.tx > 15)) sp = 2.4;
      advance(c, sp * dt, chaserChoose);
    }

    // eat whatever is on the tile the hero is closest to
    const ex = wrapX(hero.t < 0.5 ? hero.tx : hero.tx + hero.dx);
    const ey = hero.t < 0.5 ? hero.ty : hero.ty + hero.dy;
    const d = dots[ey] && dots[ey][ex];
    if (d) {
      dots[ey][ex] = 0; dotsLeft--; dotsEaten++;
      if (d === 1) addScore(10);
      else {
        addScore(50);
        frightT = Math.max(2.5, 7.5 - 0.8 * (level - 1)); combo = 0;
        chasers.forEach((c) => { if (c.state !== 'eaten') { c.fright = true; if (c.state === 'normal') c.rev = true; } });
      }
      if (dotsEaten === 60 || dotsEaten === 140) cake = { t: 10 };
      if (dotsLeft <= 0) { setState('clear'); return; }
    }
    if (cake && ex === 10 && ey === 14) {
      const pts = 500 + 250 * Math.min(level - 1, 6);
      addScore(pts); popups.push({ x: OX + 10.5 * T, y: OY + 14.5 * T, txt: String(pts), t: 1.2 });
      cake = null;
    }

    // hero meets critter?
    const hx = posX(hero), hy = posY(hero);
    for (const c of chasers) {
      if (c.state === 'wait' || c.state === 'eaten') continue;
      if (Math.hypot(posX(c) - hx, posY(c) - hy) > 0.65) continue;
      if (c.fright) {
        c.state = 'eaten'; c.fright = false;
        const pts = 200 * 2 ** Math.min(combo, 3); combo++;
        addScore(pts); freeze = 0.5;
        popups.push({ x: OX + (posX(c) + 0.5) * T, y: OY + (posY(c) + 0.5) * T, txt: String(pts), t: 1.0 });
      } else { setState('dying'); return; }
    }
  }

  // ---------------------------------------------------------------- drawing helpers
  function text(str, x, y, size, color, align, glow) {
    ctx.font = `bold ${size}px "Courier New", monospace`;
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.shadowColor = color; ctx.shadowBlur = glow === undefined ? 8 : glow;
    ctx.fillStyle = color; ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  }
  function star(cx, cy, r) {   // four-point sparkle (uses current fillStyle)
    ctx.beginPath(); ctx.moveTo(cx, cy - r);
    ctx.quadraticCurveTo(cx, cy, cx + r, cy); ctx.quadraticCurveTo(cx, cy, cx, cy + r);
    ctx.quadraticCurveTo(cx, cy, cx - r, cy); ctx.quadraticCurveTo(cx, cy, cx, cy - r);
    ctx.fill();
  }
  const px = (x) => OX + (x + 0.5) * T;
  const py = (y) => OY + (y + 0.5) * T;

  // The hero: a mirrored disco ball in sunglasses that sparkles as it rolls.
  function drawHero(x, y, r, dx, dy, roll) {
    ctx.save(); ctx.translate(x, y);
    ctx.shadowColor = '#bfe8ff'; ctx.shadowBlur = 12;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#b9c6dd'); g.addColorStop(1, '#6d7a99');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
    ctx.strokeStyle = 'rgba(40,50,90,0.55)'; ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) {               // mirror-tile lines that spin as it rolls
      const rx = Math.max(0.1, Math.abs(Math.cos(roll + k * Math.PI / 4)) * r);
      ctx.beginPath(); ctx.ellipse(0, 0, rx, r, 0, 0, TAU); ctx.stroke();
    }
    for (const lat of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.moveTo(-r, lat * r); ctx.lineTo(r, lat * r); ctx.stroke(); }
    ctx.fillStyle = '#ff7ad9';
    for (let i = 0; i < 3; i++) ctx.fillRect(Math.cos(roll + i * 2) * r * 0.6, (i * 0.5 - 0.5) * r, 2, 2);
    ctx.restore();
    const ox = dx * r * 0.15, oy = dy * r * 0.1;   // shades follow the direction of travel
    ctx.fillStyle = '#10131f';
    ctx.fillRect(-r * 0.8 + ox, -r * 0.25 + oy, r * 0.65, r * 0.4);
    ctx.fillRect(r * 0.15 + ox, -r * 0.25 + oy, r * 0.65, r * 0.4);
    ctx.fillRect(-r * 0.15 + ox, -r * 0.2 + oy, r * 0.3, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-r * 0.65 + ox, -r * 0.2 + oy, 2, 2); ctx.fillRect(r * 0.3 + ox, -r * 0.2 + oy, 2, 2);
    ctx.restore();
    ctx.fillStyle = '#fff6c8';                      // twinkles around the ball
    for (let i = 0; i < 2; i++) {
      const a = time * 3 + i * Math.PI, s = 1.5 + 1.5 * Math.abs(Math.sin(time * 6 + i * 2));
      star(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3, s);
    }
  }

  // A party-crasher critter. kind 0/1 = cats (red, teal), 2 = fuzzy lime gremlin,
  // 3 = violet antenna gremlin. mode: normal, fright, flash, eyes.
  function drawCritter(x, y, r, kind, dx, dy, mode) {
    if (mode !== 'eyes') {
      let body = COLORS[kind];
      if (mode === 'fright') body = '#3a55ff';
      if (mode === 'flash') body = Math.floor(time * 8) % 2 ? '#ffffff' : '#3a55ff';
      ctx.save();
      ctx.fillStyle = body; ctx.strokeStyle = body; ctx.shadowColor = body; ctx.shadowBlur = 8;
      if (mode === 'normal') {
        ctx.beginPath();
        if (kind < 2) {                                   // pointy cat ears
          for (const s of [-1, 1]) {
            ctx.moveTo(x + s * r * 0.9, y - r * 0.3); ctx.lineTo(x + s * r * 0.75, y - r * 1.35);
            ctx.lineTo(x + s * r * 0.15, y - r * 0.85);
          }
        } else if (kind === 2) {                          // fuzzy tufts
          for (const s of [-0.6, 0, 0.6]) {
            ctx.moveTo(x + s * r - r * 0.25, y - r * 0.8); ctx.lineTo(x + s * r, y - r * 1.4);
            ctx.lineTo(x + s * r + r * 0.25, y - r * 0.8);
          }
        }
        ctx.fill();
        if (kind === 3) {                                 // antenna with a bobble
          ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y - r * 1.4); ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y - r * 1.5, 2, 0, TAU); ctx.fill();
        }
      }
      ctx.beginPath(); ctx.arc(x, y - r * 0.1, r, Math.PI, 0);   // dome head
      ctx.lineTo(x + r, y + r * 0.8);
      for (let i = 0; i < 4; i++) {                              // wobbly fuzzy bottom
        const x1 = x + r - (i + 0.5) * r / 2, x2 = x + r - (i + 1) * r / 2;
        ctx.quadraticCurveTo(x1, y + r * (i % 2 ? 0.5 : 1.15) + Math.sin(time * 10 + i) * 1.2, x2, y + r * 0.8);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    const ex = r * 0.38, ey = y - r * 0.25;
    if (mode === 'fright' || mode === 'flash') {
      ctx.strokeStyle = mode === 'flash' && Math.floor(time * 8) % 2 ? '#3a55ff' : '#ffffff';
      ctx.lineWidth = 1.5; ctx.beginPath();
      for (const s of [-1, 1]) {                              // dizzy X eyes
        ctx.moveTo(x + s * ex - 2.5, ey - 2.5); ctx.lineTo(x + s * ex + 2.5, ey + 2.5);
        ctx.moveTo(x + s * ex + 2.5, ey - 2.5); ctx.lineTo(x + s * ex - 2.5, ey + 2.5);
      }
      ctx.moveTo(x - r * 0.6, y + r * 0.35);                  // wobbly mouth
      for (let i = 1; i <= 6; i++) ctx.lineTo(x - r * 0.6 + i * r * 0.2, y + r * (i % 2 ? 0.2 : 0.45));
      ctx.stroke();
      const cc = ['#ff7ad9', '#ffe45e', '#4cf0ff'];           // confetti swirling around
      for (let i = 0; i < 3; i++) {
        const a = time * 4 + i * 2.1;
        ctx.save(); ctx.translate(x + Math.cos(a) * r * 1.3, y - r * 0.2 + Math.sin(a) * r * 1.1);
        ctx.rotate(a * 2); ctx.fillStyle = cc[i]; ctx.fillRect(-1.5, -1.5, 3, 3); ctx.restore();
      }
      return;
    }
    ctx.fillStyle = '#fff';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * ex, ey, r * 0.3, r * 0.36, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#111';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * ex + dx * r * 0.14, ey + dy * r * 0.14, r * 0.15, 0, TAU); ctx.fill(); }
    if (mode === 'normal') {                                  // mischievous grin
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y + r * 0.1, r * 0.45, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
  }

  function drawGlass(x, y, s) {   // champagne flute with bubbles
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.shadowColor = '#ffd86b'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffd86b'; ctx.beginPath();
    ctx.moveTo(-4, -7); ctx.lineTo(4, -7); ctx.lineTo(1.6, 1); ctx.lineTo(-1.6, 1); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-4, -7); ctx.lineTo(-1.6, 1); ctx.moveTo(4, -7); ctx.lineTo(1.6, 1);
    ctx.moveTo(0, 1); ctx.lineTo(0, 6); ctx.moveTo(-3, 6.5); ctx.lineTo(3, 6.5); ctx.stroke();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) {
      const b = (time * 1.5 + i * 0.33) % 1;
      ctx.fillRect(-1.5 + i * 1.5, 0 - b * 6, 1, 1);
    }
    ctx.restore();
  }

  function drawCake(x, y, s) {    // slice of wedding cake with a cherry
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.shadowColor = '#ff9ccc'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffe3ef'; ctx.fillRect(-6, -2, 12, 7);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff7fb0'; ctx.fillRect(-6, 1, 12, 2);
    ctx.fillStyle = '#ffffff'; ctx.beginPath();
    ctx.moveTo(-6, -2); ctx.lineTo(-3, -5); ctx.lineTo(3, -5); ctx.lineTo(6, -2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff2f4f'; ctx.beginPath(); ctx.arc(0, -6, 2.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8be8ff'; ctx.fillRect(-7, 5, 14, 1.5);
    ctx.restore();
  }

  // Walls are pre-rendered once per colour: glowing lines wherever wall meets floor.
  function wallImage(color) {
    if (wallCache[color]) return wallCache[color];
    const c = document.createElement('canvas');
    c.width = W * T; c.height = H * T;
    const g = c.getContext('2d');
    const isW = (x, y) => x >= 0 && x < W && y >= 0 && y < H && MAP[y][x] === '#';
    g.fillStyle = 'rgba(30,20,80,0.55)';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isW(x, y)) g.fillRect(x * T, y * T, T, T);
    g.lineCap = 'round';
    for (const pass of [{ w: 4, a: 0.35, b: 10 }, { w: 1.6, a: 1, b: 4 }]) {
      g.strokeStyle = color; g.shadowColor = color; g.shadowBlur = pass.b;
      g.lineWidth = pass.w; g.globalAlpha = pass.a; g.beginPath();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!isW(x, y)) continue;
        const X = x * T, Y = y * T;
        const floor = (nx, ny) => nx >= 0 && nx < W && ny >= 0 && ny < H && !isW(nx, ny) && MAP[ny][nx] !== '-';
        if (floor(x, y - 1)) { g.moveTo(X, Y); g.lineTo(X + T, Y); }
        if (floor(x, y + 1)) { g.moveTo(X, Y + T); g.lineTo(X + T, Y + T); }
        if (floor(x - 1, y)) { g.moveTo(X, Y); g.lineTo(X, Y + T); }
        if (floor(x + 1, y)) { g.moveTo(X + T, Y); g.lineTo(X + T, Y + T); }
      }
      g.stroke();
    }
    g.globalAlpha = 1; g.shadowBlur = 6; g.shadowColor = '#ff7ad9';
    g.strokeStyle = '#ff7ad9'; g.lineWidth = 2; g.beginPath();   // pen door
    g.moveTo(10 * T, 8 * T + T / 2); g.lineTo(11 * T, 8 * T + T / 2); g.stroke();
    wallCache[color] = c;
    return c;
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#0a0322'); g.addColorStop(1, '#16053a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {      // twinkling stars at fixed spots
      const sx = (i * 97 + 31) % canvas.width, sy = (i * 53 + 17) % canvas.height;
      ctx.globalAlpha = 0.15 + 0.25 * Math.abs(Math.sin(time * 1.5 + i));
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function critterMode(c) {
    if (c.state === 'eaten') return 'eyes';
    if (c.fright) return frightT < 2 ? 'flash' : 'fright';
    return 'normal';
  }

  // ---------------------------------------------------------------- screens
  function drawHud() {
    text('PELLET PANIC', canvas.width / 2, 16, 14, '#ff7ad9', 'center', 8);
    text('SCORE', 12, 60, 14, '#4cf0ff'); text(String(score), 12, 82, 18, '#ffffff', 'left', 4);
    text('LIVES', 12, 130, 14, '#4cf0ff');
    for (let i = 0; i < lives; i++) drawHero(24 + (i % 4) * 26, 160 + Math.floor(i / 4) * 26, 8, 1, 0, i);
    text('HIGH', canvas.width - 12, 60, 14, '#ffd86b', 'right'); text(String(high), canvas.width - 12, 82, 18, '#ffffff', 'right', 4);
    text('LEVEL', canvas.width - 12, 130, 14, '#ffd86b', 'right'); text(String(level), canvas.width - 12, 154, 22, '#ffffff', 'right', 4);
  }

  function label(str, color) {   // message box in the middle of the maze
    const cx = px(10), cy = py(11);
    ctx.fillStyle = 'rgba(5,0,20,0.85)'; ctx.fillRect(cx - 62, cy - 14, 124, 28);
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(cx - 62, cy - 14, 124, 28);
    text(str, cx, cy + 1, 18, color, 'center', 10);
  }

  function drawGame() {
    drawBackground(); drawHud();
    ctx.save();
    ctx.beginPath(); ctx.rect(OX, OY, W * T, H * T); ctx.clip();
    const flash = state === 'clear' && Math.floor(stateT * 6) % 2;
    ctx.drawImage(wallImage(flash ? '#ffffff' : '#5b6cff'), OX, OY);

    ctx.fillStyle = '#ffe9a8'; ctx.beginPath();           // sparkles, twinkling
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (dots[y][x] !== 1) continue;
      const r = 1.6 + Math.sin(time * 4 + x * 3 + y) * 0.8, cx = px(x), cy = py(y);
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath();
    }
    ctx.fill();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {   // champagne
      if (dots[y][x] === 2) drawGlass(px(x), py(y), 0.85 + 0.15 * Math.sin(time * 6));
    }
    if (cake) { if (cake.t > 2 || Math.floor(time * 6) % 2) drawCake(px(10), py(14), 1); }

    const showChasers = state !== 'dying' || stateT < 0.6;
    if (showChasers) {
      for (const c of chasers) {
        const bob = c.state === 'wait' ? Math.sin(time * 6 + c.kind) * 0.15 : 0;
        drawCritter(px(posX(c)), py(posY(c) + bob), 7.5, c.kind, c.dx, c.dy, critterMode(c));
      }
    }
    if (state === 'dying') {                              // pop into a burst of sparkles
      const p = Math.min(1, stateT / 1.8);
      if (p < 0.5) drawHero(px(posX(hero)), py(posY(hero)), 7 * (1 - p * 1.6), 0, 0, stateT * 12);
      ctx.fillStyle = '#fff6c8';
      for (let i = 0; i < 10; i++) {
        const a = i * TAU / 10 + 0.3, d = p * 34;
        ctx.globalAlpha = Math.max(0, 1 - p);
        star(px(posX(hero)) + Math.cos(a) * d, py(posY(hero)) + Math.sin(a) * d, 3);
      }
      ctx.globalAlpha = 1;
    } else {
      drawHero(px(posX(hero)), py(posY(hero)), 7, hero.dx, hero.dy, heroRoll);
    }
    for (const p of popups) text(p.txt, p.x, p.y, 12, '#ffd86b', 'center', 6);
    if (state === 'ready') label('READY!', '#ffd86b');
    if (state === 'over') label('GAME OVER', '#ff3b4e');
    ctx.restore();
  }

  function drawTitle() {
    drawBackground();
    text('PELLET PANIC', 320, 62, 46, `hsl(${(time * 60) % 360},100%,68%)`, 'center', 18);
    text('a disco-ball wedding party chase', 320, 96, 13, '#c9b8ff', 'center', 4);
    // little parade: critters chase the hero, then the hero chases dizzy critters
    const u = (time % 16) / 8, chase = u < 1, f = chase ? u : u - 1;
    const hx = chase ? -30 + f * 700 : 670 - f * 700, dir = chase ? 1 : -1;
    for (let i = 0; i < 4; i++) {
      const cx = hx - dir * (chase ? 38 + i * 30 : 45 + i * 30);
      drawCritter(cx, 138, 9, i, dir * (chase ? 1 : -1), 0, chase ? 'normal' : 'fright');
    }
    drawHero(hx, 138, 10, dir, 0, time * 6);
    const rows = [
      () => { ctx.fillStyle = '#ffe9a8'; star(190, 196, 4); }, 'SPARKLE ........ 10',
      () => drawGlass(190, 196 + 34, 1.1), 'CHAMPAGNE ..... 50, DIZZY TIME!',
      () => drawCritter(190, 196 + 68, 9, 1, 0, 0, 'fright'), 'DIZZY CRITTER . 200-1600',
      () => drawCake(190, 196 + 102, 1.2), 'WEDDING CAKE ... BONUS',
    ];
    for (let i = 0; i < 4; i++) { rows[i * 2](); text(rows[i * 2 + 1], 220, 196 + i * 34, 15, '#ffffff', 'left', 3); }
    if (Math.floor(time * 2) % 2 === 0) text('PRESS START', 320, 366, 28, '#ffd86b', 'center', 14);
    text('ARROWS / WASD TO STEER   ENTER OR SPACE = START', 320, 404, 12, '#4cf0ff', 'center', 3);
    text('PHONE: SWIPE TO STEER, TAP TO START', 320, 424, 12, '#4cf0ff', 'center', 3);
    text('HIGH SCORE ' + high, 320, 454, 15, '#ff7ad9', 'center', 6);
  }

  // ---------------------------------------------------------------- input
  function startPressed() {
    if (state === 'title') newGame();
    else if (state === 'over') setState('title');
  }
  function steer(name) {
    want = DIRMAP[name]; wantT = time;
  }

  const KEYS = {
    arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right',
    arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', enter: 'start', ' ': 'start',
  };
  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;   // leave browser shortcuts alone
    const act = KEYS[(e.key || '').toLowerCase()];
    if (!act) return;                                 // (Escape is left to the host)
    e.preventDefault();
    if (e.repeat && act === 'start') return;
    if (act === 'start') startPressed(); else steer(act);
  }

  // swipe steering: drag far enough in a direction to steer; a plain tap = start
  let touch = null;
  function onTouchStart(e) {
    e.preventDefault();
    const t0 = e.changedTouches[0];
    touch = { x: t0.clientX, y: t0.clientY, moved: false };
  }
  function onTouchMove(e) {
    e.preventDefault();
    if (!touch) return;
    const t0 = e.changedTouches[0];
    const dx = t0.clientX - touch.x, dy = t0.clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    touch.moved = true;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    touch.x = t0.clientX; touch.y = t0.clientY;      // allow chained swipes
  }
  function onTouchEnd(e) {
    e.preventDefault();
    if (touch && !touch.moved) startPressed();
    touch = null;
  }

  window.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

  // ---------------------------------------------------------------- main loop
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);   // clamp big gaps
    last = now; time += dt;
    update(dt);
    if (state === 'title') drawTitle(); else drawGame();
  }
  raf = requestAnimationFrame((now) => { last = now; frame(now); });

  return {
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      saveHigh();
      window.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    },
    // Virtual buttons for phones: 'left','right','up','down','start'
    press(action, isDown) {
      if (!isDown) return;
      if (action === 'start') startPressed();
      else if (DIRMAP[action]) steer(action);
    },
  };
}
