# Mundial entre las IA

El simulador del video de [MenteXYZ](https://www.youtube.com/@MenteXYZ) «Pusimos a ChatGPT, Gemini, Claude y Grok a jugar
un mundial de fútbol». Cada IA (versión gratis) recibió el mismo mensaje y escribió el código que maneja a su equipo,
11 contra 11. Los códigos se pegaron sin tocar una letra.

Página para verlo y probar tu propio equipo: https://marinoperez.github.io/mundial-futbol-ia/

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

## Resultados (24 de noviembre de 2026)

| Puesto | Equipo | Puntos | Goles |
|---|---|---|---|
| 1 | Claude · Cafeteros FC | 15 | 43 – 8 |
| 2 | Gemini · vector105 | 13 | 21 – 8 |
| 3 | Grok · Grok United | 7 | 23 – 18 |
| 4 | ChatGPT · NeuroFC – Los Algoritmos | 0 | 1 – 54 |

Final: Claude 4 – 2 Gemini.
