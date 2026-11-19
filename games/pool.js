// ─────────────────────────────────────────────────────────────
// 8-Ball Pool: top-down, played on the party's own pool table
// (charcoal felt, black lacquer rails, red glow), you vs. the computer.
// Drag on the table to aim, pull the power bar down and let go to shoot
// (or hold Space). Fouls give ball in hand: drag the white ball.
// startPool(canvas, { onExit }) → { stop() }
// ─────────────────────────────────────────────────────────────

export function startPool(canvas, { onExit } = {}) {
  const ctx = canvas.getContext('2d');
  const L = 200, H = 100, R = 2.9, RAIL = 10;            // playfield in table units; ball radius
  const POCKETS = [[0, 0, 5.9], [L / 2, -0.9, 5.1], [L, 0, 5.9], [0, H, 5.9], [L / 2, H + 0.9, 5.1], [L, H, 5.9]];
  const COLORS = ['#f6f2e8', '#f2c418', '#1f4fbf', '#d0312d', '#5b2c83', '#ec7a1c', '#1e8449', '#7b241c', '#111111'];
  const colorOf = (n) => COLORS[n > 8 ? n - 8 : n];
  const FRICTION_C = 16, FRICTION_K = 0.5, CUSHION = 0.78, BALL_E = 0.95, MAX_SPEED = 560;
  const NAMES = ['You', 'Computer'];

  // ── layout: landscape (table across) or portrait (table up and down) ──
  let portrait = false, M = new DOMMatrix(), Minv = new DOMMatrix(), bar = { x: 0, y: 0, w: 0, h: 0 }, S = 1;
  function layout() {
    portrait = innerHeight > innerWidth * 1.05;
    canvas.width = portrait ? 760 : 1200; canvas.height = portrait ? 1220 : 740;
    canvas.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
    const top = 118;
    if (!portrait) {
      S = 4.6; const fx = 150 + RAIL * S, fy = top + 14 + RAIL * S;
      M = new DOMMatrix([S, 0, 0, S, fx, fy]);
      bar = { x: 46, y: fy - RAIL * S + 30, w: 52, h: H * S + RAIL * S * 2 - 60 };
    } else {
      S = 4.9; const fx = 150 + RAIL * S, fy = top + 14 + RAIL * S;   // table x runs down the screen, y runs right-to-left
      M = new DOMMatrix([0, S, -S, 0, fx + H * S, fy]);
      bar = { x: 40, y: fy - RAIL * S + 40, w: 52, h: L * S + RAIL * S * 2 - 80 };
    }
    Minv = M.inverse();
  }
  const toTable = (sx, sy) => { const p = Minv.transformPoint(new DOMPoint(sx, sy)); return [p.x, p.y]; };
  const screenPt = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height]; };

  // ── game state ──
  let balls, turn, groups, open, breakShot, bih, kitchen, phase, aim, power, msg, msgT, shot, winner, aiT, aiPlan, raf, last, charging;
  function newGame() {
    balls = [];
    const add = (n, x, y) => balls.push({ n, x, y, vx: 0, vy: 0, in: false, roll: 0, rx: 1, ry: 0 });
    add(0, 50, 50);
    // rack: 8 in the middle, a solid and a stripe in the back corners, the rest shuffled
    const slots = []; for (let k = 0; k < 5; k++) for (let j = 0; j <= k; j++) slots.push([k, j]);
    const fixed = { '0,0': 1, '2,1': 8, '4,0': 15, '4,4': 6 };      // 1 at the front, 8 in the middle, a stripe and a solid in the back corners
    const pool = [2, 3, 4, 5, 7, 9, 10, 11, 12, 13, 14].sort(() => Math.random() - 0.5);
    const order = slots.map(([k, j]) => fixed[`${k},${j}`] ?? pool.pop());
    slots.forEach(([k, j], i) => add(order[i], 150 + k * (2 * R * 0.866 + 0.06), 50 + (j - k / 2) * (2 * R + 0.06)));
    turn = 0; groups = [null, null]; open = true; breakShot = true; bih = true; kitchen = true;
    phase = 'aim'; aim = 0; power = 0; charging = false; winner = null; aiPlan = null;
    say('Your break! Drag on the table to aim, then pull the power bar', 3.2);
  }
  const cue = () => balls[0];
  const isSolid = (n) => n >= 1 && n <= 7, isStripe = (n) => n >= 9;
  const groupOf = (n) => (isSolid(n) ? 'solids' : isStripe(n) ? 'stripes' : null);
  const onTable = (n) => balls.some((b) => b.n === n && !b.in);
  const remaining = (p) => (groups[p] ? balls.filter((b) => !b.in && groupOf(b.n) === groups[p]).length : 7);
  const targetsFor = (p) => {
    if (!groups[p]) return balls.filter((b) => !b.in && b.n !== 0 && b.n !== 8);
    if (remaining(p) === 0) return balls.filter((b) => !b.in && b.n === 8);
    return balls.filter((b) => !b.in && groupOf(b.n) === groups[p]);
  };
  const legalFirst = (p, n) => {
    if (!groups[p]) return n !== 8;
    if (remaining(p) === 0) return n === 8;
    return groupOf(n) === groups[p];
  };
  const log = [];
  function say(t, secs = 1.8) { msg = t; msgT = secs; if (autoplay) log.push(`${NAMES[turn]}: ${t} [${groups}]`); }

  // ── physics ──
  function step(dt) {
    for (const b of balls) {
      if (b.in) continue;
      const v = Math.hypot(b.vx, b.vy);
      if (v > 0) {
        const nv = Math.max(0, v - (FRICTION_C + FRICTION_K * v) * dt), k = v ? nv / v : 0;
        b.vx *= k; b.vy *= k;
        if (nv < 1.2) { b.vx = b.vy = 0; }
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (nv > 0) { b.roll += (nv * dt) / R; b.rx = b.vx / nv; b.ry = b.vy / nv; }
      }
    }
    // ball against ball
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i]; if (a.in) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j]; if (b.in) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= 4 * R * R || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = (2 * R - d) / 2;
        a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rel > 0) {
          const imp = ((1 + BALL_E) / 2) * rel;
          a.vx -= imp * nx; a.vy -= imp * ny; b.vx += imp * nx; b.vy += imp * ny;
          if (shot && shot.first == null) { if (a.n === 0) shot.first = b.n; else if (b.n === 0) shot.first = a.n; }
        }
      }
    }
    // pockets, then cushions (no cushion across a pocket's mouth)
    for (const b of balls) {
      if (b.in) continue;
      for (const [px, py, pr] of POCKETS) if (Math.hypot(b.x - px, b.y - py) < pr) { sink(b); break; }
      if (b.in) continue;
      const nearCornerX = b.x < 7 || b.x > L - 7, nearCornerY = b.y < 7 || b.y > H - 7, inSideMouth = Math.abs(b.x - L / 2) < 4.8;
      if (!(nearCornerX && nearCornerY)) {
        if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * CUSHION; }
        if (b.x > L - R) { b.x = L - R; b.vx = -Math.abs(b.vx) * CUSHION; }
        if (!inSideMouth) {
          if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy) * CUSHION; }
          if (b.y > H - R) { b.y = H - R; b.vy = -Math.abs(b.vy) * CUSHION; }
        }
      }
      if (b.x < -R || b.x > L + R || b.y < -R || b.y > H + R) sink(b);   // anything that slips past the mouth drops in
    }
  }
  function sink(b) { b.in = true; b.vx = b.vy = 0; if (shot) shot.pocketed.push(b.n); }
  const moving = () => balls.some((b) => !b.in && (b.vx || b.vy));

  function shoot(p) {
    const c = cue(), sp = 18 + (MAX_SPEED - 18) * p;
    c.vx = Math.cos(aim) * sp; c.vy = Math.sin(aim) * sp;
    shot = { first: null, pocketed: [], who: turn, wasBreak: breakShot, clearedBefore: groups[turn] && remaining(turn) === 0 };
    phase = 'rolling'; bih = false; kitchen = false; power = 0; charging = false;
  }

  // ── after every shot: 8-ball rules ──
  function resolve() {
    const s = shot; shot = null;
    const me = s.who, other = 1 - me, cueIn = s.pocketed.includes(0);
    const objs = s.pocketed.filter((n) => n !== 0);
    let foul = cueIn || s.first == null || (!s.wasBreak && !legalFirstBefore(s, me));
    let why = cueIn ? 'Scratch!' : s.first == null ? 'No ball hit!' : 'Wrong ball first!';
    if (s.wasBreak && s.first != null && !cueIn) foul = false;
    if (objs.includes(8)) {
      if (s.wasBreak) { respot8(); }
      else {
        const won = s.clearedBefore && !foul;
        winner = won ? me : other; phase = 'over';
        say(won ? (me === 0 ? 'You win!' : 'Computer wins!') : (me === 0 ? 'The 8 went down early. Computer wins!' : 'Computer sank the 8 early. You win!'), 99);
        if (cueIn) cue().in = true;
        return;
      }
    }
    // claim a group: first ball you legally sink after the break
    let claimed = '';
    if (open && !s.wasBreak && !foul) {
      const firstObj = objs.find((n) => n !== 8);
      if (firstObj) { groups[me] = groupOf(firstObj); groups[other] = groups[me] === 'solids' ? 'stripes' : 'solids'; open = false; claimed = me === 0 ? `You're ${groups[0]}!` : `Computer is ${groups[1]}. You're ${groups[0]}!`; }
    }
    const madeOwn = objs.some((n) => n !== 8 && (!groups[me] || groupOf(n) === groups[me]));
    breakShot = false;
    if (cueIn) { const c = cue(); c.in = false; c.x = 50; c.y = 50; c.vx = c.vy = 0; nudgeFree(c); }
    if (foul) {
      turn = other; bih = true;
      say(`${why} ${turn === 0 ? 'Ball in hand: drag the white ball' : 'Computer has ball in hand'}`, 2.4);
    } else if (madeOwn) {
      say(claimed || (me === 0 ? 'Nice! Go again' : 'Computer goes again'), 1.6);
    } else {
      turn = other; say(claimed || (turn === 0 ? 'Your turn' : "Computer's turn"), 1.4);
    }
    phase = turn === 0 && !autoplay ? 'aim' : 'ai'; aiT = 0; aiPlan = null;
    if (turn === 0) aimAtSomething();
  }
  function legalFirstBefore(s, p) {     // judged by the groups as they stood when the shot was taken
    if (!groups[p]) return s.first !== 8;
    if (s.clearedBefore) return s.first === 8;
    return groupOf(s.first) === groups[p];
  }
  function respot8() {
    const b = balls.find((x) => x.n === 8); b.in = false; b.x = 150; b.y = 50; b.vx = b.vy = 0; nudgeFree(b);
  }
  function overlaps(b, x, y) { return balls.some((o) => o !== b && !o.in && Math.hypot(o.x - x, o.y - y) < 2 * R + 0.1); }
  function nudgeFree(b) { let x = b.x; for (let i = 0; i < 80 && overlaps(b, x, b.y); i++) x += (i % 2 ? -1 : 1) * (i + 1) * 1.2; b.x = Math.min(L - R, Math.max(R, x)); }
  function aimAtSomething() {          // point the cue at one of your balls to start
    const t = targetsFor(0), c = cue(); if (!t.length) return;
    let best = t[0], bd = 1e9; for (const b of t) { const d = Math.hypot(b.x - c.x, b.y - c.y); if (d < bd) { bd = d; best = b; } }
    aim = Math.atan2(best.y - c.y, best.x - c.x);
  }

  // ── aim guide: where the cue ball goes, what it hits ──
  function traceAim() {
    const c = cue(), dx = Math.cos(aim), dy = Math.sin(aim);
    let tMin = Infinity, hit = null;
    for (const b of balls) {
      if (b.in || b === c) continue;
      const fx = c.x - b.x, fy = c.y - b.y, bq = fx * dx + fy * dy, cq = fx * fx + fy * fy - 4 * R * R, disc = bq * bq - cq;
      if (disc < 0) continue;
      const t = -bq - Math.sqrt(disc);
      if (t > 0 && t < tMin) { tMin = t; hit = b; }
    }
    let tw = Infinity;
    if (dx > 0) tw = Math.min(tw, (L - R - c.x) / dx); if (dx < 0) tw = Math.min(tw, (R - c.x) / dx);
    if (dy > 0) tw = Math.min(tw, (H - R - c.y) / dy); if (dy < 0) tw = Math.min(tw, (R - c.y) / dy);
    if (tw < tMin) return { t: tw, hit: null };
    return { t: tMin, hit };
  }

  // ── the computer player ──
  const segClear = (ax, ay, bx, by, skip) => {
    const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
    for (const o of balls) {
      if (o.in || skip.includes(o)) continue;
      const t = Math.max(0, Math.min(1, ((o.x - ax) * vx + (o.y - ay) * vy) / (l2 || 1)));
      if (Math.hypot(ax + vx * t - o.x, ay + vy * t - o.y) < 2 * R - 0.05) return false;
    }
    return true;
  };
  function speedAfter(v0, dist) { let v = v0, d = 0; const dt = 1 / 240; while (d < dist && v > 0) { v = Math.max(0, v - (FRICTION_C + FRICTION_K * v) * dt); d += v * dt; } return d >= dist ? v : 0; }
  function speedFor(dist, endV) { let lo = 5, hi = MAX_SPEED; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (speedAfter(m, dist) >= endV) hi = m; else lo = m; } return hi; }
  function bestShot(cx, cy) {
    let best = null;
    const c = cue();
    for (const b of targetsFor(turn)) {
      for (const [px0, py0] of POCKETS) {
        const px = px0 + (px0 === 0 ? 1.6 : px0 === L ? -1.6 : 0), py = py0 + (py0 <= 0 ? 1.6 : py0 >= H ? -1.6 : 0);   // aim a little inside the pocket
        const ox = px - b.x, oy = py - b.y, od = Math.hypot(ox, oy); if (od < 0.1) continue;
        const gx = b.x - (ox / od) * 2 * R, gy = b.y - (oy / od) * 2 * R;     // ghost ball spot
        const ax = gx - cx, ay = gy - cy, ad = Math.hypot(ax, ay); if (ad < 0.5) continue;
        const cut = Math.acos(Math.max(-1, Math.min(1, (ax * ox + ay * oy) / (ad * od))));
        if (cut > 1.25) continue;
        if (!segClear(cx, cy, gx, gy, [c, b]) || !segClear(b.x, b.y, px, py, [c, b])) continue;
        const side = Math.abs(px0 - L / 2) < 1;                               // side pockets want a straighter line in
        const entry = side ? Math.abs(oy) / od : 1;
        if (side && entry < 0.45) continue;
        const score = Math.cos(cut) ** 2 * entry / (1 + (ad + od * 1.4) / 160);
        if (!best || score > best.score) {
          const vObj = speedFor(od, 22) / BALL_E;
          const v = Math.min(MAX_SPEED, speedFor(ad, vObj / Math.max(0.25, Math.cos(cut))) * 1.08);
          best = { score, angle: Math.atan2(ay, ax), power: Math.min(1, (v - 18) / (MAX_SPEED - 18)) };
        }
      }
    }
    return best;
  }
  function planAI() {
    const c = cue();
    if (bih) {                         // ball in hand: try spots around the table, keep the best one
      let bestSpot = null;
      for (let x = 8; x < L - 4; x += 9) for (let y = 7; y < H - 4; y += 9) {
        if (overlaps(c, x, y)) continue;
        const s = bestShot(x, y); if (s && (!bestSpot || s.score > bestSpot.s.score)) bestSpot = { x, y, s };
      }
      if (bestSpot) { c.x = bestSpot.x; c.y = bestSpot.y; }
    }
    let plan = bestShot(c.x, c.y);
    if (!plan) {                       // nothing on: just hit one of its balls firmly
      const ts = targetsFor(turn).sort((a, b) => (segClear(c.x, c.y, b.x, b.y, [c, b]) ? 0 : 1) - (segClear(c.x, c.y, a.x, a.y, [c, a]) ? 0 : 1) || Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
      const t = ts[0] || balls.find((b) => !b.in && b.n !== 0);
      plan = { angle: Math.atan2(t.y - c.y, t.x - c.x), power: 0.45 };
    }
    plan.angle += (Math.random() + Math.random() + Math.random() - 1.5) * 0.024;   // it's good, not perfect
    plan.from = aim;
    return plan;
  }

  // ── input ──
  let drag = null, autoplay = false;   // autoplay: the computer plays both sides (testing only)
  const inBar = (x, y) => x > bar.x - 24 && x < bar.x + bar.w + 24 && y > bar.y - 20 && y < bar.y + bar.h + 20;
  const btn = () => ({ x: canvas.width / 2 - 130, y: canvas.height / 2 + 40, w: 260, h: 70 });
  function down(e) {
    e.preventDefault();
    const [sx, sy] = screenPt(e);
    if (phase === 'over') { const b = btn(); if (sx > b.x && sx < b.x + b.w && sy > b.y && sy < b.y + b.h) newGame(); return; }
    if (phase !== 'aim') return;
    canvas.setPointerCapture?.(e.pointerId);
    if (inBar(sx, sy)) { drag = { kind: 'power', y0: sy }; power = 0; return; }
    const [tx, ty] = toTable(sx, sy), c = cue();
    if (bih && Math.hypot(tx - c.x, ty - c.y) < R * 3.2) { drag = { kind: 'ball' }; return; }
    drag = { kind: 'aim' }; aimTo(tx, ty);
  }
  function move(e) {
    if (!drag) return;
    const [sx, sy] = screenPt(e);
    if (drag.kind === 'power') power = Math.max(0, Math.min(1, (sy - drag.y0) / (bar.h * 0.9)));
    else if (drag.kind === 'aim') { const [tx, ty] = toTable(sx, sy); aimTo(tx, ty); }
    else if (drag.kind === 'ball') {
      const [tx, ty] = toTable(sx, sy), c = cue();
      const x = Math.min(kitchen ? 50 : L - R, Math.max(R, tx)), y = Math.min(H - R, Math.max(R, ty));
      if (!overlaps(c, x, y)) { c.x = x; c.y = y; }
    }
  }
  function up() {
    if (drag && drag.kind === 'power') { if (power > 0.02) shoot(power); else power = 0; }
    drag = null;
  }
  function aimTo(tx, ty) { const c = cue(); if (Math.hypot(tx - c.x, ty - c.y) > 0.5) aim = Math.atan2(ty - c.y, tx - c.x); }
  function key(e) {
    if (e.key === 'Escape') { e.preventDefault(); onExit && onExit(); return; }
    if (phase === 'over' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); newGame(); return; }
    if (phase !== 'aim') return;
    if (e.key === 'ArrowLeft' || e.key === 'a') { aim -= e.shiftKey ? 0.035 : 0.006; e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'd') { aim += e.shiftKey ? 0.035 : 0.006; e.preventDefault(); }
    if (e.key === ' ') { e.preventDefault(); if (!charging) { charging = true; power = 0; } }
  }
  function keyUp(e) { if (e.key === ' ' && charging && phase === 'aim') { e.preventDefault(); if (power > 0.02) shoot(power); charging = false; } }

  // ── drawing ──
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function drawTable() {
    ctx.setTransform(M);
    // red glow from the venue lights under the table
    ctx.shadowColor = 'rgba(255,40,20,.55)'; ctx.shadowBlur = 40;
    const lac = ctx.createLinearGradient(0, -RAIL, 0, H + RAIL); lac.addColorStop(0, '#2a2220'); lac.addColorStop(0.5, '#0f0b09'); lac.addColorStop(1, '#231b18');
    rr(-RAIL, -RAIL, L + RAIL * 2, H + RAIL * 2, 5); ctx.fillStyle = lac; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,90,60,.35)'; ctx.lineWidth = 0.5; ctx.stroke();
    // cushions + felt
    ctx.fillStyle = '#2e2e37'; rr(-2.6, -2.6, L + 5.2, H + 5.2, 1.5); ctx.fill();
    const felt = ctx.createRadialGradient(L / 2, H / 2, 10, L / 2, H / 2, L * 0.62);
    felt.addColorStop(0, '#34343e'); felt.addColorStop(1, '#1b1b21');
    ctx.fillStyle = felt; ctx.fillRect(0, 0, L, H);
    // head string + foot spot
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(50, 0); ctx.lineTo(50, H); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(150, 50, 0.6, 0, 7); ctx.fill();
    // diamond sights in mother-of-pearl
    ctx.fillStyle = '#e9dcc6';
    for (let i = 1; i < 8; i++) { if (i === 4) continue; const x = (L / 8) * i; for (const y of [-RAIL / 2 - 1.3, H + RAIL / 2 + 1.3]) { ctx.beginPath(); ctx.arc(x, y, 0.75, 0, 7); ctx.fill(); } }
    for (let i = 1; i < 4; i++) { const y = (H / 4) * i; for (const x of [-RAIL / 2 - 1.3, L + RAIL / 2 + 1.3]) { ctx.beginPath(); ctx.arc(x, y, 0.75, 0, 7); ctx.fill(); } }
    // pockets
    for (const [px, py] of POCKETS) {
      const cx = px === 0 ? -1.2 : px === L ? L + 1.2 : px, cy = py <= 0 ? -1.6 : H + 1.6, pr = px === L / 2 ? 5.0 : 5.9;
      const g = ctx.createRadialGradient(cx, cy, 0.5, cx, cy, pr); g.addColorStop(0, '#000'); g.addColorStop(0.8, '#060606'); g.addColorStop(1, '#2a2a2a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, pr, 0, 7); ctx.fill();
    }
  }
  function drawBall(b, x, y, alpha = 1, rad = R) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(x + rad * 0.25, y + rad * 0.3, rad * 1.02, rad * 0.95, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.save(); ctx.clip();
    const n = b.n;
    if (isStripe(n)) { ctx.fillStyle = '#f6f2e8'; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2); ctx.fillStyle = colorOf(n); ctx.fillRect(x - rad, y - rad * 0.56, rad * 2, rad * 1.12); }
    else { ctx.fillStyle = colorOf(n); ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    if (n !== 0) {                     // number spot, rolling around with the ball
      const c = Math.cos(b.roll), s = Math.sin(b.roll);
      if (c > -0.15) {
        const ox = b.rx * s * rad * 0.62, oy = b.ry * s * rad * 0.62, sc = 0.35 + 0.65 * Math.max(0, c);
        ctx.fillStyle = '#f6f2e8'; ctx.beginPath(); ctx.arc(x + ox, y + oy, rad * 0.48 * (0.6 + 0.4 * sc), 0, 7); ctx.fill();
        ctx.save(); ctx.translate(x + ox, y + oy); if (portrait) ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#111'; ctx.font = `700 ${rad * 0.62 * (0.6 + 0.4 * sc)}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n), 0, rad * 0.04); ctx.restore();
      }
    }
    const hl = ctx.createRadialGradient(x - rad * 0.38, y - rad * 0.42, rad * 0.05, x - rad * 0.2, y - rad * 0.2, rad * 1.25);
    hl.addColorStop(0, 'rgba(255,255,255,.85)'); hl.addColorStop(0.18, 'rgba(255,255,255,.18)'); hl.addColorStop(0.6, 'rgba(0,0,0,0)'); hl.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.fillStyle = hl; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    ctx.restore(); ctx.restore();
  }
  function drawGuide() {
    const c = cue(), dx = Math.cos(aim), dy = Math.sin(aim), tr = traceAim();
    const ex = c.x + dx * tr.t, ey = c.y + dy * tr.t;
    const bad = tr.hit && !legalFirst(turn, tr.hit.n) && !breakShot;
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 0.35; ctx.setLineDash([1.6, 1.2]);
    ctx.beginPath(); ctx.moveTo(c.x + dx * R, c.y + dy * R); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = bad ? '#ff4a3a' : 'rgba(255,255,255,.9)'; ctx.lineWidth = 0.35;
    ctx.beginPath(); ctx.arc(ex, ey, R, 0, 7); ctx.stroke();
    if (bad) { ctx.beginPath(); ctx.moveTo(ex - 1.3, ey - 1.3); ctx.lineTo(ex + 1.3, ey + 1.3); ctx.moveTo(ex + 1.3, ey - 1.3); ctx.lineTo(ex - 1.3, ey + 1.3); ctx.stroke(); }
    if (tr.hit && !bad) {
      const nx = (tr.hit.x - ex) / (2 * R), ny = (tr.hit.y - ey) / (2 * R), along = dx * nx + dy * ny;
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.moveTo(tr.hit.x, tr.hit.y); ctx.lineTo(tr.hit.x + nx * (6 + 26 * along), tr.hit.y + ny * (6 + 26 * along)); ctx.stroke();
      const tx = dx - nx * along, ty = dy - ny * along, tl = Math.hypot(tx, ty);
      if (tl > 0.05) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + (tx / tl) * 14 * tl, ey + (ty / tl) * 14 * tl); ctx.stroke(); }
    }
  }
  function drawCue(pull) {
    const c = cue(), dx = Math.cos(aim), dy = Math.sin(aim), s0 = R + 1.2 + pull * 22, len = 118;
    const ax = c.x - dx * s0, ay = c.y - dy * s0, bx = c.x - dx * (s0 + len), by = c.y - dy * (s0 + len), px = -dy, py = dx;
    const seg = (t0, t1, w0, w1, col) => {
      const x0 = ax + (bx - ax) * t0, y0 = ay + (by - ay) * t0, x1 = ax + (bx - ax) * t1, y1 = ay + (by - ay) * t1;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0 + px * w0, y0 + py * w0); ctx.lineTo(x1 + px * w1, y1 + py * w1); ctx.lineTo(x1 - px * w1, y1 - py * w1); ctx.lineTo(x0 - px * w0, y0 - py * w0); ctx.closePath(); ctx.fill();
    };
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
    seg(0, 0.012, 0.42, 0.42, '#4a7fc0');           // chalked tip
    seg(0.012, 0.04, 0.44, 0.46, '#f1ece2');        // ferrule
    seg(0.04, 0.62, 0.46, 0.7, '#d9b47f');          // maple shaft
    seg(0.62, 0.66, 0.7, 0.72, '#111');
    seg(0.66, 0.97, 0.72, 0.95, '#6b1724');         // burgundy butt, like the dining plates
    seg(0.97, 1, 0.95, 0.95, '#111');
    ctx.restore();
  }
  function drawHUD() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const W = canvas.width;
    for (const p of [0, 1]) {
      const x = p === 0 ? 24 : W - 24, al = p === 0 ? 'left' : 'right', active = turn === p && phase !== 'over';
      ctx.textAlign = al; ctx.textBaseline = 'alphabetic';
      ctx.font = `700 ${portrait ? 30 : 32}px Georgia, serif`; ctx.fillStyle = active ? '#ffd9a8' : 'rgba(255,230,210,.55)';
      if (active) { ctx.shadowColor = 'rgba(255,120,60,.8)'; ctx.shadowBlur = 14; }
      ctx.fillText(NAMES[p], x, 44); ctx.shadowBlur = 0;
      ctx.font = 'italic 17px Georgia, serif'; ctx.fillStyle = 'rgba(255,230,210,.6)';
      ctx.fillText(groups[p] ? groups[p] : 'open table', x, 68);
      // that player's balls: still on the table bright, sunk ones faded
      const list = groups[p] ? (groups[p] === 'solids' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15]) : [];
      if (groups[p] && remaining(p) === 0) list.push(8);
      const rad = portrait ? 11 : 12, gap = rad * 2 + 5;
      ctx.save();
      list.forEach((n, i) => { const bx = p === 0 ? x + rad + i * gap : x - rad - i * gap; const b = { n, roll: 0, rx: 1, ry: 0 }; const was = portrait; portrait = false; drawBall(b, bx, 92, onTable(n) ? 1 : 0.22, rad); portrait = was; });
      ctx.restore();
    }
    // power bar
    const b = bar, p = phase === 'aim' ? power : phase === 'ai' && aiPlan && aiT > 1.6 ? Math.min(aiPlan.power, (aiT - 1.6) / 0.5 * aiPlan.power) : 0;
    rr(b.x, b.y, b.w, b.h, 14); ctx.fillStyle = '#16100f'; ctx.fill(); ctx.strokeStyle = '#3a2228'; ctx.lineWidth = 2; ctx.stroke();
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h); g.addColorStop(0, '#3ec46d'); g.addColorStop(0.55, '#f2c418'); g.addColorStop(1, '#e0321f');
    ctx.save(); rr(b.x + 6, b.y + 6, b.w - 12, b.h - 12, 9); ctx.clip();
    ctx.fillStyle = g; ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, (b.h - 12) * p);
    ctx.restore();
    // little cue handle that slides down as you pull
    const hy = b.y + 10 + (b.h - 40) * p;
    ctx.fillStyle = '#d9b47f'; rr(b.x + 10, hy, b.w - 20, 22, 8); ctx.fill();
    ctx.fillStyle = '#6b1724'; rr(b.x + 10, hy + 11, b.w - 20, 11, 6); ctx.fill();
    ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h + 30); ctx.fillStyle = 'rgba(255,230,210,.6)'; ctx.font = '700 14px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('POWER', 0, 0); ctx.restore();
    // message
    if (msgT > 0 || phase === 'over') {
      const a = phase === 'over' ? 1 : Math.min(1, msgT * 2);
      ctx.globalAlpha = a; ctx.font = `700 ${portrait ? 24 : 26}px Georgia, serif`; ctx.textAlign = 'center';
      const tw = ctx.measureText(msg).width + 46, cx = W / 2, cy = phase === 'over' ? canvas.height / 2 - 30 : (portrait ? 150 : 132);
      if (phase === 'over') { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, canvas.height); ctx.font = `700 ${portrait ? 38 : 48}px Georgia, serif`; }
      const tw2 = phase === 'over' ? ctx.measureText(msg).width + 60 : tw, th = phase === 'over' ? 84 : 46;
      rr(cx - tw2 / 2, cy - th / 2 - 8, tw2, th, 14); ctx.fillStyle = 'rgba(20,10,10,.85)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,150,100,.5)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ffe1c2'; ctx.textBaseline = 'middle'; ctx.fillText(msg, cx, cy - 8);
      ctx.globalAlpha = 1;
      if (phase === 'over') {
        const bt = btn(); rr(bt.x, bt.y, bt.w, bt.h, 16); ctx.fillStyle = '#6b1724'; ctx.fill(); ctx.strokeStyle = '#ffb38a'; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '700 28px Georgia, serif'; ctx.fillText('Play again', bt.x + bt.w / 2, bt.y + bt.h / 2 + 1);
      }
      ctx.textBaseline = 'alphabetic';
    }
  }
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const bg = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 50, canvas.width / 2, canvas.height / 2, canvas.width);
    bg.addColorStop(0, '#2a0f0d'); bg.addColorStop(1, '#0b0404');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawTable();
    if (phase === 'aim' && bih && kitchen) { ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fillRect(0, 0, 50, H); }
    for (const b of balls) if (!b.in && b.n !== 0) drawBall(b, b.x, b.y);
    const c = cue();
    if (!c.in) {
      if (bih && phase === 'aim') { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 0.35; ctx.setLineDash([0.8, 0.8]); ctx.beginPath(); ctx.arc(c.x, c.y, R * 2.2, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
      drawBall(c, c.x, c.y);
    }
    if (phase === 'aim' && !(drag && drag.kind === 'ball')) { drawGuide(); drawCue(power); }
    if (phase === 'ai' && aiPlan && aiT > 0.6) { drawGuide(); drawCue(aiT > 1.6 ? Math.min(aiPlan.power, (aiT - 1.6) / 0.5 * aiPlan.power) : 0); }
    drawHUD();
  }

  // ── loop ──
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    if (msgT > 0 && phase !== 'over') msgT -= dt;
    if (charging && phase === 'aim') power = Math.min(1, power + dt / 1.3);
    if (phase === 'rolling') {
      const sub = 8; for (let i = 0; i < sub; i++) step(dt / sub);
      if (!moving()) resolve();
    } else if (phase === 'ai') {
      aiT += dt;
      if (!aiPlan && aiT > 0.5) aiPlan = planAI();
      if (aiPlan && aiT > 0.6 && aiT < 1.6) { const k = Math.min(1, (aiT - 0.6) / 0.9), d = Math.atan2(Math.sin(aiPlan.angle - aiPlan.from), Math.cos(aiPlan.angle - aiPlan.from)); aim = aiPlan.from + d * (1 - (1 - k) ** 3); }
      if (aiPlan && aiT > 2.25) { aim = aiPlan.angle; shoot(Math.max(0.08, aiPlan.power)); }
    }
    draw();
  }

  layout(); newGame();
  canvas._pool = { get state() { return { turn, groups: [...groups], phase, winner, msg, left: balls.filter((b) => !b.in).map((b) => b.n) }; }, log, auto(on) { autoplay = on; if (on && phase === 'aim') { phase = 'ai'; aiT = 0; aiPlan = null; } }, newGame };
  canvas.style.touchAction = 'none';
  const onResize = () => layout();
  canvas.addEventListener('pointerdown', down);
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
  addEventListener('keydown', key);
  addEventListener('keyup', keyUp);
  addEventListener('resize', onResize);
  raf = requestAnimationFrame(frame);

  return {
    stop() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', down);
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      removeEventListener('keydown', key); removeEventListener('keyup', keyUp); removeEventListener('resize', onResize);
      canvas.width = 640; canvas.height = 480; canvas.style.aspectRatio = ''; canvas.style.touchAction = '';
    },
  };
}
