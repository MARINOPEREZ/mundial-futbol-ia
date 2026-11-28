// EXTRA fuera del torneo (video 18): el código del TERCER mensaje de ChatGPT (las reglas permitían dos) contra su
// versión del primer mundial y contra los otros tres. No cuenta para nada: es para ver qué habría hecho su idea.
const fs = require("fs"), path = require("path"), M = require("./motor.js");
const t = JSON.parse(fs.readFileSync(path.join(__dirname, "cerebros", "equipos.json"), "utf8"));
const eq = (id) => ({ nombre: t[id].nombre, color: t[id].color, codigo: fs.readFileSync(path.join(__dirname, "cerebros", t[id].archivo), "utf8") });
const res = [];
[["chatgpt_extra", "chatgpt_v16", 1851], ["chatgpt_v16", "chatgpt_extra", 1852], ["chatgpt_extra", "gemini", 1853], ["claude", "chatgpt_extra", 1854], ["chatgpt_extra", "grok", 1855]].forEach(([l, v, s]) => {
  const r = new M.Partido(eq(l), eq(v), { semilla: s }).jugarCompleto(), [a, b] = r.equipos;
  console.log(`semilla ${s}: ${a.nombre} ${a.goles} - ${b.goles} ${b.nombre} | tiros ${a.tiros}/${b.tiros} · pases ${a.pases}/${b.pases} · posesión ${a.posesion}/${b.posesion} % · fallos ${a.fallos}/${b.fallos}`);
  res.push({ local: l, visita: v, semilla: s, resumen: r }); });
fs.writeFileSync(path.join(__dirname, "extra.json"), JSON.stringify({ partidos: res }, null, 1));
