function decidir(estado) {
  const cancha = estado.cancha;
  const balon = estado.balon;
  const mios = estado.mios;
  const rivales = estado.rivales;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // Formación base 4-4-2, atacando hacia x=105
  const formacion = [
    { x: 4, y: 34 },   // Arquero
    { x: 20, y: 12 },  // Defensa
    { x: 20, y: 25 },
    { x: 20, y: 43 },
    { x: 20, y: 56 },
    { x: 40, y: 12 },  // Mediocampo
    { x: 40, y: 25 },
    { x: 40, y: 43 },
    { x: 40, y: 56 },
    { x: 72, y: 26 },  // Delanteros
    { x: 72, y: 42 }
  ];

  // Encontrar jugador más cercano al balón
  let jugadorCercano = 0;
  let menorDistancia = Infinity;

  for (let i = 0; i < 11; i++) {
    const d = dist(mios[i], balon);
    if (d < menorDistancia) {
      menorDistancia = d;
      jugadorCercano = i;
    }
  }

  // Ubicación del balón anticipada
  const bx = clamp(balon.x + balon.vx * 0.35, 0, 105);
  const by = clamp(balon.y + balon.vy * 0.35, 0, 68);

  const ordenes = [];

  for (let i = 0; i < 11; i++) {
    let destino = { ...formacion[i] };
    let patear = undefined;

    // El arquero protege el arco
    if (i === 0) {
      destino.x = clamp(bx * 0.12, 2, 8);
      destino.y = clamp(by, 24, 44);

      if (balon.x < 18 && dist(mios[i], balon) < 2.2) {
        patear = {
          x: 65,
          y: 34,
          fuerza: 0.75,
          altura: 0.15
        };
      }
    }

    // El jugador más cercano disputa el balón
    else if (i === jugadorCercano) {
      destino = { x: bx, y: by };
    }

    // Defensas ajustan su posición cuando el rival ataca
    else if (i >= 1 && i <= 4) {
      if (balon.x < 48) {
        destino.x = clamp(formacion[i].x - 5, 8, 35);
      }
      destino.y = clamp(
        formacion[i].y + (by - 34) * 0.18,
        4,
        64
      );
    }

    // Mediocampistas se aproximan a la jugada
    else if (i >= 5 && i <= 8) {
      destino.x = clamp(formacion[i].x + (bx - 52) * 0.25, 25, 65);
      destino.y = clamp(formacion[i].y + (by - 34) * 0.3, 5, 63);
    }

    // Delanteros buscan espacios de ataque
    else {
      destino.x = clamp(formacion[i].x + (bx - 70) * 0.15, 58, 95);
      destino.y = clamp(formacion[i].y + (by - 34) * 0.22, 8, 60);
    }

    // Si tiene el balón, realiza un envío hacia adelante
    if (dist(mios[i], balon) <= cancha.alcance) {
      const haciaArco = 105 - balon.x;
      patear = {
        x: 105,
        y: clamp(34 + (34 - balon.y) * 0.15, 27, 41),
        fuerza: clamp(haciaArco / 70, 0.25, 0.85),
        altura: 0.05
      };
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