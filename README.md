# Escandador basico de poesia en espanol

Aplicacion estatica (HTML + CSS + JS) para analizar versos en espanol.

## Que hace hoy
- Entrada de poema en un panel izquierdo.
- Salida limpia en el panel derecho.
- Escansion en linea por verso:
  - separacion silabica con guiones,
  - silaba tonica destacada en negrita,
  - conteo metrico por verso,
  - patron de acentos (posiciones silabicas).
- Acento versal configurable:
  - preset o patron personalizado (ej: 6-10, 2-4-8-10),
  - validacion visual verde/rojo por posicion.
- Hemistiquio:
  - marcado inline con / o corte global para todas las lineas,
  - salida metrica en formato n+m.
- Sinalefa:
  - deteccion automatica en fronteras candidatas,
  - forzado/ruptura manual con clic por frontera.
- Revision de monosilabos:
  - deteccion de soporte ritmico debil en posiciones objetivo (*).

Ejemplo de formato de salida:

Ca-**mi**-no **len**-to por la **tar**-de **cla**-ra, 11 2-4-8-10

## Estructura
- index.html: estructura de la pagina.
- styles.css: estilos y layout responsive.
- analyzer.js: reglas de silabificacion, acentuacion y conteo.
- app.js: renderizado y eventos UI.
- reglas_escanción.md: reglas linguisticas de referencia.

## Como ejecutar local
1. Abre index.html en tu navegador.
2. Escribe o pega tu poema en el panel izquierdo.
3. Revisa el analisis en el panel derecho.

No requiere build ni backend.

## Hosting estatico
Puedes desplegar directamente estos archivos en:
- GitHub Pages
- Amazon S3 (website hosting)

## Metodologia del analizador (v2)
1. Tokeniza lineas y palabras.
2. Separa silabas por reglas ortograficas.
3. Detecta silaba tonica (tilde o regla general).
4. Clasifica acento de palabra.
5. Suma silabas por linea.
6. Ajusta por acento final del verso (aguda +1, llana 0, esdrujula -1, monosilaba final +1).
7. Calcula posiciones de acentos del verso.
8. Aplica sinalefa por fronteras con reglas conservadoras y overrides manuales.
9. Valida acentos detectados contra el patron versal objetivo.
10. Si hay hemistiquio, computa y muestra n+m por partes.

## Metodos principales en JavaScript
- analyzePoem(text)
- splitIntoLines(text)
- splitLineIntoWords(line)
- analyzeLine(line)
- analyzeWord(word)
- syllabifyWord(word)
- detectStressSyllable(word, syllables)
- classifyWordAccentType(syllables, stressIndex)
- adjustPoeticCount(syllableCount, accentType)
- parseStressPattern(value)
- normalizeInput(text)
- renderAnalysis(result)
- renderAnnotatedLine(runtime)
- buildLineRuntime(lineAnalysis, lineIndex)

## Modulos externos: que delegar en el futuro
Partes candidatas para delegar a librerias especializadas:
- Silabificacion avanzada (casos de excepcion y dialectales).
- Deteccion acentual lexica con diccionario.

Partes que conviene mantener locales:
- Conteo metrico poetico por verso.
- Reglas de ajuste final (aguda/llana/esdrujula).
- Presentacion de salida y formato de escansion.

## Limitaciones actuales
Aun no implementado o parcial:
- Dialefa y sineresis avanzadas.
- Reglas dialectales finas de sinalefa/hiato.
- Analisis ritmico de estrofa completa (no solo por linea).
- Tonicidad secundaria profunda.

Ver detalles en reglas_escanción.md.
