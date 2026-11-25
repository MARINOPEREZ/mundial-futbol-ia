// El torneo completo, repetible: node torneo.js  (lee cerebros/equipos.json; escribe torneo.json)
// Todos contra todos a ida y vuelta (semillas 1601 a 1606) y final entre los dos primeros (semilla 1616,
// tiempo extra de 2 minutos con gol de oro; si sigue empatada, gana el mejor de la tabla).
// node torneo.js --ensayo  usa los equipos de ensayo (no escribe torneo.json).
const fs = require("fs"), path = require("path");
const M = require("./motor.js");
const aqui = (...p) => path.join(__dirname, ...p);
const ensayo = process.argv.includes("--ensayo");
const todos = JSON.parse(fs.readFileSync(aqui("cerebros", "equipos.json"), "utf8"));
const ids = Object.keys(todos).filter((id) => ensayo ? id.startsWith("ensayo") : !id.startsWith("ensayo"));
if (ids.length < 2) { console.log("Faltan equipos en cerebros/equipos.json"); process.exit(1); }
const eq = (id) => ({ nombre: todos[id].nombre, color: todos[id].color, codigo: fs.readFileSync(aqui("cerebros", todos[id].archivo), "utf8") });

// Orden fijado antes de probar: cada pareja juega dos veces, cambiando el local.
const pares = [];
for (let i = 0; i < ids.length; i++) for (let k = i + 1; k < ids.length; k++) pares.push([ids[i], ids[k]]);
const calendario = pares.concat(pares.map(([a, b]) => [b, a]));

const tabla = {}; ids.forEach((id) => (tabla[id] = { id, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }));
const partidos = [];
function jugar(local, visita, semilla, opciones) {
  const r = new M.Partido(eq(local), eq(visita), Object.assign({ semilla }, opciones)).jugarCompleto();
  const [a, b] = r.equipos;
  console.log(`semilla ${semilla}: ${a.nombre} ${a.goles} - ${b.goles} ${b.nombre} | tiros ${a.tiros}/${b.tiros} · pases ${a.pases}/${b.pases} · posesión ${a.posesion}/${b.posesion} % · fallos ${a.fallos}/${b.fallos} · lentos ${a.lentos}/${b.lentos}${a.error ? " · error local: " + a.error : ""}${b.error ? " · error visitante: " + b.error : ""}`);
  return { local, visita, semilla, resumen: r };
}
calendario.forEach(([l, v], i) => {
  const p = jugar(l, v, 1601 + i); partidos.push(p);
  const [a, b] = p.resumen.equipos, tl = tabla[l], tv = tabla[v];
  tl.pj++; tv.pj++; tl.gf += a.goles; tl.gc += b.goles; tv.gf += b.goles; tv.gc += a.goles;
  if (a.goles > b.goles) { tl.g++; tv.p++; tl.pts += 3; } else if (a.goles < b.goles) { tv.g++; tl.p++; tv.pts += 3; } else { tl.e++; tv.e++; tl.pts++; tv.pts++; }
});
function directo(x, y) {                      // goles de x menos goles de y en sus dos partidos
  let d = 0;
  for (const p of partidos) { const [a, b] = p.resumen.equipos;
    if (p.local === x && p.visita === y) d += a.goles - b.goles; if (p.local === y && p.visita === x) d += b.goles - a.goles; }
  return d;
}
const orden = Object.values(tabla).sort((x, y) => y.pts - x.pts || (y.gf - y.gc) - (x.gf - x.gc) || y.gf - x.gf || directo(y.id, x.id));
console.log("\nTABLA");
orden.forEach((t, i) => console.log(`${i + 1}. ${todos[t.id].nombre} (${todos[t.id].ia}) · ${t.pts} pts · ${t.g}G ${t.e}E ${t.p}P · goles ${t.gf}-${t.gc}`));

console.log("\nFINAL");
const fin = jugar(orden[0].id, orden[1].id, 1616, { prorroga: 120 });
const [fa, fb] = fin.resumen.equipos;
const extra = fin.resumen.prorroga;
const campeon = fa.goles > fb.goles ? orden[0].id : fa.goles < fb.goles ? orden[1].id : orden[0].id;
console.log(`Campeón: ${todos[campeon].nombre} (${todos[campeon].ia})${extra ? (fa.goles !== fb.goles ? " · con gol de oro" : " · empate tras el tiempo extra: gana el mejor de la tabla") : ""}`);
if (!ensayo) fs.writeFileSync(aqui("torneo.json"), JSON.stringify({ partidos, tabla: orden, final: fin, campeon }, null, 1));
