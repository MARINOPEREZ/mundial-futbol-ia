function decidir(estado) {
  const ordenes = [];
  const balon = estado.balon;
  const mios = estado.mios;
  
  // Encontrar el jugador de campo más cercano al balón
  let masCercano = -1;
  let distMin = Infinity;
  const distancias = [];
  
  for (let i = 1; i < 11; i++) {
    const dist = Math.hypot(mios[i].x - balon.x, mios[i].y - balon.y);
    distancias[i] = dist;
    if (dist < distMin) {
      distMin = dist;
      masCercano = i;
    }
  }
  
  const atacando = balon.x > 52;
  
  for (let i = 0; i < 11; i++) {
    const jugador = mios[i];
    const orden = {};
    
    if (i === 0) {
      // ARQUERO - Lógica especializada
      const distBalon = Math.hypot(balon.x - jugador.x, balon.y - jugador.y);
      const balonPeligroso = balon.x < 28 && (balon.vx < -1 || balon.x < 12);
      
      if (balonPeligroso) {
        // Salir agresivamente a interceptar
        orden.ir = { x: Math.max(2, Math.min(18, balon.x)), y: balon.y };
        
        if (distBalon < 2.2 && balon.z < 2.8 && balon.z >= 0) {
          // Atrapar y despejar largo
          const targetY = 34 + (Math.random() - 0.5) * 30;
          orden.patear = { x: 85, y: targetY, fuerza: 0.9, altura: 0.6 };
        }
      } else {
        // Posición base, siguiendo el balón lateralmente
        const targetY = 34 + (balon.y - 34) * 0.4;
        orden.ir = { x: 3, y: Math.max(5, Math.min(63, targetY)) };
      }
      
    } else if (i <= 4) {
      // DEFENSORES (1-4) - Línea de 4
      const distBalon = distancias[i];
      
      const posiciones = [
        { x: 20, y: 10 },
        { x: 22, y: 25 },
        { x: 22, y: 43 },
        { x: 20, y: 58 }
      ];
      
      const posBase = posiciones[i - 1];
      
      if (balon.x < 55 && i === masCercano) {
        // Ir al balón si es el más cercano y está en zona defensiva
        orden.ir = { x: balon.x, y: balon.y };
        
        if (distBalon < 1.3) {
          // Despejar hacia adelante
          const targetX = 85 + Math.random() * 15;
          const targetY = 34 + (Math.random() - 0.5) * 30;
          orden.patear = { x: targetX, y: targetY, fuerza: 0.85, altura: 0.4 };
        }
      } else {
        // Mantener posición defensiva
        const ajusteY = (balon.y - 34) * 0.15;
        orden.ir = { 
          x: posBase.x + (atacando ? 10 : 0), 
          y: Math.max(5, Math.min(63, posBase.y + ajusteY))
        };
      }
      
    } else if (i <= 8) {
      // MEDIOCAMPISTAS (5-8) - Línea de 4
      const distBalon = distancias[i];
      
      const posiciones = [
        { x: 45, y: 12 },
        { x: 48, y: 28 },
        { x: 48, y: 40 },
        { x: 45, y: 56 }
      ];
      
      const posBase = posiciones[i - 5];
      
      if (i === masCercano && distBalon < 25) {
        // Presionar el balón
        orden.ir = { x: balon.x, y: balon.y };
        
        if (distBalon < 1.3) {
          // Tengo el balón
          if (balon.x > 75) {
            // Cerca del arco, tirar
            const targetY = 34 + (Math.random() - 0.5) * 6;
            orden.patear = { x: 105, y: targetY, fuerza: 1, altura: 0 };
          } else {
            // Pasar hacia adelante
            const targetX = 90 + Math.random() * 10;
            const targetY = 34 + (Math.random() - 0.5) * 25;
            orden.patear = { x: targetX, y: targetY, fuerza: 0.75, altura: 0.3 };
          }
        }
      } else {
        // Mantener posición, avanzando si atacamos
        const avance = atacando ? 15 : 0;
        const ajusteY = (balon.y - 34) * 0.2;
        orden.ir = {
          x: posBase.x + avance,
          y: Math.max(5, Math.min(63, posBase.y + ajusteY))
        };
      }
      
    } else {
      // DELANTEROS (9-10) - Pareja de ataque
      const distBalon = distancias[i];
      
      const posiciones = [
        { x: 82, y: 22 },
        { x: 82, y: 46 }
      ];
      
      const posBase = posiciones[i - 9];
      
      if (i === masCercano && distBalon < 30) {
        // Ir al balón si está cerca
        orden.ir = { x: balon.x, y: balon.y };
        
        if (distBalon < 1.3) {
          // Siempre tirar al arco
          const targetY = 34 + (Math.random() - 0.5) * 5;
          orden.patear = { x: 105, y: targetY, fuerza: 1, altura: 0 };
        }
      } else {
        // Buscar espacios adelante
        const ajusteX = Math.max(0, (balon.x - 52) * 0.3);
        const ajusteY = (balon.y - 34) * 0.25;
        orden.ir = {
          x: Math.min(100, posBase.x + ajusteX),
          y: Math.max(5, Math.min(63, posBase.y + ajusteY))
        };
      }
    }
    
    ordenes.push(orden);
  }
  
  return ordenes;
}
