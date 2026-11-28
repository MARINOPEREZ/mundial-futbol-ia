function decidir(estado) {
  try {
    return cerebro(estado);
  } catch (e) {
    return estado.mios.map(function (p) { return { ir: { x: p.x, y: p.y } }; });
  }
}

function cerebro(estado) {
  var C = estado.cancha, b = estado.balon, mios = estado.mios, riv = estado.rivales;
  var L = C.largo, W = C.ancho, GY = W / 2;

  function clamp(v, a, c) { return Math.max(a, Math.min(c, v)); }
  function dist(a, c) { return Math.hypot(a.x - c.x, a.y - c.y); }
  function segDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var l2 = dx * dx + dy * dy;
    var t = l2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function minRivDist(x, y) {
    var m = 999;
    for (var i = 0; i < riv.length; i++) {
      var d = Math.hypot(riv[i].x - x, riv[i].y - y);
      if (d < m) m = d;
    }
    return m;
  }

  // ---- Posesión ----
  var dMio = 999, dRiv = 999, i;
  for (i = 0; i < mios.length; i++) dMio = Math.min(dMio, dist(mios[i], b));
  for (i = 0; i < riv.length; i++) dRiv = Math.min(dRiv, dist(riv[i], b));
  var poss = (dMio <= dRiv + 0.5) || estado.saque === "propio";

  var perdiendoTarde = estado.tiempo >= 300 && estado.marcador.propio < estado.marcador.rival;
  var late = perdiendoTarde ? 12 : 0;

  // ---- Punto de interceptación del balón ----
  function objetivoBalon(p) {
    var tx, ty;
    if (b.z > 0.8) {
      var g = 10;
      var t = (b.vz + Math.sqrt(b.vz * b.vz + 2 * g * b.z)) / g;
      tx = b.x + b.vx * t * 0.9;
      ty = b.y + b.vy * t * 0.9;
    } else {
      var d = dist(p, b);
      var tt = Math.min(d / 7.5, 1.2);
      tx = b.x + b.vx * tt * 0.6;
      ty = b.y + b.vy * tt * 0.6;
      if (d < 3) { tx = b.x; ty = b.y; }
    }
    return { x: clamp(tx, 0.5, L - 0.5), y: clamp(ty, 0.5, W - 0.5) };
  }

  // ---- Quiénes presionan al balón (solo jugadores de campo) ----
  var ranking = [];
  for (i = 1; i < 11; i++) ranking.push({ i: i, d: dist(mios[i], b) });
  ranking.sort(function (a, c) { return a.d - c.d; });
  var nChase = poss ? 1 : 2;
  if (!poss && b.x < 50 && estado.saque !== "rival") nChase = 3;
  var chasers = {};
  for (i = 0; i < nChase; i++) chasers[ranking[i].i] = true;

  // ---- Ajuste de patada según altura del balón ----
  function fix(o) {
    if (b.z > 1.3) { o.fuerza = Math.min(o.fuerza, 0.6); o.altura = 0; }
    else if (b.z > 0.4) { o.fuerza = Math.min(o.fuerza, 0.7); }
    return o;
  }

  // ---- Regate: hacia el arco rival esquivando rivales ----
  function regatear(p) {
    var dx = L - p.x, dy = GY - p.y;
    var n = Math.hypot(dx, dy) || 1;
    dx /= n; dy /= n;
    for (var k = 0; k < riv.length; k++) {
      var d = dist(p, riv[k]);
      if (d < 7 && d > 0.1) {
        var w = (7 - d) / 7 * 1.6;
        dx += (p.x - riv[k].x) / d * w;
        dy += (p.y - riv[k].y) / d * w;
      }
    }
    n = Math.hypot(dx, dy) || 1;
    dx /= n; dy /= n;
    return { x: clamp(p.x + dx * 10, 0.5, L - 0.5), y: clamp(p.y + dy * 10, 0.5, W - 0.5) };
  }

  // ---- Decisión del jugador que tiene el balón al pie ----
  function decidirConBalon(p, idx) {
    var dG = Math.hypot(L - p.x, GY - p.y);
    var presion = minRivDist(p.x, p.y);

    // 1) Tiro
    var enZona = (p.x > L - 27 && Math.abs(p.y - GY) < 22) || p.x > L - 16;
    if (enZona) {
      var kr = null;
      for (var k = 0; k < riv.length; k++) if (riv[k].n === 0) kr = riv[k];
      var ty;
      if (Math.abs(p.y - GY) > 10) ty = p.y > GY ? GY - 2.9 : GY + 2.9;
      else if (kr) ty = kr.y > GY ? GY - 2.9 : GY + 2.9;
      else ty = GY + 2.9;
      var f = clamp(0.55 + dG / 75, 0.7, 1);
      return { patear: fix({ x: L, y: ty, fuerza: f, altura: 0 }) };
    }

    // 2) Mejor pase
    var best = null;
    for (var j = 1; j < 11; j++) {
      if (j === idx) continue;
      var q = mios[j];
      var dd = dist(p, q);
      if (dd < 4 || dd > 45) continue;
      var fwd = q.x - p.x;
      var rLane = 999;
      for (var m = 0; m < riv.length; m++) {
        rLane = Math.min(rLane, segDist(riv[m].x, riv[m].y, p.x, p.y, q.x, q.y));
      }
      var rRecv = minRivDist(q.x, q.y);
      if (rRecv < 3) continue;
      var blocked = rLane < 2;
      if (blocked && dd < 12) continue;
      var score = fwd - dd * 0.1 + Math.min(rRecv, 10) * 1.5 + Math.min(rLane, 6) * 2 - (blocked ? 6 : 0);
      if (fwd < -5) score -= 10;
      if (!best || score > best.score) best = { score: score, q: q, dd: dd, fwd: fwd, blocked: blocked };
    }
    if (best && !(presion > 5 && best.fwd < 8)) {
      var lx = best.q.x + best.q.vx * 0.6, ly = best.q.y + best.q.vy * 0.6;
      lx = clamp(lx, 0.5, L - 0.5); ly = clamp(ly, 0.5, W - 0.5);
      var d2 = Math.hypot(lx - p.x, ly - p.y);
      if (best.blocked) {
        return { patear: fix({ x: lx, y: ly, fuerza: clamp(d2 / 1.44 / 28, 0.25, 1), altura: 0.6 }) };
      }
      return { patear: fix({ x: lx, y: ly, fuerza: clamp((0.62 * d2 + 7) / 28, 0.25, 1), altura: 0 }) };
    }

    // 3) Sin presión: conducir
    if (presion > 4.5) return { ir: regatear(p) };

    // 4) Presionado y sin pase: despejar
    if (p.x < 40) {
      var cy = p.y < GY ? 3 : W - 3;
      return { patear: fix({ x: Math.min(p.x + 35, L - 5), y: cy, fuerza: 1, altura: 0.4 }) };
    }
    return { patear: fix({ x: Math.min(p.x + 25, L - 5), y: GY, fuerza: 0.9, altura: 0.6 }) };
  }

  var ordenes = new Array(11);

  // ---- ARQUERO ----
  (function () {
    var k = mios[0];
    var dBG = Math.hypot(b.x, b.y - GY) || 1;
    var r = Math.min(4.5, Math.max(1.5, dBG - 1));
    var kx = Math.max(1, r * b.x / dBG);
    var ky = clamp(GY + r * (b.y - GY) / dBG, GY - 3.6, GY + 3.6);

    if (b.vx < -4 && b.x < 45) {
      var t = (b.x - 1.5) / (-b.vx);
      var yc = b.y + b.vy * t;
      if (Math.abs(yc - GY) < 7) { ky = clamp(yc, GY - 5, GY + 5); kx = 1.5; }
    }

    var inArea = b.x < C.areaX - 0.5 && Math.abs(b.y - GY) < C.areaY / 2 - 0.5;
    var bSpeed = Math.hypot(b.vx, b.vy);
    var dk = dist(k, b);
    var minR = minRivDist(b.x, b.y);
    var ir = { x: kx, y: ky };
    if (inArea && bSpeed < 9 && dk < minR + 1) ir = { x: b.x, y: b.y };

    var o = { ir: ir };
    if (inArea && dk <= 2.2 && b.z <= 2.8) {
      var cy = b.y < GY ? 6 : W - 6;
      o.patear = fix({ x: 50, y: cy, fuerza: 0.9, altura: 0.35 });
    }
    ordenes[0] = o;
  })();

  // ---- JUGADORES DE CAMPO ----
  for (i = 1; i < 11; i++) {
    var p = mios[i];
    var dBall = dist(p, b);
    var ir;

    if (chasers[i]) {
      ir = objetivoBalon(p);
    } else {
      var baseY = [34, 8, 26, 42, 60, 6, 26, 42, 62, 26, 42][i];
      var x, y;
      if (i <= 4) {
        x = clamp(b.x * 0.5 + 8 + (poss ? 6 : 0) + late, 16, 62);
        y = baseY * 0.65 + b.y * 0.35;
      } else if (i <= 8) {
        x = clamp(b.x * 0.6 + 16 + (poss ? 8 : 0) + late, 30, 82);
        y = baseY * 0.65 + b.y * 0.35;
      } else {
        x = clamp(b.x * 0.5 + 36 + (poss ? 10 : 0) + late, 50, 96);
        y = baseY * 0.65 + b.y * 0.35;
        if (poss) {
          x = clamp(Math.max(x, b.x + 5), 50, 98);
          if (b.x > 60) y = (i === 9) ? 28 : 40;
        }
      }
      ir = { x: clamp(x, 0.5, L - 0.5), y: clamp(y, 0.5, W - 0.5) };
    }

    var o = { ir: ir };
    if (dBall <= 1.3 && b.z <= 2.4) {
      var dec = decidirConBalon(p, i);
      if (dec.patear) o.patear = dec.patear;
      if (dec.ir) o.ir = dec.ir;
    }
    ordenes[i] = o;
  }

  return ordenes;
}
