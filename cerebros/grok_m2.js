// Grok United - Cerebro de fútbol IA
// Variables persistentes entre llamadas
let ultimoBalon = null;
let posesion = false;
let ultimaPosesion = 0;

function decidir(estado) {
  const C = estado.cancha;
  const balon = estado.balon;
  const mios = estado.mios;
  const rivales = estado.rivales;
  const saque = estado.saque;
  const tiempo = estado.tiempo;
  const duracion = estado.duracion || 360;
  const mitad = estado.mitad || 1;
  const marcador = estado.marcador || { propio: 0, rival: 0 };
  const diff = marcador.propio - marcador.rival;
  const segundosRestantes = (mitad === 3 ? 480 : duracion) - tiempo;

  const ARCO_Y = 34;
  const META_X = 105;
  const ALCANCE = C.alcance;

  // Predicción simple del balón
  const predBalon = {
    x: balon.x + balon.vx * 0.3,
    y: balon.y + balon.vy * 0.3,
    z: Math.max(0, balon.z + balon.vz * 0.3 - 4.9 * 0.09)
  };

  // Quién está más cerca del balón
  let miMasCerca = 0;
  let distMiMin = 999;
  let rivMasCerca = 0;
  let distRivMin = 999;
  for (let i = 0; i < 11; i++) {
    const d = dist(mios[i], balon);
    if (d < distMiMin) {
      distMiMin = d;
      miMasCerca = i;
    }
    const dr = dist(rivales[i], balon);
    if (dr < distRivMin) {
      distRivMin = dr;
      rivMasCerca = i;
    }
  }

  // Detectar posesión aproximada
  if (distMiMin < distRivMin && distMiMin < 3) {
    posesion = true;
    ultimaPosesion = tiempo;
  } else if (distRivMin < distMiMin - 1) {
    posesion = false;
  }

  // Roles 4-4-2
  const roles = ["gk", "lb", "cb", "cb", "rb", "lm", "cm", "cm", "rm", "st", "st"];

  // Posiciones base
  const basePos = calcularFormacion(estado, posesion, diff, segundosRestantes);

  const ordenes = [];

  for (let i = 0; i < 11; i++) {
    const yo = mios[i];
    const rol = roles[i];
    let ir = { x: basePos[i].x, y: basePos[i].y };
    let patear = null;

    // === ARQUERO ===
    if (i === 0) {
      ir = posicionArquero(estado, predBalon, yo);
      if (dist(yo, balon) < 2.5 && balon.z < 2.8) {
        if (balon.x < 18 && Math.abs(balon.y - 34) < 12) {
          if (saque === "propio" || dist(yo, balon) < 1.5) {
            patear = despejeArquero(estado, yo);
          }
        }
      }
      ordenes.push({ ir: ir, patear: patear });
      continue;
    }

    // Ajustar posición
    ir = ajustarPosicion(i, rol, basePos[i], estado, predBalon, posesion, diff);

    // Ir al balón si soy el más cercano o estoy cerca
    const distBalon = dist(yo, balon);
    const distPred = dist(yo, predBalon);
    if (i === miMasCerca || distBalon < 4 || (distPred < 3.5 && balon.z < 2.2)) {
      ir = {
        x: clamp(predBalon.x + balon.vx * 0.15, 2, 103),
        y: clamp(predBalon.y + balon.vy * 0.15, 2, 66)
      };
    }

    // Decidir pateo
    if (distBalon < ALCANCE + 0.4 && balon.z < 2.5) {
      patear = decidirPateo(i, rol, estado, yo, predBalon, posesion, diff, segundosRestantes);
    }

    // Evitar colisiones
    ir = evitarColision(i, ir, mios, 2.2);

    // Limitar a la cancha
    ir.x = clamp(ir.x, 1, 104);
    ir.y = clamp(ir.y, 1, 67);

    ordenes.push({ ir: ir, patear: patear });
  }

  ultimoBalon = { x: balon.x, y: balon.y, z: balon.z };
  return ordenes;
}

function dist(a, b) {
  return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function angulo(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function calcularFormacion(estado, posesion, diff, restante) {
  const balon = estado.balon;
  const pos = [];

  let lineaDef = 22;
  let lineaMed = 48;
  let lineaAtq = 78;

  if (posesion) {
    lineaDef = 32;
    lineaMed = 58;
    lineaAtq = 88;
  } else {
    lineaDef = 16;
    lineaMed = 38;
    lineaAtq = 62;
  }

  if (diff < 0 && restante < 90) {
    lineaDef += 12;
    lineaMed += 15;
    lineaAtq += 10;
  }
  if (diff > 0 && restante < 60) {
    lineaDef -= 6;
    lineaMed -= 8;
    lineaAtq -= 10;
  }

  pos[0] = { x: 6, y: 34 };
  pos[1] = { x: lineaDef, y: 12 };
  pos[2] = { x: lineaDef - 2, y: 26 };
  pos[3] = { x: lineaDef - 2, y: 42 };
  pos[4] = { x: lineaDef, y: 56 };
  pos[5] = { x: lineaMed, y: 10 };
  pos[6] = { x: lineaMed - 4, y: 26 };
  pos[7] = { x: lineaMed - 4, y: 42 };
  pos[8] = { x: lineaMed, y: 58 };
  pos[9] = { x: lineaAtq, y: 26 };
  pos[10] = { x: lineaAtq, y: 42 };

  const offsetY = (balon.y - 34) * 0.18;
  for (let i = 1; i < 11; i++) {
    pos[i].y = clamp(pos[i].y + offsetY, 4, 64);
  }

  return pos;
}

function posicionArquero(estado, pred, yo) {
  const balon = estado.balon;
  let x = 5;
  let y = 34;

  y = clamp(balon.y * 0.55 + 34 * 0.45, 18, 50);

  if (balon.x < 25 && Math.abs(balon.y - 34) < 18) {
    x = clamp(balon.x - 3, 2, 14);
    y = clamp(balon.y, 16, 52);
  }

  if (balon.vx < -2 && balon.x < 40) {
    x = clamp(pred.x - 4, 2, 16);
    y = clamp(pred.y, 14, 54);
  }

  return { x: x, y: y };
}

function despejeArquero(estado, yo) {
  const balon = estado.balon;
  const lado = balon.y < 34 ? 1 : -1;
  return {
    x: 55 + Math.random() * 25,
    y: 34 + lado * (18 + Math.random() * 15),
    fuerza: 0.85 + Math.random() * 0.12,
    altura: 0.55 + Math.random() * 0.25
  };
}

function ajustarPosicion(i, rol, base, estado, pred, posesion, diff) {
  const balon = estado.balon;
  let x = base.x;
  let y = base.y;

  if (!posesion) {
    if (rol === "cm" || rol === "lm" || rol === "rm") {
      x = clamp(balon.x - 8 + (i % 3) * 3, 12, 70);
      y = clamp(balon.y + (i % 2 === 0 ? -6 : 6), 6, 62);
    }
    if (rol === "st") {
      x = clamp(balon.x - 4, 25, 85);
      y = clamp(balon.y + (i === 9 ? -8 : 8), 10, 58);
    }
  } else {
    if (rol === "lm") y = clamp(y - 4, 4, 30);
    if (rol === "rm") y = clamp(y + 4, 38, 64);
    if (rol === "st") {
      x = clamp(Math.max(x, balon.x + 6), 55, 98);
    }
  }

  if (rol === "cb" || rol === "lb" || rol === "rb") {
    if (balon.x < 40) {
      x = Math.min(x, balon.x + 12);
    }
  }

  return { x: x, y: y };
}

function decidirPateo(i, rol, estado, yo, pred, posesion, diff, restante) {
  const balon = estado.balon;
  const mios = estado.mios;
  const rivales = estado.rivales;

  const anguloArco = Math.abs(balon.y - 34);

  // Disparo a puerta en zona de peligro
  if (balon.x > 72 && anguloArco < 22 && balon.z < 1.8) {
    const fuerza = balon.x > 88 ? 0.92 : (balon.x > 80 ? 0.82 : 0.72);
    const altura = balon.x > 90 && anguloArco < 10 ? 0.15 : 0.08;
    const targetY = 34 + (balon.y < 34 ? -2.8 : 2.8) * (0.6 + Math.random() * 0.5);
    return {
      x: 105.5,
      y: clamp(targetY, 30.5, 37.5),
      fuerza: clamp(fuerza + (Math.random() - 0.5) * 0.08, 0.65, 1),
      altura: altura
    };
  }

  // Remate desde muy cerca
  if (balon.x > 92 && Math.abs(balon.y - 34) < 12) {
    return {
      x: 105.8,
      y: 34 + (Math.random() - 0.5) * 4,
      fuerza: 0.95,
      altura: 0.12
    };
  }

  // Buscar el mejor pase
  let mejorPase = null;
  let mejorScore = -999;

  for (let j = 0; j < 11; j++) {
    if (j === i) continue;
    const comp = mios[j];
    const d = dist(yo, comp);
    if (d < 6 || d > 38) continue;

    const avance = comp.x - yo.x;
    if (avance < -5) continue;

    let rivCerca = 0;
    for (let k = 0; k < 11; k++) {
      if (dist(rivales[k], comp) < 5) rivCerca++;
    }

    const score = avance * 1.4 - rivCerca * 6 - d * 0.15 + (comp.x > 70 ? 8 : 0);
    if (score > mejorScore) {
      mejorScore = score;
      mejorPase = comp;
    }
  }

  if (mejorPase && mejorScore > 4) {
    const dx = mejorPase.x - yo.x;
    const dy = mejorPase.y - yo.y;
    const distPase = Math.sqrt(dx * dx + dy * dy);
    const targetX = mejorPase.x + (mejorPase.vx || 0) * 0.4 + dx * 0.15;
    const targetY = mejorPase.y + (mejorPase.vy || 0) * 0.4;
    const fuerza = clamp(0.35 + distPase / 55, 0.3, 0.78);
    const altura = distPase > 22 ? 0.35 : 0.08;
    return {
      x: clamp(targetX, 5, 102),
      y: clamp(targetY, 3, 65),
      fuerza: fuerza,
      altura: altura
    };
  }

  // Centro desde banda
  if ((balon.y < 14 || balon.y > 54) && balon.x > 60) {
    return {
      x: 96 + Math.random() * 6,
      y: 34 + (balon.y < 34 ? 6 : -6),
      fuerza: 0.72,
      altura: 0.55 + Math.random() * 0.2
    };
  }

  // Avance hacia adelante
  if (balon.x < 85) {
    const targetY = clamp(34 + (balon.y - 34) * 0.4 + (Math.random() - 0.5) * 10, 12, 56);
    return {
      x: clamp(balon.x + 18 + Math.random() * 12, 40, 100),
      y: targetY,
      fuerza: 0.55 + Math.random() * 0.2,
      altura: 0.25
    };
  }

  // Disparo lejano de último recurso
  if (balon.x > 65 && Math.abs(balon.y - 34) < 25) {
    return {
      x: 105,
      y: 34 + (Math.random() - 0.5) * 5,
      fuerza: 0.78,
      altura: 0.2
    };
  }

  // Toque corto para mantener posesión
  return {
    x: clamp(yo.x + 8, 10, 100),
    y: clamp(yo.y + (Math.random() - 0.5) * 6, 5, 63),
    fuerza: 0.28,
    altura: 0.05
  };
}

function evitarColision(i, ir, mios, minDist) {
  let x = ir.x;
  let y = ir.y;
  for (let j = 0; j < 11; j++) {
    if (j === i) continue;
    const d = dist({ x: x, y: y }, mios[j]);
    if (d < minDist) {
      const ang = angulo(mios[j], { x: x, y: y });
      x += Math.cos(ang) * (minDist - d) * 0.7;
      y += Math.sin(ang) * (minDist - d) * 0.7;
    }
  }
  return { x: x, y: y };
}