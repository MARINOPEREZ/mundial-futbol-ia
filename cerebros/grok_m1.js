// Grok United - Cerebro de fútbol IA
// Variables persistentes entre llamadas
let ultimoBalon = null;
let posesion = false;
let ultimaPosesion = 0;
let formacion = "442";
let tiempoUltimoGol = 0;

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

  // Constantes útiles
  const ARCO_Y = 34;
  const ARCO_ANCHO = C.arco;
  const META_X = 105;
  const PORTERIA_X = 0;
  const VEL_JUG = C.velJugador;
  const ALCANCE = C.alcance;
  const ALTURA_ARCO = C.alturaArco;

  // Predicción simple del balón (0.3s hacia adelante)
  const predBalon = {
    x: balon.x + balon.vx * 0.3,
    y: balon.y + balon.vy * 0.3,
    z: Math.max(0, balon.z + balon.vz * 0.3 - 4.9 * 0.09)
  };

  // ¿Quién está más cerca del balón?
  let miMasCerca = -1, distMiMin = 999;
  let rivMasCerca = -1, distRivMin = 999;
  for (let i = 0; i < 11; i++) {
    const d = dist(mios[i], balon);
    if (d < distMiMin) { distMiMin = d; miMasCerca = i; }
    const dr = dist(rivales[i], balon);
    if (dr < distRivMin) { distRivMin = dr; rivMasCerca = i; }
  }

  // Detectar posesión aproximada
  if (distMiMin < distRivMin && distMiMin < 3) {
    posesion = true;
    ultimaPosesion = tiempo;
  } else if (distRivMin < distMiMin - 1) {
    posesion = false;
  }

  // Roles base 4-4-2
  // 0: GK
  // 1-4: DEF (LB, CB, CB, RB)
  // 5-8: MID (LM, CM, CM, RM)
  // 9-10: FWD (ST, ST)

  const roles = [
    "gk", "lb", "cb", "cb", "rb",
    "lm", "cm", "cm", "rm",
    "st", "st"
  ];

  // Posiciones base según formación y fase
  const basePos = calcularFormacion(estado, posesion, diff, segundosRestantes);

  // Órdenes
  const ordenes = [];

  for (let i = 0; i < 11; i++) {
    const yo = mios[i];
    const rol = roles[i];
    let ir = { x: basePos[i].x, y: basePos[i].y };
    let patear = null;

    // === ARQUERO ===
    if (i === 0) {
      ir = posicionArquero(estado, predBalon, yo);
      // Si el balón está muy cerca y bajo, intentar atrapar o despejar
      if (dist(yo, balon) < 2.5 && balon.z < 2.8) {
        if (balon.x < 18 && Math.abs(balon.y - 34) < 12) {
          // Despeje seguro o saque de puerta
          if (saque === "propio" || dist(yo, balon) < 1.5) {
            patear = despejeArquero(estado, yo);
          }
        }
      }
      ordenes.push({ ir, patear });
      continue;
    }

    // === LÓGICA GENERAL DE MOVIMIENTO ===
    // Ajustar posición base según balón y presión
    ir = ajustarPosicion(i, rol, basePos[i], estado, predBalon, posesion, diff);

    // Interceptar / presionar balón
    const distBalon = dist(yo, balon);
    const distPred = dist(yo, predBalon);

    // Si soy el más cercano o estoy muy cerca, ir al balón
    if (i === miMasCerca || distBalon < 4 || (distPred < 3.5 && balon.z < 2.2)) {
      // Anticipar un poco
      ir = {
        x: clamp(predBalon.x + balon.vx * 0.15, 2, 103),
        y: clamp(predBalon.y + balon.vy * 0.15, 2, 66)
      };
    }

    // === DECISIÓN DE PATEO ===
    if (distBalon < ALCANCE + 0.4 && balon.z < 2.5) {
      patear = decidirPateo(i, rol, estado, yo, predBalon, posesion, diff, segundosRestantes);
    }

    // Evitar amontonarse demasiado
    ir = evitarColision(i, ir, mios, 2.2);

    // Limitar a la cancha
    ir.x = clamp(ir.x, 1, 104);
    ir.y = clamp(ir.y, 1, 67);

    ordenes.push({ ir, patear });
  }

  ultimoBalon = { x: balon.x, y: balon.y, z: balon.z };
  return ordenes;
}

// ==================== FUNCIONES AUXILIARES ====================

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
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

  // Línea base X según posesión y marcador
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

  // Si vamos perdiendo al final, subir más
  if (diff < 0 && restante < 90) {
    lineaDef += 12;
    lineaMed += 15;
    lineaAtq += 10;
  }
  // Si vamos ganando al final, bajar un poco
  if (diff > 0 && restante < 60) {
    lineaDef -= 6;
    lineaMed -= 8;
    lineaAtq -= 10;
  }

  // GK
  pos[0] = { x: 6, y: 34 };

  // DEF 1-4 (LB, CB, CB, RB)
  pos[1] = { x: lineaDef, y: 12 };
  pos[2] = { x: lineaDef - 2, y: 26 };
  pos[3] = { x: lineaDef - 2, y: 42 };
  pos[4] = { x: lineaDef, y: 56 };

  // MID 5-8 (LM, CM, CM, RM)
  pos[5] = { x: lineaMed, y: 10 };
  pos[6] = { x: lineaMed - 4, y: 26 };
  pos[7] = { x: lineaMed - 4, y: 42 };
  pos[8] = { x: lineaMed, y: 58 };

  // FWD 9-10
  pos[9] = { x: lineaAtq, y: 26 };
  pos[10] = { x: lineaAtq, y: 42 };

  // Ajustar un poco según posición del balón en Y
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

  // Seguir el balón en Y pero con límites
  y = clamp(balon.y * 0.55 + 34 * 0.45, 18, 50);

  // Si el balón está cerca o viene fuerte, salir
  if (balon.x < 25 && Math.abs(balon.y - 34) < 18) {
    x = clamp(balon.x - 3, 2, 14);
    y = clamp(balon.y, 16, 52);
  }

  // Anticipar
  if (balon.vx < -2 && balon.x < 40) {
    x = clamp(pred.x - 4, 2, 16);
    y = clamp(pred.y, 14, 54);
  }

  return { x, y };
}

function despejeArquero(estado, yo) {
  const balon = estado.balon;
  // Preferir despeje largo hacia un costado o al centro-adelante
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

  // Si no tenemos posesión, los mediocampistas y delanteros presionan más
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
    // Con posesión, abrir el campo
    if (rol === "lm") y = clamp(y - 4, 4, 30);
    if (rol === "rm") y = clamp(y + 4, 38, 64);
    if (rol === "st") {
      x = clamp(Math.max(x, balon.x + 6), 55, 98);
    }
  }

  // Defensa: mantener línea y cubrir
  if (rol === "cb" || rol === "lb" || rol === "rb") {
    // No subir demasiado si el balón está atrás
    if (balon.x < 40) {
      x = Math.min(x, balon.x + 12);
    }
  }

  return { x, y };
}

function decidirPateo(i, rol, estado, yo, pred, posesion, diff, restante) {
  const balon = estado.balon;
  const mios = estado.mios;
  const rivales = estado.rivales;
  const C = estado.cancha;

  // Distancia al arco rival
  const distArco = META_X - balon.x;
  const anguloArco = Math.abs(balon.y - 34);

  // 1. Disparo a puerta si estamos en zona de peligro
  if (balon.x > 72 && anguloArco < 22 && balon.z < 1.8) {
    const fuerza = balon.x > 88 ? 0.92 : (balon.x > 80 ? 0.82 : 0.72);
    const altura = balon.x > 90 && anguloArco < 10 ? 0.15 : 0.08;
    // Apuntar un poco al fondo del arco o a un ángulo
    const targetY = 34 + (balon.y < 34 ? -2.8 : 2.8) * (0.6 + Math.random() * 0.5);
    return {
      x: 105.5,
      y: clamp(targetY, 30.5, 37.5),
      fuerza: clamp(fuerza + (Math.random() - 0.5) * 0.08, 0.65, 1),
      altura: altura
    };
  }

  // 2. Si estamos muy cerca (área chica) → remate potente
  if (balon.x > 92 && Math.abs(balon.y - 34) < 12) {
    return {
      x: 105.8,
      y: 34 + (Math.random() - 0.5) * 4,
      fuerza: 0.95,
      altura: 0.12
    };
  }

  // 3. Pase a un compañero mejor ubicado
  let mejorPase = null;
  let mejorScore = -999;

  for (let j = 0; j < 11; j++) {
    if (j === i) continue;
    const comp = mios[j];
    const d = dist(yo, comp);
    if (d < 6 || d > 38) continue;

    // ¿Está más adelantado y libre?
    const avance = comp.x - yo.x;
    if (avance < -5) continue;

    // Contar rivales cerca del receptor
    let rivCerca = 0;
    for (const r of rivales) {
      if (dist(r, comp) < 5) rivCerca++;
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
    // Anticipar un poco el movimiento del compañero
    const targetX = mejorPase.x + (mejorPase.vx || 0) * 0.4 + dx * 0.15;
    const targetY = mejorPase.y + (mejorPase.vy || 0) * 0.4;
    const fuerza = clamp(0.35 + distPase / 55, 0.3, 0.78);
    const altura = distPase > 22 ? 0.35 : 0.08;
    return {
      x: clamp(targetX, 5, 102),
      y: clamp(targetY, 3, 65),
      fuerza,
      altura
    };
  }

  // 4. Centro desde banda
  if ((balon.y < 14 || balon.y > 54) && balon.x > 60) {
    return {
      x: 96 + Math.random() * 6,
      y: 34 + (balon.y < 34 ? 6 : -6),
      fuerza: 0.72,
      altura: 0.55 + Math.random() * 0.2
    };
  }

  // 5. Avance / conducción hacia adelante si no hay nada mejor
  if (balon.x < 85) {
    // Empujar hacia el arco con un pase largo o avance
    const targetY = clamp(34 + (balon.y - 34) * 0.4 + (Math.random() - 0.5) * 10, 12, 56);
    return {
      x: clamp(balon.x + 18 + Math.random() * 12, 40, 100),
      y: targetY,
      fuerza: 0.55 + Math.random() * 0.2,
      altura: 0.25
    };
  }

  // 6. Último recurso: disparo lejano si no hay opciones
  if (balon.x > 65 && Math.abs(balon.y - 34) < 25) {
    return {
      x: 105,
      y: 34 + (Math.random() - 0.5) * 5,
      fuerza: 0.78,
      altura: 0.2
    };
  }

  // Mantener posesión (toque corto hacia adelante)
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
    const d = dist({ x, y }, mios[j]);
    if (d < minDist) {
      const ang = angulo(mios[j], { x, y });
      x += Math.cos(ang) * (minDist - d) * 0.7;
      y += Math.sin(ang) * (minDist - d) * 0.7;
    }
  }
  return { x, y };
}