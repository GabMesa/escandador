# Reglas de escansion (v2)

## Objetivo
Este documento define las reglas linguisticas usadas por el escandador basico de poesia en espanol.

## Alcance de v2
- Analisis por palabra y por linea.
- Separacion silabica ortografica aproximada.
- Deteccion de silaba tonica.
- Clasificacion acentual: aguda, llana, esdrujula, sobreesdrujula, monosilaba.
- Conteo de silabas por linea.
- Ajuste metrico por acento final del verso:
  - aguda: +1
  - llana: +0
  - esdrujula/sobreesdrujula: -1
- Patron de acentos del verso como posiciones silabicas.
- Validacion de acento versal contra patron objetivo elegido por el poeta.
- Hemistiquio por barra inline (/) y por corte global aplicado a todas las lineas.
- Conteo en versos compuestos como n+m (cada hemistiquio se computa por separado).
- Sinalefa automatica con posibilidad de forzar/romper manualmente por frontera.
- Revision de monosilabos atonos como soporte ritmico opcional (marcado con *).

## Reglas de separacion silabica

### 1) Nucleo silabico
- Cada silaba contiene un nucleo vocalico.
- Se consideran vocales: a, e, i, o, u, con tildes y u con dieresis.

### 2) Consonantes entre vocales
- Una consonante entre vocales pasa al ataque de la silaba siguiente.
  - ca-sa, pe-ro
- Dos consonantes:
  - Si forman grupo de ataque permitido, se mantienen juntas en la segunda silaba.
  - Grupos considerados: bl, br, cl, cr, dr, fl, fr, gl, gr, pl, pr, tr, tl.
  - Ejemplos: a-bra-zo, a-cla-rar.
  - En otro caso, se separan: al-to, ac-to.
- Digrafos tratados como unidad consonantica: ch, ll, rr.

### 3) qu / gu en gue-gui / que-qui
- En secuencias qu + e/i y gu + e/i, la u se trata como muda para el nucleo.
- Ejemplos: gue-rra, qui-ta.

### 4) Diptongo
- Dos vocales en el mismo nucleo cuando:
  - hay al menos una vocal debil (i, u, y final),
  - no hay hiato por tilde en debil (i/u tildada),
  - no son dos vocales fuertes puras en contacto.
- La h intercalada no rompe la posible union vocalica.

### 5) Triptongo
- Patron debil + fuerte + debil (sin tilde en las debiles), en un mismo nucleo.

### 6) Hiato
- Se separan en silabas distintas cuando:
  - hay dos fuertes contiguas,
  - o una debil tildada rompe diptongo/triptongo.

## Reglas de acentuacion (silaba tonica)

### 1) Con tilde grafica
- Si la palabra tiene tilde, la silaba que contiene esa vocal es la tonica.

### 2) Sin tilde grafica
- Si termina en vocal, n o s: tonica en penultima silaba (llana).
- Si termina en otra consonante: tonica en ultima silaba (aguda).
- Monosilabas: unica silaba tonica.

## Clasificacion acentual
- Aguda: tonica en ultima silaba.
- Llana: tonica en penultima.
- Esdrujula: tonica en antepenultima.
- Sobreesdrujula: tonica antes de la antepenultima.
- Monosilaba: una sola silaba.

## Conteo silabico y metrico

### 1) Conteo silabico bruto
- Suma de silabas de todas las palabras de la linea.

### 2) Ajuste por palabra final del verso
- Si la ultima palabra es aguda: conteo metrico = bruto + 1.
- Si es llana: conteo metrico = bruto.
- Si es monosilaba final: conteo metrico = bruto + 1.
- Si es esdrujula o sobreesdrujula: conteo metrico = bruto - 1.

## Patron de acentos del verso
- Se recorre la linea palabra por palabra con indice silabico acumulado (1-based).
- Para cada palabra polisilabica se anota la posicion de su silaba tonica.
- Se muestra como secuencia unida por guiones, por ejemplo: 2-4-8-10.

## Acento versal
- El poeta define un patron objetivo con posiciones silabicas (ej: 6-10, 2-4-8-10).
- Por cada verso se comparan los acentos detectados con ese patron.
- Estado visual:
  - verde: posicion presente,
  - rojo: posicion ausente,
  - *: ausencia compensada solo por monosilabo atono (aviso, no acierto fuerte).

## Hemistiquio
- Dos formas de marcado:
  - inline en el poema con /,
  - global desde controles de la app (corte en una posicion silabica para todas las lineas).
- Precedencia:
  - si una linea tiene / inline, ese corte manda en esa linea,
  - si no hay / inline y el modo global esta activo, se usa el corte global.
- El analisis muestra / en la linea y el conteo como n+m.
- Cada hemistiquio se ajusta con su propia regla final (aguda +1, llana 0, esdrujula -1, monosilaba final +1).

## Sinalefa
- Candidata cuando una palabra termina en vocal fonica y la siguiente empieza en vocal fonica (incluyendo h muda).
- Modo conservador por defecto:
  - evita sinalefa en pausas fuertes,
  - evita sinalefa en frontera de hemistiquio,
  - evita sinalefa cuando compromete una frontera de acento versal objetivo.
- El poeta puede alternar manualmente cada frontera candidata desde el analisis.
- La pausa de final de verso impide sinalefa entre versos.

## Monosilabos y ritmo
- Se distingue entre monosilabos atonos funcionales y monosilabos tonicos.
- Los atonos funcionales no cuentan como acento fuerte principal por defecto.
- Si un patron se sostiene solo por esos monosilabos atonos, se marca como soporte debil (*).

## Reglas no implementadas aun (siguiente fase)
- Dialefa y sineresis poetica completas.
- Ajustes dialectales avanzados de sinalefa/hiato.
- Perfil ritmico profundo por series (acento versal de estrofa, no solo linea).
- Modelado avanzado de tonicidad secundaria.

## Nota de precision
Este analizador es una base didactica. La metrica poetica real en espanol requiere licencias y fenomenos prosodicos adicionales que se incorporaran en fases posteriores.
