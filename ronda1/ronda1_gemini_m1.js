const memoria = {
  balonPrev: null,
  posesionPrevia: null,
  ultimoDisparo: -999
};

function decidir(estado) {
  const cancha = estado.cancha || {
    largo: 105,
    ancho: 68,
    arco: 7.32,
    areaX: 16.5,
    areaY: 40.32,
    alcance: 1.3,
    velJugador: 7.5,
    velPateo: 28
  };

  const largo = cancha.largo;
  const ancho = cancha.ancho;
  const centroY = ancho / 2;
  const mitadArco = (cancha.arco || 7.32) / 2;
  const alcance = cancha.alcance || 1.3;
  const velMax = cancha.velJugador || 7.5;

  const mios = estado.mios || [];
  const rivales = estado.rivales || [];
  const balon = estado.balon || { x: largo / 2, y: centroY, vx: 0, vy: 0 };
  const tiempo = typeof estado.tiempo === "number" ? estado.tiempo : 0;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  // Predicción del balón a t segundos
  const predecirBalon = (t) => {
    const damping = Math.pow(0.92, t * 10);
    const factor = damping < 0.9999 ? (1 - damping) / (1 - 0.92) : t * 10;
    const bx = clamp(balon.x + (balon.vx || 0) * 0.1 * factor, 0, largo);
    const by = clamp(balon.y + (balon.vy || 0) * 0.1 * factor, 0, ancho);
    return { x: bx, y: by };
  };

  const balonFuturo = predecirBalon(0.35);

  // Detectar quién tiene o está más cerca del balón
  let masCercanoMio = mios[1] || mios[0] || { n: 0, x: 10, y: centroY };
  let minDistMio = Infinity;
  for (let i = 0; i < mios.length; i++) {
    const j = mios[i];
    if (!j) continue;
    const d = dist(j.x, j.y, balonFuturo.x, balonFuturo.y);
    if (d < minDistMio) {
      minDistMio = d;
      masCercanoMio = j;
    }
  }

  let masCercanoRival = rivales[0] || { n: 0, x: largo - 10, y: centroY };
  let minDistRival = Infinity;
  for (let i = 0; i < rivales.length; i++) {
    const r = rivales[i];
    if (!r) continue;
    const d = dist(r.x, r.y, balon.x, balon.y);
    if (d < minDistRival) {
      minDistRival = d;
      masCercanoRival = r;
    }
  }

  const tenemosBalon = minDistMio <= alcance + 0.6 && minDistMio <= minDistRival + 0.8;
  const peligroEnArea = balon.x < cancha.areaX + 6 && (balon.vx || 0) < 0;

  // Desplazamiento táctico según posición del balón (4-4-2 dinámico)
  const shiftX = clamp((balon.x - largo * 0.5) * 0.42, -22, 26);
  const shiftY = clamp((balon.y - centroY) * 0.25, -10, 10);

  const formacionBase = [
    { x: 4.5, y: centroY },                // 0: Arquero
    { x: 24 + shiftX * 0.7, y: 15 + shiftY }, // 1: Lateral izq
    { x: 19 + shiftX * 0.5, y: 27 + shiftY }, // 2: Central izq
    { x: 19 + shiftX * 0.5, y: 41 + shiftY }, // 3: Central der
    { x: 24 + shiftX * 0.7, y: 53 + shiftY }, // 4: Lateral der
    { x: 48 + shiftX, y: 12 + shiftY },       // 5: Volante izq
    { x: 43 + shiftX, y: 27 + shiftY },       // 6: Mediocentro izq
    { x: 43 + shiftX, y: 41 + shiftY },       // 7: Mediocentro der
    { x: 48 + shiftX, y: 56 + shiftY },       // 8: Volante der
    { x: 72 + shiftX * 1.1, y: 25 + shiftY * 0.6 }, // 9: Delantero izq
    { x: 72 + shiftX * 1.1, y: 43 + shiftY * 0.6 }  // 10: Delantero der
  ];

  // Elegir los 2 presionadores más aptos (excluyendo arquero si no es necesario)
  const candidatosPresion = mios
    .filter((j, idx) => j && idx > 0)
    .map((j) => ({
      idx: j.n !== undefined ? j.n : 1,
      d: dist(j.x, j.y, balonFuturo.x, balonFuturo.y)
    }))
    .sort((a, b) => a.d - b.d);

  const presionador1 = candidatosPresion[0] ? candidatosPresion[0].idx : 9;
  const presionador2 = candidatosPresion[1] ? candidatosPresion[1].idx : 10;

  // Evaluar si un punto (tx, ty) está libre de rivales cercanos
  const estaLibre = (tx, ty, radioMin) => {
    for (let i = 0; i < rivales.length; i++) {
      const r = rivales[i];
      if (!r) continue;
      if (dist(tx, ty, r.x, r.y) < radioMin) return false;
    }
    return true;
  };

  // Calcular mejor opción de pase o despeje para un jugador que tiene el balón
  const calcularPaseODespeje = (jugador) => {
    // Si estamos cerca del arco rival, intentar rematar al poste más libre
    if (jugador.x > largo * 0.66) {
      const posteAlto = { x: largo, y: centroY - mitadArco + 0.9 };
      const posteBajo = { x: largo, y: centroY + mitadArco - 0.9 };
      const centroArco = { x: largo, y: centroY };

      const opcionesTiro = [posteAlto, posteBajo, centroArco].map((obj) => {
        let peorRival = Infinity;
        for (let i = 0; i < rivales.length; i++) {
          const r = rivales[i];
          if (!r) continue;
          // Distancia del rival a la línea de tiro
          const dLinea = dist(r.x, r.y, (jugador.x + obj.x) / 2, (jugador.y + obj.y) / 2);
          if (dLinea < peorRival) peorRival = dLinea;
        }
        return { obj, score: peorRival };
      });

      opcionesTiro.sort((a, b) => b.score - a.score);
      const mejorTiro = opcionesTiro[0].obj;
      const distArco = dist(jugador.x, jugador.y, mejorTiro.x, mejorTiro.y);
      const fuerzaTiro = clamp(0.55 + (distArco / 55) * 0.35, 0.55, 0.9);
      return { x: mejorTiro.x, y: mejorTiro.y, fuerza: fuerzaTiro, esTiro: true };
    }

    // Buscar compañeros adelantados o mejor ubicados
    let mejorPase = null;
    let mejorPuntaje = -Infinity;

    for (let i = 1; i < mios.length; i++) {
      const comp = mios[i];
      if (!comp || comp.n === jugador.n) continue;

      const dPase = dist(jugador.x, jugador.y, comp.x, comp.y);
      if (dPase < 5 || dPase > 46) continue;

      // Adelantar ligeramente el destino del pase según velocidad del compañero
      const px = clamp(comp.x + (comp.vx || 0) * 0.25 + 2.5, 8, largo - 6);
      const py = clamp(comp.y + (comp.vy || 0) * 0.25, 4, ancho - 4);

      // Revisar si algún rival está en el carril del pase
      let obstruccion = 0;
      for (let k = 0; k < rivales.length; k++) {
        const r = rivales[k];
        if (!r) continue;
        const d1 = dist(jugador.x, jugador.y, r.x, r.y);
        const d2 = dist(r.x, r.y, px, py);
        if (d1 + d2 < dPase + 3.2) {
          obstruccion += 12;
        }
        if (dist(r.x, r.y, px, py) < 4.5) {
          obstruccion += 7;
        }
      }

      const avanceX = (px - jugador.x) * 1.1;
      const cercaniaArco = (px / largo) * 18;
      const penalizacionDistancia = Math.abs(dPase - 20) * 0.35;
      const puntaje = avanceX + cercaniaArco - obstruccion - penalizacionDistancia;

      if (puntaje > mejorPuntaje) {
        mejorPuntaje = puntaje;
        const fuerzaPase = clamp(0.18 + (dPase / 45) * 0.42, 0.18, 0.62);
        mejorPase = { x: px, y: py, fuerza: fuerzaPase, esTiro: false };
      }
    }

    if (mejorPase && mejorPuntaje > -4) {
      return mejorPase;
    }

    // Si está en zona defensiva y apretado, despejar hacia banda/adelante
    if (jugador.x < largo * 0.35) {
      const yDespeje = jugador.y < centroY ? 8 : ancho - 8;
      return {
        x: clamp(jugador.x + 35, 25, largo - 10),
        y: yDespeje,
        fuerza: 0.72,
        esTiro: false
      };
    }

    // Conducir o avanzar suavemente
    return null;
  };

  const ordenes = [];

  for (let i = 0; i < 11; i++) {
    const j = mios[i] || { n: i, x: 20, y: centroY, vx: 0, vy: 0 };
    const base = formacionBase[i] || { x: largo / 2, y: centroY };
    let destX = base.x;
    let destY = base.y;
    let patear = undefined;

    if (i === 0) {
      // ARQUERO: cubrir el ángulo entre el balón y el centro del arco propio
      const anguloX = clamp(balon.x, 0, largo);
      const anguloY = clamp(balon.y, centroY - mitadArco * 1.4, centroY + mitadArco * 1.4);
      const dirY = anguloY - centroY;
      destX = clamp(2.2 + (balon.x < 18 ? 1.5 : 0), 1.2, 5.2);
      destY = clamp(centroY + dirY * 0.38, centroY - mitadArco + 0.7, centroY + mitadArco - 0.7);

      const dBalon = dist(j.x, j.y, balon.x, balon.y);
      if (dBalon <= 2.2) {
        if (peligroEnArea) {
          // Despejar fuerte lejos del área
          const ySalida = balon.y < centroY ? ancho - 10 : 10;
          patear = { x: largo * 0.55, y: ySalida, fuerza: 0.78 };
        } else {
          // Salir jugando corto con un defensa libre
          const apoyo = mios[2] && estaLibre(mios[2].x, mios[2].y, 6) ? mios[2] : mios[3];
          if (apoyo) {
            patear = {
              x: clamp(apoyo.x + 3, 8, largo * 0.5),
              y: clamp(apoyo.y, 6, ancho - 6),
              fuerza: 0.28
            };
          }
        }
      }
    } else {
      // JUGADORES DE CAMPO
      const dBalon = dist(j.x, j.y, balon.x, balon.y);
      const puedePatear = dBalon <= alcance;

      const esPresionador =
        (i === presionador1 || (i === presionador2 && balon.x > largo * 0.35)) &&
        !(estado.saque === "rival" && dBalon < 7.2);

      if (esPresionador) {
        destX = balonFuturo.x;
        destY = balonFuturo.y;
      } else if (tenemosBalon) {
        // Apoyo ofensivo escalonado
        destX = clamp(base.x + 8, 12, largo - 8);
        destY = clamp(base.y + (j.y < balon.y ? -4 : 4), 5, ancho - 5);
      } else {
        // Basculación defensiva compacta
        destX = clamp(base.x - (balon.x < largo * 0.45 ? 5 : 0), 8, largo - 14);
        destY = base.y;
      }

      // Evitar aglomeraciones excesivas si no va por el balón
      if (!esPresionador && !estaLibre(destX, destY, 3.2)) {
        destY = clamp(destY + (destY < centroY ? -4.5 : 4.5), 5, ancho - 5);
      }

      // Si está a distancia de pateo, decidir si patear o conducir
      if (puedePatear) {
        const accion = calcularPaseODespeje(j);
        if (accion) {
          patear = { x: accion.x, y: accion.y, fuerza: accion.fuerza };
          if (accion.esTiro) {
            memoria.ultimoDisparo = tiempo;
          }
        } else {
          // Conducir hacia el espacio libre más cercano al arco rival
          const targetX = clamp(j.x + 12, 10, largo - 6);
          const targetY = clamp(j.y + (j.y < centroY ? 2 : -2), 6, ancho - 6);
          destX = targetX;
          destY = targetY;
        }
      }
    }

    // Limitar paso máximo por turno (0.1s * velJugador = 0.75m, damos un punto objetivo limpio)
    const dx = destX - j.x;
    const dy = destY - j.y;
    const dMeta = Math.hypot(dx, dy);
    let irX = destX;
    let irY = destY;

    if (dMeta > velMax * 0.25) {
      irX = j.x + (dx / dMeta) * (velMax * 0.25);
      irY = j.y + (dy / dMeta) * (velMax * 0.25);
    }

    irX = clamp(irX, 0.5, largo - 0.5);
    irY = clamp(irY, 0.5, ancho - 0.5);

    const orden = { ir: { x: irX, y: irY } };
    if (patear) {
      orden.patear = {
        x: clamp(patear.x, 0, largo),
        y: clamp(patear.y, 0, ancho),
        fuerza: clamp(patear.fuerza, 0.05, 1)
      };
    }
    ordenes.push(orden);
  }

  memoria.balonPrev = { x: balon.x, y: balon.y };
  memoria.posesionPrevia = tenemosBalon;

  return ordenes;
}
