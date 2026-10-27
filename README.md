# SGC · Tablero de decisiones de las escuelas

Versión web del `SGC_Tablero_dinamico_escuelas_v0.9.html`: **Next.js + React + TypeScript** (Vercel), **API Fastify + TypeScript** (Render) y **PostgreSQL en Supabase**. Las 12 vistas, las reglas de cálculo (estados, semáforo, alertas R01–R14) y las plantillas de Excel son las de la v0.9.

```
Navegador ──► Vercel: Next.js (pantallas + motor de cálculo en el navegador)
    │               │ inicio de sesión (Supabase Auth)
    │               ▼
    └─────────► Render: API Fastify (permisos, Excel, exportaciones, bitácora)
                        └──► Supabase: PostgreSQL (datos) + Storage (Excel originales)
```

## Estructura

| Carpeta | Qué es |
|---|---|
| `apps/web` | Pantallas (Next.js 16, React 19). Calcula las vistas con el mismo motor que la API. |
| `apps/api` | API (Fastify). Verifica la sesión de Supabase, aplica permisos en cada operación, lee y valida Excel, exporta y registra la bitácora. |
| `packages/engine` | **Motor de cálculo** en TypeScript puro (estados, alertas, semáforo de «Decisión», exportaciones). |
| `packages/db` | Esquema Drizzle, migraciones SQL y conexión (Supabase o PGlite). |
| `packages/excel` | Lectura de la plantilla de carga/consolidado/parámetros y escritura de las exportaciones (SheetJS 0.20). |
| `packages/catalog` | Catálogo del modelo (extraído del HTML v0.9) y las plantillas Excel. |
| `tools/oracle` | Ejecuta el HTML original (jsdom) para generar los resultados de referencia de las pruebas. |
| `reference` | El HTML original, solo como referencia. |

## Qué garantiza que los resultados no cambiaron

- **Pruebas de equivalencia** (`pnpm test`): el HTML original se ejecuta en 7 escenarios (datos reales, ejemplo, otra fecha de corte, archivos cargados, parámetros distintos, consolidado) y el motor nuevo debe dar el mismo estado de cada indicador y proceso, las mismas alertas y las mismas filas de exportación. También se compara la vista «Decisión» (semáforo, validaciones, ranking) y la lectura de los Excel.
- **De punta a punta**: se cargan los archivos por la API, se guardan en la base, y las exportaciones salen idénticas a las del original.
- Una medición **sin fuente** no se puede guardar ni por la puerta de atrás: lo impide la base (restricción CHECK). Las tablas tienen **RLS activado sin políticas**: la clave pública de Supabase no puede leer nada; todo pasa por la API.

Diferencias deliberadas respecto del HTML: los datos de EJEMPLO no se guardan en la base (se ven con el interruptor); los datos de la EPTM informados por Robert (22-10-2026) siguen **fijos en el motor**, tal como estaban («de momento nada»); la hora de las ediciones la pone el servidor; los permisos se comprueban en el servidor.

## Roles

| Rol | Puede |
|---|---|
| `admin` | Todo, incluido crear cuentas y cambiar roles |
| `oficina` | Validar valores, editar parámetros, cargar archivos de cualquier escuela |
| `responsable` | Editar y cargar archivos **solo de su escuela** (uno por escuela) |
| `lectura` | Ver y exportar |

No hay registro público: solo entran personas con cuenta creada por la administración (vista **Equipo**). Cada persona usa una cuenta con su nombre.

## Desarrollo local (sin Supabase)

Requisitos: Node 22+ y pnpm 11.

```bash
pnpm install
# API con base PostgreSQL embebida (PGlite), sesión local y datos de ejemplo permitidos
cp apps/api/.env.example apps/api/.env.local   # o usa el .env.local que ya trae el repositorio
pnpm --filter @sgc/api dev:local               # http://localhost:8080
# en otra terminal
pnpm --filter @sgc/web dev                     # http://localhost:3000
```

En local se elige una cuenta en la pantalla de ingreso (`NEXT_PUBLIC_AUTH_MODE=dev`). La primera cuenta administradora es la de `BOOTSTRAP_ADMIN_EMAIL`. `DEV_AUTH` no puede activarse en producción: la API se niega a arrancar.

Pruebas y verificación:

```bash
pnpm test         # motor (equivalencia), Excel y API (base embebida)
pnpm typecheck
pnpm build
```

## Despliegue (lo haces tú, en este orden)

### 1. Supabase
1. Crea un proyecto. **Región:** elige la misma o la más cercana a Render (ver el punto 2).
2. **Authentication → Providers → Email:** deja activo el correo y contraseña y **desactiva «Allow new users to sign up»**.
3. **Authentication → Users → Add user:** crea la cuenta de la primera persona administradora (correo y contraseña) con *Auto Confirm*.
4. **Project Settings → Database → Connection string → Session pooler:** copia la cadena (sirve para IPv4) → será `DATABASE_URL`.
5. **Project Settings → API (o API Keys):** copia la URL del proyecto (`SUPABASE_URL`), la clave pública *anon/publishable* (para Vercel) y la clave *service_role* (secreta, solo para Render). Si tu proyecto aún usa la clave JWT heredada, copia también el *JWT secret* en `SUPABASE_JWT_SECRET`.
6. No hace falta crear tablas ni el bucket: la API aplica las migraciones y crea el bucket privado `sgc-archivos` al arrancar.

### 2. Render (API)
1. En render.com crea una cuenta y conecta tu GitHub. **New → Blueprint** y elige este repositorio: `render.yaml` ya indica el `Dockerfile` (`Dockerfile` (en la raíz)), el chequeo `/health` y la lista de variables. (Alternativa manual: **New → Web Service → Docker**, Dockerfile `Dockerfile` (en la raíz), contexto en la raíz.)
2. Render te pedirá los valores de las variables marcadas: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BOOTSTRAP_ADMIN_EMAIL`, `CORS_ORIGINS` (de momento pon cualquier dominio provisional; lo corriges en el paso 3). Deja `SUPABASE_JWT_SECRET` vacía. **No** definas `DEV_AUTH`.
3. Cuando termine el despliegue, anota la URL (`https://sgc-api-xxxx.onrender.com`). Probar: `GET /health` → `{"ok":true}`.
4. Región: la más cercana a la de Supabase (la API hace varias consultas por petición). Usa **una sola instancia**: las migraciones se aplican al arrancar.
5. El plan gratuito **duerme la API tras ~15 minutos sin uso** y la primera petición tarda 30 a 60 s en despertar. Para uso diario conviene un plan de pago pequeño (`plan: starter` en `render.yaml`).

### 3. Vercel (pantallas)
1. *Import Project* → el mismo repositorio, **Root Directory = `apps/web`** (activa «Include source files outside of the Root Directory»).
2. Variables: `NEXT_PUBLIC_API_URL` (URL de Render), `NEXT_PUBLIC_AUTH_MODE=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Despliega y vuelve a Render: pon el dominio de Vercel en `CORS_ORIGINS` (sin barra final) y guarda (se redespliega solo).
4. Entra con la cuenta administradora del paso 1.3: se vuelve `admin` en el primer ingreso. Desde **Equipo** crea las demás cuentas.

> El plan gratuito de Vercel es solo para uso personal no comercial, y el gratuito de Supabase pausa el proyecto tras una semana sin uso: para uso institucional conviene un plan de pago. Revisa los planes vigentes.

## Operación
- **Respaldos:** los de Supabase (planes de pago). Guarda además un `pg_dump` periódico.
- **Parámetros:** cada guardado es una versión nueva en la base (nunca se pierde la anterior; se puede cargar una versión vieja como borrador).
- **Bitácora:** vista Equipo (administración y oficina). Registra cargas, cambios de parámetros, ediciones, validaciones y cambios de equipo, con la hora del servidor.
- **Actualizar el catálogo del modelo:** se carga una sola vez al inicio (`pnpm --filter @sgc/api seed`); cambiarlo implica una migración de datos.
- Los Excel originales quedan en el bucket privado de Supabase con su huella SHA-256 y se descargan desde la vista Cargas.
