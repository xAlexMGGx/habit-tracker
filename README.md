# Habit tracker

PWA para iPhone de seguimiento de hábitos y to-dos. Frontend en React + Vite (GitHub Pages) y backend en Supabase.
La especificación completa está en [SPEC.md](SPEC.md) y las decisiones tomadas por el camino en [docs/DECISIONS.md](docs/DECISIONS.md).

Este README recoge **los pasos manuales que tienes que hacer tú**. Hazlos en orden la primera vez.

---

## 0. Requisitos

- [Node.js](https://nodejs.org) 20.19 o superior (recomendado 24 LTS) y npm.
- Una cuenta de [GitHub](https://github.com) con este repositorio subido (`xAlexMGGx/habit-tracker`).
- Una cuenta de [Supabase](https://supabase.com) (el plan gratuito basta).

> Los nombres exactos de los menús de Supabase y GitHub pueden variar un poco con el tiempo; las rutas de abajo son orientativas.

---

## 1. Crear el proyecto en Supabase

1. Entra en <https://supabase.com/dashboard> → **New project**.
2. Nombre: `habit-tracker`. Región: la más cercana (p. ej. *West EU (Ireland)* o *Central EU (Frankfurt)*).
3. Pon una contraseña de base de datos y guárdala en tu gestor de contraseñas (no la necesita la app).
4. Espera a que termine de crearse (1-2 minutos).

> ⚠️ En el plan gratuito, Supabase **pausa los proyectos tras 7 días sin actividad**. Si usas la app a diario no pasa nada; si se pausa, se reactiva desde el panel.

---

## 2. Ejecutar las migraciones (crear tablas y seguridad)

Las migraciones están en [supabase/migrations/](supabase/migrations/). Crean las tablas `user_settings`, `habits`, `habit_logs` y `todos`, con **Row Level Security** (cada usuario solo ve y modifica sus propias filas).

### Opción A — SQL Editor (la más sencilla)

1. En el panel del proyecto: **SQL Editor** → **New query**.
2. Abre [supabase/migrations/20261020000000_init.sql](supabase/migrations/20261020000000_init.sql), copia **todo** su contenido y pégalo.
3. Pulsa **Run**. Debe terminar con *Success. No rows returned*.
4. Comprueba en **Table Editor** que aparecen las 4 tablas y que cada una muestra el candado de **RLS enabled**.

Cuando haya migraciones nuevas en fases posteriores, ejecuta solo los ficheros nuevos, en orden de nombre:

| Fichero | Qué añade |
|---|---|
| `20261020000000_init.sql` | Tablas, RLS y funciones base (fase 1) |
| `20261022000000_todo_details.sql` | Prioridad (semáforo), "en progreso" y notas en las tareas |
| `20261023000000_push.sql` | Suscripciones push y registro de recordatorios enviados (fase 4, ver paso 9) |
| `20261024000000_health.sql` | Claves personales y hábitos rellenados desde Salud (fase 6, ver paso 10) |
| `20261024120000_reminder_days_todo_order.sql` | Recordatorios según el día de la semana y orden manual de las tareas (ver paso 11) |

### Opción B — Supabase CLI

```bash
npx supabase login
npx supabase link --project-ref <REF_DEL_PROYECTO>   # el ref está en la URL del panel
npx supabase db push
```

---

## 3. Configurar la autenticación

La app usa **email + contraseña**. No hay registro público: tú creas las cuentas (2-3 personas).

1. **Cerrar el registro público**
   **Authentication → Sign In / Providers** → desactiva **Allow new users to sign up**. Deja activado el proveedor **Email**.

2. **Contraseña mínima**
   En la misma pantalla (sección *Email* / *Passwords*), pon **Minimum password length = 8**.

3. **Crear las cuentas**
   **Authentication → Users → Add user → Create new user**: email + contraseña, y marca **Auto Confirm User**.
   Repite con cada persona y dale su contraseña inicial; podrá cambiarla en *Ajustes → Cambiar contraseña*.

4. **SMTP propio (necesario para "¿Has olvidado la contraseña?")**
   Supabase no deja editar las plantillas de email con su servidor de correo de serie, y la app necesita que el email lleve un código (paso 5). Lo más sencillo es enviar los emails desde una cuenta de Gmail:

   1. En esa cuenta de Google, activa la **verificación en dos pasos**: <https://myaccount.google.com/security>.
   2. Crea una **contraseña de aplicación** en <https://myaccount.google.com/apppasswords> (nombre: `Supabase`). Google muestra 16 letras en grupos de 4: cópialas **sin los espacios**.
   3. En Supabase, **Authentication → Emails → SMTP Settings** (en paneles antiguos: *Project Settings → Authentication → SMTP Settings*), activa **Enable custom SMTP** y rellena:

      | Campo | Valor |
      |---|---|
      | Sender email address | tu dirección de Gmail |
      | Sender name | `Habit tracker` |
      | Host | `smtp.gmail.com` |
      | Port number | `587` (si al enviar da error, prueba `465`) |
      | Minimum interval between emails | deja el valor por defecto (60) |
      | Username | tu dirección de Gmail completa |
      | Password | la contraseña de aplicación de 16 letras (no la de tu cuenta) |

   4. **Save changes**. Los emails saldrán desde esa dirección de Gmail.

   Si no configuras SMTP, la app funciona igual, pero "¿Has olvidado la contraseña?" no servirá (ver *Solución de problemas*).

5. **Plantilla del email con código**
   En iPhone, la app instalada no comparte sesión con Safari, así que un enlace en el email no serviría: la app pide un **código de 6 dígitos**.
   **Authentication → Emails → Templates → Reset Password**:
   - **Subject**: `Código para restablecer tu contraseña / Password reset code`
   - **Body** (sustituye todo el contenido):

   ```html
   <h2>Habit tracker</h2>
   <p>Tu código para crear una contraseña nueva / Your password reset code:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   <p>Caduca en 1 hora. / It expires in 1 hour.</p>
   ```

   Lo imprescindible es que aparezca `{{ .Token }}`. Guarda y pruébalo desde la app: *¿Has olvidado la contraseña?* → tu email → te llega el código (mira también en spam).

6. **URL del sitio**
   **Authentication → URL Configuration → Site URL**: `https://xalexmggx.github.io/habit-tracker/`

> ⚠️ **No borres un usuario para "resetearlo"**: borrar la cuenta borra también todos sus hábitos, registros y to-dos.

---

## 4. Variables de entorno

La app necesita dos valores **públicos** de Supabase:

| Variable | Dónde está |
|---|---|
| `VITE_SUPABASE_URL` | **Project Settings → Data API** (o *API*) → *Project URL*, p. ej. `https://abcd1234.supabase.co`. Solo hasta `.supabase.co`: **sin** `/rest/v1/` al final |
| `VITE_SUPABASE_ANON_KEY` | **Project Settings → API Keys** → la clave **publishable** (`sb_publishable_…`) o, en la pestaña *Legacy*, la clave **anon** |

> 🔒 **Nunca uses la clave `secret` / `service_role`** en la app: da acceso total a la base de datos saltándose la RLS. El proyecto se niega a compilar o arrancar si detecta una.
> La clave publishable/anon sí es pública: acaba dentro del JavaScript que descarga el navegador, y es la RLS la que protege los datos.

Para desarrollo local, copia `.env.example` a `.env.local` y rellénalo:

```bash
cp .env.example .env.local
```

`.env.local` está en `.gitignore` y no se sube al repositorio.

---

## 5. Probar en local

```bash
npm install
npm run dev
```

Abre <http://localhost:5173/habit-tracker/> e inicia sesión con una de las cuentas del paso 3.
Para ver cómo queda en móvil, usa el modo dispositivo de las DevTools del navegador (iPhone).

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm test` | Tests de la lógica (fechas, frecuencias, traducciones, CSV) |
| `npm run typecheck` | Comprobación de tipos |
| `npm run build` | Compilación de producción en `dist/` |
| `npm run preview` | Sirve `dist/` en local, con service worker incluido |
| `npm run icons` | Regenera los iconos PNG a partir de `public/icon.svg` |

> Face ID y la instalación como app solo funcionan con HTTPS, así que pruébalos ya desplegado en GitHub Pages, no con la IP local.

---

## 6. Desplegar en GitHub Pages

El despliegue es automático con GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) en cada `push` a `main`: instala, pasa los tests, compila y publica.

1. **Repositorio público.** GitHub Pages gratis requiere que lo sea (**Settings → General → Danger Zone → Change visibility**). No hay secretos en el código: la clave de Supabase que usa la app es pública y los datos están protegidos por la RLS.
2. **Activar Pages con Actions.** **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Variables del build.** **Settings → Secrets and variables → Actions → pestaña Variables → New repository variable**:
   - `VITE_SUPABASE_URL` = la URL del paso 4
   - `VITE_SUPABASE_ANON_KEY` = la clave publishable/anon del paso 4
4. **Subir el código** (si aún no lo has hecho):

   ```bash
   git add .
   git commit -m "Fase 1: base"
   git push origin main
   ```

5. Mira el progreso en la pestaña **Actions**. Al terminar, la app estará en:
   **<https://xalexmggx.github.io/habit-tracker/>**

Si cambias el nombre del repositorio no hay que tocar nada: el workflow usa el nombre del repo como ruta base.

---

## 7. Instalar la app en el iPhone

1. Abre **Safari** (tiene que ser Safari) y ve a <https://xalexmggx.github.io/habit-tracker/>.
2. Pulsa el botón **Compartir** (el cuadrado con la flecha hacia arriba).
3. Elige **Añadir a pantalla de inicio** → **Añadir**.
4. Abre la app **desde el icono nuevo** (no desde Safari). Desde ahí funciona como una app y, a partir de la fase 4, podrá recibir notificaciones.
5. Inicia sesión. Cuando iOS ofrezca **guardar la contraseña en el llavero**, acepta: la próxima vez te la rellenará con Face ID.
6. (Opcional) **Ajustes (⚙️) → Bloquear con Face ID**: la app pedirá Face ID al abrirse o al volver a ella tras más de un minuto. Se activa por dispositivo.

Cuando se publique una versión nueva, la app mostrará arriba un aviso **"Hay una versión nueva · Actualizar"**.

---

## 8. Copias de seguridad

El plan gratuito de Supabase **no hace copias automáticas**. De vez en cuando: **Ajustes → Exportar mis datos** → **JSON** (todo en un fichero) o **CSV** (un fichero por tabla). En el iPhone se abre la hoja de compartir: elige **Guardar en Archivos**.

---

## 9. Notificaciones push (fase 4)

Los recordatorios los envía una **Edge Function** de Supabase (`send-reminders`), que `pg_cron` llama **cada minuto**: mira la hora local de cada usuario y envía los avisos que tocan. Funciona en el iPhone con **iOS 16.4 o superior** y la app **instalada en la pantalla de inicio**.

Hazlo en este orden (desde la carpeta del proyecto, en una terminal):

### 9.1 Migración

En el **SQL Editor**, ejecuta [supabase/migrations/20261023000000_push.sql](supabase/migrations/20261023000000_push.sql).

### 9.2 Claves VAPID

```bash
npx web-push@3.6.7 generate-vapid-keys
```

Te da una **Public Key** y una **Private Key**. Guarda las dos en tu gestor de contraseñas.

- La **pública** va en la app: añádela a `.env.local` como `VITE_VAPID_PUBLIC_KEY=…` y en GitHub (**Settings → Secrets and variables → Actions → Variables**) como variable `VITE_VAPID_PUBLIC_KEY`.
- La **privada** solo va en los secretos de Supabase (paso 9.4). **Nunca** en el repositorio, en `.env.local` ni en las Variables de GitHub.

### 9.3 Conectar la CLI de Supabase con tu proyecto

```bash
npx supabase login
npx supabase link --project-ref TU-REF
```

`TU-REF` es lo que va antes de `.supabase.co` en la URL del proyecto.

### 9.4 Secretos de la función

Genera un secreto para que solo el cron pueda lanzar los envíos:

```bash
node -e "console.log(crypto.randomUUID())"
```

Y guárdalo junto con las claves VAPID (sustituye los valores; el `mailto:` es un email de contacto para los servicios de push):

```bash
npx supabase secrets set VAPID_PUBLIC_KEY=TU-CLAVE-PUBLICA VAPID_PRIVATE_KEY=TU-CLAVE-PRIVADA VAPID_SUBJECT=mailto:tu@email.com CRON_SECRET=EL-SECRETO-GENERADO
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los pone Supabase automáticamente en la función. La clave `service_role` solo se usa ahí, en el servidor; nunca en la app.

### 9.5 Desplegar la función

```bash
npx supabase functions deploy send-reminders --no-verify-jwt --use-api
```

- `--no-verify-jwt`: la función comprueba ella misma quién la llama (el cron con `CRON_SECRET`; la prueba desde la app con tu sesión).
- `--use-api`: empaqueta en los servidores de Supabase, así que no necesitas Docker.

### 9.6 Programar el envío cada minuto

Copia el contenido de [supabase/sql/schedule-reminders.sql](supabase/sql/schedule-reminders.sql) en el SQL Editor, sustituye **allí** `YOUR-PROJECT-REF` y `YOUR-CRON-SECRET` (el mismo `CRON_SECRET` del paso 9.4) y ejecútalo **una vez**. Activa `pg_cron` y `pg_net` y guarda la URL y el secreto en el **Vault** (cifrados).

> ⚠️ **No guardes el secreto en el fichero del repositorio**: el repo es público. Si quieres una copia rellena, llámala `schedule-reminders.local.sql` (está en `.gitignore`).

**Cambiar el `CRON_SECRET`** (por ejemplo, si se ha publicado por error): genera uno nuevo y actualízalo en los dos sitios:

```bash
npx supabase secrets set CRON_SECRET=EL-NUEVO
```

```sql
select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), 'EL-NUEVO');
```

> Coste: una llamada por minuto son unas 44.000 al mes; el plan gratuito incluye 500.000 invocaciones de Edge Functions.

### 9.7 Desplegar la app y probar

1. Con `VITE_VAPID_PUBLIC_KEY` en las Variables de GitHub, haz push (o relanza el workflow) para desplegar la app.
2. En el iPhone, abre la app **desde el icono** → **Ajustes → Notificaciones** → activa **Recordatorios en este dispositivo** → **Permitir**.
3. Pulsa **Enviar notificación de prueba**: debe llegar en unos segundos.
4. Pon un recordatorio a un hábito para dentro de 2 minutos (Mis hábitos → el hábito → Recordatorios) y espera.

Las notificaciones son **por dispositivo**: actívalas en cada iPhone. Al cerrar sesión se desactivan en ese dispositivo.

---

## 10. Salud / Fitbit (fase 6)

Los hábitos de **pasos** se rellenan solos con los datos de la Fitbit:

Fitbit → app de Google → **Salud** del iPhone → **un atajo de Atajos** (varias veces al día, solo) → Edge Function `health` → hábitos.

El atajo lee Salud y envía los datos de los últimos días con una **clave personal** que solo sirve para eso. En la base de datos solo se guarda el *hash* de la clave, y puedes revocarla desde Ajustes. De los datos de Salud solo se guarda el total de cada día en los hábitos que lo usan.

> Solo se usan los **pasos**. Los entrenamientos no se pueden leer desde Atajos (solo registrarlos) y el sueño se descartó al probarlo.

### 10.1 Comprueba que los datos llegan a Salud

En el iPhone: **Salud → Explorar → Pasos → Fuentes de datos y acceso**. Tiene que aparecer la app de Google de tu Fitbit. Si no aparece, el resto no puede funcionar: actívalo primero en la app de Google.

Si el iPhone también cuenta pasos, en esa pantalla pulsa **Editar** y pon la Fitbit la primera, para que Salud no los cuente dos veces.

### 10.2 Migración

En el **SQL Editor**, ejecuta [supabase/migrations/20261024000000_health.sql](supabase/migrations/20261024000000_health.sql). Hazlo **antes** de subir la app nueva.

### 10.3 Desplegar la función

Con la CLI ya conectada (paso 9.3):

```bash
npx supabase functions deploy health --no-verify-jwt --use-api
```

No necesita secretos nuevos. `--no-verify-jwt` es necesario porque el atajo no inicia sesión: la función comprueba ella misma la clave personal.

### 10.4 Desplegar la app y crear la clave

1. Haz push a `main` para desplegar la app.
2. En el iPhone: **Ajustes → Salud → Crear clave para el atajo**. Ponle un nombre, pulsa **Crear clave** y **Copiar**. Por seguridad no se vuelve a mostrar: si la pierdes, revócala y crea otra.

### 10.5 Crear el atajo

Sigue **Ajustes → Salud → Cómo crear el atajo**, que tiene los pasos completos y la dirección para copiar. En resumen, en la app **Atajos** creas un atajo llamado `Habit tracker` que:

1. Busca en Salud (**Buscar muestras médicas**) los **pasos** de los últimos 4 días, agrupados por día.
2. Convierte cada día en una línea de texto `Fecha de inicio|Valor`, con la fecha en ISO 8601 con hora (en el «Formato» de la fecha, «ISO 8601» y «Hora» activada).
3. Hace un `POST` a `https://TU-REF.supabase.co/functions/v1/health` con la cabecera `Authorization` y el valor `Bearer <clave>`, y un JSON con el campo de texto `steps`.
4. **Si** recibe una entrada, muestra la respuesta como notificación (p. ej. *Habit tracker ✓ Hoy: 8432 pasos*). La app le pasa una entrada al sincronizar desde ella, y la automatización de las 23:00 también; las demás no, y van en silencio.

> Las otras personas pueden hacer lo mismo con su propia clave. También puedes compartir tu atajo por enlace de iCloud, y cada persona cambia la clave por la suya.

### 10.6 Tus hábitos

En **Mis hábitos**, crea o edita un hábito **cuantitativo** y en **Fuente** elige **Salud**: tomará los pasos de cada día. La unidad la pone la app y la meta empieza en 10.000 pasos. Puedes convertir un hábito que ya tengas y conserva su historial.

- Cada sincronización rellena **hoy y los dos días anteriores**, en los días en que el hábito toca (en los de «X veces por semana», cualquier día). Los días anteriores, si hacen falta, se ponen a mano.
- Si cambias un día a mano, **se queda tu valor**. Para volver al de Salud, abre ese día y pulsa **Usar el dato de Salud**.
- El ❤️ de los hábitos de Salud (en la Agenda y en Seguimiento) **sincroniza**: abre Atajos y ejecuta el atajo. Si ese día lo cambiaste a mano, pregunta antes: **Sincronizar y sobrescribir** (vuelve al dato de Salud), **Solo sincronizar** o **Cancelar**. En el detalle del hábito tienes también el botón **Sincronizar con Salud**, con la hora de la última sincronización.
- Después de sincronizar, vuelve a la app con **◀ Habit tracker**, arriba a la izquierda.

### 10.7 Probarlo

En la app, **Ajustes → Salud → Sincronizar ahora** (o toca un ❤️). La primera vez, iOS pedirá permiso para leer Salud y para conectarse a `supabase.co`: elige **Permitir siempre**. Debe llegar la notificación con los datos de hoy, y en Ajustes verás la última sincronización.

### 10.8 Que se ejecute solo

En **Atajos → Automatización → + → Hora del día**, con **Diariamente** y **Ejecutar inmediatamente**:

- **23:00, con notificación**: tras **Siguiente**, elige **Nuevo atajo en blanco**. Añade **Texto** con la palabra `notificar` y, debajo, **Ejecutar atajo** con `Habit tracker` (su entrada debe ser ese Texto). Te avisa con el resumen del día.
- **Las demás, en silencio** (p. ej. 9:00, 12:00, 15:00, 18:00 y 21:00): tras **Siguiente**, elige directamente el atajo `Habit tracker`.

iOS no deja leer Salud con el iPhone bloqueado, así que alguna ejecución puede fallar. Como el atajo envía siempre los últimos días, la siguiente lo completa.

---

## 11. Cambios tras la fase 6

- **Recordatorios según el día:** cada hora de recordatorio de un hábito lleva debajo los días de la semana en que suena (p. ej. 19:00 de lunes a viernes y 10:00 el fin de semana). Los que ya tenías suenan todos los días.
- **Orden de las tareas:** dentro de cada prioridad, las tareas del día se reordenan con el asa ≡, como los hábitos en Mis hábitos.
- **Anillo y tarro diarios** (hábitos cuantitativos): en el periodo eliges «Día» y ves lo que llevas de la meta de hoy.

Para activarlo, haz estos tres pasos **seguidos** (la versión anterior de la app y de la función todavía usa la columna antigua de los recordatorios):

1. En el **SQL Editor**, ejecuta [supabase/migrations/20261024120000_reminder_days_todo_order.sql](supabase/migrations/20261024120000_reminder_days_todo_order.sql).
2. Vuelve a desplegar la función de los recordatorios:

   ```bash
   npx supabase functions deploy send-reminders --no-verify-jwt --use-api
   ```

3. Haz push a `main` para desplegar la app.

---

## Estructura del proyecto

```
.github/workflows/deploy.yml   Build + despliegue en GitHub Pages
supabase/migrations/           Esquema SQL, RLS y funciones
supabase/functions/
  send-reminders/              Edge Function que envía las notificaciones
  health/                      Edge Function que recibe los datos de Salud del atajo
  _shared/                     Lógica común con la app (fechas, frecuencias, qué recordar, Salud)
supabase/sql/                  SQL que se ejecuta a mano una vez (cron de recordatorios)
public/                        Iconos de la app (generados desde icon.svg)
src/
  i18n/locales/{es,en}.json    Todos los textos de la interfaz
  lib/                         Lógica pura: fechas, frecuencias, exportación, cliente Supabase
  data/                        Consultas y mutaciones (TanStack Query, actualizaciones optimistas)
  auth/                        Sesión, inicio de sesión y recuperación con código
  components/                  Piezas comunes (cabecera, pestañas, hojas, diálogos…)
  features/
    agenda/                    Tira de días, to-dos, pendientes y marcado de hábitos
    habits/                    Mis hábitos: lista, reordenar, archivar, formulario
    tracker/                   Seguimiento (fase 2)
    settings/                  Ajustes (y la guía del atajo de Salud)
    lock/                      Bloqueo con Face ID
    welcome/                   Guía de instalación
  sw.ts                        Service worker
```

---

## Solución de problemas

- **"Falta configurar Supabase"** al abrir en local → falta `.env.local` o hay que reiniciar `npm run dev`.
- **El build de GitHub Actions falla con "Missing VITE_SUPABASE_URL…"** → faltan las variables del paso 6.3 (son *Variables*, no *Secrets*).
- **La página de GitHub Pages da 404** → revisa que *Source* sea **GitHub Actions** y que el workflow haya terminado en verde.
- **No llega el código de recuperación** → revisa el SMTP y la plantilla (pasos 3.4 y 3.5) y la carpeta de spam. En **Authentication → Rate Limits** puedes ver el límite de emails por hora.
- **El SMTP de Gmail da error al enviar** → comprueba que usas la *contraseña de aplicación* (sin espacios) y no la de tu cuenta, y prueba el puerto `465` en vez del `587`.
- **Alguien ha olvidado la contraseña y no hay SMTP** → cámbiasela tú en **SQL Editor** (sustituye el email y la contraseña nueva, de 8 caracteres o más):

  ```sql
  update auth.users
     set encrypted_password = extensions.crypt('contraseña-nueva', extensions.gen_salt('bf'))
   where email = 'persona@ejemplo.com';
  ```

  Después, esa persona puede poner la suya en *Ajustes → Cambiar contraseña*.
- **"Email o contraseña incorrectos"** con una cuenta recién creada → comprueba que marcaste *Auto Confirm User*.
- **Los cambios no aparecen en el iPhone** → espera el aviso de versión nueva o cierra la app del todo y ábrela otra vez.
- **Notificaciones: el interruptor está desactivado y pide instalar la app** → ábrela desde el icono de la pantalla de inicio, no desde Safari, con iOS 16.4 o superior.
- **"No se ha podido enviar la prueba"** → la función no está desplegada o falta un secreto. Mira **Edge Functions → send-reminders → Logs** (un error `Missing secret …` dice cuál falta).
- **Llega la prueba pero no los recordatorios** → revisa el cron en el SQL Editor:

  ```sql
  select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
  select status_code, content::text from net._http_response order by created desc limit 10;
  ```

  Un `401` significa que el `CRON_SECRET` del Vault no coincide con el de la función. Comprueba también la zona horaria: se toma del iPhone cada vez que abres la app.
- **Cambias las claves VAPID** → en cada dispositivo, desactiva y vuelve a activar las notificaciones.
- **"No se ha podido crear la clave"** en Ajustes → Salud → falta la migración del paso 10.2.
- **El atajo da error en «Obtener contenido de URL»** → si es un 404, la función `health` no está desplegada (paso 10.3). Revisa también la dirección.
- **La notificación dice que la clave no es válida** → se ha revocado o está mal copiada. La cabecera debe ser exactamente `Authorization` con el valor `Bearer ht_…` (con un espacio después de `Bearer`).
- **"No ha llegado ningún dato de Salud"** → Atajos no tiene permiso para leer Salud: en el iPhone, **Ajustes → Privacidad y seguridad → Salud → Atajos** y activa Pasos. Comprueba también el paso 10.1.
- **Los pasos salen dobles** → en Salud, pon la Fitbit la primera en las fuentes de datos de Pasos (paso 10.1).
- **Alguna automatización no ha funcionado** → es normal si el iPhone estaba bloqueado; la siguiente lo completa.
- **No llega la notificación al sincronizar desde la app** → revisa la acción «Si» del atajo («Entrada del atajo» «tiene algún valor») y que «Mostrar notificación» esté dentro. En Supabase, **Edge Functions → health → Logs** muestra cuántas líneas llegaron en cada sincronización.
