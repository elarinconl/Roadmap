## Objetivo

Hacer que los nombres de las actividades y de las iniciativas se lean mejor dentro de sus barras horizontales, sin romper la vista actual del Gantt.

## Diagnóstico

Hoy el contenedor `.flex-1` de la timeline ocupa exactamente el ancho disponible (≈940px en el viewport actual). Con 12 meses repartidos en `repeat(12, minmax(0,1fr))`, cada mes mide ~78px. Una actividad de 1 mes tiene ~78px de ancho menos paddings → caben ~8–10 caracteres antes del `truncate`. Por eso los nombres se cortan.

## Cambio propuesto (mejor experiencia UI)

Aplicar un **ancho mínimo por mes** a la zona de timeline y permitir **scroll horizontal** solo en esa zona, dejando el sidebar izquierdo fijo. Esto:

- Hace que cada barra (iniciativa o actividad) tenga ~2× más espacio para mostrar texto sin truncar en la mayoría de los casos.
- No oculta nada: si la pantalla es ancha sigue cubriendo el 100% (`min-width` no encoge la vista actual de quienes tienen monitores grandes).
- Es la convención estándar en Gantts (Asana, Linear, Monday).

### Detalles técnicos

En `src/components/gantt/GanttChart.tsx`:

1. Añadir constante `MIN_MONTH_W = 140` (px). Total timeline mínimo = `12 * 140 = 1680px`.
2. Envolver el bloque `<div className="flex">` que contiene el sidebar + timeline en un wrapper con `overflow-x-auto`.
3. El sidebar izquierdo (`width: LEFT_COL`) pasa a `sticky left-0 z-20 bg-card` para que se mantenga visible al hacer scroll horizontal.
4. La timeline (`ref={timelineRef}`) recibe `style={{ minWidth: 12 * MIN_MONTH_W }}` además de `flex-1`.
5. El header de meses (línea con `MONTH_LABELS`) usa el mismo wrapper de scroll sincronizado: lo más simple es mover el header de meses **dentro** del mismo contenedor scrollable, junto a la timeline, para que ambos compartan scroll natural. Concretamente:
   - Refactorizar para que `Months header` y el cuerpo (`Body`) vivan dentro de un mismo `<div className="overflow-x-auto">`.
   - Dentro, una columna izquierda sticky (sidebar + labels "Objetivo · Iniciativa", "Hitos") y una columna derecha con `minWidth: 12*MIN_MONTH_W` que contiene header de meses, hitos y todas las filas.
6. `MilestonesHeader` recibe el mismo tratamiento: su columna derecha hereda el ancho mínimo.
7. Verificar que las barras (que se posicionan con `%`) sigan funcionando: como están relativas a la timeline scrollable, el cálculo `dateToFraction * 100%` sigue siendo correcto sobre el nuevo ancho.

### Beneficio visible

- Una actividad de 1 mes pasa de ~70px utiles a ~130px utiles → "Lanzar campaña Q2" ya no se trunca a "Lanzar ca…".
- Las iniciativas largas (3-6 meses) muestran el título completo en casi todos los casos.
- En pantallas ≥1680px la vista se ve igual que hoy (el `min-width` no impone scroll si hay suficiente espacio).

## Fuera de alcance

- No se cambia la columna izquierda (sidebar) ni la estructura de áreas/actividades.
- No se añade zoom configurable (se puede agregar después si hace falta).
- No se tocan los modales, drag-and-drop, ni la lógica de datos.

## Archivos afectados

- `src/components/gantt/GanttChart.tsx` (único archivo).
