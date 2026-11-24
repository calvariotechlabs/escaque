# Banco de posiciones · 2026-11-24 · commit 2676662d839f

Huella de los resultados deterministas: `25b54cac` (igual en dos ejecuciones del mismo commit).

Posiciones: 82 (mate-inmediato 9, mate-forzado 4, clavada 5, doblete 6, descubierto 4, sacrificio-correcto 5, sacrificio-incorrecto 4, ganancia-material 5, perdida-material 8, equivalentes 6, tranquila 7, final 7, auditoria 12).

Referencia: Stockfish 17.1, 8000000 nodos por posición, 1 hilo, todas las jugadas valoradas. Metodología en bench/README.md.

## Alfil Beta

| Perfil | Mejor jugada | Equivalente (≤ 30 cp) | Pérdida media | Errores > 2 peones | En tácticas | Mates mantenidos | Tiempo medio | Máximo |
|---|---|---|---|---|---|---|---|---|
| Nivel Fácil (azar con semilla fija por posición) | 26/82 (32 %) | 41/82 (50 %) | 175.8 cp | 17 | 15 | 13/18 (72 %) | 5 ms | 62 ms |
| Nivel Medio (profundidad 3, tope 0,5 s: en posiciones pesadas el reloj decide) | 45/82 (55 %) | 63/82 (77 %) | 65 cp | 9 | 8 | 17/18 (94 %) | 33 ms | 505 ms |
| Nivel Difícil (0,9 s de reloj real: depende del equipo) | 46/82 (56 %) | 67/82 (82 %) | 31.8 cp | 4 | 4 | 18/18 (100 %) | 749 ms | 906 ms |
| Alfil Beta a profundidad fija 5 (determinista) | 48/82 (59 %) | 69/82 (84 %) | 24.8 cp | 3 | 3 | 18/18 (100 %) | 759 ms | 13247 ms |

Punto de parada del motor (B11): Difícil < 1 s → máximo 906 ms; sin errores de más de 2 peones en tácticas → 4.

Errores de Difícil en tácticas: gana-arca-noe (c8e6, −331 cp); pierde-arca-noe (d1d4, −278 cp); auditoria-h-14 (d8a5, −485 cp); auditoria-h-02b (a1b1, −398 cp).

## Coach

Informes analizados: 152 (la mejor jugada de la referencia y las jugadas marcadas en cada posición), a profundidad 4.

| Métrica | Resultado |
|---|---|
| Veredicto igual al de la referencia | 99/152 (65 %) |
| Errores graves detectados (Error o Error grave) | 20/23 (87 %) |
| Falsos positivos (jugada equivalente a la mejor llamada Error o Error grave) | 7/123 (6 %) |
| Errores llamados «Mejor» o «Buena» | 3 |
| Mejor jugada del coach equivalente a la de la referencia | 68/82 (83 %) |
| Mate a favor en 3 o menos visto antes de la jugada | 20/20 (100 %) |
| Mate permitido visto después de la jugada | 4/4 (100 %) |
| Informes con alguna contradicción | 28/152 (18 %) |
| Tiempo por análisis (media · p95 · máximo) | 286 · 973 · 4417 ms |

Contradicciones por regla:

- mejor-con-otra-mejor: 26
- aviso-y-sin-motivo: 0
- mate-en-contra-con-elogio: 0
- pieza-no-capturada: 2
- veredicto-contra-evaluacion: 0

Matriz de veredictos (filas: referencia; columnas: coach):

| Referencia \ Coach | mejor | buena | imprecision | error | error-grave |
|---|---|---|---|---|---|
| mejor | 77 | 26 | 13 | 3 | 4 |
| buena | 2 | 0 | 0 | 0 | 0 |
| imprecision | 1 | 0 | 1 | 1 | 0 |
| error | 0 | 0 | 0 | 1 | 0 |
| error-grave | 3 | 0 | 0 | 0 | 20 |

Falsos positivos: mate2-philidor Nf7+: error; sacrificio-griego Bxh7+: error-grave; sacrificio-traxler Bxf7+: error-grave; pierde-blackburne Nxd4: error; final-subpromocion c8=R: error; auditoria-h-06 Nxf7: error-grave; auditoria-h-02b axb4: error-grave.

Errores no vistos: pierde-blackburne Nxe5: mejor (referencia error-grave); pierde-arca-noe Qxd4: mejor (referencia error-grave); auditoria-h-14 Qa5: mejor (referencia error-grave).

Contradicciones encontradas:

- mate1-coronacion c8=R#: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: c8=Q#»)
- doble-dama-rey-torre Qb8+: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Qe5+»)
- descubierto-alfil Bd1+: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Bc4+»)
- descubierto-negras Nd5+: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Nc6+»)
- sacrificio-mal-axf7 O-O: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Nc3»)
- sacrificio-mal-cxe5 Be7: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Bg4»)
- pierde-englund Bc3: pieza-no-capturada («Cc3 gana la dama» y la línea solo captura: nada)
- permite-mate-pasillo h4: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Qc2»)
- permite-mate-pasillo h3: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Qc2»)
- permite-mate-pasillo-negras Rc8: pieza-no-capturada («h6 gana una torre» y la línea solo captura: nada)
- permite-mate-pasillo-negras f5: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: h6»)
- equiv-inicial e4: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Nc3»)
- equiv-inicial d4: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Nc3»)
- equiv-inicial Nf3: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Nc3»)
- equiv-e4e5 Nf3: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Nc3»)
- equiv-italiana O-O: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Nc3»)
- equiv-italiana d3: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Nc3»)
- equiv-final-peones Kf3: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Ke3»)
- equiv-final-peones Kd3: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Ke3»)
- tranq-gambito-dama cxd5: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Bxf6»)
- tranq-inglesa d3: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: e4»)
- final-torres Ra7: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Ra6»)
- final-peon-pasado Kf3: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Ke3»)
- final-alfil-malo Be4: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Kf6»)
- auditoria-h-02 Nf3: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Nc3»)
- auditoria-h-04 b3: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: gxf5»)
- auditoria-h-04 h4: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: gxf5»)
- auditoria-h-09 Bb5+: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Qa5»)

## Estabilidad

Posiciones cuya evaluación cambia 1 peón o más entre profundidad 4 y 5: 2 de 82.

clavada-englund (130 → 250 cp); doble-blackburne-dg5 (-158 → -53 cp).

