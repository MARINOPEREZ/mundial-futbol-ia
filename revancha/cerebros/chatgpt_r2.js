function decidir(estado) {
  const cancha = estado.cancha;
  const balon = estado.balon;
  const mios = estado.mios;
  const rivales = estado.rivales;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const bx = clamp(balon.x + balon.vx * 0.18, 0, 105);
  const by = clamp(balon.y + balon.vy * 0.18, 0, 68);

  const formacion = [
    { x: 5, y: 34 },
    { x: 19, y: 13 },
    { x: 22, y: 27 },
    { x: 22, y: 41 },
    { x: 19, y: 55 },
    { x: 39, y: 14 },
    { x: 43, y: 27 },
    { x: 43, y: 41 },
    { x: 39, y: 54 },
    { x: 72, y: 27 },
    { x: 73, y: 41 }
  ];

  let cercano = 0;
  let menor = Infinity;

  for (let i = 0; i < 11; i++) {
    const d = dist(mios[i], balon);
    if (d < menor) {
      menor = d;
      cercano = i;
    }
  }

  function buscarPase(indice) {
    const jugador = mios[indice];
    let mejor = null;
    let mejorPuntaje = -Infinity;

    for (let j = 1; j < 11; j++) {
      if (j === indice) continue;

      const receptor = mios[j];
      const avance = receptor.x - balon.x;
      const distancia = dist(jugador, receptor);

      if (avance < 4 || distancia < 5 || distancia > 38) continue;

      let presion = 0;

      for (let r = 0; r < rivales.length; r++) {
        const d = dist(receptor, rivales[r]);
        if (d < 8) presion += (8 - d) * 2;
      }

      const puntaje = avance * 1.6 - distancia * 0.35 - presion;

      if (puntaje > mejorPuntaje) {
        mejorPuntaje = puntaje;
        mejor = receptor;
      }
    }

    return mejor;
  }

  function paseA(destino) {
    const distancia = dist(balon, destino);
    return {
      x: destino.x,
      y: destino.y,
      fuerza: clamp(distancia / 44, 0.12, 0.88),
      altura: 0.015
    };
  }

  function tiroArco() {
    const distancia = Math.hypot(105 - balon.x, 34 - balon.y);

    return {
      x: 105,
      y: balon.y < 34 ? 31 : 37,
      fuerza: clamp(distancia / 43, 0.18, 0.92),
      altura: 0.02
    };
  }

  const ordenes = [];

  for (let i = 0; i < 11; i++) {
    let destino = { x: formacion[i].x, y: formacion[i].y };
    let patear;

    // ARQUERO
    if (i === 0) {
      destino.x = clamp(4 + bx * 0.075, 2, 10);
      destino.y = clamp(34 + (by - 34) * 0.65, 26, 42);

      if (balon.x < 15 && dist(mios[i], balon) < 8) {
        destino = { x: bx, y: by };
      }

      if (dist(mios[i], balon) <= cancha.alcance) {
        const receptor = buscarPase(i);

        patear = receptor
          ? paseA(receptor)
          : { x: 72, y: 34, fuerza: 0.82, altura: 0.04 };
      }
    }

    // JUGADOR MÁS CERCANO AL BALÓN
    else if (i === cercano) {
      destino = { x: bx, y: by };
    }

    // DEFENSAS
    else if (i >= 1 && i <= 4) {
      const retroceso = bx < 52 ? 8 : 0;

      destino.x = clamp(
        formacion[i].x - retro + (bx - 52) * 0.08,
        10,
        36
      );

      destino.y = clamp(
        formacion[i].y + (by - 34) * 0.22,
        5,
        63
      );
    }

    // MEDIOCAMPISTAS
    else if (i >= 5 && i <= 8) {
      destino.x = clamp(
        formacion[i].x + (bx - 52) * 0.32,
        26,
        70
      );

      destino.y = clamp(
        formacion[i].y + (by - 34) * 0.32,
        5,
        63
      );
    }

    // DELANTEROS
    else {
      destino.x = clamp(
        formacion[i].x + (bx - 70) * 0.22,
        58,
        96
      );

      destino.y = clamp(
        formacion[i].y + (by - 34) * 0.25,
        7,
        61
      );
    }

    // DECISIONES CON BALÓN
    if (
      i === cercano &&
      i !== 0 &&
      dist(mios[i], balon) <= cancha.alcance
    ) {
      const distanciaArco = 105 - balon.x;

      if (balon.x >= 76 && distanciaArco < 32) {
        patear = tiroArco();
      } else {
        const receptor = buscarPase(i);

        if (receptor) {
          patear = paseA(receptor);
        } else {
          patear = undefined;

          destino = {
            x: clamp(balon.x + 12, 0, 100),
            y: clamp(balon.y + (34 - balon.y) * 0.12, 5, 63)
          };
        }
      }
    }

    ordenes.push({
      ir: {
        x: clamp(destino.x, 0, 105),
        y: clamp(destino.y, 0, 68)
      },
      patear: patear
    });
  }

  return ordenes;
}
