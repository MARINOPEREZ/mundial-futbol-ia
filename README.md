# Mundial entre las IA

El simulador del video de [MenteXYZ](https://www.youtube.com/@MenteXYZ) «Pusimos a ChatGPT, Gemini, Claude y Grok a jugar
un mundial de fútbol». Cada IA (versión gratis) recibió el mismo mensaje y escribió el código que maneja a su equipo,
11 contra 11. Los códigos se pegaron sin tocar una letra.

Página para verlo y probar tu propio equipo: https://marinoperez.github.io/mundial-futbol-ia/

## La revancha (27 de noviembre de 2026)

Segundo torneo, en la carpeta [`revancha/`](revancha/) y en https://marinoperez.github.io/mundial-futbol-ia/revancha/
(video «ChatGPT recibió 54 goles en el mundial de las IA: esta fue su revancha»). A las cuatro IA del primer mundial
les mostramos sus resultados y su propio código y tuvieron un mensaje para mejorarlo; entraron Copilot y Qwen, que
pidió el público.

- `revancha/mensajes/`: el mensaje que recibió cada una (`nueva.txt` es el de Copilot y Qwen).
- `revancha/cerebros/`: los códigos tal como los entregaron. `chatgpt_r1.js` y `chatgpt_r2.js` fallan en cada jugada
  («retro is not defined»): con sus dos mensajes gastados compitió `chatgpt_r2.js`, un equipo que no se mueve.
  `chatgpt_extra3.js` es un tercer mensaje fuera de reglas (`extra.js`, `extra.json`): no cuenta.
- `revancha/torneo.js`, `torneo.json`, `torneo.txt`: versión nueva contra vieja (semillas 1841 a 1848), todos contra
  todos (1801 a 1815), semifinales (1821 y 1822) y final (1830).
- `revancha/partido.html`: la transmisión con los jugadores nuevos. El motor (`motor.js`) es el mismo.

| Puesto | Equipo | Puntos | Goles |
|---|---|---|---|
| 1 | Gemini · vector105 | 13 | 22 – 6 |
| 2 | Claude · Cafeteros FC | 12 | 25 – 9 |
| 3 | Qwen · Quantum FC | 7 | 26 – 25 |
| 4 | Copilot · Neural Press FC | 7 | 10 – 23 |
| 5 | Grok · Grok United | 4 | 26 – 24 |
| 6 | ChatGPT · NeuroFC – Los Algoritmos | 0 | 0 – 22 |

Semifinales: Gemini 8 – 1 Copilot y Claude 10 – 2 Qwen. Final: Gemini 1 – 0 Claude.

## Qué hay aquí

- `motor.js`: el simulador (reglas, física del balón, arquero). Funciona en Node y en el navegador.
- `cerebros/`: el código de cada equipo tal como lo entregó su IA. `grok_m1.js` es el primer código de Grok, que fallaba
  («META_X is not defined»); el que jugó es `grok_m2.js`. ChatGPT entregó código en su segundo mensaje de la segunda ronda.
- `mensaje.txt`: el mensaje exacto que recibieron las cuatro.
- `torneo.js` y `torneo.json`: el torneo completo y sus resultados (semillas 1601 a 1612 y la final, 1616).
- `jugadas.json`: centros, cabezazos, voleas y chilenas de cada partido.
- `partido.html`: la transmisión en 3D. Solo dibuja lo que calcula el motor.
- `ronda1/`: los códigos de la primera ronda, que se anuló.

## Repetir el torneo

```
node torneo.js
```

Con las mismas semillas salen los mismos marcadores.

## Transparencia

- El simulador lo programamos nosotros con Claude Code, y el campeón fue Claude. El equipo de Claude lo escribió su
  versión gratis en un chat sin memoria, que no conocía el simulador.
- La primera ronda se anuló: el arquero era imbatible y hubo tres empates a cero. Se corrigió el arquero, se sumó el
  juego aéreo y se repitió todo con chats nuevos.
- Son partidos de seis minutos con reglas simples (sin faltas ni fuera de juego). Esto mide quién programó mejor este
  juego, y nada más.

## Resultados del primer mundial (24 de noviembre de 2026)

| Puesto | Equipo | Puntos | Goles |
|---|---|---|---|
| 1 | Claude · Cafeteros FC | 15 | 43 – 8 |
| 2 | Gemini · vector105 | 13 | 21 – 8 |
| 3 | Grok · Grok United | 7 | 23 – 18 |
| 4 | ChatGPT · NeuroFC – Los Algoritmos | 0 | 1 – 54 |

Final: Claude 4 – 2 Gemini.

## Licencia

MIT (ver `LICENSE`): puedes usar, copiar y modificar el simulador citando a MenteXYZ. Los archivos de `cerebros/` y
`ronda1/` y `revancha/cerebros/` son las respuestas de cada asistente (ChatGPT, Gemini, Claude, Grok, Copilot y Qwen), publicadas tal como las entregaron.
