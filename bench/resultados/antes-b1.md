# Banco de posiciones · 2026-11-24 · commit 5e9e946ae52d

Huella de los resultados deterministas: `5601b7ac` (igual en dos ejecuciones del mismo commit).

Posiciones: 82 (mate-inmediato 9, mate-forzado 4, clavada 5, doblete 6, descubierto 4, sacrificio-correcto 5, sacrificio-incorrecto 4, ganancia-material 5, perdida-material 8, equivalentes 6, tranquila 7, final 7, auditoria 12).

Referencia: Stockfish 17.1, 8000000 nodos por posición, 1 hilo, todas las jugadas valoradas. Metodología en bench/README.md.

## Alfil Beta

| Perfil | Mejor jugada | Equivalente (≤ 30 cp) | Pérdida media | Errores > 2 peones | En tácticas | Mates mantenidos | Tiempo medio | Máximo |
|---|---|---|---|---|---|---|---|---|
| Nivel Fácil (azar con semilla fija por posición) | 26/82 (32 %) | 41/82 (50 %) | 175.8 cp | 17 | 15 | 13/18 (72 %) | 5 ms | 73 ms |
| Nivel Medio (profundidad 3, tope 0,5 s) | 45/82 (55 %) | 63/82 (77 %) | 65 cp | 9 | 8 | 17/18 (94 %) | 40 ms | 511 ms |
| Nivel Difícil (0,9 s de reloj real: depende del equipo) | 46/82 (56 %) | 67/82 (82 %) | 33.5 cp | 5 | 5 | 18/18 (100 %) | 750 ms | 908 ms |
| Alfil Beta a profundidad fija 5 (determinista) | 48/82 (59 %) | 69/82 (84 %) | 24.8 cp | 3 | 3 | 18/18 (100 %) | 749 ms | 12789 ms |

Punto de parada del motor (B11): Difícil < 1 s → máximo 908 ms; sin errores de más de 2 peones en tácticas → 5.

Errores de Difícil en tácticas: gana-arca-noe (c8e6, −331 cp); pierde-arca-noe (d1d4, −278 cp); auditoria-h-14 (d8a5, −485 cp); auditoria-h-02b (a1b1, −398 cp); auditoria-h-07 (a1b1, −304 cp).

## Coach

Informes analizados: 145 (la mejor jugada de la referencia y las jugadas marcadas en cada posición), a profundidad 4.

| Métrica | Resultado |
|---|---|
| Veredicto igual al de la referencia | 90/145 (62 %) |
| Errores graves detectados (Error o Error grave) | 20/23 (87 %) |
| Falsos positivos (jugada equivalente a la mejor llamada Error o Error grave) | 7/116 (6 %) |
| Errores llamados «Mejor» o «Buena» | 3 |
| Mejor jugada del coach equivalente a la de la referencia | 68/82 (83 %) |
| Mate a favor en 3 o menos visto antes de la jugada | 20/20 (100 %) |
| Mate permitido visto después de la jugada | 4/4 (100 %) |
| Informes con alguna contradicción | 38/145 (26 %) |
| Tiempo por análisis (media · p95 · máximo) | 211 · 720 · 3795 ms |

Contradicciones por regla:

- mejor-con-otra-mejor: 17
- aviso-y-sin-motivo: 14
- mate-en-contra-con-elogio: 1
- pieza-no-capturada: 6
- veredicto-contra-evaluacion: 0

Matriz de veredictos (filas: referencia; columnas: coach):

| Referencia \ Coach | mejor | buena | imprecision | error | error-grave |
|---|---|---|---|---|---|
| mejor | 68 | 30 | 11 | 3 | 4 |
| buena | 2 | 0 | 0 | 0 | 0 |
| imprecision | 1 | 0 | 1 | 1 | 0 |
| error | 0 | 0 | 0 | 1 | 0 |
| error-grave | 3 | 0 | 0 | 0 | 20 |

Falsos positivos: mate2-philidor Nf7+: error; sacrificio-griego Bxh7+: error-grave; sacrificio-traxler Bxf7+: error-grave; pierde-blackburne Nxd4: error; final-subpromocion c8=R: error; auditoria-h-06 Nxf7: error-grave; auditoria-h-02b axb4: error-grave.

Errores no vistos: pierde-blackburne Nxe5: mejor (referencia error-grave); pierde-arca-noe Qxd4: mejor (referencia error-grave); auditoria-h-14 Qa5: mejor (referencia error-grave).

Contradicciones encontradas:

- mate1-coronacion c8=R#: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: c8=Q#»)
- doble-dama-rey-torre Qb8+: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Qe5+»)
- doble-peon c3: aviso-y-sin-motivo (aviso «Pieza colgando» y «no hay un motivo táctico»)
- clavada-dama-torre Rxe7+: pieza-no-capturada («Txe7+ gana una pieza» y la línea solo captura: q)
- descubierto-petrov Nc6+: pieza-no-capturada («Cc6+ gana una torre» y la línea solo captura: q)
- descubierto-alfil Bd1+: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Bc4+»)
- descubierto-negras Nd5+: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Nc6+»)
- sacrificio-opera-txd7 Rxd7: pieza-no-capturada («Txd7 gana un peón» y la línea solo captura: n, n)
- sacrificio-damiano Nxe5: aviso-y-sin-motivo (aviso «Pieza colgando» y «no hay un motivo táctico»)
- sacrificio-griego Bxh7+: aviso-y-sin-motivo (aviso «Pieza colgando» y «no hay un motivo táctico»)
- sacrificio-mal-axf7 O-O: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Nc3»)
- sacrificio-mal-axf7 Bxf7+: aviso-y-sin-motivo (aviso «Pieza colgando» y «no hay un motivo táctico»)
- sacrificio-mal-griego Bxh7+: aviso-y-sin-motivo (aviso «Pieza colgando» y «no hay un motivo táctico»)
- sacrificio-mal-axf7-d3 Bxf7+: aviso-y-sin-motivo (aviso «Pieza colgando» y «no hay un motivo táctico»)
- sacrificio-mal-cxe5 Nxe4: aviso-y-sin-motivo (aviso «Pieza colgando» y «no hay un motivo táctico»)
- pierde-elefante Nxd5: aviso-y-sin-motivo (aviso «Pieza colgando» y «no hay un motivo táctico»)
- pierde-torre-caballo Rd3: aviso-y-sin-motivo (aviso «Pieza colgando» y «no hay un motivo táctico»)
- permite-mate-pasillo h3: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Qc2»)
- permite-mate-pastor Nf6: aviso-y-sin-motivo (aviso «Pieza colgando» y «no hay un motivo táctico»)
- equiv-inicial Nf3: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Nc3»)
- equiv-e4e5 Nf3: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Nc3»)
- equiv-italiana O-O: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Nc3»)
- equiv-final-peones Kf3: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Ke3»)
- equiv-final-peones Kd3: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Ke3»)
- tranq-gambito-dama cxd5: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Bxf6»)
- tranq-inglesa d3: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: e4»)
- final-torres Rb1: aviso-y-sin-motivo (aviso «Pieza colgando» y «no hay un motivo táctico»)
- final-peon-pasado Kf3: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Ke3»)
- final-alfil-malo Be4: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Kf6»)
- auditoria-h-02 Nf3: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: Nc3»)
- auditoria-h-06 d4: aviso-y-sin-motivo (aviso «Pieza colgando» y «no hay un motivo táctico»)
- auditoria-h-06 Nxf7: aviso-y-sin-motivo (aviso «Pieza colgando» y «no hay un motivo táctico»)
- auditoria-h-07 O-O: pieza-no-capturada («Ad2 gana dos peones» y la línea solo captura: n, n)
- auditoria-h-03 Qg5: aviso-y-sin-motivo (aviso «Pieza colgando» y «no hay un motivo táctico»)
- auditoria-h-08 Qd3+: pieza-no-capturada («Dd3+ gana una torre» y la línea solo captura: q)
- auditoria-h-08 Qd5+: pieza-no-capturada («Dd3+ gana una torre» y la línea solo captura: q)
- auditoria-h-04 h4: mejor-con-otra-mejor («Mejor jugada» y debajo «Mejor jugada: gxf5»)
- auditoria-h-04 gxf5: mate-en-contra-con-elogio (Mate en 1 para las negras y «gxf5 gana una pieza.»)

## Estabilidad

Posiciones cuya evaluación cambia 1 peón o más entre profundidad 4 y 5: 2 de 82.

clavada-englund (130 → 250 cp); doble-blackburne-dg5 (-158 → -53 cp).

