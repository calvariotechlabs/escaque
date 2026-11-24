# Banco de posiciones · 2026-11-24 · commit 7ab25d970e05

Huella de los resultados deterministas: `dafd2ae3` (igual en dos ejecuciones del mismo commit).

Posiciones: 82 (mate-inmediato 9, mate-forzado 4, clavada 5, doblete 6, descubierto 4, sacrificio-correcto 5, sacrificio-incorrecto 4, ganancia-material 5, perdida-material 8, equivalentes 6, tranquila 7, final 7, auditoria 12).

Referencia: Stockfish 17.1, 8000000 nodos por posición, 1 hilo, todas las jugadas valoradas. Metodología en bench/README.md.

## Alfil Beta

| Perfil | Mejor jugada | Equivalente (≤ 30 cp) | Pérdida media | Errores > 2 peones | En tácticas | Mates mantenidos | Tiempo medio | Máximo |
|---|---|---|---|---|---|---|---|---|
| Nivel Fácil (azar con semilla fija por posición) | 26/82 (32 %) | 41/82 (50 %) | 175.8 cp | 17 | 15 | 13/18 (72 %) | 4 ms | 65 ms |
| Nivel Medio (profundidad 3, tope 0,5 s: en posiciones pesadas el reloj decide) | 45/82 (55 %) | 63/82 (77 %) | 65 cp | 9 | 8 | 17/18 (94 %) | 32 ms | 506 ms |
| Nivel Difícil (0,9 s de reloj real: depende del equipo) | 46/82 (56 %) | 67/82 (82 %) | 31.8 cp | 4 | 4 | 18/18 (100 %) | 749 ms | 907 ms |
| Alfil Beta a profundidad fija 5 (determinista) | 48/82 (59 %) | 69/82 (84 %) | 24.8 cp | 3 | 3 | 18/18 (100 %) | 703 ms | 12354 ms |

Punto de parada del motor (B11): Difícil < 1 s → máximo 907 ms; sin errores de más de 2 peones en tácticas → 4.

Errores de Difícil en tácticas: gana-arca-noe (c8e6, −331 cp); pierde-arca-noe (d1d4, −278 cp); auditoria-h-14 (d8a5, −485 cp); auditoria-h-02b (a1b1, −398 cp).

## Coach

Informes analizados: 152 (la mejor jugada de la referencia y las jugadas marcadas en cada posición), a profundidad 4.

| Métrica | Resultado |
|---|---|
| Veredicto igual al de la referencia | 99/152 (65 %) |
| Errores graves detectados (Error o Error grave) | 20/23 (87 %) |
| Falsos positivos (jugada equivalente a la mejor llamada Error o Error grave) | 5/123 (4 %) |
| Errores llamados «Mejor» o «Buena» | 3 |
| Mejor jugada del coach equivalente a la de la referencia | 68/82 (83 %) |
| Mate a favor en 3 o menos visto antes de la jugada | 20/20 (100 %) |
| Mate permitido visto después de la jugada | 4/4 (100 %) |
| Informes con alguna contradicción | 0/152 (0 %) |
| Tiempo por análisis (media · p95 · máximo) | 290 · 1046 · 3781 ms |
| Profundidad de la búsqueda de antes (media · mínimo · máximo) | 3.7 · 1 · 7 |

Contradicciones por regla:

- mejor-con-otra-mejor: 0
- aviso-y-sin-motivo: 0
- mate-en-contra-con-elogio: 0
- pieza-no-capturada: 0
- veredicto-contra-evaluacion: 0
- invariante-del-coach: 0

Matriz de veredictos (filas: referencia; columnas: coach):

| Referencia \ Coach | mejor | buena | imprecision | error | error-grave |
|---|---|---|---|---|---|
| mejor | 77 | 27 | 14 | 1 | 4 |
| buena | 2 | 0 | 0 | 0 | 0 |
| imprecision | 1 | 0 | 1 | 1 | 0 |
| error | 0 | 0 | 0 | 1 | 0 |
| error-grave | 3 | 0 | 0 | 0 | 20 |

Falsos positivos: sacrificio-griego Bxh7+: error-grave; sacrificio-traxler Bxf7+: error-grave; pierde-blackburne Nxd4: error; auditoria-h-06 Nxf7: error-grave; auditoria-h-02b axb4: error-grave.

Errores no vistos: pierde-blackburne Nxe5: mejor (referencia error-grave); pierde-arca-noe Qxd4: mejor (referencia error-grave); auditoria-h-14 Qa5: mejor (referencia error-grave).

## Estabilidad

Posiciones cuya evaluación cambia 1 peón o más entre profundidad 4 y 5: 2 de 82.

clavada-englund (130 → 250 cp); doble-blackburne-dg5 (-158 → -53 cp).

