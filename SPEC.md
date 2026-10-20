# SPEC — App de hábitos y to-dos (PWA para iPhone)

Documento de referencia del proyecto. Recoge todas las decisiones de producto tomadas. Si algo no está definido aquí, pregunta antes de inventarlo.

---

## 1. Visión general

- App para **trackear hábitos** (recurrentes) y **to-dos** (tareas puntuales de un día concreto).
- Uso privado: 2-3 personas, **cada una con su cuenta y sus datos**. No hay nada compartido ni social entre usuarios.
- Se usa en **iPhone** como **PWA** instalada en la pantalla de inicio ("Añadir a pantalla de inicio" desde Safari). No hay app nativa ni App Store.
- Idiomas: **español e inglés**.

### Fuera de alcance
- Funciones sociales o compartir datos entre usuarios.
- Marcar hábitos desde el widget (el widget solo muestra información).
- App nativa, HealthKit directo, Siri, Live Activities.

---

## 2. Stack y arquitectura

- **Frontend:** PWA (recomendado: Vite + React + TypeScript; `vite-plugin-pwa` para manifest y service worker). Visualizaciones como componentes SVG propios.
- **Hosting:** GitHub Pages (tener en cuenta el `base` path del repo).
- **Backend:** Supabase (plan gratuito).
  - **Auth:** cuentas por usuario (email + contraseña y/o enlace mágico).
  - **Postgres** con **Row Level Security** en todas las tablas: cada usuario solo puede leer y escribir sus propias filas.
  - **Edge Functions + pg_cron** para notificaciones push y para los endpoints de Scriptable y Atajos (fases posteriores).
- En el frontend solo se usa la clave `anon`/pública. **Nunca** la `service_role`.
- Los pasos manuales que tenga que hacer el usuario (crear el proyecto de Supabase, ejecutar migraciones, configurar claves VAPID, activar GitHub Pages…) se documentan paso a paso en un `README.md`.
- Pantalla de bienvenida o aviso que explique que la app debe instalarse en la pantalla de inicio y abrirse desde el icono (necesario para notificaciones en iOS).

### Modelo de datos orientativo
Claude Code puede ajustarlo, pero debe cubrir:

- `user_settings`: idioma, número de columnas del tracker (1 | 2), modo de orden del tracker (manual | racha | % cumplimiento | pendientes hoy primero), zona horaria, última subtab usada en Agenda, preferencias de notificaciones.
- `habits`:
  - Datos básicos: nombre, icono, color.
  - Tipo (`boolean` | `quantitative` | `negative`), y meta + unidad (si es cuantitativo).
  - Frecuencia y su configuración.
  - Recordatorios (horas).
  - Visualización elegida y su configuración (`viz_config` JSON, p. ej. parámetros del tarro).
  - `sort_order` (orden manual), `archived_at`, `created_at`.
  - En fase 6: fuente (`manual` | `health` + métrica + umbral).
- `habit_logs`: hábito, fecha local, valor (unique por hábito y fecha).
- `todos`: título, fecha asignada, `completed_at`, recordatorio opcional, `created_at`.
- `push_subscriptions` (fase 4) y `api_tokens` personales de solo lectura/escritura limitada (fases 5 y 6).

---

## 3. Tipos de hábito

- **Sí/no:** se hace o no se hace (p. ej. "meditar").
- **Cuantitativo:** con meta numérica y unidad (p. ej. "8 vasos de agua", "10.000 pasos"). Se marca con +1 / +N o introduciendo un valor. Cuenta como cumplido al llegar a la meta.
- **Negativo:** algo a evitar (p. ej. "no fumar"). Por defecto el día cuenta como "limpio"; el usuario registra una **recaída** cuando ocurre. El día en curso solo cuenta como limpio una vez termina.

### Frecuencias
- Diaria.
- Días concretos de la semana.
- X veces por semana: aparece todos los días con un contador "n/X esta semana".
- Cada N días.

### Reglas generales
- Las rachas y los porcentajes se calculan sobre los **días en que el hábito tocaba**, según su frecuencia.
- La semana empieza en **lunes**.

---

## 4. Navegación

Barra inferior con **3 pestañas** y un **icono de engranaje** (Ajustes) arriba a la derecha.

| Etiqueta EN | Título EN | Etiqueta ES | Título ES |
|---|---|---|---|
| Agenda | Agenda | Agenda | Agenda |
| Tracker | Habit tracker | Seguimiento | Seguimiento de hábitos |
| Habits | Habit list | Mis hábitos | Mis hábitos |

Las etiquetas de la barra son cortas; el título completo va dentro de la pestaña.

### Estilo por pestaña
- **Agenda:** limpia y rápida, es una checklist.
- **Seguimiento:** colorida y juguetona; las tarjetas son las protagonistas.
- **Mis hábitos:** minimalista e intuitiva.
- Diseño mobile-first para iPhone: respetar safe areas, objetivos táctiles grandes y modo claro/oscuro del sistema.

---

## 5. Pestaña Agenda

### Estructura
- **Arriba, una tira de días** (semana deslizable). Se abre **siempre en hoy**. Los días que tienen to-dos muestran un puntito.
- Botón para saltar a una fecha concreta (selector de calendario).
- **Subtabs:** `To-dos | Hábitos`.
  - Cada subtab muestra su contador (p. ej. "To-dos 2/5", "Hábitos 3/7").
  - Se recuerda la última subtab usada.
- Botón **"+"** para añadir un to-do rápido al día seleccionado.

### Subtab To-dos
- To-dos del día seleccionado, con check.
- Solo en el día de hoy, se muestra además la sección **"Pendientes de días anteriores"**: to-dos no completados de cualquier fecha anterior a hoy.
- Al pulsar un to-do pendiente aparecen acciones rápidas: **Hoy** (mueve el to-do al día actual), **Mañana** y **Elegir fecha**.
- Mover un to-do pendiente **siempre** está permitido, aunque su fecha original sea un día bloqueado: es planificar el presente, no editar el pasado.

### Subtab Hábitos
- Muestra los hábitos que tocan ese día, para marcarlos (check, +1, valor o recaída según el tipo).
- **Días futuros:** la subtab Hábitos no muestra hábitos (mensaje vacío o subtab desactivada).
- **Hoy y días pasados:** visibles, sujetos a la ventana de edición.

### Ventana de edición del pasado (aplica a hábitos y to-dos)
- **Hoy y los 14 días anteriores:** edición normal.
- **Más de 14 días atrás:** solo lectura.
  - Aparece un aviso arriba: **"¿Quieres editar este día?"**.
  - Al pulsarlo, se pide confirmación y el día queda desbloqueado mientras el usuario permanezca en él.
- **Editar el pasado afecta a la lista de "Pendientes de días anteriores":**
  - Completar un to-do en un día pasado lo saca de Pendientes.
  - Desmarcarlo lo vuelve a añadir a Pendientes.
  - Crear un to-do sin completar en un día pasado lo añade a Pendientes.
- Editar hábitos del pasado recalcula rachas, porcentajes, tarro, planta, etc.

---

## 6. Pestaña Seguimiento (Habit tracker)

- **Arriba, una barra de progreso fina:** "X/Y hábitos completados hoy".
- **Debajo, las tarjetas**, una por hábito activo, dibujadas con la visualización elegida para ese hábito. Son el foco de la pantalla.
- **Diseño:** selector de **1 o 2 columnas**. La elección se guarda en `user_settings`. Cada visualización debe verse bien en ambos tamaños de tarjeta.
- **Orden:**
  - **Manual** (por defecto): arrastrar y soltar tarjetas. El orden se guarda en la cuenta (`sort_order`) y se mantiene siempre.
  - **Automático:** por racha, por % de cumplimiento o "pendientes hoy primero".
  - Cambiar a un orden automático **no borra el orden manual**: al volver a manual se recupera tal cual.
- **Detalle al pulsar una tarjeta:**
  - Visualización completa.
  - Estadísticas: racha actual, mejor racha, % de cumplimiento semanal, mensual y total.
  - Posibilidad de **ver el hábito con otras visualizaciones compatibles** sin cambiar la elegida.

---

## 7. Visualizaciones

### Compatibilidad con los tipos de hábito

| Visualización | Sí/no | Cuantitativo | Negativo |
|---|---|---|---|
| Mapa de calor | ✓ | ✓ (intensidad según cantidad) | ✓ (días limpios) |
| Calendario mensual | ✓ | ✓ | ✓ |
| Anillo | ✓ | ✓ | ✓ |
| Barras / línea | | ✓ | |
| Tarro de canicas | ✓ | ✓ | |
| Planta | ✓ | ✓ (cuenta si llega a la meta) | |
| Contador "días sin" | | | ✓ |

Al crear o editar un hábito, solo se ofrecen las visualizaciones compatibles con su tipo.

### Mapa de calor
- Un cuadrado por día, con más intensidad cuanto mayor es el cumplimiento.
- Las últimas semanas o meses según el espacio disponible.

### Calendario mensual
- Vista de mes con cada día marcado: cumplido, parcial, fallado o no tocaba.
- Navegable entre meses.

### Anillo
- Porcentaje de cumplimiento de la semana o del mes (periodo configurable).

### Barras / línea
- Cantidad registrada por día (últimos 7 o 30 días), con la meta dibujada como línea de referencia.

### Contador "días sin"
- Número grande con los días desde la última recaída.
- Muestra también el récord.

### Tarro de canicas — mide **la cantidad acumulada**
- Cada cumplimiento añade una canica.
  - En cuantitativos, el usuario define cuánto vale una canica (p. ej. 1 canica = 1 km).
- **Nunca se pierden canicas**: fallar no resta.
- **Periodo de renovación** configurable: semanal, mensual (**por defecto**), trimestral o anual.
- **Capacidad:** opciones sugeridas calculadas a partir del periodo y la frecuencia, más un campo para una cantidad personalizada.
  - Hábito diario + mensual → días del mes (se ajusta solo, de 28 a 31).
  - Hábito diario + semanal → 7.
  - Hábito diario + anual → 365.
  - 3 veces por semana + mensual → unas 13.
- **Tarro lleno antes de acabar el periodo:** se muestra lleno, con un indicador de canicas extra.
- **Al acabar el periodo**, el tarro (lleno o no) pasa a la **estantería**.
- **Estantería:** cuadrícula de **4x3** con los últimos 12 tarros y su nivel de llenado (con periodo mensual, un año completo).

### Planta — mide **la constancia reciente**
- Crece por fases: semilla → brote → planta joven → planta → flor.
- La fase depende del % de cumplimiento en los últimos 14 días en que tocaba el hábito.
- **Se marchita** si se fallan 3 días seguidos en los que tocaba.
- **Nunca muere**: revive al volver a cumplir.
- Los umbrales deben ser constantes fáciles de ajustar.

---

## 8. Guía de visualizaciones (botón "?")

- Botón "?" en la pestaña Mis hábitos, junto al selector de visualización al crear o editar un hábito.
- Es una **guía**, no una tabla:
  - Formato **carrusel**, con una página por visualización y paso deslizando.
  - Cada página incluye:
    - Un **ejemplo real dibujado** con el mismo componente de la app y datos de ejemplo (p. ej. tarro a medio llenar de "Ir al gimnasio").
    - **Cómo se lee:** qué significa cada color, canica o fase.
    - **Para qué sirve:** el propósito y qué motiva.
    - **Ideal para:** tipos de hábito compatibles y ejemplos concretos.
- **Contextual:** si se abre mientras se elige una visualización, arranca en esa página.
- Todo el texto está traducido (ES/EN).

---

## 9. Pestaña Mis hábitos (Habit list)

- Lista de hábitos activos (mismo `sort_order` que el orden manual del tracker). Se puede reordenar.
- **Crear y editar hábito**, en un formulario minimalista:
  - Nombre, icono, color.
  - Tipo (sí/no, cuantitativo con meta y unidad, negativo).
  - Frecuencia.
  - Recordatorios (una o varias horas).
  - Visualización, con **vista previa** y botón "?". Muestra los parámetros extra si aplica (tarro: periodo, capacidad, valor de cada canica).
  - La visualización se puede cambiar después sin perder datos.
- **Archivar:** el hábito desaparece de Agenda y Seguimiento pero conserva el historial.
  - Sección "Archivados" con opción de restaurar.
  - Borrar definitivamente, con doble confirmación.

---

## 10. Ajustes (engranaje)

- **Cuenta:** email, cerrar sesión.
- **Idioma:** Español / English.
  - Por defecto, el idioma del iPhone.
  - Cambia toda la interfaz: pestañas, botones, guía, notificaciones, fechas y nombres de días.
  - El contenido escrito por el usuario no se traduce.
- **Notificaciones:** activar o desactivar, y estado del permiso (fase 4).
- **Exportar mis datos:** JSON y CSV (copia de seguridad; el plan gratuito de Supabase no hace backups automáticos).
- **Widget:** instrucciones y script de Scriptable para copiar (fase 5).
- **Salud / Fitbit:** instrucciones del atajo de iOS (fase 6).

### Internacionalización
Desde el principio, sin textos hardcodeados: todos los textos de la interfaz en ficheros de traducción `es` y `en`.

---

## 11. Notificaciones (fase 4)

- Web Push: funciona en iOS 16.4+ con la PWA instalada en la pantalla de inicio.
- Recordatorios por hábito a las horas configuradas, solo los días en que toca y si aún no está cumplido.
- Recordatorio opcional por to-do.
- Envío desde servidor: `pg_cron` + Edge Function con claves VAPID, respetando la zona horaria del usuario.

---

## 12. Widget con Scriptable (fase 5)

- Widget **solo de lectura**, hecho con la app Scriptable, que muestra un dibujo del progreso (diseño exacto **por decidir** con el usuario).
- Al pulsarlo, abre la app.
- Datos: endpoint (Edge Function) que devuelve un resumen del día, autenticado con un **token personal** generado y revocable desde Ajustes.
- El script se ofrece en Ajustes para copiarlo, con instrucciones.

---

## 13. Integración con Fitbit Air (fase 6, la última)

- Flujo: Fitbit Air → app Google Health → Apple Health (sincronización nativa de Google Health) → **automatización de Atajos de iOS** (p. ej. diaria a las 23:00) que lee pasos, sueño y entrenamientos → POST a una Edge Function con el token personal → la app registra los valores.
- Los hábitos pueden tener como fuente una métrica de salud con umbral (p. ej. pasos ≥ 10.000, sueño ≥ 7 h, ≥ 1 entrenamiento) y se marcan solos.
- Ajustes incluye instrucciones paso a paso para crear el atajo.

---

## 14. Fases de desarrollo

Al terminar cada fase, **parar, resumir lo hecho y pedir validación** antes de seguir.

1. **Base:**
   - Proyecto PWA y despliegue en GitHub Pages.
   - Supabase: auth, tablas, RLS, `README` con pasos manuales.
   - i18n ES/EN.
   - Navegación (3 pestañas + Ajustes).
   - **Agenda completa:** tira de días, subtabs, to-dos, Pendientes con acciones rápidas, marcado de hábitos, ventana de edición de 14 días y desbloqueo.
   - **Mis hábitos:** crear, editar, archivar, reordenar.
   - Ajustes básicos: cuenta, idioma, exportar.
2. **Seguimiento + visualizaciones:**
   - Pestaña Seguimiento: barra de progreso, tarjetas, 1/2 columnas, orden manual y automático, detalle con estadísticas.
   - Visualizaciones: mapa de calor, calendario mensual, anillo, barras/línea, "días sin".
   - Guía "?".
3. **Tarro de canicas y planta**, incluida la estantería, y su incorporación a la guía.
4. **Notificaciones push.**
5. **Widget Scriptable** (definir antes el diseño con el usuario).
6. **Integración con salud / Fitbit Air** vía Atajos.
