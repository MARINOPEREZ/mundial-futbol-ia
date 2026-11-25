// ===== Dinamo Algoritmo =====
const VEL = 7.5;
const DEC = 8.7; // desaceleración estimada del balón (m/s^2)

const BASE = [
  null,
  { x: 24, y: 9 }, { x: 22, y: 26 }, { x: 22, y: 42 }, { x: 24, y: 59 },
  { x: 44, y: 8 }, { x: 42, y: 26 }, { x: 42, y: 42 }, { x: 44, y: 60 },
  { x: 70, y: 25 }, { x: 70, y: 43 }
];

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function lim(v, a, c) { return v < a ? a : (v > c ? c : v); }

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = lim(t, 0, 1);
  return dist(px, py, ax + t * dx, ay + t * dy);
}

// posición estimada del balón dentro de t segundos
function ballAt(b, t) {
  const s = Math.hypot(b.vx, b.vy);
  if (s < 0.05) return { x: b.x, y: b.y };
  const tt = Math.min(t, s / DEC);
  const d = s * tt - 0.5 * DEC * tt * tt;
  return { x: b.x + (b.vx / s) * d, y: b.y + (b.vy / s) * d };
}

// tiempo mínimo para que un jugador llegue al balón
function tInt(p, b, reach) {
  for (let t = 0; t <= 4.0001; t += 0.25) {
    const q = ballAt(b, t);
    if (dist(p.x, p.y, q.x, q.y) - reach <= VEL * t) return { t: t, x: q.x, y: q.y };
  }
  const q = ballAt(b, 4);
  return { t: 4 + dist(p.x, p.y, q.x, q.y) / VEL, x: q.x, y: q.y };
}

function fuerzaPase(d) { return lim(Math.sqrt(d / 45) + 0.1, 0.25, 1); }

function mejorPase(p, M, R) {
  let mejor = null;
  for (let j = 1; j < 11; j++) {
    if (j === p.n) continue;
    const q = M[j];
    const tx = lim(q.x + q.vx * 0.5, 1, 104);
    const ty = lim(q.y + q.vy * 0.5, 1, 67);
    const d = dist(p.x, p.y, tx, ty);
    if (d < 4 || d > 42) continue;
    let s = (tx - p.x) + (tx > 80 ? 6 : 0) - d * 0.15;
    let dmin = 99;
    for (let k = 0; k < 11; k++) {
      const r = R[k];
      if (dist(r.x, r.y, p.x, p.y) >= 1.8) {
        const sd = segDist(r.x, r.y, p.x, p.y, tx, ty);
        if (sd < 2.5) s -= (2.5 - sd) * 14;
      }
      const dr = dist(r.x, r.y, tx, ty);
      if (dr < dmin) dmin = dr;
    }
    if (dmin < 3.5) s -= (3.5 - dmin) * 6;
    if (!mejor || s > mejor.s) mejor = { s: s, x: tx, y: ty, d: d, n: j };
  }
  return mejor;
}

function pase(p, mp) {
  return {
    ir: { x: p.x + (mp.x - p.x) * 0.3, y: p.y + (mp.y - p.y) * 0.3 },
    patear: { x: mp.x, y: mp.y, fuerza: fuerzaPase(mp.d) }
  };
}

function despeje(p) {
  const ty = p.y < 34 ? lim(p.y - 18, 5, 63) : lim(p.y + 18, 5, 63);
  const tx = lim(p.x + 32, 0, 100);
  return { ir: { x: tx, y: ty }, patear: { x: tx, y: ty, fuerza: 1 } };
}

function regate(p, R) {
  let gx = 105 - p.x, gy = 34 - p.y;
  const gl = Math.hypot(gx, gy) || 1;
  gx /= gl; gy /= gl;
  let rx = 0, ry = 0;
  for (let k = 0; k < 11; k++) {
    const r = R[k];
    const d = dist(p.x, p.y, r.x, r.y);
    if (d < 9 && d > 0.01) {
      const w = ((9 - d) / 9) * 1.6;
      rx += ((p.x - r.x) / d) * w;
      ry += ((p.y - r.y) / d) * w;
    }
  }
  const dx = gx + rx, dy = gy + ry;
  const dl = Math.hypot(dx, dy) || 1;
  return { ir: { x: lim(p.x + (dx / dl) * 12, 0, 105), y: lim(p.y + (dy / dl) * 12, 0, 68) } };
}

function portador(p, M, R, rk) {
  const dg = dist(p.x, p.y, 105, 34);
  let rcerca = 99;
  for (let k = 0; k < 11; k++) {
    const d = dist(p.x, p.y, R[k].x, R[k].y);
    if (d < rcerca) rcerca = d;
  }
  const presionado = rcerca < 4.5;

  // 1) Disparo
  if (p.x > 70) {
    const ang = Math.abs(p.y - 34) < (105 - p.x) * 1.4 + 5;
    if (ang && dg <= 31) {
      let bloq = false;
      for (let k = 1; k < 11; k++) {
        const r = R[k];
        if (r.x > p.x && segDist(r.x, r.y, p.x, p.y, 105, 34) < 1.6) { bloq = true; break; }
      }
      if (dg <= 18 || !bloq) {
        const m = dg > 20 ? 2.6 : 3.0;
        const ya = 34 - m, yb = 34 + m;
        const ty = Math.abs(ya - rk.y) > Math.abs(yb - rk.y) ? ya : yb;
        const f = dg <= 16 ? 0.8 : (dg <= 24 ? 0.9 : 1);
        return { ir: { x: 105, y: 34 }, patear: { x: 106, y: ty, fuerza: f } };
      }
    }
  }

  // 2) Pase / despeje / regate
  const mp = mejorPase(p, M, R);
  if (presionado) {
    if (mp && mp.s > -22) return pase(p, mp);
    if (p.x < 50) return despeje(p);
    return regate(p, R);
  }
  if (mp && mp.s > 15) return pase(p, mp);
  return regate(p, R);
}

function cerebro(e) {
  const b = e.balon;
  const M = [], R = [];
  for (const p of e.mios) M[p.n] = p;
  for (const p of e.rivales) R[p.n] = p;
  const rk = R[0];

  const iM = [], iR = [];
  let tMy = 99, tRv = 99, rvCar = R[1];
  for (let n = 0; n < 11; n++) {
    iM[n] = tInt(M[n], b, n === 0 ? 2.0 : 1.0);
    iR[n] = tInt(R[n], b, n === 0 ? 2.0 : 1.0);
    if (iM[n].t < tMy) tMy = iM[n].t;
    if (iR[n].t < tRv) { tRv = iR[n].t; rvCar = R[n]; }
  }
  const pos = tMy <= tRv + 0.1; // ¿tenemos la posesión?

  // Ajuste por marcador y tiempo
  const dif = e.marcador.propio - e.marcador.rival;
  const resta = e.duracion - e.tiempo;
  let sesgo = 0;
  if (e.mitad !== 3) {
    if (dif < 0 && resta < 100) sesgo = 10;
    else if (dif > 0 && resta < 60) sesgo = -8;
  }

  // Formación dinámica
  const ord = [];
  const shift = (b.x - 52.5) * 0.5 + (pos ? 6 : -2) + sesgo;
  for (let n = 1; n < 11; n++) {
    let x;
    if (n <= 4) x = lim(BASE[n].x + shift * 0.7, 10, 70);
    else if (n <= 8) x = lim(BASE[n].x + shift, 20, 90);
    else x = pos ? lim(Math.max(b.x + 15, 72), 72, 97) : lim(60 + shift * 0.5, 52, 85);
    const y = lim(BASE[n].y + (b.y - 34) * 0.3, 4, 64);
    ord[n] = { ir: { x: x, y: y } };
  }

  // Portero: ¿sale a buscar el balón?
  const speedB = Math.hypot(b.vx, b.vy);
  const enArea = b.x < 15 && Math.abs(b.y - 34) < 18;
  const keeperRush = enArea && speedB < 10 && iM[0].t < tRv - 0.1;

  // Perseguidores
  const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].sort((a, c) => iM[a].t - iM[c].t);
  const chasers = [];
  if (!keeperRush) {
    chasers.push(ids[0]);
    ord[ids[0]] = { ir: { x: lim(iM[ids[0]].x, 0, 105), y: lim(iM[ids[0]].y, 0, 68) } };
    if (!pos && b.x < 75) {
      chasers.push(ids[1]);
      const q = ballAt(b, 0.5);
      let ux = 0 - q.x, uy = 34 - q.y;
      const ul = Math.hypot(ux, uy) || 1;
      ord[ids[1]] = { ir: { x: lim(q.x + (ux / ul) * 3, 0, 105), y: lim(q.y + (uy / ul) * 3, 0, 68) } };
    }
  }

  // Marcaje de defensas cuando no tenemos el balón
  const libres = [1, 2, 3, 4].filter(n => chasers.indexOf(n) < 0);
  if (!pos && libres.length) {
    const amen = [];
    for (let k = 1; k < 11; k++) {
      const r = R[k];
      if (r !== rvCar && r.x < 68) amen.push(r);
    }
    amen.sort((a, c) => a.x - c.x);
    const sel = amen.slice(0, libres.length).sort((a, c) => a.y - c.y);
    const ls = libres.slice().sort((a, c) => BASE[a].y - BASE[c].y);
    for (let i = 0; i < sel.length; i++) {
      const r = sel[i];
      ord[ls[i]] = { ir: { x: lim(r.x + r.vx * 0.3 - 2.5, 3, 100), y: lim(r.y + r.vy * 0.3, 1, 67) } };
    }
  }

  // Portador del balón (jugador de campo más cercano dentro del alcance)
  let best = -1, bd = 1.3;
  for (let n = 1; n < 11; n++) {
    const d = dist(M[n].x, M[n].y, b.x, b.y);
    if (d < bd) { bd = d; best = n; }
  }
  if (best > 0) ord[best] = portador(M[best], M, R, rk);

  // Portero
  const k = M[0];
  if (dist(k.x, k.y, b.x, b.y) < 2.2) {
    const mp = mejorPase(k, M, R);
    if (mp && mp.s > -25) ord[0] = pase(k, mp);
    else ord[0] = despeje(k);
  } else if (keeperRush) {
    ord[0] = { ir: { x: lim(iM[0].x, 0, 16), y: lim(iM[0].y, 34 - 20, 34 + 20) } };
  } else {
    const dx = b.x, dy = b.y - 34;
    const dl = Math.hypot(dx, dy) || 1;
    const off = lim(dl * 0.15, 2, 5.5);
    const tx = lim((dx / dl) * off, 1.2, 6);
    let ty = lim(34 + (dy / dl) * off, 34 - 3.6, 34 + 3.6);
    if (b.vx < -5 && b.x < 50) {
      const t = (b.x - tx) / (-b.vx);
      if (t > 0 && t < 2.5) {
        const yc = b.y + b.vy * t;
        if (Math.abs(yc - 34) < 7) ty = lim(yc, 34 - 6.5, 34 + 6.5);
      }
    }
    ord[0] = { ir: { x: tx, y: ty } };
  }

  return ord;
}

function decidir(estado) {
  try {
    return cerebro(estado);
  } catch (err) {
    const b = estado.balon;
    const out = [];
    for (let i = 0; i < 11; i++) out.push({ ir: { x: b.x, y: b.y } });
    return out;
  }
}