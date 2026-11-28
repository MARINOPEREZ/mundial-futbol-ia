// Cancha neutral del «Mundial entre las IA» (video 16 de MenteXYZ).
// Un partido de 11 contra 11 donde cada equipo lo maneja una función `decidir(estado)` escrita por una IA.
// El motor es el mismo para todos: cada equipo ve la cancha como si atacara hacia la derecha (x = 105) y con el
// mismo azar (semilla). Funciona igual en el navegador y en Node (para repetir los partidos y verificarlos).
(function (raiz) {
  "use strict";

  const C = {
    LARGO: 105, ANCHO: 68, ARCO: 7.32, AREA_X: 16.5, AREA_Y: 40.32,
    DT: 1 / 60,                // paso de la física
    CADA: 6,                   // el cerebro decide cada 6 pasos (10 veces por segundo)
    VEL_JUGADOR: 7.5,          // m/s
    CON_BALON: 0.85,           // llevando el balón: 15 % más lento
    ACEL_JUGADOR: 14,          // m/s²
    ALCANCE: 1.3,              // distancia para poder patear
    ALCANCE_ARQUERO: 2.2,      // el n.º 0, dentro de su área
    ARQUERO_SEGURO: 12,        // m/s: hasta esta velocidad del balón el arquero nunca falla
    ARQUERO_FALLA: 0.4,        // probabilidad máxima de que se le escape (a 24 m/s o más)
    VEL_PATEO: 28,             // m/s con fuerza 1
    // Juego aéreo (24-nov, pedido de Marino: centros, cabezazos, voleas y chilenas)
    VEL_ALTURA: 12,            // m/s hacia arriba con altura 1
    GRAVEDAD: 9.8, REBOTE: 0.5,
    ROCE_AIRE: 0.9,            // en el aire el balón casi no se frena
    ALTURA_JUGADOR: 2.4,       // hasta dónde alcanza un jugador saltando
    ALTURA_ARQUERO: 2.8,       // el arquero, dentro de su área
    ALTURA_ARCO: 2.44,         // el travesaño
    ALTURA_CABEZA: 1.3,        // por encima de esto, el toque es de cabeza
    ALTURA_VOLEA: 0.4,         // entre esto y la cabeza: volea (chilena si es fuerte)
    FUERZA_CABEZA: 0.6,        // un cabezazo no sale con más fuerza que esta
    ROCE: 0.55,                // el balón pierde ≈ 42 % de su velocidad por segundo
    ESPERA_PATEO: 0.35,        // s entre dos pateos del mismo jugador
    RADIO: 0.45,               // los jugadores no se atraviesan
    DURACION: 360,             // segundos de juego (dos tiempos de 180)
    LIMITE_MS: 20,             // un cerebro que tarda más de esto en decidir pierde el turno
  };

  // Formación de salida (4-4-2), en coordenadas del propio equipo (su arco en x = 0).
  const BASE = [
    [4, 34],
    [20, 10], [18, 26], [18, 42], [20, 58],
    [36, 10], [34, 26], [34, 42], [36, 58],
    [48, 26], [48, 42],
  ];

  function azar(semilla) {               // mulberry32: el mismo azar en cualquier equipo y navegador
    let a = semilla >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v));

  // Convierte el texto que entregó la IA en una función aislada: no ve el motor ni al rival.
  function compilar(codigo, semilla) {
    const rnd = azar(semilla);
    const mates = Object.create(Math);
    mates.random = rnd;
    const f = new Function("Math", "window", "document", "globalThis", "self", "require", "process", "fetch",
      '"use strict";\n' + codigo + '\n;return (typeof decidir === "function") ? decidir : null;');
    const d = f(mates, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
    if (typeof d !== "function") throw new Error("El código no define la función decidir(estado)");
    return d;
  }

  function Partido(local, visitante, opciones) {
    const o = opciones || {};
    const semilla = o.semilla || 1;
    const prorroga = o.prorroga || 0;
    const rnd = azar(semilla);
    const reloj = o.reloj || (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
    const eq = [local, visitante].map((e, i) => ({
      nombre: e.nombre, color: e.color, goles: 0, fallos: 0, lentos: 0, ultimoError: "",
      decidir: null, codigo: e.codigo, lado: i,     // lado 0 ataca hacia +x en la cancha real
      pateos: 0, pases: 0, tiros: 0, posesion: 0,
    }));
    eq.forEach((e, i) => {
      try { e.decidir = compilar(e.codigo, semilla * 7919 + i + 1); }
      catch (err) { e.ultimoError = String(err && err.message || err); e.fallos = -1; }
    });

    const P = this;
    P.C = C; P.equipos = eq; P.t = 0; P.paso = 0; P.terminado = false;
    P.balon = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ultimo: null };   // ultimo = {equipo, n}
    P.jug = [];                                            // 22 jugadores en coordenadas reales
    P.eventos = [];                                        // goles, saques, errores (para la transmisión)
    P.pausa = 0;                                           // segundos de espera tras un gol o un saque
    P.saque = null;                                        // {equipo, hasta}: el rival no se acerca
    P.mitad = 1;

    // Coordenadas: reales (x 0..105). El equipo 0 defiende x = 0; el equipo 1 defiende x = 105.
    const aReal = (e, x, y) => (e === 0 ? [x, y] : [C.LARGO - x, C.ANCHO - y]);
    const dePropio = aReal;                                // la transformación es su propia inversa

    for (let e = 0; e < 2; e++) for (let n = 0; n < 11; n++)
      P.jug.push({ e, n, x: 0, y: 0, vx: 0, vy: 0, ox: 0, oy: 0, espera: 0, pateo: null, ang: e ? Math.PI : 0 });

    function colocar(saca) {
      for (const j of P.jug) {
        let [bx, by] = BASE[j.n];
        if (j.e === saca && j.n === 9) { bx = 52; by = 34; }
        if (j.e === saca && j.n === 10) { bx = 51; by = 37.5; }
        if (j.e !== saca && j.n >= 9) bx = 42;
        const [x, y] = aReal(j.e, bx, by);
        j.x = x; j.y = y; j.vx = j.vy = 0; j.ox = x; j.oy = y; j.espera = 0; j.pateo = null;
      }
      Object.assign(P.balon, { x: C.LARGO / 2, y: C.ANCHO / 2, z: 0, vx: 0, vy: 0, vz: 0, ultimo: null });
      P.saque = { equipo: saca, hasta: P.t + 3 };
      P.pausa = 1.2;
    }
    colocar(0);

    function vista(e) {                                    // lo que ve el cerebro del equipo e
      const yo = eq[e], otro = eq[1 - e];
      const tr = (j) => {
        const [x, y] = dePropio(e, j.x, j.y);
        const s = e === 0 ? 1 : -1;
        return { n: j.n, x, y, vx: j.vx * s, vy: j.vy * s };
      };
      const [bx, by] = dePropio(e, P.balon.x, P.balon.y);
      const s = e === 0 ? 1 : -1;
      return {
        tiempo: P.t, duracion: C.DURACION, mitad: P.mitad,
        marcador: { propio: yo.goles, rival: otro.goles },
        balon: { x: bx, y: by, z: P.balon.z, vx: P.balon.vx * s, vy: P.balon.vy * s, vz: P.balon.vz },
        mios: P.jug.filter((j) => j.e === e).map(tr),
        rivales: P.jug.filter((j) => j.e !== e).map(tr),
        saque: P.saque ? (P.saque.equipo === e ? "propio" : "rival") : null,
        cancha: { largo: C.LARGO, ancho: C.ANCHO, arco: C.ARCO, areaX: C.AREA_X, areaY: C.AREA_Y,
                  alcance: C.ALCANCE, velJugador: C.VEL_JUGADOR, velPateo: C.VEL_PATEO,
                  alturaArco: C.ALTURA_ARCO, alturaJugador: C.ALTURA_JUGADOR },
      };
    }

    function pensar(e) {
      const equipo = eq[e];
      if (!equipo.decidir) return;
      let ordenes = null;
      const t0 = reloj();
      try { ordenes = equipo.decidir(vista(e)); }
      catch (err) {
        equipo.fallos++; equipo.ultimoError = String(err && err.message || err);
        if (equipo.fallos <= 3) P.eventos.push({ t: P.t, tipo: "error", equipo: e, texto: equipo.ultimoError });
      }
      if (reloj() - t0 > C.LIMITE_MS) { equipo.lentos++; ordenes = null; }
      const mios = P.jug.filter((j) => j.e === e);
      for (const j of mios) {
        const or = Array.isArray(ordenes) ? ordenes[j.n] : null;
        j.pateo = null;
        if (!or || typeof or !== "object") continue;       // sin orden: sigue hacia donde iba
        if (or.ir && typeof or.ir === "object") {
          const [x, y] = aReal(e, limitar(num(or.ir.x, j.x), -2, C.LARGO + 2), limitar(num(or.ir.y, j.y), -2, C.ANCHO + 2));
          j.ox = x; j.oy = y;
        }
        if (or.patear && typeof or.patear === "object") {
          const [x, y] = aReal(e, num(or.patear.x, C.LARGO), num(or.patear.y, C.ANCHO / 2));
          j.pateo = { x, y, fuerza: limitar(num(or.patear.fuerza, 1), 0.05, 1), altura: limitar(num(or.patear.altura, 0), 0, 1) };
        }
      }
    }

    function enAreaPropia(j) {
      const [x, y] = dePropio(j.e, j.x, j.y);
      return x <= C.AREA_X && Math.abs(y - C.ANCHO / 2) <= C.AREA_Y / 2;
    }

    function evento(tipo, extra) { P.eventos.push(Object.assign({ t: P.t, tipo }, extra)); }

    function reanudar(equipo, x, y, tipo) {                // saque de banda, de arco o de esquina (simplificados)
      x = limitar(x, 0.5, C.LARGO - 0.5); y = limitar(y, 0.5, C.ANCHO - 0.5);
      Object.assign(P.balon, { x, y, z: 0, vx: 0, vy: 0, vz: 0, ultimo: null });
      let mejor = null, dm = 1e9;
      for (const j of P.jug) if (j.e === equipo && (tipo !== "arco" ? j.n !== 0 : j.n === 0)) {
        const d = Math.hypot(j.x - x, j.y - y);
        if (d < dm) { dm = d; mejor = j; }
      }
      if (mejor) { mejor.x = x - (equipo === 0 ? 0.6 : -0.6); mejor.y = y; mejor.vx = mejor.vy = 0; mejor.espera = 0; }
      for (const j of P.jug) if (j.e !== equipo) {         // el rival, a 7 m
        const d = Math.hypot(j.x - x, j.y - y);
        if (d < 7) { const k = 7 / Math.max(d, 0.01); j.x = limitar(x + (j.x - x) * k, 0, C.LARGO); j.y = limitar(y + (j.y - y) * k, 0, C.ANCHO); }
      }
      P.saque = { equipo, hasta: P.t + 3 };
      P.pausa = 0.8;
      evento(tipo, { equipo });
    }

    P.avanzar = function () {
      if (P.terminado) return;
      if (P.pausa > 0) { P.pausa -= C.DT; return; }
      if (P.paso % C.CADA === 0) {
        if ((P.paso / C.CADA) % 2 === 0) { pensar(0); pensar(1); } else { pensar(1); pensar(0); }
      }
      P.paso++; P.t += C.DT;
      if (P.saque && P.t > P.saque.hasta) P.saque = null;
      const b = P.balon;

      // Jugadores
      for (const j of P.jug) {
        let dx = j.ox - j.x, dy = j.oy - j.y;
        const d = Math.hypot(dx, dy);
        let qx = 0, qy = 0;
        const conBalon = b.ultimo && b.ultimo.e === j.e && b.ultimo.n === j.n && Math.hypot(j.x - b.x, j.y - b.y) < C.ALCANCE;
        const tope = C.VEL_JUGADOR * (conBalon ? C.CON_BALON : 1);     // con el balón en los pies se corre más lento
        if (d > 0.15) { const v = Math.min(tope, d * 4); qx = dx / d * v; qy = dy / d * v; }
        const ax = qx - j.vx, ay = qy - j.vy, a = Math.hypot(ax, ay), m = C.ACEL_JUGADOR * C.DT;
        if (a > m) { j.vx += ax / a * m; j.vy += ay / a * m; } else { j.vx = qx; j.vy = qy; }
        j.x = limitar(j.x + j.vx * C.DT, -2, C.LARGO + 2); j.y = limitar(j.y + j.vy * C.DT, -2, C.ANCHO + 2);
        if (Math.hypot(j.vx, j.vy) > 0.5) j.ang = Math.atan2(j.vy, j.vx);
        if (j.espera > 0) j.espera -= C.DT;
        if (P.saque && j.e !== P.saque.equipo) {           // durante un saque el rival no se acerca
          const r = Math.hypot(j.x - b.x, j.y - b.y);
          if (r < 7 && Math.hypot(b.vx, b.vy) < 0.5) { const k = 7 / Math.max(r, 0.01); j.x = b.x + (j.x - b.x) * k; j.y = b.y + (j.y - b.y) * k; }
        }
      }
      for (let i = 0; i < P.jug.length; i++) for (let k = i + 1; k < P.jug.length; k++) {   // no se atraviesan
        const p = P.jug[i], q = P.jug[k], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
        if (d < 2 * C.RADIO && d > 1e-6) { const s = (2 * C.RADIO - d) / 2; p.x -= dx / d * s; p.y -= dy / d * s; q.x += dx / d * s; q.y += dy / d * s; }
      }

      // Balón
      b.x += b.vx * C.DT; b.y += b.vy * C.DT;
      if (b.z > 0 || b.vz > 0) {
        b.vz -= C.GRAVEDAD * C.DT; b.z += b.vz * C.DT;
        if (b.z <= 0) { b.z = 0; b.vz = b.vz < -2 ? -b.vz * C.REBOTE : 0; }
      }
      const f = Math.pow(b.z > 0.05 ? C.ROCE_AIRE : C.ROCE, C.DT); b.vx *= f; b.vy *= f;
      if (Math.hypot(b.vx, b.vy) < 0.15) { b.vx = 0; b.vy = 0; }

      // ¿Quién llega al balón? Si hay varios, el orden se sortea (con la semilla) para no favorecer a nadie.
      const cerca = [];
      for (const j of P.jug) {
        const arq = j.n === 0 && enAreaPropia(j);
        const alc = arq ? C.ALCANCE_ARQUERO : C.ALCANCE;
        if (j.espera <= 0 && b.z <= (arq ? C.ALTURA_ARQUERO : C.ALTURA_JUGADOR) && Math.hypot(j.x - b.x, j.y - b.y) <= alc) {
          // Corrección del 24-nov (tras la primera ronda, 0-0 con 82 tiros): al arquero se le escapan los tiros
          // fuertes. A 12 m/s o menos nunca falla; desde ahí la probabilidad sube hasta 0,4 a 24 m/s o más.
          const vb = Math.hypot(b.vx, b.vy);
          const ajeno = !b.ultimo || b.ultimo.e !== j.e || b.ultimo.n !== j.n;
          if (j.n === 0 && ajeno && vb > C.ARQUERO_SEGURO && rnd() < Math.min(C.ARQUERO_FALLA, (vb - C.ARQUERO_SEGURO) / 30)) {
            j.espera = 0.6; evento("escapa", { equipo: j.e }); continue;
          }
          cerca.push(j);
        }
      }
      if (cerca.length) {
        const j = cerca[Math.floor(rnd() * cerca.length)];
        const vel = Math.hypot(b.vx, b.vy);
        const equipo = eq[j.e];
        if (!b.ultimo || b.ultimo.e !== j.e || b.ultimo.n !== j.n) {
          if (b.ultimo && b.ultimo.e === j.e) equipo.pases++;
        }
        if (j.pateo) {
          let dx = j.pateo.x - b.x, dy = j.pateo.y - b.y; const d = Math.hypot(dx, dy) || 1;
          // Según la altura del balón al tocarlo: pie, volea (chilena si es fuerte) o cabeza. En el aire hay menos puntería.
          let fuerza = j.pateo.fuerza, altura = j.pateo.altura, k = 1, jugada = null;
          if (b.z > C.ALTURA_CABEZA) { fuerza = Math.min(fuerza, C.FUERZA_CABEZA); altura = Math.min(altura, 0.4); k = 1.5; jugada = "cabezazo"; }
          else if (b.z > C.ALTURA_VOLEA) { k = 1.5; jugada = fuerza > 0.7 ? "chilena" : "volea"; }
          const error = (rnd() - 0.5) * 2 * (0.03 + 0.09 * fuerza) * k;   // radianes: más fuerza, menos puntería
          const ang = Math.atan2(dy, dx) + error, v = C.VEL_PATEO * fuerza;
          b.vx = Math.cos(ang) * v; b.vy = Math.sin(ang) * v; b.vz = C.VEL_ALTURA * altura;
          j.espera = C.ESPERA_PATEO; equipo.pateos++;
          const [px] = dePropio(j.e, j.pateo.x, j.pateo.y);
          const [mx, my] = dePropio(j.e, j.x, j.y);
          if (!jugada && altura >= 0.3 && mx > 70 && Math.abs(my - C.ANCHO / 2) > 14 && px > 85) jugada = "centro";
          if (jugada) { equipo[jugada] = (equipo[jugada] || 0) + 1; evento(jugada, { equipo: j.e, n: j.n }); }
          if (px >= C.LARGO - 1 && (j.pateo.fuerza > 0.6 || jugada === "cabezazo")) { equipo.tiros++; evento("tiro", { equipo: j.e, n: j.n }); }
          if (P.saque && P.saque.equipo === j.e) P.saque = null;
        } else if (j.n === 0 && enAreaPropia(j) && vel > 6) {
          b.vx = 0; b.vy = 0; b.z = 0; b.vz = 0; evento("atajada", { equipo: j.e });          // el arquero la detiene
        } else {
          b.vx = j.vx * 1.05; b.vy = j.vy * 1.05; b.z = 0; b.vz = 0;       // la controla y la lleva pegada al pie
          const dd = Math.hypot(j.vx, j.vy);
          if (dd > 0.5) { b.x = j.x + j.vx / dd * 0.7; b.y = j.y + j.vy / dd * 0.7; }
        }
        b.ultimo = { e: j.e, n: j.n };
      }
      if (b.ultimo) eq[b.ultimo.e].posesion++;

      // Gol, saque de arco, de esquina o de banda
      const enArco = Math.abs(b.y - C.ANCHO / 2) < C.ARCO / 2 && b.z < C.ALTURA_ARCO;   // por encima del travesaño no es gol
      if (b.x < 0 || b.x > C.LARGO) {
        const defiende = b.x < 0 ? 0 : 1;
        if (enArco) {
          const anota = 1 - defiende; eq[anota].goles++;
          evento("gol", { equipo: anota, n: b.ultimo ? b.ultimo.n : -1, propia: !!(b.ultimo && b.ultimo.e === defiende),
                          marcador: [eq[0].goles, eq[1].goles] });
          colocar(defiende); P.pausa = 2.5;
          if (P.mitad === 3) { P.terminado = true; evento("final", { marcador: [eq[0].goles, eq[1].goles], oro: anota }); return; }
        } else if (b.ultimo && b.ultimo.e === defiende) {
          reanudar(1 - defiende, b.x < 0 ? 0.5 : C.LARGO - 0.5, b.y < C.ANCHO / 2 ? 0.5 : C.ANCHO - 0.5, "esquina");
        } else {
          reanudar(defiende, defiende === 0 ? 5.5 : C.LARGO - 5.5, C.ANCHO / 2, "arco");
        }
      } else if (b.y < 0 || b.y > C.ANCHO) {
        const saca = b.ultimo ? 1 - b.ultimo.e : 0;
        reanudar(saca, b.x, b.y < 0 ? 0.5 : C.ANCHO - 0.5, "banda");
      }

      if (P.mitad === 1 && P.t >= C.DURACION / 2) { P.mitad = 2; evento("descanso", {}); colocar(1); }
      // Solo en la final (opciones.prorroga = segundos): si termina empatada, tiempo extra con gol de oro (mitad 3).
      if (P.mitad === 2 && P.t >= C.DURACION && prorroga > 0 && eq[0].goles === eq[1].goles) {
        P.mitad = 3; evento("prorroga", {}); colocar(0);
      } else if (P.t >= C.DURACION + (P.mitad === 3 ? prorroga : 0)) {
        P.terminado = true; evento("final", { marcador: [eq[0].goles, eq[1].goles] });
      }
    };

    P.jugarCompleto = function () { while (!P.terminado) P.avanzar(); return P.resumen(); };
    P.resumen = function () {
      const tot = eq[0].posesion + eq[1].posesion || 1;
      return { semilla, prorroga: P.mitad === 3, equipos: eq.map((e) => ({ nombre: e.nombre, goles: e.goles, tiros: e.tiros, pases: e.pases,
        pateos: e.pateos, centros: e.centro || 0, cabezazos: e.cabezazo || 0, voleas: e.volea || 0, chilenas: e.chilena || 0, posesion: Math.round(100 * e.posesion / tot), fallos: e.fallos, lentos: e.lentos,
        error: e.ultimoError })), goles: P.eventos.filter((v) => v.tipo === "gol") };
    };
  }

  const API = { C, BASE, Partido, compilar, azar };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else raiz.Mundial = API;
})(typeof window !== "undefined" ? window : globalThis);
