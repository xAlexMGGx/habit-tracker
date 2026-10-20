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
