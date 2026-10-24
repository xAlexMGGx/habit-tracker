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

## Cambios tras el feedback de las fases 1-3

- **Nombre:** "To-dos" pasa a ser **"Tareas"** en español y **"TO-DO"** en inglés, en toda la interfaz.
- **Prioridad de las tareas** (columna `todos.priority`):
  - Semáforo: alta (rojo) > media (naranja) > baja (verde).
  - Una tarea nueva es verde, pero se puede elegir el color en la hoja del "+". El color elegido se mantiene para las siguientes que añadas seguidas.
  - En el día, las tareas se agrupan en bloques separados: rojo, naranja y verde, cada uno con una franja de su color.
  - El círculo de cada tarea lleva el color de su prioridad.
  - Pendientes de días anteriores: primero por prioridad y luego de la más antigua a la más reciente.
- **Detalles de la tarea:**
  - Al tocarla se pueden cambiar título, prioridad, "En progreso" y notas, moverla o eliminarla.
  - **Mover ya no cierra la hoja**, así que se puede cambiar la prioridad en el mismo paso.
- **En progreso** (`todos.started_at`): el círculo se ve medio relleno. Se activa con un interruptor en los detalles.
- **Notas** (`todos.notes`, hasta 2000 caracteres):
  - Un único campo de texto libre, visible solo en los detalles.
  - En la lista solo aparece un icono 💬 discreto si la tarea tiene notas.
- **Calendario propio** para "Ir a una fecha" y "Elegir fecha": el selector nativo de iOS no permite marcar la semana seleccionada. La semana actual aparece dentro de un "globo" gris.
- **Anillo y estadísticas de semana y mes:** se miden sobre el **periodo completo**: días cumplidos / todos los días que tocan en la semana (de lunes a domingo) o en el mes, incluidos los que aún no han llegado.
  - Un hábito de 4 veces por semana no marca 100 % hasta la cuarta.
  - El % total sigue siendo "hasta hoy". El orden por % (últimos 30 días) no cambia.
- **Restar en el detalle de Seguimiento:** fila "Hoy" con − / cantidad / + en los cuantitativos, y con las recaídas en los negativos. Al tocar la cantidad se abre el mismo editor que en la Agenda.
- **Tema:**
  - Ajustes → Apariencia: Automático (sigue al iPhone), Claro u Oscuro.
  - Se guarda **en el dispositivo** (`localStorage`), no en la cuenta, para aplicarlo antes de pintar la pantalla y evitar un destello del otro tema.
  - Pendiente de comprobar en el iPhone: el color de la barra de estado de iOS al forzar un tema distinto al del sistema.

## Notificaciones (fase 4)

- **Arquitectura:**
  - `pg_cron` llama cada minuto a la Edge Function `send-reminders`, autenticada con `CRON_SECRET` guardado en el Vault.
  - La función calcula la hora local de cada usuario (`user_settings.timezone`) y envía con Web Push (VAPID, `npm:web-push`).
  - La lógica que decide si un hábito "toca hoy" está en `supabase/functions/_shared/` y la usan **la app y la función**: es exactamente la misma regla, incluida la de X veces por semana con días que se mueven.
- **Ventana:** un recordatorio se envía durante los 10 minutos siguientes a su hora, una sola vez.
  - La tabla `sent_reminders` lo reclama antes de enviarlo, así que no hay duplicados aunque el cron se solape.
  - Si el cron está caído más de 10 minutos, ese aviso se pierde.
- **Hábitos:** solo los días en que tocan y si aún no están cumplidos.
  - En los cuantitativos, el aviso dice cuánto llevas.
  - En los **negativos**, a la hora elegida llega un **mensaje de ánimo** ("Hoy vas limpio…"), y solo si ese día no hay recaídas.
  - Cada hábito puede tener ninguna, una o varias horas (hasta 10), cada una con la suya, sin relación con la meta diaria: p. ej. "Lavarme los dientes" 3 veces al día con avisos a las 08:00, 14:00 y 22:00, y "Beber agua" sin ninguno.
- **Tareas:** una hora opcional, solo el día de la tarea y si sigue sin hacer. El recordatorio se mueve con la tarea y no se repite en los días siguientes si queda pendiente. El aviso lleva el color de la prioridad (🔴🟠🟢).
- **Por dispositivo:**
  - Cada iPhone se suscribe por separado desde Ajustes.
  - Al **cerrar sesión** se da de baja ese dispositivo, para que la siguiente cuenta no reciba avisos ajenos.
  - Las suscripciones que el servicio de push da por caducadas (404/410) se borran solas.
- **Prueba:** "Enviar notificación de prueba" llama a la misma función con la sesión del usuario.
- **Al tocar una notificación** se abre la Agenda (la de prueba abre Ajustes).
- **Textos de las notificaciones:** en `supabase/functions/_shared/messages.ts` (ES/EN), en el idioma de la cuenta.

## Widget (fase 5): descartado

- En iOS, una PWA no puede tener widgets: solo las apps nativas. La única forma sin Mac era Scriptable, y se descartó por tener que instalar una app (2026-10-23). Se quitó todo lo hecho.

## Salud (fase 6)

- **Cadena:** Fitbit → app de Google → Salud → atajo de Atajos (varias automatizaciones al día) → Edge Function `health` → `habit_logs`.
- **El atajo se crea a mano** siguiendo la guía de Ajustes → Salud: los atajos solo se pueden instalar con un toque si están firmados desde un iPhone o un Mac. Una vez hecho, se puede compartir por enlace de iCloud.
- **Claves personales (`api_tokens`):**
  - La clave (`ht_` + 32 bytes aleatorios) se genera en el iPhone. En la base de datos solo se guardan su hash SHA-256 y los 8 primeros caracteres, para reconocerla en la lista.
  - Solo se muestra una vez. Si se cierra la hoja sin copiarla, la app pregunta antes.
  - Solo sirve para enviar datos de Salud: no permite leer nada. Se revoca desde Ajustes (se borra la fila).
  - Cada clave guarda la hora y los datos de su última sincronización (`last_sync`), que se ven en Ajustes.
- **Qué envía el atajo:** un texto por métrica, una línea por muestra de Salud, con las fechas en ISO 8601 (formato en `_shared/health.ts`). Los cálculos los hace el servidor, para poder corregirlos sin rehacer el atajo.
  - Envía 4 días, pero solo se escriben **hoy y los 2 anteriores**: así el primero, que puede estar a medias, no cuenta.
  - Los números se aceptan como los escribe el iPhone en español o en inglés ("8.432", "7,5").
  - Si dos fuentes cuentan lo mismo (iPhone y Fitbit), se toma la mayor, no la suma.
- **Métricas:**
  - **Pasos:** total del día.
  - **Sueño: descartado** al probarlo (2026-10-24): no funcionaba y no hace falta en los hábitos. El servidor lo sigue entendiendo: horas dormidas, sin contar «en cama» ni «despierto», y la noche cuenta para el día en que te despiertas (un tramo que termina a partir de las 18:00 ya es de la noche siguiente).
  - **Entrenamientos: descartados** al probarlo (2026-10-24). Atajos solo tiene «Registrar entrenamiento», no una acción para leerlos, y «Buscar muestras médicas» no los incluye. El servidor los sigue aceptando y un hábito que ya los use conserva la métrica en el formulario, pero no se ofrecen.
- **Hábitos de Salud: cuantitativos con cifra y meta** (elegido), p. ej. «8432/10.000 pasos», con todas las visualizaciones.
  - En el formulario, «Fuente: Manual / Salud» solo aparece en los cuantitativos. **Solo se ofrecen los pasos**: al elegir Salud no hay que elegir métrica, y un texto debajo explica que el hábito tomará los pasos de Salud. Un hábito que ya use otra métrica la conserva y ve el selector. La unidad la pone la app y la meta empieza en 10.000 pasos.
  - Un hábito existente se puede pasar a Salud y conserva su historial. Las 3 últimas fechas se sobrescriben con lo que diga Salud, salvo las cambiadas a mano.
  - Se rellenan los días en que el hábito toca según su plan; en «X veces por semana», todos los días. Los días anteriores a la ventana de 3 días no se rellenan aunque el hábito empiece antes (confirmado: los días anteriores se ponen a mano).
  - En lugar del botón «+N» llevan un ❤️, que se pone del color del hábito con ✓ cuando se cumple. Cambiar el valor a mano se hace a propósito, en la hoja del día; por eso en el detalle de Seguimiento tampoco tienen botón «−».
- **Cambios a mano: manda el valor manual** (elegido), con un botón para volver al de Salud.
  - `habit_logs.manual` marca el día y `health_value` guarda lo último que llegó de Salud. La sincronización actualiza `health_value`, pero no toca `value` mientras el día sea manual.
  - En la Agenda pone «cambiado a mano». La hoja del día dice qué dice Salud y ofrece «Usar el dato de Salud» o, si aún no ha llegado nada, «Quitar mi valor y esperar a Salud».
  - Un 0 puesto a mano se guarda como fila (no se borra), para que la sincronización no lo rellene.
- **Sincronizar desde la app** (pedido tras probarlo): abre Atajos y ejecuta `Habit tracker` (`shortcuts://run-shortcut`). Al volver con «◀ Habit tracker», la app recarga los datos. Está en:
  - Ajustes → Salud → «Sincronizar ahora»;
  - el ❤️ de cada hábito de Salud (Agenda, tarjeta y detalle de Seguimiento);
  - el botón «Sincronizar con Salud» del detalle, con la hora de la última sincronización.
  - Si ese día se cambió a mano, el ❤️ y el botón preguntan: «Sincronizar y sobrescribir» (primero vuelve al dato de Salud, porque el servidor nunca pisa un valor manual), «Solo sincronizar» o «Cancelar». Si no, sincronizan sin preguntar.
- **Notificación del atajo:** solo cuando recibe una entrada (acción «Si»). La app se la pasa (`input=text&text=app`), y la automatización de las 23:00 también, con «Ejecutar atajo» y un texto. El resto de automatizaciones (p. ej. 9, 12, 15, 18 y 21 h) van en silencio.
- **Limitaciones:**
  - No es en tiempo real: los datos llegan cuando se ejecuta el atajo.
  - Con el iPhone bloqueado, iOS no deja leer Salud y alguna automatización puede fallar. Por eso hay varias y se envían varios días.

## Cambios tras la fase 6

- **Recordatorios según el día** (elegido: cada hora con sus días):
  - `habits.reminders` es una lista de `{hora, días}` (días ISO, 1 = lunes) y sustituye a `reminder_times`. La base de datos valida el formato: HH:MM, de 1 a 7 días distintos de 1 a 7 y como mucho 10 recordatorios.
  - Al migrar, los recordatorios que ya había suenan todos los días.
  - Un recordatorio nuevo empieza con todos los días marcados. No se puede guardar uno sin días.
  - Sigue valiendo la regla de la fase 4: solo suena los días en que toca el hábito y si aún no está cumplido. Si dos recordatorios coinciden en hora el mismo día, llega uno.
- **Orden de las tareas** (elegido: asa ≡ como en Mis hábitos):
  - Solo dentro de su prioridad y solo las tareas del día. «Pendientes de días anteriores» sigue ordenándose sola (prioridad y antigüedad).
  - El asa aparece cuando una prioridad tiene 2 tareas o más y el día se puede editar.
  - `todos.sort_order`: al reordenar se guarda el orden de todo el día (1, 2, 3…). Una tarea nueva, movida a otro día o cambiada de prioridad va al final de su bloque, porque recibe la hora actual en milisegundos.
- **Anillo y tarro diarios** (solo hábitos cuantitativos, pedido así):
  - **Anillo «Día»:** cantidad de hoy sobre la meta diaria. El porcentaje puede pasar de 100 % (el anillo se queda lleno). En el detalle, las opciones son «Hoy / Esta semana / Este mes».
  - **Tarro «Día»:** un tarro por día que se llena con la meta diaria. No hay capacidad que elegir. La estantería muestra los 12 días anteriores.
  - Si no se elige cuánto vale una canica, en el tarro diario **la meta se reparte en 10 canicas** (decisión propia: con 1 canica = la meta, el tarro estaría vacío hasta cumplirla). En los demás periodos sigue siendo 1 canica = la meta diaria.
  - En sí/no y negativos no se ofrece «Día». Si se hubiera guardado, se muestra la opción por defecto (semana o mes).

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
- **El % se divide siempre entre 14** (cambio pedido tras la fase 3): los días anteriores a la creación del hábito cuentan como no cumplidos.
  - Así, un hábito nuevo empieza como semilla y crece día a día: brote con 3 cumplidos, planta joven con 6, planta con 9 y flor con 12 de los últimos 14 días que tocaban.
  - Antes, un hábito recién creado y cumplido hoy daba 1/1 = 100 % y salía la flor.
  - Consecuencia: en hábitos poco frecuentes (p. ej. cada 7 días) florecer tarda meses.
  - La tarjeta muestra "N de los últimos 14 días que tocaba" y el detalle, cuántos días cumplidos pide la siguiente fase.
- **Qué cuenta:** hoy, mientras está pendiente, no cuenta. En los cuantitativos, un día solo cuenta si se llega a la meta.
- **Mustia:** la fase sigue dependiendo del %. La planta mustia tiene el tallo doblado y las hojas caídas y marrones, y revive con el siguiente día cumplido.
- **Detalle:** se muestra el progreso por fases y el % necesario para la siguiente.
