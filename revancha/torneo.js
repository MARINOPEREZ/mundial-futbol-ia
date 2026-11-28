// La revancha (video 18), repetible: node torneo.js  (lee cerebros/equipos.json; escribe torneo.json)
// Reglas fijadas el 27-nov ANTES de recibir los códigos (notas.md):
//  Parte 1, «¿aprendió?»: la versión nueva de cada IA del primer mundial contra su versión vieja, dos partidos
//    cambiando el local (semillas 1841 a 1848). Fuera del torneo.
//  Parte 2: todos contra todos a UNA vuelta (semillas 1801 en adelante, el local alterna), semifinales 1.º-4.º (1821)
//    y 2.º-3.º (1822) y final (1830). Semifinal o final empatada: 2 minutos de tiempo extra con gol de oro; si sigue,
//    pasa el mejor de la tabla.
const fs = require("fs"), path = require("path");
const M = require("./motor.js");
const aqui = (...p) => path.join(__dirname, ...p);
const todos = JSON.parse(fs.readFileSync(aqui("cerebros", "equipos.json"), "utf8"));
const ORDEN = ["chatgpt", "gemini", "claude", "grok", "copilot", "qwen"];
const ids = ORDEN.filter((id) => todos[id]);                       // las que entregaron código
const eq = (id) => ({ nombre: todos[id].nombre, color: todos[id].color, codigo: fs.readFileSync(aqui("cerebros", todos[id].archivo), "utf8") });
function jugar(local, visita, semilla, opciones) {
  const r = new M.Partido(eq(local), eq(visita), Object.assign({ semilla }, opciones)).jugarCompleto();
  const [a, b] = r.equipos;
  console.log(`semilla ${semilla}: ${a.nombre} ${a.goles} - ${b.goles} ${b.nombre} | tiros ${a.tiros}/${b.tiros} · pases ${a.pases}/${b.pases} · posesión ${a.posesion}/${b.posesion} % · fallos ${a.fallos}/${b.fallos} · lentos ${a.lentos}/${b.lentos}${a.error ? " · error local: " + a.error : ""}${b.error ? " · error visitante: " + b.error : ""}${r.prorroga ? " · con tiempo extra" : ""}`);
  return { local, visita, semilla, resumen: r };
}

console.log("PARTE 1 · ¿APRENDIÓ? (versión nueva contra versión vieja)");
const espejo = [];
["chatgpt", "gemini", "claude", "grok"].forEach((id, i) => {
  const v = id + "_v16"; if (!todos[id] || !todos[v]) return;
  espejo.push(jugar(id, v, 1841 + 2 * i), jugar(v, id, 1842 + 2 * i));
});

console.log("\nPARTE 2 · TODOS CONTRA TODOS");
const tabla = {}; ids.forEach((id) => (tabla[id] = { id, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }));
const partidos = []; let n = 0;
for (let i = 0; i < ids.length; i++) for (let k = i + 1; k < ids.length; k++) {
  const [l, v] = n % 2 === 0 ? [ids[i], ids[k]] : [ids[k], ids[i]];
  const p = jugar(l, v, 1801 + n); n++; partidos.push(p);
  const [a, b] = p.resumen.equipos, tl = tabla[l], tv = tabla[v];
  tl.pj++; tv.pj++; tl.gf += a.goles; tl.gc += b.goles; tv.gf += b.goles; tv.gc += a.goles;
  if (a.goles > b.goles) { tl.g++; tv.p++; tl.pts += 3; } else if (a.goles < b.goles) { tv.g++; tl.p++; tv.pts += 3; } else { tl.e++; tv.e++; tl.pts++; tv.pts++; }
}
function directo(x, y) { let d = 0;
  for (const p of partidos) { const [a, b] = p.resumen.equipos;
    if (p.local === x && p.visita === y) d += a.goles - b.goles; if (p.local === y && p.visita === x) d += b.goles - a.goles; }
  return d; }
const orden = Object.values(tabla).sort((x, y) => y.pts - x.pts || (y.gf - y.gc) - (x.gf - x.gc) || y.gf - x.gf || directo(y.id, x.id));
console.log("\nTABLA");
orden.forEach((t, i) => console.log(`${i + 1}. ${todos[t.id].nombre} (${todos[t.id].ia}) · ${t.pts} pts · ${t.g}G ${t.e}E ${t.p}P · goles ${t.gf}-${t.gc}`));

function llave(mejor, peor, semilla, nombre) {        // el mejor de la tabla es local y pasa si sigue empatada
  console.log("\n" + nombre);
  const p = jugar(mejor, peor, semilla, { prorroga: 120 }), [a, b] = p.resumen.equipos;
  p.gana = a.goles > b.goles ? mejor : a.goles < b.goles ? peor : mejor; p.porTabla = a.goles === b.goles;
  console.log(`Pasa: ${todos[p.gana].nombre} (${todos[p.gana].ia})${p.porTabla ? " · empate tras el tiempo extra: pasa el mejor de la tabla" : p.resumen.prorroga ? " · con gol de oro" : ""}`);
  return p;
}
const pos = (id) => orden.findIndex((t) => t.id === id);
let semis = [], final = null, campeon = null;
if (orden.length >= 4) {
  semis = [llave(orden[0].id, orden[3].id, 1821, "SEMIFINAL 1"), llave(orden[1].id, orden[2].id, 1822, "SEMIFINAL 2")];
  const f = [semis[0].gana, semis[1].gana].sort((x, y) => pos(x) - pos(y));
  final = llave(f[0], f[1], 1830, "FINAL"); campeon = final.gana;
} else if (orden.length >= 2) { final = llave(orden[0].id, orden[1].id, 1830, "FINAL"); campeon = final.gana; }
if (campeon) console.log(`\nCAMPEÓN: ${todos[campeon].nombre} (${todos[campeon].ia})`);
if (!process.argv.includes("--ensayo")) fs.writeFileSync(aqui("torneo.json"), JSON.stringify({ espejo, partidos, tabla: orden, semis, final, campeon }, null, 1));
