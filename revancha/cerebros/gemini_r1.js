const _memoria = {
  ultimoMarcadorPropio: 0,
  ultimoMarcadorRival: 0
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

  const balon = estado.balon || { x: largo / 2, y: centroY, z: 0, vx: 0, vy: 0, vz: 0 };
  const mios = estado.mios || [];
  const rivales = estado.rivales || [];
  const saque = estado.saque || null;
  const marcador = estado.marcador || { propio: 0, rival: 0 };

  _memoria.ultimoMarcadorPropio = marcador.propio || 0;
  _memoria.ultimoMarcadorRival = marcador.rival || 0;

  const bx = clamp(balon.x ?? largo / 2, 0, largo);
  const by = clamp(balon.y ?? centroY, 0, ancho);
  const bz = balon.z || 0;
  const bvx = balon.vx || 0;
  const bvy = balon.vy || 0;

  const velBalon = Math.hypot(bvx, bvy);
  const dtPred = clamp(velBalon * 0.014, 0.05, 0.42);
  const pxBalon = clamp(bx + bvx * dtPred, 0, largo);
  const pyBalon = clamp(by + bvy * dtPred, 0, ancho);

  const vanPerdiendo = (marcador.propio || 0) < (marcador.rival || 0);
  const esTiempoExtra = estado.mitad === 3;
  const rectaFinal = esTiempoExtra || ((estado.duracion || 360) - (estado.tiempo || 0)) < 50;
  const empujonFinal = vanPerdiendo && rectaFinal;

  // Base 4-4-2 compacta y equilibrada
  const basePos = [
    { x: 3.8,  y: centroY },       // 0: Arquero
    { x: 22.0, y: 13.0 },          // 1: Lateral izq
    { x: 18.5, y: 26.5 },          // 2: Central izq
    { x: 18.5, y: 41.5 },          // 3: Central der
    { x: 22.0, y: 55.0 },          // 4: Lateral der
    { x: 50.0, y: 12.5 },          // 5: Volante izq
    { x: 44.0, y: 27.0 },          // 6: Mediocentro izq
    { x: 44.0, y: 41.0 },          // 7: Mediocentro der
    { x: 50.0, y: 55.5 },          // 8: Volante der
    { x: 76.0, y: 25.5 },          // 9: Delantero izq
    { x: 76.0, y: 42.5 }           // 10: Delantero der
  ];

  let shiftX = clamp((pxBalon - largo * 0.5) * 0.48, -14, 24);
  if (saque === "propio") {
    shiftX = Math.max(shiftX, 4);
  }
  if (empujonFinal) {
    shiftX = clamp(shiftX + 9, -10, 26);
  }
  const shiftY = clamp((pyBalon - centroY) * 0.28, -11, 11);

  // Elegir presionador principal (1..10) y apoyo cercano
  let mejorPresionador = -1;
  let mejorPuntaje = Infinity;
  let segundoPresionador = -1;
  let segundoPuntaje = Infinity;

  for (let i = 1; i < mios.length; i++) {
    const j = mios[i];
    if (!j) continue;
    const dist = Math.hypot(pxBalon - j.x, pyBalon - j.y);
    const penalizacionAtras = (j.x < 11 && bx > 28 && !empujonFinal) ? 16 : 0;
    const puntaje = dist + penalizacionAtras;

    if (puntaje < mejorPuntaje) {
      segundoPuntaje = mejorPuntaje;
      segundoPresionador = mejorPresionador;
      mejorPuntaje = puntaje;
      mejorPresionador = i;
    } else if (puntaje < segundoPuntaje) {
      segundoPuntaje = puntaje;
      segundoPresionador = i;
    }
  }

  const ordenes = [];

  for (let i = 0; i < mios.length; i++) {
    const j = mios[i] || { x: basePos[i]?.x || 50, y: basePos[i]?.y || centroY, vx: 0, vy: 0 };
    const base = basePos[i] || { x: 50, y: centroY };

    let targetX = clamp(base.x + shiftX, i === 0 ? 1.5 : 7, largo - 3);
    let targetY = clamp(base.y + shiftY, 4, ancho - 4);

    if (i === 0) {
      // Arquero: posicionamiento dinámico según peligro y altura del balón
      const distArco = Math.hypot(bx, by - centroY);
      const balonVieneAlArco = bvx < -2.5 && bx < 45;
      if (bx < areaX + 2.5 && distArco < 13.5 && bz <= 2.75) {
        targetX = clamp(bx - 0.5, 1.0, areaX - 1.2);
        targetY = clamp(by, centroY - mitadArco - 1.2, centroY + mitadArco + 1.2);
      } else {
        const yCubierta = clamp(
          centroY + ((by - centroY) / Math.max(22, bx + 16)) * 3.8,
          centroY - mitadArco + 0.7,
          centroY + mitadArco - 0.7
        );
        targetX = balonVieneAlArco ? 3.0 : (bx < 30 ? 4.5 : 3.6);
        targetY = yCubierta;
      }
    } else if (i === mejorPresionador) {
      targetX = clamp(pxBalon, 2, largo - 1);
      targetY = clamp(pyBalon, 1, ancho - 1);
    } else if (i === segundoPresionador && bx < 65 && distEntre(j, pxBalon, pyBalon) < 18) {
      // Cobertura cercana para robar o cerrar línea de pase
      const ang = Math.atan2(centroY - pyBalon, 0 - pxBalon);
      targetX = clamp(pxBalon + Math.cos(ang) * 5.5, 6, largo - 4);
      targetY = clamp(pyBalon + Math.sin(ang) * 5.5, 4, ancho - 4);
    } else {
      // Desmarques y coberturas por zonas
      if (bx > 58) {
        if (i === 9 || i === 10) {
          // Atacan el área y el segundo palo buscando remate o centro raso
          targetX = clamp(largo - 9.5, 72, largo - 4.5);
          targetY = i === 9 ? clamp(centroY - 5.2, 8, ancho - 8) : clamp(centroY + 5.2, 8, ancho - 8);
        } else if (i === 5 || i === 8) {
          targetX = clamp(bx - 4, 42, largo - 12);
          targetY = i === 5 ? 13 : ancho - 13;
        } else if (i === 6 || i === 7) {
          targetX = clamp(bx - 14, 32, largo - 22);
          targetY = i === 6 ? clamp(centroY - 9, 10, ancho - 10) : clamp(centroY + 9, 10, ancho - 10);
        }
      } else if (bx < 36) {
        // Bloque compacto atrás sin regalar espacios centrales
        const compactX = empujonFinal ? 1.0 : 0.82;
        targetX = clamp(base.x + shiftX * compactX, 11, 76);
        if (i === 2 || i === 3) {
          targetY = i === 2 ? clamp(centroY - 6.5, 10, ancho - 10) : clamp(centroY + 6.5, 10, ancho - 10);
        }
      }
    }

    // Separación mínima para no estorbar al presionador
    if (i !== 0 && i !== mejorPresionador) {
      const dPres = Math.hypot(targetX - pxBalon, targetY - pyBalon);
      if (dPres < 7.0) {
        const ang = Math.atan2(targetY - pyBalon, targetX - pxBalon);
        targetX = clamp(pxBalon + Math.cos(ang) * 7.8, 7, largo - 4);
        targetY = clamp(pyBalon + Math.sin(ang) * 7.8, 4, ancho - 4);
      }
    }

    const orden = {
      ir: {
        x: clamp(targetX, 0, largo),
        y: clamp(targetY, 0, ancho)
      }
    };

    const distBalon = Math.hypot(bx - j.x, by - j.y);
    const alturaMaxAlcance = (i === 0 && j.x <= areaX) ? 2.8 : 2.4;
    const puedeTocar = distBalon <= alcance && bz <= alturaMaxAlcance;

    if (puedeTocar) {
      const accion = calcularMejorAccion(i, j, mios, rivales, balon, estado, empujonFinal, saque);
      if (accion) {
        orden.patear = accion;
      }
    }

    ordenes.push(orden);
  }

  return ordenes;
}

function calcularMejorAccion(idx, jugador, mios, rivales, balon, estado, empujonFinal, saque) {
  const c = estado.cancha || {};
  const largo = c.largo || 105;
  const ancho = c.ancho || 68;
  const arcoAncho = c.arco || 7.32;
  const areaX = c.areaX || 16.5;
  const centroY = ancho / 2;
  const mitadArco = arcoAncho / 2;

  const x = jugador.x;
  const y = jugador.y;
  const bz = balon.z || 0;
  const distArcoRival = Math.hypot(largo - x, centroY - y);

  // 1. Arquero (índice 0)
  if (idx === 0) {
    const rivalMuyCerca = rivales.some(r => r && Math.hypot(r.x - x, r.y - y) < 7.5);
    if (rivalMuyCerca || x > areaX - 1.5 || saque === "propio") {
      const paseSalida = buscarPase(idx, x, y, mios, rivales, largo, ancho, false, true);
      if (paseSalida && paseSalida.seguridad > 0.45) {
        return {
          x: paseSalida.x,
          y: paseSalida.y,
          fuerza: clamp(paseSalida.dist / 50, 0.22, 0.68),
          altura: paseSalida.dist > 28 ? 0.32 : 0.05
        };
      }
      return {
        x: largo - 26,
        y: y < centroY ? 16 : ancho - 16,
        fuerza: 0.82,
        altura: 0.42
      };
    }
    // Detiene y retiene el balón con seguridad dentro del área
    return null;
  }

  // 2. Tiro al arco: solo cuando hay distancia y ángulo reales para vencer al portero
  const puedeRematar = (x > largo * 0.64 && distArcoRival < 31) || (distArcoRival < 17.5);
  if (puedeRematar) {
    let bloqueadores = 0;
    for (let rIdx = 1; rIdx < rivales.length; rIdx++) {
      const r = rivales[rIdx];
      if (!r) continue;
      const dJug = Math.hypot(r.x - x, r.y - y);
      const dArc = Math.hypot(largo - r.x, centroY - r.y);
      if (dJug < 4.5 && dJug < distArcoRival && dArc < distArcoRival) {
        bloqueadores++;
      }
    }

    const arqueroRival = rivales[0] || { x: largo - 3, y: centroY };
    const posteSup = centroY - mitadArco + 0.55;
    const posteInf = centroY + mitadArco - 0.55;
    // Apuntar al lado contrario de donde está parado el arquero rival
    const objetivoY = arqueroRival.y >= centroY ? posteSup : posteInf;

    const esCabezazo = bz > 1.3;
    const esVolea = bz >= 0.4 && bz <= 1.3;

    if (bloqueadores === 0 || distArcoRival < 15.5) {
      let fuerzaTiro;
      if (distArcoRival < 14) {
        fuerzaTiro = 0.74;
      } else if (distArcoRival < 23) {
        fuerzaTiro = 0.78;
      } else {
        fuerzaTiro = 0.70;
      }

      if (empujonFinal) {
        fuerzaTiro = Math.min(0.86, fuerzaTiro + 0.06);
      }
      if (esCabezazo) {
        fuerzaTiro = Math.min(0.56, fuerzaTiro);
      } else if (esVolea) {
        fuerzaTiro = Math.min(0.64, fuerzaTiro);
      }

      const alturaTiro = distArcoRival > 22 ? 0.14 : (bz > 0.6 ? 0.18 : 0.04);

      return {
        x: largo,
        y: clamp(objetivoY, centroY - mitadArco + 0.35, centroY + mitadArco - 0.35),
        fuerza: clamp(fuerzaTiro, 0.25, 0.88),
        altura: alturaTiro
      };
    }
  }

  // 3. Presión defensiva en zona propia: salir limpio o despejar con criterio
  const rivalEncima = rivales.some(r => r && Math.hypot(r.x - x, r.y - y) < 4.3);
  if (x < 25 && rivalEncima) {
    const paseLimpio = buscarPase(idx, x, y, mios, rivales, largo, ancho, true, false);
    if (paseLimpio && paseLimpio.seguridad > 0.42) {
      return {
        x: paseLimpio.x,
        y: paseLimpio.y,
        fuerza: clamp(paseLimpio.dist / 46, 0.2, 0.64),
        altura: paseLimpio.dist > 27 ? 0.24 : 0.0
      };
    }
    return {
      x: clamp(x + 36, 32, largo - 10),
      y: y < centroY ? 12 : ancho - 12,
      fuerza: 0.76,
      altura: 0.35
    };
  }

  // 4. Pase progresivo o centro al área cuando hay compañero bien ubicado
  const paseProgresivo = buscarPase(idx, x, y, mios, rivales, largo, ancho, true, false);
  if (paseProgresivo && paseProgresivo.gananciaX > 6.5 && paseProgresivo.seguridad > 0.52) {
    const esCentro = paseProgresivo.x > largo - 17 && Math.hypot(paseProgresivo.x - x, paseProgresivo.y - y) > 14;
    return {
      x: paseProgresivo.x,
      y: paseProgresivo.y,
      fuerza: clamp(paseProgresivo.dist / 45, 0.18, 0.66),
      altura: esCentro ? 0.42 : (paseProgresivo.dist > 28 ? 0.18 : 0.0)
    };
  }

  // 5. Conducir si estamos libres y avanzando hacia campo rival
  if (!rivalEncima && x < largo - 13) {
    return null;
  }

  // 6. Pase de circulación seguro si hay rival cerca
  if (paseProgresivo && paseProgresivo.seguridad > 0.38) {
    return {
      x: paseProgresivo.x,
      y: paseProgresivo.y,
      fuerza: clamp(paseProgresivo.dist / 46, 0.16, 0.58),
      altura: 0.0
    };
  }

  // 7. Despeje controlado hacia adelante
  return {
    x: clamp(x + 24, 12, largo - 6),
    y: clamp(y + (centroY - y) * 0.25, 8, ancho - 8),
    fuerza: 0.56,
    altura: 0.12
  };
}

function buscarPase(idx, x, y, mios, rivales, largo, ancho, permitirAdelanteCorto, permitirArquero) {
  let mejor = null;
  let mejorScore = -Infinity;

  for (let k = 0; k < mios.length; k++) {
    if (k === idx) continue;
    if (k === 0 && !permitirArquero) continue;
    const comp = mios[k];
    if (!comp) continue;

    const dist = Math.hypot(comp.x - x, comp.y - y);
    if (dist < 5.5 || dist > 52) continue;

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

    const seguridad = clamp(minRivalReceptor / 11.5, 0, 1) * 0.58 + clamp(minRivalLinea / 5.8, 0, 1) * 0.42;
    const gananciaX = comp.x - x;
    if (!permitirAdelanteCorto && gananciaX < -10) continue;

    const score = gananciaX * 1.35 + seguridad * 28 - Math.abs(dist - 19) * 0.32;

    if (score > mejorScore && seguridad > 0.34) {
      mejorScore = score;
      mejor = {
        x: clamp(comp.x + (comp.vx || 0) * 0.22, 4, largo - 4),
        y: clamp(comp.y + (comp.vy || 0) * 0.22, 4, ancho - 4),
        dist,
        gananciaX,
        seguridad
      };
    }
  }

  return mejor;
}

function distEntre(jugador, px, py) {
  return Math.hypot((jugador?.x || 0) - px, (jugador?.y || 0) - py);
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
