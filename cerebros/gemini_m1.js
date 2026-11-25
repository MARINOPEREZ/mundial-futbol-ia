let _memoria = {
  posesionPrevia: null,
  ultimoToque: null
};

function decidir(estado) {
  const c = estado.cancha || {};
  const largo = c.largo || 105;
  const ancho = c.ancho || 68;
  const arcoAncho = c.arco || 7.32;
  const areaX = c.areaX || 16.5;
  const alcance = c.alcance || 1.3;
  const centroY = ancho / 2;
  const mitadArco = arcoAncho / 2;

  const balon = estado.balon;
  const mios = estado.mios || [];
  const rivales = estado.rivales || [];
  const saque = estado.saque;

  const bx = balon.x;
  const by = balon.y;
  const bz = balon.z || 0;
  const bvx = balon.vx || 0;
  const bvy = balon.vy || 0;

  const dtPred = Math.min(0.45, Math.hypot(bvx, bvy) * 0.015);
  const pxBalon = clamp(bx + bvx * dtPred, 0, largo);
  const pyBalon = clamp(by + bvy * dtPred, 0, ancho);

  const vanPerdiendo = estado.marcador.propio < estado.marcador.rival;
  const rectaFinal = estado.mitad === 3 || (estado.duracion - estado.tiempo) < 45;
  const empujonFinal = vanPerdiendo && rectaFinal;

  // Base 4-4-2 en coordenadas propias (0..105 ataque, 0..68 ancho)
  const basePos = [
    { x: 4.5,  y: centroY }, // 0: Arquero
    { x: 24.0, y: 14.0 },    // 1: Lateral izq
    { x: 20.0, y: 27.0 },    // 2: Central izq
    { x: 20.0, y: 41.0 },    // 3: Central der
    { x: 24.0, y: 54.0 },    // 4: Lateral der
    { x: 52.0, y: 12.0 },    // 5: Volante izq
    { x: 48.0, y: 27.0 },    // 6: Mediocentro izq
    { x: 48.0, y: 41.0 },    // 7: Mediocentro der
    { x: 52.0, y: 56.0 },    // 8: Volante der
    { x: 78.0, y: 25.0 },    // 9: Delantero izq
    { x: 78.0, y: 43.0 }     // 10: Delantero der
  ];

  // Desplazar formación según dónde está el balón
  const shiftX = clamp((pxBalon - largo * 0.5) * 0.42, -16, 22) + (empujonFinal ? 8 : 0);
  const shiftY = clamp((pyBalon - centroY) * 0.25, -10, 10);

  // Elegir al mejor jugador de campo (1..10) para ir por el balón
  let mejorPresionador = -1;
  let mejorPuntaje = Infinity;

  for (let i = 1; i < mios.length; i++) {
    const j = mios[i];
    if (!j) continue;
    const dist = Math.hypot(pxBalon - j.x, pyBalon - j.y);
    const penalizacionAtras = j.x < 12 && bx > 25 ? 18 : 0;
    const puntaje = dist + penalizacionAtras;
    if (puntaje < mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejorPresionador = i;
    }
  }

  const ordenes = [];

  for (let i = 0; i < mios.length; i++) {
    const j = mios[i];
    const base = basePos[i] || { x: 50, y: centroY };

    let targetX = clamp(base.x + shiftX, i === 0 ? 1.5 : 8, largo - 3);
    let targetY = clamp(base.y + shiftY, 4, ancho - 4);

    if (i === 0) {
      // Arquero: cubrir ángulo del arco o salir a cortar balones sueltos en área
      const distArco = Math.hypot(bx, by - centroY);
      const balonVieneAlArco = bvx < -2 && bx < 42;
      if (bx < areaX + 3 && distArco < 14 && bz <= 2.7) {
        targetX = clamp(bx - 0.6, 1.0, areaX - 1.0);
        targetY = clamp(by, centroY - mitadArco - 1.5, centroY + mitadArco + 1.5);
      } else {
        const yCubierta = clamp(
          centroY + ((by - centroY) / Math.max(20, bx + 15)) * 4.2,
          centroY - mitadArco + 0.8,
          centroY + mitadArco - 0.8
        );
        targetX = balonVieneAlArco ? 3.2 : 4.2;
        targetY = yCubierta;
      }
    } else if (i === mejorPresionador) {
      // Si el balón está muy cerca de nuestro arco y hay compañero libre, despejar/salir; si no, ir al balón
      targetX = clamp(pxBalon, 2, largo - 1);
      targetY = clamp(pyBalon, 1, ancho - 1);
    } else {
      // Apoyo ofensivo o coberturas defensivas
      if (bx > 60) {
        // En campo rival: los delanteros y volantes atacan el área / segundo palo
        if (i === 9 || i === 10) {
          targetX = clamp(largo - 11, 65, largo - 5);
          targetY = i === 9 ? centroY - 6.5 : centroY + 6.5;
        } else if (i === 5 || i === 8) {
          targetX = clamp(bx - 6, 35, largo - 14);
          targetY = i === 5 ? 14 : ancho - 14;
        }
      } else if (bx < 35) {
        // En campo propio: compactar líneas detrás del balón sin amontonarse
        targetX = clamp(base.x + shiftX * 0.8, 12, 75);
      }
    }

    // Evitar aglomeración excesiva cerca del presionador
    if (i !== 0 && i !== mejorPresionador) {
      const distAlBalon = Math.hypot(targetX - pxBalon, targetY - pyBalon);
      if (distAlBalon < 7.5) {
        const ang = Math.atan2(targetY - pyBalon, targetX - pxBalon);
        targetX = clamp(pxBalon + Math.cos(ang) * 8.5, 8, largo - 4);
        targetY = clamp(pyBalon + Math.sin(ang) * 8.5, 4, ancho - 4);
      }
    }

    const orden = {
      ir: {
        x: clamp(targetX, 0, largo),
        y: clamp(targetY, 0, ancho)
      }
    };

    // Evaluar si el jugador alcanza el balón para patear o controlarlo
    const distBalon = Math.hypot(bx - j.x, by - j.y);
    const alturaMaxAlcance = (i === 0 && j.x <= areaX) ? 2.8 : 2.4;
    const puedeTocar = distBalon <= alcance && bz <= alturaMaxAlcance;

    if (puedeTocar) {
      const tiro = calcularMejorAccion(i, j, mios, rivales, balon, estado, empujonFinal);
      if (tiro) {
        orden.patear = tiro;
      }
      // Si tiro es null, el jugador no patea y controla el balón pegado al pie
    }

    ordenes.push(orden);
  }

  return ordenes;
}

function calcularMejorAccion(idx, jugador, mios, rivales, balon, estado, empujonFinal) {
  const largo = (estado.cancha && estado.cancha.largo) || 105;
  const ancho = (estado.cancha && estado.cancha.ancho) || 68;
  const arcoAncho = (estado.cancha && estado.cancha.arco) || 7.32;
  const areaX = (estado.cancha && estado.cancha.areaX) || 16.5;
  const centroY = ancho / 2;
  const mitadArco = arcoAncho / 2;

  const x = jugador.x;
  const y = jugador.y;
  const bz = balon.z || 0;
  const distArcoRival = Math.hypot(largo - x, centroY - y);

  // 1. Si es el arquero: despejar largo o pasar a un defensor/mediocampista abierto
  if (idx === 0) {
    const rivalCerca = rivales.some(r => r && Math.hypot(r.x - x, r.y - y) < 8.5);
    if (rivalCerca || x > areaX - 2) {
      const compañeroLibre = buscarPase(idx, x, y, mios, rivales, largo, ancho, true);
      if (compañeroLibre) {
        return {
          x: compañeroLibre.x,
          y: compañeroLibre.y,
          fuerza: clamp(compañeroLibre.dist / 52, 0.25, 0.72),
          altura: compañeroLibre.dist > 28 ? 0.35 : 0.05
        };
      }
      return {
        x: largo - 25,
        y: y < centroY ? 18 : ancho - 18,
        fuerza: 0.85,
        altura: 0.45
      };
    }
    return null; // Retiene el balón con calma
  }

  // 2. Revisar si hay tiro peligroso al arco rival
  const tieneAnguloTiro = x > largo * 0.56 && distArcoRival < 42;
  if (tieneAnguloTiro) {
    const rivalBloqueando = rivales.some(r => {
      if (!r) return false;
      const dJugador = Math.hypot(r.x - x, r.y - y);
      const dArco = Math.hypot(largo - r.x, centroY - r.y);
      return dJugador < 5.0 && dJugador < distArcoRival && dArco < distArcoRival;
    });

    const arqueroRival = rivales[0] || { x: largo - 3, y: centroY };
    // Apuntar al lado del arco más alejado del arquero rival, dentro de los postes
    const yPosteSup = centroY - mitadArco + 0.65;
    const yPosteInf = centroY + mitadArco - 0.65;
    const objetivoY = arqueroRival.y > centroY ? yPosteSup : yPosteInf;

    const esCabezazo = bz > 1.3;
    const esVolea = bz >= 0.4 && bz <= 1.3;

    if (!rivalBloqueando || distArcoRival < 20) {
      let fuerzaTiro = distArcoRival < 16 ? 0.82 : 0.72;
      if (empujonFinal) fuerzaTiro = Math.min(0.9, fuerzaTiro + 0.08);
      if (esCabezazo) fuerzaTiro = Math.min(0.58, fuerzaTiro);
      else if (esVolea && fuerzaTiro > 0.68) fuerzaTiro = 0.66; // Evita chilena imprecisa salvo urgencia

      return {
        x: largo,
        y: clamp(objetivoY, centroY - mitadArco + 0.4, centroY + mitadArco - 0.4),
        fuerza: clamp(fuerzaTiro, 0.2, 0.92),
        altura: distArcoRival > 25 ? 0.15 : 0.05
      };
    }
  }

  // 3. Si está en nuestra zona defensiva y presionado, despejar o pasar seguro
  const enPeligroPropio = x < 24;
  const rivalMuyCerca = rivales.some(r => r && Math.hypot(r.x - x, r.y - y) < 4.2);

  if (enPeligroPropio && rivalMuyCerca) {
    const paseSeguro = buscarPase(idx, x, y, mios, rivales, largo, ancho, false);
    if (paseSeguro) {
      return {
        x: paseSeguro.x,
        y: paseSeguro.y,
        fuerza: clamp(paseSeguro.dist / 45, 0.2, 0.65),
        altura: paseSeguro.dist > 26 ? 0.25 : 0.0
      };
    }
    return {
      x: clamp(x + 35, 30, largo - 10),
      y: y < centroY ? 12 : ancho - 12,
      fuerza: 0.75,
      altura: 0.35
    };
  }

  // 4. Buscar pase progresivo o centro al área si hay mejor opción adelante
  const paseAdelante = buscarPase(idx, x, y, mios, rivales, largo, ancho, false);
  if (paseAdelante && paseAdelante.gananciaX > 8 && paseAdelante.seguridad > 0.55) {
    const esCentro = paseAdelante.x > largo - 18 && Math.abs(paseAdelante.y - centroY) < 12 && Math.hypot(paseAdelante.x - x, paseAdelante.y - y) > 16;
    return {
      x: paseAdelante.x,
      y: paseAdelante.y,
      fuerza: clamp(paseAdelante.dist / 44, 0.18, 0.68),
      altura: esCentro ? 0.45 : (paseAdelante.dist > 28 ? 0.2 : 0.0)
    };
  }

  // 5. Si no hay rival encima y estamos avanzando bien, llevar el balón pegado al pie
  if (!rivalMuyCerca && x < largo - 12) {
    return null;
  }

  // 6. Si hay rival cerca y no condujimos, hacer pase corto o despeje suave
  if (paseAdelante) {
    return {
      x: paseAdelante.x,
      y: paseAdelante.y,
      fuerza: clamp(paseAdelante.dist / 45, 0.15, 0.6),
      altura: 0.0
    };
  }

  return {
    x: clamp(x + 22, 10, largo - 5),
    y: clamp(y + (centroY - y) * 0.25, 8, ancho - 8),
    fuerza: 0.55,
    altura: 0.15
  };
}

function buscarPase(idx, x, y, mios, rivales, largo, ancho, permitirArquero) {
  let mejor = null;
  let mejorScore = -Infinity;

  for (let k = 0; k < mios.length; k++) {
    if (k === idx) continue;
    if (k === 0 && !permitirArquero) continue;
    const comp = mios[k];
    if (!comp) continue;

    const dist = Math.hypot(comp.x - x, comp.y - y);
    if (dist < 5 || dist > 55) continue;

    // Distancia del rival más cercano al compañero receptor
    let minRivalReceptor = Infinity;
    let minRivalLinea = Infinity;

    for (let rIdx = 0; rIdx < rivales.length; rIdx++) {
      const r = rivales[rIdx];
      if (!r) continue;
      const dRec = Math.hypot(r.x - comp.x, r.y - comp.y);
      if (dRec < minRivalReceptor) minRivalReceptor = dRec;

      const dLin = distPuntoSegmento(r.x, r.y, x, y, comp.x, comp.y);
      if (dLin < minRivalLinea) minRivalLinea = dLin;
    }

    const seguridad = clamp(minRivalReceptor / 12, 0, 1) * 0.6 + clamp(minRivalLinea / 6, 0, 1) * 0.4;
    const gananciaX = comp.x - x;
    const score = gananciaX * 1.4 + seguridad * 25 - Math.abs(dist - 20) * 0.35;

    if (score > mejorScore && seguridad > 0.3) {
      mejorScore = score;
      mejor = {
        x: clamp(comp.x + (comp.vx || 0) * 0.2, 4, largo - 4),
        y: clamp(comp.y + (comp.vy || 0) * 0.2, 4, ancho - 4),
        dist,
        gananciaX,
        seguridad
      };
    }
  }

  return mejor;
}

function distPuntoSegmento(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function clamp(val, min, max) {
  return val < min ? min : (val > max ? max : val);
}
