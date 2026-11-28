let memoria = {
  ultimoPoseedor: -1
};

function decidir(estado) {
  const C = estado.cancha;
  const B = estado.balon;
  const M = estado.mios;
  const R = estado.rivales;

  const ARCO_RIVAL = { x: 105, y: 34 };
  const ARCO_PROPIO = { x: 0, y: 34 };

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function libre(x, y, rivalDist = 6) {
    let min = 999;
    for (let r of R) {
      const d = Math.hypot(r.x - x, r.y - y);
      if (d < min) min = d;
    }
    return min > rivalDist;
  }

  function rivalMasCercano(x, y) {
    let mejor = null;
    let md = 1e9;
    for (let r of R) {
      const d = Math.hypot(r.x - x, r.y - y);
      if (d < md) {
        md = d;
        mejor = r;
      }
    }
    return { rival: mejor, dist: md };
  }

  function miMasCercanoBalon() {
    let best = 0;
    let bd = 1e9;

    for (let i = 0; i < 11; i++) {
      const d = dist(M[i], B);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  function rivalMasCercanoBalon() {
    let bd = 1e9;
    for (let r of R) {
      const d = dist(r, B);
      if (d < bd) bd = d;
    }
    return bd;
  }

  function tengoBalon(i) {
    return (
      dist(M[i], B) <= C.alcance + 0.2 &&
      B.z <= 2.4
    );
  }

  const formacion = [
    [4, 34], // GK
    [20, 8],
    [24, 24],
    [24, 44],
    [20, 60],
    [45, 10],
    [48, 27],
    [48, 41],
    [45, 58],
    [75, 24],
    [75, 44]
  ];

  const ordenes = [];
  const perseguidor = miMasCercanoBalon();

  const vamosPerdiendo = estado.marcador.propio < estado.marcador.rival;
  const vamosGanando = estado.marcador.propio > estado.marcador.rival;

  let empuje = 0;

  if (vamosPerdiendo) empuje = 10;
  if (vamosGanando) empuje = -4;

  const distanciaRivalBalon = rivalMasCercanoBalon();

  for (let i = 0; i < 11; i++) {
    let objetivo = {
      x: formacion[i][0] + empuje,
      y: formacion[i][1]
    };

    if (i === 0) {
      const gx = clamp(B.x * 0.15, 2, 14);
      const gy = clamp(B.y, 28, 40);

      objetivo = { x: gx, y: gy };

      if (tengoBalon(0)) {
        let destino = M[9];

        if (M[10].x > destino.x) destino = M[10];

        ordenes.push({
          ir: objetivo,
          patear: {
            x: destino.x + 10,
            y: destino.y,
            fuerza: 1,
            altura: 0.65
          }
        });
        continue;
      }

      ordenes.push({ ir: objetivo });
      continue;
    }

    if (i === perseguidor) {
      const anticipacion = 0.45;

      objetivo = {
        x: B.x + B.vx * anticipacion,
        y: B.y + B.vy * anticipacion
      };
    } else {
      const factorX = clamp(B.x / 105, 0, 1);

      objetivo.x += factorX * 14;
      objetivo.y += (B.y - 34) * 0.20;
    }

    if (tengoBalon(i)) {
      memoria.ultimoPoseedor = i;

      const distArco = Math.hypot(
        ARCO_RIVAL.x - M[i].x,
        ARCO_RIVAL.y - M[i].y
      );

      const presion = rivalMasCercano(M[i].x, M[i].y).dist;

      if (
        M[i].x > 78 &&
        distArco < 34
      ) {
        ordenes.push({
          ir: objetivo,
          patear: {
            x: 105,
            y: 34,
            fuerza: distArco < 18 ? 0.82 : 1,
            altura: distArco > 24 ? 0.12 : 0
          }
        });
        continue;
      }

      let mejorPase = -1;
      let mejorValor = -999;

      for (let j = 1; j < 11; j++) {
        if (j === i) continue;

        const pj = M[j];

        let valor =
          pj.x * 2 -
          Math.abs(pj.y - 34) * 0.15 +
          rivalMasCercano(pj.x, pj.y).dist * 2;

        if (valor > mejorValor) {
          mejorValor = valor;
          mejorPase = j;
        }
      }

      if (
        presion > 3.5 &&
        M[i].x < 92
      ) {
        const p = M[mejorPase];
        const larga = dist(M[i], p) > 28;

        ordenes.push({
          ir: objetivo,
          patear: {
            x: p.x + 3,
            y: p.y,
            fuerza: larga ? 0.95 : 0.55,
            altura: larga ? 0.45 : 0
          }
        });
        continue;
      }

      if (
        M[i].x < 95 &&
        presion > 1.8
      ) {
        ordenes.push({
          ir: {
            x: 105,
            y: 34
          }
        });
        continue;
      }

      ordenes.push({
        ir: {
          x: 105,
          y: 34
        }
      });
      continue;
    }

    if (
      i >= 9 &&
      B.x > 65
    ) {
      objetivo.x = Math.max(objetivo.x, 88);

      if (i === 9) objetivo.y = 24;
      if (i === 10) objetivo.y = 44;
    }

    if (
      i >= 5 &&
      i <= 8 &&
      B.x > 50
    ) {
      objetivo.x += 8;
    }

    if (
      i >= 1 &&
      i <= 4 &&
      B.x < 45
    ) {
      objetivo.x -= 4;
    }

    ordenes.push({
      ir: {
        x: clamp(objetivo.x, 0, 105),
        y: clamp(objetivo.y, 0, 68)
      }
    });
  }

  return ordenes;
}
