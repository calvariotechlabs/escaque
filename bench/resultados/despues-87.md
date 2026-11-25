# Banco de posiciones · 2026-11-25 · commit 141ce1fa9c9f

Huella de los resultados deterministas: `a9712a34` (igual en dos ejecuciones del mismo commit).

Posiciones: 82 (mate-inmediato 9, mate-forzado 4, clavada 5, doblete 6, descubierto 4, sacrificio-correcto 5, sacrificio-incorrecto 4, ganancia-material 5, perdida-material 8, equivalentes 6, tranquila 7, final 7, auditoria 12).

Referencia: Stockfish 17.1, 8000000 nodos por posición, 1 hilo, todas las jugadas valoradas. Metodología en bench/README.md.

## Alfil Beta

| Perfil | Mejor jugada | Equivalente (≤ 30 cp) | Pérdida media | Errores > 2 peones | En tácticas | Mates mantenidos | Tiempo medio | Máximo |
|---|---|---|---|---|---|---|---|---|
| Nivel Fácil (azar con semilla fija por posición) | 28/82 (34 %) | 42/82 (51 %) | 180.7 cp | 18 | 16 | 13/18 (72 %) | 4 ms | 41 ms |
| Nivel Medio (profundidad 3, tope 0,5 s: en posiciones pesadas el reloj decide) | 44/82 (54 %) | 63/82 (77 %) | 48.7 cp | 7 | 6 | 17/18 (94 %) | 9 ms | 108 ms |
| Nivel Difícil (0,9 s de reloj real: depende del equipo) | 50/82 (61 %) | 71/82 (87 %) | 17.5 cp | 1 | 1 | 18/18 (100 %) | 748 ms | 904 ms |
| Alfil Beta a profundidad fija 5 (determinista) | 49/82 (60 %) | 68/82 (83 %) | 28.4 cp | 3 | 3 | 18/18 (100 %) | 49 ms | 504 ms |

Punto de parada del motor (B11): Difícil < 1 s → máximo 904 ms; sin errores de más de 2 peones en tácticas → 1.

Errores de Difícil en tácticas: auditoria-h-14 (d8a5, −485 cp).

## Coach

Informes analizados: 152 (la mejor jugada de la referencia y las jugadas marcadas en cada posición), a profundidad 4.

| Métrica | Resultado |
|---|---|
| Veredicto igual al de la referencia | 97/152 (64 %) |
| Errores graves detectados (Error o Error grave) | 20/23 (87 %) |
| Falsos positivos (jugada equivalente a la mejor llamada Error o Error grave) | 3/123 (2 %) |
| Errores llamados «Mejor» o «Buena» | 3 |
| Mejor jugada del coach equivalente a la de la referencia | 67/82 (82 %) |
| Mate a favor en 3 o menos visto antes de la jugada | 20/20 (100 %) |
| Mate permitido visto después de la jugada | 4/4 (100 %) |
| Informes con alguna contradicción | 0/152 (0 %) |
| Tiempo por análisis (media · p95 · máximo) | 85 · 370 · 588 ms |
| Profundidad de la búsqueda de antes (media · mínimo · máximo) | 4.0 · 1 · 9 |

Contradicciones por regla:

- mejor-con-otra-mejor: 0
- aviso-y-sin-motivo: 0
- mate-en-contra-con-elogio: 0
- pieza-no-capturada: 0
- veredicto-contra-evaluacion: 0
- refutacion-sin-linea: 0
- invariante-del-coach: 0

Matriz de veredictos (filas: referencia; columnas: coach):

| Referencia \ Coach | mejor | buena | imprecision | error | error-grave |
|---|---|---|---|---|---|
| mejor | 76 | 30 | 14 | 0 | 3 |
| buena | 2 | 0 | 0 | 0 | 0 |
| imprecision | 1 | 0 | 1 | 1 | 0 |
| error | 0 | 0 | 1 | 0 | 0 |
| error-grave | 2 | 1 | 0 | 0 | 20 |

Falsos positivos: sacrificio-griego Bxh7+: error-grave; sacrificio-traxler Bxf7+: error-grave; auditoria-h-02b axb4: error-grave.

Errores no vistos: pierde-blackburne Nxe5: mejor (referencia error-grave); pierde-arca-noe Qxd4: mejor (referencia error-grave); auditoria-h-14 Qa5: buena (referencia error-grave).

## Estabilidad

Posiciones cuya evaluación cambia 1 peón o más entre profundidad 4 y 5: 1 de 82.

clavada-englund (147 → 266 cp).

