// Grok United - Cerebro v2 (Revancha)
// Variables persistentes
let ultimoBalon = null;
let posesion = false;
let ultimaPosesion = 0;
let ultimoGolTime = -999;
let modoAtaque = 0; // 0 normal, 1 urgente, -1 cerrar

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

  // Predicción del balón más agresiva
  const predBalon = {
    x: balon.x + balon.vx * 0.45,
    y: balon.y + balon.vy * 0.45,
    z: Math.max(0, balon.z + balon.vz * 0.4 - 4.9 * 0.16)
  };

  // Quién está más cerca
  let miMasCerca = 0, distMiMin = 999;
  let rivMasCerca = 0, distRivMin = 999;
  for (let i = 0; i < 11; i++) {
    const d = dist(mios[i], balon);
    if (d < distMiMin) { distMiMin = d; miMasCerca = i; }
    const dr = dist(rivales[i], balon);
    if (dr < distRivMin) { distRivMin = dr; rivMasCerca = i; }
  }

  // Posesión más estable
  if (distMiMin < distRivMin - 0.6 && distMiMin < 3.8) {
    posesion = true;
    ultimaPosesion = tiempo;
  } else if (distRivMin < distMiMin - 1.2) {
    posesion = false;
  } else if (tiempo - ultimaPosesion > 2.5) {
    posesion = distMiMin < distRivMin;
  }

  // Modo según marcador y tiempo
  if (diff < 0 && segundosRestantes < 100) modoAtaque = 1;
  else if (diff > 1 && segundosRestantes < 70) modoAtaque = -1;
  else if (diff < -1) modoAtaque = 1;
  else modoAtaque = 0;

  const roles = ["gk", "lb", "cb", "cb", "rb", "lm", "cm", "cm", "rm", "st", "st"];
  const basePos = calcularFormacion(estado, posesion, diff, segundosRestantes, modoAtaque);

  const ordenes = [];

  for (let i = 0; i < 11; i++) {
    const yo = mios[i];
    const rol = roles[i];
    let ir = { x: basePos[i].x, y: basePos[i].y };
    let patear = null;

    // === ARQUERO ===
    if (i === 0) {
      ir = posicionArquero(estado, predBalon, yo);
      if (dist(yo, balon) < 2.8 && balon.z < 2.9) {
        if (balon.x < 20 && Math.abs(balon.y - 34) < 14) {
          if (saque === "propio" || dist(yo, balon) < 1.7 || balon.z > 1.2) {
            patear = despejeArquero(estado, yo, mios);
          }
        }
      }
      // Si el arquero tiene el balón controlado, repartir
      if (dist(yo, balon) < 1.4 && balon.z < 1.1 && saque !== "rival") {
        patear = despejeArquero(estado, yo, mios);
      }
      ordenes.push({ ir: ir, patear: patear });
      continue;
    }

    // Ajuste de posición según rol y posesión
    ir = ajustarPosicion(i, rol, basePos[i], estado, predBalon, posesion, diff, modoAtaque);

    // Ir al balón: el más cercano + apoyo cercano + anticipación
    const distBalon = dist(yo, balon);
    const distPred = dist(yo, predBalon);
    const soyCazador = (i === miMasCerca) ||
                       (distBalon < 5.5) ||
                       (distPred < 4.2 && balon.z < 2.4) ||
                       (!posesion && distBalon < 9 && rol !== "st" && distMiMin > 3.5);

    if (soyCazador) {
      // Anticipar mejor la trayectoria
      const lead = Math.min(0.55, 0.25 + distBalon * 0.018);
      ir = {
        x: clamp(predBalon.x + balon.vx * lead, 1.5, 103.5),
        y: clamp(predBalon.y + balon.vy * lead, 1.5, 66.5)
      };
    }

    // Pressing agresivo cuando no hay posesión
    if (!posesion && distBalon < 14 && rol !== "gk") {
      const pressFactor = (rol === "cm" || rol === "lm" || rol === "rm") ? 0.85 : 0.55;
      ir.x = ir.x * (1 - pressFactor) + predBalon.x * pressFactor;
      ir.y = ir.y * (1 - pressFactor) + predBalon.y * pressFactor;
    }

    // Decidir pateo
    if (distBalon < ALCANCE + 0.55 && balon.z < 2.6) {
      patear = decidirPateo(i, rol, estado, yo, predBalon, posesion, diff, segundosRestantes, modoAtaque);
    }

    // Evitar colisiones propias
    ir = evitarColision(i, ir, mios, 2.35);

    // Mantener dentro de la cancha
    ir.x = clamp(ir.x, 1, 104);
    ir.y = clamp(ir.y, 1, 67);

    ordenes.push({ ir: ir, patear: patear });
  }

  ultimoBalon = { x: balon.x, y: balon.y, z: balon.z, vx: balon.vx, vy: balon.vy };
  return ordenes;
}

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function angulo(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function calcularFormacion(estado, posesion, diff, restante, modo) {
  const balon = estado.balon;
  const pos = [];

  let lineaDef = 20;
  let lineaMed = 46;
  let lineaAtq = 76;

  if (posesion) {
    lineaDef = 34;
    lineaMed = 60;
    lineaAtq = 89;
  } else {
    lineaDef = 14;
    lineaMed = 34;
    lineaAtq = 58;
  }

  // Ajustes por marcador
  if (modo === 1) { // necesitamos gol
    lineaDef += 10;
    lineaMed += 14;
    lineaAtq += 9;
  } else if (modo === -1) { // cerrar
    lineaDef -= 7;
    lineaMed -= 9;
    lineaAtq -= 12;
  }

  // Compactar cuando el rival tiene el balón cerca
  if (!posesion && balon.x < 45) {
    lineaDef = Math.min(lineaDef, balon.x + 9);
    lineaMed = Math.min(lineaMed, balon.x + 22);
  }

  pos[0] = { x: 5.5, y: 34 };
  pos[1] = { x: lineaDef, y: 11 };
  pos[2] = { x: lineaDef - 1.5, y: 25 };
  pos[3] = { x: lineaDef - 1.5, y: 43 };
  pos[4] = { x: lineaDef, y: 57 };
  pos[5] = { x: lineaMed, y: 9 };
  pos[6] = { x: lineaMed - 3, y: 25 };
  pos[7] = { x: lineaMed - 3, y: 43 };
  pos[8] = { x: lineaMed, y: 59 };
  pos[9] = { x: lineaAtq, y: 24 };
  pos[10] = { x: lineaAtq, y: 44 };

  // Seguir el balón en Y con suavidad
  const offsetY = (balon.y - 34) * (posesion ? 0.22 : 0.28);
  for (let i = 1; i < 11; i++) {
    pos[i].y = clamp(pos[i].y + offsetY, 3.5, 64.5);
  }

  // Los delanteros se abren un poco más
  if (posesion) {
    pos[9].y = clamp(pos[9].y - 3, 8, 30);
    pos[10].y = clamp(pos[10].y + 3, 38, 60);
  }

  return pos;
}

function posicionArquero(estado, pred, yo) {
  const balon = estado.balon;
  let x = 4.8;
  let y = 34;

  // Seguir el balón pero quedarse centrado
  y = clamp(balon.y * 0.62 + 34 * 0.38, 16, 52);

  if (balon.x < 28 && Math.abs(balon.y - 34) < 20) {
    x = clamp(balon.x - 4.5, 1.8, 13);
    y = clamp(balon.y * 0.75 + 34 * 0.25, 14, 54);
  }

  // Anticipar tiros
  if (balon.vx < -3 && balon.x < 45) {
    x = clamp(pred.x - 5, 1.5, 14);
    y = clamp(pred.y, 13, 55);
  }

  // Salir a cortar centros
  if (balon.x < 22 && balon.z > 1.4 && Math.abs(balon.y - 34) < 16) {
    x = clamp(balon.x - 1.5, 2, 12);
    y = clamp(balon.y, 15, 53);
  }

  return { x, y };
}

function despejeArquero(estado, yo, mios) {
  const balon = estado.balon;
  // Preferir sacar a los laterales o mediocampistas libres
  let mejor = null;
  let mejorScore = -999;
  for (let j = 1; j < 9; j++) {
    const comp = mios[j];
    if (comp.x < yo.x + 8) continue;
    let rivCerca = 0;
    for (let k = 0; k < 11; k++) {
      if (dist(estado.rivales[k], comp) < 6) rivCerca++;
    }
    const score = (comp.x - yo.x) * 1.1 - rivCerca * 7 + (Math.abs(comp.y - 34) > 12 ? 4 : 0);
    if (score > mejorScore) {
      mejorScore = score;
      mejor = comp;
    }
  }

  if (mejor && mejorScore > 5) {
    return {
      x: clamp(mejor.x + 4, 25, 85),
      y: clamp(mejor.y + (Math.random() - 0.5) * 4, 6, 62),
      fuerza: 0.62 + Math.random() * 0.15,
      altura: 0.35 + Math.random() * 0.2
    };
  }

  // Despeje largo hacia banda
  const lado = balon.y < 34 ? 1 : -1;
  return {
    x: 58 + Math.random() * 22,
    y: 34 + lado * (20 + Math.random() * 12),
    fuerza: 0.82 + Math.random() * 0.12,
    altura: 0.5 + Math.random() * 0.25
  };
}

function ajustarPosicion(i, rol, base, estado, pred, posesion, diff, modo) {
  const balon = estado.balon;
  let x = base.x;
  let y = base.y;

  if (!posesion) {
    // Compactar y presionar
    if (rol === "cm" || rol === "lm" || rol === "rm") {
      x = clamp(balon.x - 7 + (i % 3) * 2.5, 10, 68);
      y = clamp(balon.y + ((i % 2 === 0) ? -7 : 7), 5, 63);
    }
    if (rol === "st") {
      // Delanteros quedan listos para contra
      x = clamp(Math.max(balon.x - 6, 35), 30, 82);
      y = clamp(balon.y + (i === 9 ? -9 : 9), 9, 59);
    }
    if (rol === "cb" || rol === "lb" || rol === "rb") {
      if (balon.x < 48) {
        x = Math.min(x, balon.x + 11);
      }
    }
  } else {
    // Con posesión: amplitud y profundidad
    if (rol === "lm") {
      y = clamp(y - 5, 3, 28);
      x = clamp(Math.max(x, balon.x - 4), 30, 92);
    }
    if (rol === "rm") {
      y = clamp(y + 5, 40, 65);
      x = clamp(Math.max(x, balon.x - 4), 30, 92);
    }
    if (rol === "st") {
      x = clamp(Math.max(x, balon.x + 8), 58, 99);
      // Uno se queda más centrado, el otro se abre
      if (i === 9) y = clamp(y - 4, 10, 32);
      else y = clamp(y + 4, 36, 58);
    }
    if (rol === "cm") {
      x = clamp(balon.x - 6 + (i === 6 ? -3 : 3), 28, 78);
    }
  }

  // Modo urgente: todos empujan
  if (modo === 1 && rol !== "gk") {
    x = clamp(x + 8, 15, 100);
  }

  return { x, y };
}

function decidirPateo(i, rol, estado, yo, pred, posesion, diff, restante, modo) {
  const balon = estado.balon;
  const mios = estado.mios;
  const rivales = estado.rivales;
  const anguloArco = Math.abs(balon.y - 34);

  // === DISPARO A PUERTA ===
  // Zona de peligro clara
  if (balon.x > 74 && anguloArco < 20 && balon.z < 1.9) {
    const cerca = balon.x > 90;
    const fuerza = cerca ? 0.93 : (balon.x > 82 ? 0.84 : 0.73);
    // Apuntar a los lados del arquero rival (estimamos que está cerca del centro)
    const lado = (balon.y < 34) ? -1 : 1;
    const targetY = 34 + lado * (3.1 + Math.random() * 1.8);
    return {
      x: 105.6,
      y: clamp(targetY, 30.2, 37.8),
      fuerza: clamp(fuerza + (Math.random() - 0.5) * 0.06, 0.68, 0.98),
      altura: (cerca && anguloArco < 9) ? 0.11 : 0.06
    };
  }

  // Remate muy cercano
  if (balon.x > 93 && Math.abs(balon.y - 34) < 11) {
    return {
      x: 105.9,
      y: 34 + (Math.random() - 0.5) * 3.5,
      fuerza: 0.96,
      altura: 0.09
    };
  }

  // === PASE INTELIGENTE ===
  let mejorPase = null;
  let mejorScore = -999;

  for (let j = 0; j < 11; j++) {
    if (j === i) continue;
    const comp = mios[j];
    const d = dist(yo, comp);
    if (d < 5.5 || d > 36) continue;

    const avance = comp.x - yo.x;
    // Preferimos avance, pero permitimos pases laterales de seguridad
    if (avance < -8 && rol !== "st") continue;

    let rivCerca = 0;
    let rivMuyCerca = 0;
    for (let k = 0; k < 11; k++) {
      const dr = dist(rivales[k], comp);
      if (dr < 4.2) rivMuyCerca++;
      if (dr < 6.5) rivCerca++;
    }

    // Espacio libre delante del compañero
    let espacio = 0;
    for (let k = 0; k < 11; k++) {
      if (rivales[k].x > comp.x && rivales[k].x < comp.x + 12 && Math.abs(rivales[k].y - comp.y) < 7) {
        espacio -= 3;
      }
    }

    let score = avance * 1.65 - rivCerca * 5.5 - rivMuyCerca * 9 - d * 0.12 + espacio;
    if (comp.x > 75) score += 10;
    if (comp.x > 88) score += 6;
    if (rol === "st" && avance > 5) score += 4; // delanteros buscan profundidad
    if (rivMuyCerca === 0 && avance > 3) score += 5;

    if (score > mejorScore) {
      mejorScore = score;
      mejorPase = comp;
    }
  }

  if (mejorPase && mejorScore > 3.5) {
    const dx = mejorPase.x - yo.x;
    const dy = mejorPase.y - yo.y;
    const distPase = Math.sqrt(dx * dx + dy * dy);
    // Anticipar movimiento del compañero
    const lead = 0.35 + Math.min(0.25, distPase * 0.008);
    const targetX = mejorPase.x + (mejorPase.vx || 0) * lead + dx * 0.12;
    const targetY = mejorPase.y + (mejorPase.vy || 0) * lead;
    const fuerza = clamp(0.32 + distPase / 52, 0.28, 0.76);
    const altura = distPase > 20 ? 0.28 : (distPase > 12 ? 0.12 : 0.04);
    return {
      x: clamp(targetX, 4, 103),
      y: clamp(targetY, 2.5, 65.5),
      fuerza: fuerza,
      altura: altura
    };
  }

  // === CENTRO DESDE BANDA ===
  if ((balon.y < 13 || balon.y > 55) && balon.x > 62) {
    // Buscar delanteros dentro del área
    let targetY = 34;
    for (let j = 9; j <= 10; j++) {
      if (mios[j].x > 80) {
        targetY = mios[j].y;
        break;
      }
    }
    return {
      x: 94 + Math.random() * 7,
      y: clamp(targetY + (Math.random() - 0.5) * 5, 26, 42),
      fuerza: 0.68 + Math.random() * 0.12,
      altura: 0.52 + Math.random() * 0.22
    };
  }

  // === PROGRESIÓN SEGURA ===
  if (balon.x < 88) {
    // Preferir mantener posesión con toques cortos si hay presión
    let rivCercaMia = 0;
    for (let k = 0; k < 11; k++) {
      if (dist(rivales[k], yo) < 4.5) rivCercaMia++;
    }

    if (rivCercaMia >= 2 || (rol === "cb" || rol === "lb" || rol === "rb")) {
      // Salida segura
      const lado = yo.y < 34 ? 1 : -1;
      return {
        x: clamp(yo.x + 11 + Math.random() * 8, 20, 95),
        y: clamp(yo.y + lado * (8 + Math.random() * 10), 6, 62),
        fuerza: 0.42 + Math.random() * 0.18,
        altura: 0.18
      };
    }

    // Avance normal
    const targetY = clamp(34 + (balon.y - 34) * 0.35 + (Math.random() - 0.5) * 9, 10, 58);
    return {
      x: clamp(balon.x + 16 + Math.random() * 11, 35, 100),
      y: targetY,
      fuerza: 0.52 + Math.random() * 0.18,
      altura: 0.2
    };
  }

  // Disparo lejano solo si no hay mejor opción y estamos bien ubicados
  if (balon.x > 68 && anguloArco < 22 && modo === 1) {
    return {
      x: 105.2,
      y: 34 + (Math.random() - 0.5) * 4.5,
      fuerza: 0.8,
      altura: 0.18
    };
  }

  // Toque de seguridad (mantener posesión)
  return {
    x: clamp(yo.x + 7 + Math.random() * 4, 12, 98),
    y: clamp(yo.y + (Math.random() - 0.5) * 7, 4, 64),
    fuerza: 0.26,
    altura: 0.04
  };
}

function evitarColision(i, ir, mios, minDist) {
  let x = ir.x;
  let y = ir.y;
  for (let j = 0; j < 11; j++) {
    if (j === i) continue;
    const d = dist({ x, y }, mios[j]);
    if (d < minDist) {
      const ang = angulo(mios[j], { x, y });
      const push = (minDist - d) * 0.75;
      x += Math.cos(ang) * push;
      y += Math.sin(ang) * push;
    }
  }
  return { x, y };
}
