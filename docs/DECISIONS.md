# Decisiones tomadas fuera del SPEC

Complementa a [SPEC.md](../SPEC.md). Cada punto se acordó con el usuario o es un detalle de implementación que se puede cambiar sobre la marcha.

## Generales

- **Nombre de la app:** "Habit tracker" (el mismo en ES y EN).
- **"Hoy"** es la fecha local del dispositivo. La zona horaria se guarda en `user_settings.timezone` y se actualiza sola; la usará el servidor en la fase 4.
- **Idioma:** en el primer arranque la cuenta toma el idioma del iPhone (`es*` → español; cualquier otro → inglés).
- **Rutas con hash** (`#/agenda`): GitHub Pages no tiene fallback para SPAs.
- **Sin modo offline de datos** hasta la nueva **fase 7** (última, después de la 6). La app abre sin conexión, pero leer y escribir requiere red.

## Autenticación

- Email + contraseña. **Registro público desactivado:** el administrador crea las 2-3 cuentas desde Supabase.
- **Recuperar contraseña con código de 6 dígitos** que se escribe en la app (los enlaces mágicos abren Safari, que no comparte sesión con la PWA instalada en iOS).
- **Face ID:**
  1. Autorrelleno del llavero de iCloud en el formulario de acceso (`autocomplete` correcto).
  2. **Bloqueo opcional** (Ajustes → Seguridad), por dispositivo, con WebAuthn y el autenticador del iPhone. Pide Face ID al abrir la app y al volver tras más de **1 minuto** en segundo plano; mientras está en segundo plano, oculta el contenido. Se puede desbloquear también con la contraseña. Es un bloqueo local: la protección de los datos en el servidor sigue siendo la RLS.
- Contraseña mínima: 8 caracteres.

## Hábitos

- **Icono:** emoji (rejilla sugerida + cualquier emoji del teclado). **Color:** paleta fija de 12 colores con variante oscura (`habits.color` guarda la clave, p. ej. `blue`).
- **El tipo no se puede cambiar** después de crear el hábito (los valores registrados significan cosas distintas según el tipo).
- **Fecha de inicio** (`start_date`, por defecto hoy, editable): el hábito solo aparece y cuenta desde ese día.
- **Cada N días:** calendario fijo anclado a `start_date` (no "N días desde la última vez").
- **X veces por semana:**
  - El usuario elige X **días previstos**.
  - Si lo completa un día no previsto, ese día **sustituye** a un día previsto pendiente de esa semana: primero a uno ya pasado sin hacer y, si no hay, al siguiente.
  - Los días no previstos aparecen en Agenda en "También esta semana" mientras no se llegue a X.
  - No disponible para hábitos negativos.
- **Cuantitativos:** botón grande "+N", con N configurable por hábito (`quick_step`, por defecto 1). Al tocar la cifra se puede escribir el total del día.
- **Negativos:** botón "Recaída" (con *Deshacer*). Al tocar el texto se ajusta el número de recaídas del día.
- **Visualización en la fase 1:** selector simple con las compatibles con el tipo. Por defecto: sí/no → mapa de calor, cuantitativo → barras, negativo → "días sin". La vista previa y la guía "?" llegan en la fase 2; los parámetros del tarro, en la 3.
- **Recordatorios:** las columnas (`habits.reminder_times`, `todos.reminder_time`) existen desde ya, pero su interfaz llega con las notificaciones (fase 4).

## Agenda

- **Contador "Hábitos n/m":** se cuenta por día. `m` son los hábitos que tocan ese día y `n` los cumplidos ese día. Un hábito negativo cuenta como cumplido si ese día no hay recaídas (también hoy). La regla de "hoy solo cuenta como limpio cuando termina" se aplicará en rachas y estadísticas (fase 2).
- **Contador "To-dos n/m":** solo los to-dos de ese día (sin Pendientes).
- **Días futuros:** no hay subtab Hábitos; solo se muestran los to-dos.
- **Tira de días:** al deslizar se cambia de semana manteniendo el mismo día de la semana seleccionado.
- **To-dos:** se ordenan por creación. Al completarlos se quedan en su sitio, tachados. Al tocar uno se abre una hoja para moverlo (Hoy / Mañana / Elegir fecha), renombrarlo o eliminarlo (con *Deshacer*).
- **Pendientes de días anteriores:** se pueden completar y mover siempre, aunque su fecha esté bloqueada (es una acción del presente).
- **Días bloqueados** (más de 14 días atrás): el desbloqueo dura mientras sigas en ese día; al cambiar de día o de pestaña se vuelve a bloquear.
- **Hábitos archivados:** desaparecen de la Agenda en todos los días, también en los pasados.

## Ajustes

- **Exportar:** JSON (todo en un fichero) o CSV (habits, habit-logs y todos). Se hace en dos toques (preparar → guardar) porque iOS solo permite abrir la hoja de compartir directamente desde un toque.
- **Cambiar contraseña** desde Ajustes → Cuenta.

## Seguimiento (fase 2)

- **Tarjetas:** una por hábito activo, incluidos los que hoy no tocan, que muestran "Hoy no toca".
  - Si el hábito toca hoy, o es opcional esta semana, la tarjeta tiene un **botón para marcar hoy** (check, +N o recaída, el mismo que en Agenda). Al tocar el resto de la tarjeta se abre el detalle.
- **Barra de progreso:** el mismo cálculo que el contador "Hábitos n/m" de la Agenda para hoy.
- **Reordenar:** se mantiene pulsada la tarjeta (unos 0,35 s) y se arrastra. Solo funciona en orden manual, y ese orden es el mismo que el de Mis hábitos. Los órdenes automáticos no tocan `sort_order`.
- **Orden "por % de cumplimiento":** usa el % de los **últimos 30 días**. Con empate se mantiene el orden manual. En "Pendientes hoy primero" no cuentan los negativos, porque no requieren ninguna acción.

## Estadísticas

- Se calculan sobre los días en que tocaba el hábito (para X veces por semana, con el plan ya ajustado).
- **Racha actual:** días que tocaban, seguidos y cumplidos, hasta hoy.
  - Hoy, si aún está pendiente, no rompe la racha.
  - En los cuantitativos, un día parcial la rompe.
  - En los negativos, hoy cuenta cuando termina; una recaída hoy la pone a 0.
  - La racha se muestra como número, sin unidad, porque en hábitos no diarios son "veces", no días.
- **Porcentajes:** cumplidos / días que tocaban.
  - Semana y mes son **naturales**: de lunes a hoy y del día 1 a hoy.
  - Hoy solo cuenta si ya está cumplido. En los negativos, solo si hay recaída.
  - Sin días que contar se muestra "—".
- **Días sin:** la racha limpia de un hábito negativo; el récord es su mejor racha.

## Visualizaciones

- **Tres tamaños:** tarjeta a 2 columnas, tarjeta a 1 columna y detalle.
- **Mapa de calor:**
  - Columnas = semanas (lunes arriba). Se muestran tantas como quepan, hasta 53.
  - Los días en que no tocaba son muy claros, y los anteriores al inicio del hábito, más tenues todavía.
  - Las recaídas salen en rojo y hoy lleva un borde.
- **Calendario:**
  - Colores: cumplido en color lleno, parcial con borde y relleno proporcional, fallado en rojo suave, no tocaba con el número tenue.
  - En la tarjeta muestra el mes actual sin navegación; en el detalle se navega hasta el mes actual.
- **Anillo:** `viz_config.ringPeriod` = `week` (por defecto) o `month`.
- **Barras / línea:** `viz_config.barsRange` = 7 (barras, por defecto) o 30 (línea). Hoy, sin registro, no se dibuja en la línea.
- **Detalle:**
  - Chips "Ver como" con las visualizaciones compatibles; ★ marca la elegida.
  - Cambiar de visualización, o el periodo del anillo y el rango de las barras, ahí solo sirve para mirar: no se guarda.
- **Formulario:**
  - Vista previa de la visualización elegida con datos de ejemplo parecidos al hábito.
  - Mientras no eliges una a mano, la visualización sigue al tipo de hábito.
- **Guía "?":** botón en Mis hábitos (empieza en la primera página) y junto al selector del formulario (empieza en la visualización elegida). Los ejemplos se dibujan con los mismos componentes y datos generados.

## Tarro de canicas (fase 3)

- **Canicas:**
  - Sí/no: una canica por cada día cumplido, también los días no previstos en "X veces por semana".
  - Cuantitativos: la cantidad **se acumula entre días** y se divide por el valor de la canica (5,5 km + 2,5 km = 8 canicas a 1 km cada una). Si no se indica valor, **una canica = la meta diaria**.
  - Fallar nunca resta canicas.
- **Periodos naturales:** semana (de lunes a domingo), mes, trimestre (ene-mar, abr-jun…) y año. Por defecto, mes.
- **Capacidad:**
  - "Todos los días que toca" (100 %), "Casi todos" (80 %) o un número personalizado.
  - Las dos sugeridas se recalculan en cada periodo con los días en que toca el hábito: 28-31 en los meses, 7 en una semana diaria, 365 en un año diario. En "X veces por semana" se usa X × días/7, que da unas 13 al mes con 3 por semana.
  - En los cuantitativos, la capacidad se expresa en canicas: días que toca × meta / valor de la canica.
  - En el periodo en que empieza el hábito, la capacidad sugerida solo cuenta los días desde la fecha de inicio.
- **Lleno antes de tiempo:** el tarro se ve lleno, con una etiqueta "+N" en la tapa y el texto "¡Lleno! +N canicas extra".
- **Estantería:**
  - En el detalle (y en la guía) se ve una cuadrícula de 4×3 con los 12 últimos periodos terminados, del más antiguo al más reciente.
  - Los periodos anteriores al inicio del hábito aparecen como huecos punteados.
  - Todo se calcula a partir de los registros: si editas el pasado o cambias el periodo o la capacidad, la estantería se recalcula.
- **Dibujo:** el tamaño de las canicas se ajusta para que quepa la capacidad completa, así que con 365 son muy pequeñas.

## Planta (fase 3)

- **Constantes en [src/lib/plant.ts](../src/lib/plant.ts):**
  - ventana de 14 días que tocaba;
  - umbrales del 20 / 40 / 60 / 80 % para brote, planta joven, planta y flor;
  - se marchita con 3 fallos seguidos.
- **Qué cuenta:** hoy, mientras está pendiente, no cuenta. En los cuantitativos, un día solo cuenta si se llega a la meta. Si el hábito tiene menos de 14 días que tocaban, se usan los que haya; sin ninguno, es una semilla.
- **Mustia:** la fase sigue dependiendo del %. La planta mustia tiene el tallo doblado y las hojas caídas y marrones, y revive con el siguiente día cumplido.
- **Detalle:** se muestra el progreso por fases y el % necesario para la siguiente.
