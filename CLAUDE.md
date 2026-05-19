# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Next.js 16 (App Router, Turbopack dev / webpack build) · React 19 (con `babel-plugin-react-compiler`) · TypeScript · Tailwind v4 (`@tailwindcss/postcss`) · Supabase (auth + Postgres + Storage) · Stripe · Twilio (WhatsApp) · Resend (email) · Anthropic + Gemini (AI) · Upstash QStash (cron-like jobs) · `@ducanh2912/next-pwa` (PWA con service worker generado en build).

Package name: `henryflow` (no es público; deploya en Vercel).

## Comandos

```bash
npm run dev         # next dev (Turbopack)
npm run build       # next build --webpack (PWA SW se genera aquí)
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm start           # next start (post-build)
```

CI (`.github/workflows/ci.yml`) corre, en orden, `typecheck` → `lint --max-warnings=0` → `build` (con env vars placeholder). Rompe el build si hay un solo warning de ESLint. **Antes de pushear: `npm run build` localmente** (feedback en memoria del usuario; el lint con `--max-warnings=0` es bypass común que aquí está prohibido).

## Cómo NO romper nada

### Identidad de cliente: teléfono normalizado, NO passport ni email

Si tocas algo que crea/identifica clientes, usa `normalizePhone()` de `src/lib/phone.ts` y la RPC `find_client_by_phone(p_phone text)`. La tabla `profiles` tiene un UNIQUE INDEX (`profiles_normalized_phone_unique`) sobre `normalize_phone(phone)` para clientes — un teléfono mapea a un único profile y punto. Email sintético se deriva del phone (`client_<digits>@usalatinoprime.internal`), nunca del passport. Bypassear esta regla genera profiles paralelos imposibles de reconciliar (caso histórico documentado en `supabase/scripts/reconcile_jose_luis_criollo.sql`).

### 1 contrato firmado = 1 case nuevo

`contracts.case_id ↔ cases.contract_id` es una relación 1:1 bidireccional. `register-client` (`src/app/api/contracts/register-client/route.ts`) crea siempre un case nuevo cuando se le pasa un contrato sin `case_id`, y es idempotente: re-llamarlo sobre un contrato ya enlazado devuelve el case existente. **No restaurar** la deduplicación por `(client_id, service_id)` — fue intencionalmente removida; un cliente puede tener N contratos del mismo servicio (ej. visa juvenil con hijos en distintos contratos).

### Tres clientes de Supabase, no son intercambiables

- `src/lib/supabase/client.ts` — browser, anon key, respeta RLS.
- `src/lib/supabase/server.ts` (`createClient`, async) — server components/route handlers, anon key con cookies de sesión, respeta RLS y conoce `auth.getUser()`.
- `src/lib/supabase/service.ts` (`createServiceClient`) — service role key, **bypasa RLS**. Solo en route handlers después de autorizar el caller.
- `src/lib/supabase/middleware.ts` — `updateSession()` que el middleware de la app llama en cada request; refresca cookies pero no bloquea rutas (auth real se aplica en cada layout/route).

Patrón típico en endpoints admin: `createClient()` para obtener `user`, leer `profiles.role` / `employee_type`, y SOLO entonces pasar a `createServiceClient()` para queries y mutaciones.

### Documentos por hijo (`is_per_minor`)

Algunos `document_types` (acta de nacimiento, ID, pasaporte del menor, etc.) tienen `is_per_minor=true`. El endpoint `/api/cita/[token]/required-documents` los expande a N items, uno por minor del contrato vinculado al case + un bucket `"Sin asignar"` para uploads legacy con `documents.minor_index IS NULL`. Los uploads desde `UploadButton` propagan `minor_index` y `minor_label` (snapshot del nombre) a `documents`. Si modificas la UI de docs, mantén el `key` compuesto `${type_id}:${minor_index ?? 'general'}` — sin eso, React colapsa los items que comparten `type_id`.

Catálogo de docs vive en dos lugares: `document_types` (BD, source of truth para fases SIJS) y `DOCUMENT_CATEGORIES` hardcoded en `src/lib/appointments/constants.ts` (legacy, usado por `document-upload-section.tsx` y formularios sin fase). Cuando agregues un tipo nuevo, decidir cuál.

## Arquitectura por superficies

El App Router está dividido en **4 superficies funcionales** que comparten BD pero tienen UX/auth distintas:

| Ruta | Auth | Para quién |
|---|---|---|
| `/cita/[token]` | Token-based (sin login) — `appointment_tokens` por `(client_id, case_id)` | Cliente firmado: subir docs, llenar formularios, agendar citas |
| `/portal/*` | Sesión Supabase | Cliente con cuenta (flujo de promos/comunidad) |
| `/admin/*` | Sesión + `profiles.role='admin'` | Henry (CEO/admin total) |
| `/employee/*` | Sesión + `profiles.role='employee'` con `employee_type` específico | Diana (paralegal), Vanessa (consultora), Andrium (`contracts_manager`) |

Hay también `/comunidad` (paywall + Zelle), `/contrato/[token]` (firma del contrato sin login), `/ceo` (dashboard ejecutivo), y forms públicos (`/visa-juvenil-form`, `/asilo-form`, etc.) que crean leads.

`/api/admin/*` y `/api/employee/*` siempre verifican `role` y, cuando aplica, `employee_type` antes de mutar. `contracts_manager` (Andrium) tiene los mismos permisos que admin sobre `/api/contracts/*` y `/api/admin/contracts/*`.

## Servicios legales como workflows

`src/lib/workflows/` define un workflow por servicio (`visa-juvenil`, `asilo-politico`, `cambio-de-corte`, `cambio-de-estatus`, `ajuste-de-estatus`, `taxes`, `itin-number`, `licencia-de-conducir`, `mociones`). Cada workflow exporta un `ServiceWorkflow` (ver `src/types/wizard.ts`) con steps/conditional logic. `getWorkflow(slug)` desde `index.ts` es el entry point. **Apelación no tiene workflow propio** — usa primitivas genéricas (`documents` + `case_form_instances` + `AUTOMATED_FORMS`) sin wizard custom.

Tres servicios usan el sistema de fases (`cases.current_phase` poblado desde `case_phase` enum):
- **Visa Juvenil (SIJS)** — 3 fases: `custodia → i360 → i485 → completado`
- **Asilo Político** — 2 fases: `asilo_sustentos → asilo_reforzar → asilo_completado`
- **Apelación** — 1 fase única: `apelacion` (también marca completion)

`src/lib/services/registry.ts` es la fuente de verdad de qué servicios usan fases y sus etiquetas visuales. Para agregar un servicio nuevo con fases: extender el enum `case_phase` (migración separada por la limitación de ALTER TYPE de Postgres), agregar entry al `SERVICE_REGISTRY`, contract template en `lib/contracts/index.ts`, y opcionalmente policy en `phase-form-mapping.ts` si aplican forms del registry.

El resto de servicios (mociones, cambio-de-corte, taxes, itin-number, licencia-de-conducir, cambio-de-estatus, ajuste-de-estatus, adelantos) trabaja con `intake_status` plano.

`src/lib/contracts/` tiene los templates de contratos firmables por servicio (etapas, objetos del contrato, precios), que `QuickContractGenerator` consume.

## Migraciones de Supabase

`supabase/migrations/` mezcla dos convenciones (números secuenciales `001_..` y fechas `20260...`). Aplicar siempre en orden alfabético. Reflejar tipos manualmente en `src/types/database.ts` cuando agregues columnas (no hay generación automática enganchada).

`supabase/scripts/` son scripts SQL one-off (no migraciones; idempotentes). Ejemplo: `reconcile_jose_luis_criollo.sql` — útiles como referencia de cómo desenredar identidades.

Hay 2 proyectos Supabase reales (cuentas distintas): `hkmeaqehutootharvsbd` (prod actual) y `bzedgcxopndnvnescoky` (en construcción). El repo y Vercel viven en la cuenta de PepitoLee, no de Henry.

## Integraciones externas

- **Stripe**: webhooks en `/api/webhooks/stripe`, checkout en `/api/payments/create-checkout`. Pagos opcionales (Zelle es la vía principal de la comunidad).
- **Twilio WhatsApp**: webhook en `/api/webhooks/twilio/whatsapp` + worker en `/api/workers/whatsapp-process`. El chatbot conversacional está en `src/lib/chatbot/`.
- **QStash**: scheduled jobs disparan endpoints `/api/cron/*` (recordatorios de citas).
- **Resend**: emails transaccionales (`src/lib/email/`).
- **Anthropic + Gemini**: investigación legal (`src/lib/legal/trigger-research-async.ts`) y extracción de docs (`src/lib/ai/extract-documents.ts`). Gemini extrae texto de PDFs subidos.
- **Voice agent**: `/api/voice-agent/*` integra una IA de voz que agenda citas; sus prospects entran a `/admin/contratos` con `?from_voice=...` y datos pre-cargados.

## Service Worker / PWA

`@ducanh2912/next-pwa` genera el SW en build. Cualquier asset > 2MB no se precachea (font de material-symbols ~3.92MB es warning conocido y aceptado). El offline fallback es `/offline`.

## Convenciones del codebase

- Idioma de UI: **español**. Comentarios y mensajes de toast en español; código en inglés.
- Estilo: Tailwind con tokens custom (`--color-ulp-*`) en `src/app/cita/[token]/_components/tokens.css`. Para `/cita` se usa Material Symbols outlined.
- Routes admin que listan datos hacen el fetch en el componente cliente con `createClient()` (browser) — no SSR — para que el realtime y los toasts funcionen sin recargar.
- `_components/` (con underscore) son privados a una ruta del App Router; no se comparten.

## Notas operativas

- Antes de `git push`, hacer `git pull && npm run build`. El push directo a `master` deploya prod en Vercel automáticamente.
- Si una migración nueva crea un UNIQUE INDEX, primero verificar duplicados con un SELECT — aplicar en una transacción separada del UPDATE/DELETE de reconciliación.
- `register-client` dispara `triggerJurisdictionResearchAsync` (background, no bloquea) solo para `service_slug='visa-juvenil'`. Tarda 60-120s y popula `case_jurisdictions`. No esperarlo en código sincronos.
