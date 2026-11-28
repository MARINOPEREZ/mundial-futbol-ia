function decidir(estado) {
  const balon = estado.balon;
  const mios = estado.mios;
  const rivales = estado.rivales;
  const cancha = estado.cancha;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const bx = clamp(balon.x + balon.vx * 0.15, 0, 105);
  const by = clamp(balon.y + balon.vy * 0.15, 0, 68);

  // Formación compacta 4-4-2
  const base = [
    { x: 5,  y: 34 },
    { x: 20, y: 12 },
    { x: 22, y: 26 },
    { x: 22, y: 42 },
    { x: 20, y: 56 },
    { x: 39, y: 12 },
    { x: 42, y: 26 },
    { x: 42, y: 42 },
    { x: 39, y: 56 },
    { x: 72, y: 26 },
    { x: 72, y: 42 }
  ];

  // Jugador más próximo al balón
  let perseguidor = 1;
  let minimo = Infinity;

  for (let i = 1; i < 11; i++) {
    const d = distancia(mios[i], balon);
    if (d < minimo) {
      minimo = d;
      perseguidor = i;
    }
  }

  // Buscar compañero adelantado con espacio
  function companero(indice) {
    let elegido = -1;
    let puntuacionMax = -99999;

    for (let j = 5; j < 11; j++) {
      if (j === indice) continue;

      const avance = mios[j].x - balon.x;
      const separacion = distancia(mios[indice], mios[j]);

      if (avance < 3 || separacion < 5 || separacion > 40) continue;

      let marca = 0;
      for (let k = 0; k < 11; k++) {
        const d = distancia(mios[j], rivales[k]);
        if (d < 7) marca += (7 - d) * 1.8;
      }

      const puntuacion = avance - separacion * 0.25 - marca;

      if (puntuacion > puntuacionMax) {
        puntuacionMax = puntuacion;
        elegido = j;
      }
    }

    return elegido;
  }

  const ordenes = [];

  for (let i = 0; i < 11; i++) {
    let x = base[i].x;
    let y = base[i].y;
    let patear;

    // Arquero
    if (i === 0) {
      x = clamp(4 + bx * 0.06, 2, 9);
      y = clamp(by, 27, 41);

      if (distancia(mios[0], balon) < cancha.alcance) {
        patear = {
          x: 72,
          y: 34,
          fuerza: 0.85,
          altura: 0.02
        };
      }
    }

    // Presión sobre el balón
    else if (i === perseguidor) {
      x = bx;
      y = by;
    }

    // Defensa: bloque unido y protección del área
    else if (i <= 4) {
      x = clamp(base[i].x + (bx - 45) * 0.10, 10, 35);
      y = clamp(base[i].y + (by - 34) * 0.20, 5, 63);
    }

    // Mediocampo: apoyo defensivo y salida de balón
    else if (i <= 8) {
      x = clamp(base[i].x + (bx - 45) * 0.30, 25, 68);
      y = clamp(base[i].y + (by - 34) * 0.30, 5, 63);
    }

    // Delanteros: buscar profundidad
    else {
      x = clamp(base[i].x + (bx - 65) * 0.20, 58, 98);
      y = clamp(base[i].y + (by - 34) * 0.25, 5, 63);
    }

    // Decisión del jugador que controla o recupera el balón
    if (
      i !== 0 &&
      distancia(mios[i], balon) <= cancha.alcance
    ) {
      const distanciaGol = 105 - balon.x;

      // Disparo a portería desde zona favorable
      if (balon.x > 72) {
        patear = {
          x: 105,
          y: balon.y < 34 ? 30 : 38,
          fuerza: clamp(distanciaGol / 42, 0.20, 0.90),
          altura: 0.01
        };
      } else {
        // Pase hacia adelante
        const receptor = companero(i);

        if (receptor !== -1) {
          const objetivo = mios[receptor];
          const d = distancia(balon, objetivo);

          patear = {
            x: objetivo.x,
            y: objetivo.y,
            fuerza: clamp(d / 43, 0.15, 0.85),
            altura: 0.01
          };
        } else {
          // Conducir hacia adelante si no hay pase
          x = clamp(balon.x + 10, 0, 100);
          y = clamp(balon.y, 5, 63);
          patear = undefined;
        }
      }
    }

    ordenes.push({
      ir: {
        x: clamp(x, 0, 105),
        y: clamp(y, 0, 68)
      },
      patear: patear
    });
  }

  return ordenes;
}
