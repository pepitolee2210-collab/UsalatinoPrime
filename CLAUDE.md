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

### Documentos por miembro (`is_per_member` / alias legacy `is_per_minor`)

Algunos `document_types` (acta de nacimiento, ID, pasaporte del menor, etc.) tienen `is_per_member=true`. El endpoint `/api/cita/[token]/required-documents` los expande a N items, uno por miembro elegible del contrato (`getFamilyMembers()` decide quiénes según servicio: SIJS = solo minors; Asilo = applicant + spouse + minors). Además añade un bucket `"<nombre> — Sin asignar"` **únicamente cuando existen uploads de ese tipo con `documents.member_role IS NULL`** (uploads legacy pre-migración M1). Antes el bucket se añadía incondicionalmente para SIJS y producía ~1.000 cards vacías en prod — la lógica vive ahora en el helper puro `expandItemsForType()` en el mismo route handler. Los uploads desde `UploadButton` propagan `member_role` y `member_index` (y los shims legacy `minor_index` / `minor_label` por una release). Si modificas la UI de docs, mantén el `key` compuesto `${type_id}:${member_role ?? 'general'}:${member_index ?? 'na'}` — sin eso, React colapsa items que comparten `type_id`.

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

## Dashboard del caso compartido admin ↔ employee

Tanto `/admin/cases/[id]` (Henry) como `/employee/cases/[id]` (Diana, Vanessa, Andrium) renderizan el **mismo** componente `CaseTabsByPhase` (`src/app/employee/_shared/case-tabs-by-phase.tsx`). Henry monta una capa fina (`admin-case-view.tsx`) con header + `PhaseStatusPanel` + acciones admin (aprobar, dar acceso, descargar PDFs) y delega todas las pestañas al componente compartido pasando `isAdmin={true}` y sus tabs admin-only como `extraTabs`.

Lo que controla qué tabs muestra cada servicio vive en **un solo lugar**: `src/lib/services/dashboard-tabs.tsx`. Por servicio se declara una lista de `DashboardTabDef` con un `render(ctx)` que recibe `caseId`, `caseNumber`, `clientId`, `clientName`, `serviceSlug`, `currentPhase`, `isAdmin`, `overview`, `formSubmissions`, `currentUserId`, `onRefresh`. Una tab puede filtrarse por rol con `requiresRole: 'admin' | 'employee' | 'any'`.

Tabs **base** (todos los servicios): `docs`, `client-docs`, `oficiales`, `archivados`, `notas`, `historia` (más `forms` si el servicio está en `SERVICE_REGISTRY`). Las agrega `CaseTabsByPhase` automáticamente — no se tocan al sumar un servicio.

Tabs **admin-only** que vienen como `extraTabs` desde `admin-case-view.tsx`:
- `cobranza` (Pagos) — `PaymentsTab` en `src/app/admin/cases/[id]/payments-tab.tsx`
- `bitacora` (`CaseChat`)
- `client-story` (SIJS) — `ClientStoryReview`, depende de `documents` (no del ctx)
- `i360` (SIJS) — `I360Review`, panel admin con descarga PDF directa (Diana usa `I360FormSection` declarado en su lado como `i360`)
- `legal-review` — `LegalReviewer`

### Cómo agregar un servicio nuevo al dashboard

1. **`service_catalog`** (BD): asegúrate de que el slug existe (migración `003_seed_services.sql` y descendientes).
2. **`src/lib/services/registry.ts`**: si usa fases, agregar entrada con `slug`, `name`, `usesPhases: true`, `phases[]`. Extender el enum `case_phase` con una migración separada (limitación de `ALTER TYPE` de Postgres).
3. **`src/lib/services/dashboard-tabs.tsx`**: agregar entrada en `SERVICE_DASHBOARD_TABS` con los tabs específicos del servicio. Cada tab es declarativa: `{ id, label, requiresRole?, isVisible?, render, getCount? }`. Listo — **no toques** `admin-case-view.tsx` ni `case-tabs-by-phase.tsx`.
4. **`src/lib/workflows/<slug>.ts`** (opcional): solo si el servicio necesita wizard de intake propio.
5. **`src/lib/contracts/<slug>.ts`** (opcional): si firma contratos.
6. **`document_type_phases`** (BD): si el servicio necesita document_types específicos por fase, inserta filas en esta M2M (override de category, icon, sort_order, etc. por fase).

### Diferencias admin vs employee

| Aspecto | Henry (admin) | Diana/Vanessa/Andrium (employee) |
|---|---|---|
| Componente raíz | `admin-case-view.tsx` | `employee-case-view.tsx` |
| Tabs base | mismas | mismas |
| Tabs por servicio | mismas (registry) | mismas (registry) |
| Tabs admin-only | sí (extraTabs: Pagos, Bitácora, Legal Review, etc.) | — |
| Acciones del header | aprobar, dar acceso, descargar I-360/I-589, asignar empleado | — |

Si una tab debería verse solo en un rol, márcala con `requiresRole` en `dashboard-tabs.tsx`. **No** dupliques componentes admin↔employee — el patrón es: un componente, un registry, dos paneles.

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
