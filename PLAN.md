# Plan: Comunidad UsaLatinoPrime (Estilo Skool)

## Resumen

Integrar una plataforma de comunidad tipo Skool dentro de UsaLatinoPrime. Los usuarios se registran gratis desde TikTok, ven un preview de la comunidad, y pagan $25/mes (Stripe subscription o Zelle manual) para acceso completo. Dentro de la comunidad tienen: publicaciones de Henry, link de Zoom diario, videos de TikTok/YouTube, y acceso a los servicios migratorios existentes.

## Decisiones de diseño clave

### Flujo del usuario
```
TikTok Live → Link de registro → Registro rápido (gratis)
→ Ve preview comunidad (paywall) → Paga $25/mes → Acceso completo
→ Dentro: Feed de Henry, Zoom diario, Videos, Comentarios, Servicios
```

### Cambio en el flujo actual
- **ANTES**: Registro → `/portal/services` (menú de servicios)
- **AHORA**: Registro → `/comunidad` (feed de la comunidad con paywall)
- Los servicios migratorios se acceden desde un botón "Servicios" dentro de la comunidad

## Arquitectura de base de datos (4 tablas nuevas)

### Tabla: `community_memberships`
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
status text NOT NULL DEFAULT 'free', -- 'free', 'active', 'cancelled', 'past_due'
payment_method text, -- 'stripe', 'zelle'
stripe_subscription_id text,
stripe_customer_id text,
current_period_start timestamptz,
current_period_end timestamptz,
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now(),
UNIQUE(user_id)
```

### Tabla: `community_posts`
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
author_id uuid REFERENCES auth.users(id),
type text NOT NULL DEFAULT 'text', -- 'text', 'video', 'zoom', 'announcement'
title text,
content text,
video_url text, -- TikTok/YouTube embed URL
zoom_url text, -- Link de Zoom (solo para type='zoom')
pinned boolean DEFAULT false,
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now()
```

### Tabla: `community_comments`
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
post_id uuid REFERENCES community_posts(id) ON DELETE CASCADE,
user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
content text NOT NULL,
created_at timestamptz DEFAULT now()
```

### Tabla: `community_reactions`
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
post_id uuid REFERENCES community_posts(id) ON DELETE CASCADE,
user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
emoji text NOT NULL DEFAULT '❤️', -- '❤️', '🔥', '👏', '💯', '🙏'
created_at timestamptz DEFAULT now(),
UNIQUE(post_id, user_id) -- 1 reacción por usuario por post
```

### Tabla: `zelle_payments` (para verificación manual)
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
amount numeric NOT NULL DEFAULT 25,
screenshot_url text NOT NULL,
status text NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
reviewed_by uuid REFERENCES auth.users(id),
reviewed_at timestamptz,
notes text,
created_at timestamptz DEFAULT now()
```

## Rutas nuevas

### Comunidad (usuario)
| Ruta | Descripción |
|------|-------------|
| `/comunidad` | Feed principal + paywall si no es miembro |
| `/comunidad/videos` | Sección de videos TikTok/YouTube |
| `/comunidad/pagar` | Página de pago ($25/mes Stripe o Zelle) |

### Admin (Henry)
| Ruta | Descripción |
|------|-------------|
| `/admin/comunidad` | Dashboard comunidad: crear posts, gestionar |
| `/admin/comunidad/zelle` | Revisar pagos Zelle (aprobar/rechazar) |

## Archivos a crear/modificar

### FASE 1: Base de datos (1 migración SQL)

**CREAR** `supabase/migrations/community_tables.sql`
- Las 5 tablas nuevas
- RLS policies: miembros activos ven posts/comments, solo admin crea posts
- Índices para performance

### FASE 2: Stripe Subscription ($25/mes)

**CREAR** `src/app/api/community/create-subscription/route.ts`
- Crea Stripe Checkout Session en modo `subscription` ($25/mes recurrente)
- Metadata: `user_id`, `type: 'community'`
- Success URL: `/comunidad?activated=true`

**CREAR** `src/app/api/community/cancel-subscription/route.ts`
- Cancela suscripción en Stripe
- Actualiza `community_memberships.status = 'cancelled'`

**MODIFICAR** `src/app/api/webhooks/stripe/route.ts`
- Agregar handlers para:
  - `customer.subscription.created` → crear/actualizar membership
  - `customer.subscription.updated` → actualizar período
  - `customer.subscription.deleted` → marcar como cancelled
  - `invoice.payment_failed` → marcar como past_due

### FASE 3: Zelle (pago manual con screenshot)

**CREAR** `src/app/api/community/zelle-submit/route.ts`
- El usuario sube screenshot del comprobante Zelle
- Se guarda en Supabase Storage + registro en `zelle_payments`
- Notifica a Henry

**CREAR** `src/app/api/community/zelle-review/route.ts`
- Henry aprueba/rechaza desde admin
- Si aprueba: actualiza `community_memberships` a `active` por 30 días

### FASE 4: Páginas de la comunidad

**CREAR** `src/app/comunidad/layout.tsx`
- Layout con navegación: Feed, Videos, Servicios
- Verifica membresía activa → si no, muestra paywall
- Mobile-first, botones grandes, texto claro

**CREAR** `src/app/comunidad/page.tsx` (Feed principal)
- Preview para no-miembros: ven 1-2 posts borrosos + CTA "Únete por $25/mes"
- Para miembros: feed completo de publicaciones de Henry
- Card de Zoom destacada arriba (siempre visible si hay link activo)
- Cada post: título, contenido, video embed, reacciones, comentarios

**CREAR** `src/app/comunidad/videos/page.tsx`
- Grid de videos de TikTok/YouTube
- Cards con thumbnail/preview + enlace que abre en nueva pestaña
- Filtros simples: TikTok | YouTube | Todos

**CREAR** `src/app/comunidad/pagar/page.tsx`
- Dos opciones: Stripe ($25/mes automático) o Zelle (manual)
- Stripe: botón que lleva a Stripe Checkout
- Zelle: instrucciones + formulario para subir screenshot
- Diseño super claro para adultos mayores

**CREAR** `src/components/community/PostCard.tsx`
- Card de publicación con avatar de Henry, fecha, contenido
- Embed de video (TikTok/YouTube iframe)
- Barra de reacciones (emojis clickeables)
- Sección de comentarios expandible

**CREAR** `src/components/community/ZoomCard.tsx`
- Card destacada navy/gold con link de Zoom
- Botón grande "Entrar a la Sesión" que abre Zoom
- Horario del próximo live

**CREAR** `src/components/community/PaywallOverlay.tsx`
- Overlay blur sobre contenido para no-miembros
- CTA claro: "Únete a la comunidad más grande de inmigrantes en USA"
- Botón "Activar por $25/mes"

**CREAR** `src/components/community/ReactionBar.tsx`
- Fila de emojis: ❤️ 🔥 👏 💯 🙏
- Contador por emoji, toggle al hacer click

**CREAR** `src/components/community/CommentSection.tsx`
- Lista de comentarios con nombre + fecha
- Input para nuevo comentario
- Simple y limpio

### FASE 5: Admin - Panel de comunidad

**CREAR** `src/app/admin/comunidad/page.tsx`
- Crear nueva publicación (texto, video, zoom link)
- Lista de publicaciones existentes (editar/eliminar/pinear)
- Configurar link de Zoom fijo
- Stats: total miembros, miembros activos, posts este mes

**CREAR** `src/app/admin/comunidad/zelle/page.tsx`
- Lista de pagos Zelle pendientes de revisión
- Ver screenshot, aprobar/rechazar con un click
- Historial de pagos Zelle aprobados

### FASE 6: Modificaciones a archivos existentes

**MODIFICAR** `src/lib/supabase/middleware.ts`
- Agregar `/comunidad` como ruta protegida (requiere auth, rol client)
- Redirigir post-registro a `/comunidad` en vez de `/portal/services`

**MODIFICAR** `src/app/(auth)/register/page.tsx`
- Simplificar: quitar campo "confirmar contraseña" (registro más rápido)
- Cambiar redirect post-registro a `/comunidad`

**MODIFICAR** `src/app/admin/layout.tsx`
- Agregar "Comunidad" al nav del admin con ícono Users

**MODIFICAR** `src/app/comunidad/layout.tsx` (nav)
- Botón "Servicios" que lleva a `/portal/services`

## Diseño UX (Mobile-first para adultos mayores)

### Principios
- Botones grandes (min 48px height)
- Texto grande (min 16px, títulos 20-24px)
- Iconos con texto siempre (nunca solo iconos)
- Colores de alto contraste (navy sobre blanco/crema)
- Mínimas opciones por pantalla
- Español claro, sin jerga técnica

### Navegación comunidad (mobile)
```
┌─────────────────────────────┐
│ ☰  UsaLatinoPrime           │  ← Header sticky
├─────────────────────────────┤
│ [🏠 Inicio] [📹 Videos] [📋 Servicios] │  ← Tab bar
├─────────────────────────────┤
│                             │
│  ┌── Zoom Card ──────────┐  │  ← Siempre arriba
│  │ 📹 Sesión en Vivo     │  │
│  │ [Entrar a Zoom]       │  │
│  └───────────────────────┘  │
│                             │
│  ┌── Post Card ──────────┐  │
│  │ Henry · hace 2h       │  │
│  │ "Hoy hablamos de..."  │  │
│  │ ❤️12 🔥8 👏5          │  │
│  │ 💬 3 comentarios      │  │
│  └───────────────────────┘  │
│                             │
│  ┌── Post Card ──────────┐  │
│  │ Henry · ayer           │  │
│  │ [Video TikTok embed]  │  │
│  │ ❤️25 🔥15             │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Paywall (no-miembros)
```
┌─────────────────────────────┐
│ Bienvenido a la Comunidad   │
│ UsaLatinoPrime              │
│                             │
│ [Post 1 - BORROSO]         │
│ [Post 2 - BORROSO]         │
│                             │
│ ┌───────────────────────┐   │
│ │ 🌟 Únete Ahora        │   │
│ │                       │   │
│ │ ✓ Sesiones en vivo    │   │
│ │   todos los días      │   │
│ │ ✓ Videos exclusivos   │   │
│ │ ✓ Comunidad de apoyo  │   │
│ │                       │   │
│ │ Solo $25/mes          │   │
│ │                       │   │
│ │ [Activar Membresía]   │   │
│ └───────────────────────┘   │
└─────────────────────────────┘
```

## Orden de implementación

1. **Migración SQL** — Tablas + RLS + índices
2. **Stripe subscription** — Crear producto $25/mes + webhook handlers
3. **Zelle flow** — Upload screenshot + admin review
4. **Layout comunidad** — Con paywall y verificación de membresía
5. **Feed principal** — Posts + reacciones + comentarios
6. **Videos page** — Grid de videos TikTok/YouTube
7. **Página de pago** — Stripe + Zelle options
8. **Admin comunidad** — CRUD posts + config Zoom + stats
9. **Admin Zelle** — Review screenshots
10. **Modificar registro** — Simplificar + redirect a /comunidad
11. **Modificar middleware** — Rutas + redirects
12. **Modificar admin nav** — Agregar Comunidad

## Notas técnicas

- **Stripe**: Usamos `mode: 'subscription'` (no `payment`). Se crea un Product + Price de $25/mes en Stripe.
- **Zelle**: Sin API. El usuario ve instrucciones ("Envíe $25 a xxx@email.com"), sube screenshot, Henry aprueba manualmente. Se activa por 30 días.
- **Videos**: No se hospedan videos. Solo se embeben links de TikTok/YouTube. TikTok usa `<blockquote>` embed, YouTube usa iframe.
- **Zoom**: Un campo `zoom_url` en un post tipo `zoom` o en una config de la comunidad. Henry lo configura una vez.
- **Realtime**: Usamos Supabase Realtime para nuevos posts y comentarios.
- **Storage**: Supabase Storage para screenshots de Zelle.
