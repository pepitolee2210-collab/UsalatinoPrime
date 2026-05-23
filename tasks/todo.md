# Plan XL: Sesiones Grupales Visa Juvenil

## Status: PENDIENTE APROBACIÓN

## El Problema

Henry tiene 40+ clientes de visa juvenil. Después de que llenan "Mi Historia" y él la aprueba, necesita reunirse con ellos para revisar casos, recoger firmas y orientarlos. Hacerlo 1-a-1 no escala. Necesita reuniones grupales con link de Zoom, y que los clientes puedan ver las sesiones desde su portal `/cita`.

## La Solución

### Para Henry (Admin)
- Nueva sección `/admin/sesiones` en el dashboard
- Crear sesiones grupales: título, fecha/hora, Zoom link, descripción
- Publicar anuncios para los clientes de visa juvenil
- Ver RSVPs (quién confirmó asistencia)
- Todo exclusivo para clientes de visa juvenil con historia aprobada

### Para el Cliente (Portal `/cita`)
- Nuevo tab "Reuniones" en su portal (solo visa juvenil, solo si su historia fue aprobada)
- Ve próximas sesiones con fecha, hora, link de Zoom
- Botón "Confirmar asistencia" (RSVP)
- Feed de anuncios de Henry con reacciones y comentarios
- Progreso actualizado: nuevo step "Reunión" en la barra de progreso

---

## Modelo de Datos

### Tabla: `vj_sessions` (sesiones grupales)
```sql
id              UUID PK DEFAULT gen_random_uuid()
title           TEXT NOT NULL
description     TEXT DEFAULT ''
session_date    TIMESTAMPTZ NOT NULL
zoom_url        TEXT DEFAULT ''
status          TEXT CHECK (scheduled, completed, cancelled) DEFAULT 'scheduled'
max_capacity    INT DEFAULT 30
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

### Tabla: `vj_session_rsvps` (confirmaciones)
```sql
id              UUID PK DEFAULT gen_random_uuid()
session_id      UUID FK → vj_sessions(id) ON DELETE CASCADE
client_id       UUID FK → profiles(id)
status          TEXT CHECK (confirmed, cancelled) DEFAULT 'confirmed'
created_at      TIMESTAMPTZ DEFAULT now()
UNIQUE(session_id, client_id)
```

### Tabla: `vj_announcements` (anuncios de Henry)
```sql
id              UUID PK DEFAULT gen_random_uuid()
title           TEXT NOT NULL
content         TEXT NOT NULL
is_pinned       BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ DEFAULT now()
```

### Tabla: `vj_announcement_reactions` (reacciones)
```sql
id              UUID PK DEFAULT gen_random_uuid()
announcement_id UUID FK → vj_announcements(id) ON DELETE CASCADE
client_id       UUID FK → profiles(id)
emoji           TEXT DEFAULT '❤️'
created_at      TIMESTAMPTZ DEFAULT now()
UNIQUE(announcement_id, client_id)
```

### Tabla: `vj_announcement_comments` (comentarios)
```sql
id              UUID PK DEFAULT gen_random_uuid()
announcement_id UUID FK → vj_announcements(id) ON DELETE CASCADE
client_id       UUID FK → profiles(id)
content         TEXT NOT NULL
created_at      TIMESTAMPTZ DEFAULT now()
```

### RLS
- Admins: CRUD completo en todas las tablas
- Employees: SELECT en todas
- Clientes: SELECT en sessions/announcements, INSERT/DELETE en rsvps/reactions/comments (solo propios)

---

## Subtareas (4 fases)

### Fase 1: Migración + APIs (M)
- [ ] 1.1 Migración SQL: crear 5 tablas + RLS + índices
- [ ] 1.2 API `GET/POST /api/admin/vj-sessions` — CRUD sesiones
- [ ] 1.3 API `GET/POST /api/admin/vj-announcements` — CRUD anuncios
- [ ] 1.4 API `POST /api/vj-sessions/rsvp` — confirmar/cancelar asistencia (cliente)
- [ ] 1.5 API `POST /api/vj-announcements/react` — toggle reacción (cliente)
- [ ] 1.6 API `POST /api/vj-announcements/comment` — agregar comentario (cliente)
- [ ] 1.7 API `GET /api/vj-portal?token=X` — datos del portal (sesiones + anuncios para el cliente)

### Fase 2: Admin — Panel de Sesiones (L)
- [ ] 2.1 Nueva página `/admin/sesiones/page.tsx`
  - Crear sesión: título, fecha/hora, Zoom link, descripción, capacidad
  - Lista de sesiones (próximas arriba, pasadas abajo)
  - Ver RSVPs por sesión (nombres, confirmados)
  - Marcar sesión como completada/cancelada
  - Badge en sidebar con sesiones próximas
- [ ] 2.2 Sección de anuncios en la misma página
  - Crear anuncio: título + contenido + toggle pin
  - Lista de anuncios con conteo de reacciones/comentarios
  - Eliminar anuncios
- [ ] 2.3 Agregar "Sesiones" al sidebar del admin (`layout.tsx`)

### Fase 3: Cliente — Tab "Reuniones" en `/cita` (L)
- [ ] 3.1 Nuevo tab "Reuniones" en `client-portal.tsx`
  - Solo visible para visa-juvenil con historia aprobada (status 'approved' en case_form_submissions)
  - Icono: Video o Users
- [ ] 3.2 Componente `VJPortal` (sesiones + anuncios)
  - Tarjeta de próxima sesión: fecha, hora, Zoom link, botón RSVP
  - Lista de sesiones futuras
  - Feed de anuncios: título, contenido, reacciones (emojis), comentarios
  - Diseño moderno, glassmorphism consistente con el estilo de /consulta
- [ ] 3.3 Actualizar progreso: agregar step "Reunión" a la barra (hasAttendedSession)
- [ ] 3.4 Cargar datos en `page.tsx`: fetch sesiones + anuncios + rsvps del cliente

### Fase 4: Diseño Visual + Polish (M)
- [ ] 4.1 Diseño del tab "Reuniones" — cards con gradientes, countdown a próxima sesión
- [ ] 4.2 Diseño del panel admin — consistente con el resto del dashboard
- [ ] 4.3 Notificación visual cuando hay sesión próxima (badge en tab)
- [ ] 4.4 Empty states con iconos y CTAs claros

---

## Acceso controlado (doble vía)

**Automático**: Si Henry aprueba "Mi Historia" → tab "Reuniones" se desbloquea.

**Manual**: Botón en el admin (vista del caso) para dar/quitar acceso a Reuniones sin importar si llenó la historia. Usa campo `vj_community_access` (boolean) en la tabla `cases`.

```
Acceso = vj_community_access = true  OR  historia aprobada
```

```
Vía 1 (automática):
  Cliente llena "Mi Historia" → Henry aprueba → acceso desbloqueado

Vía 2 (manual):
  Henry abre caso en admin → toggle "Acceso a Reuniones" → acceso desbloqueado
```

---

## Archivos a Crear (9)
1. `supabase/migrations/20260313_vj_sessions.sql`
2. `src/app/api/admin/vj-sessions/route.ts`
3. `src/app/api/admin/vj-announcements/route.ts`
4. `src/app/api/vj-portal/route.ts` (sesiones + anuncios + rsvps para cliente)
5. `src/app/api/vj-portal/rsvp/route.ts`
6. `src/app/api/vj-portal/react/route.ts`
7. `src/app/api/vj-portal/comment/route.ts`
8. `src/app/admin/sesiones/page.tsx`
9. `src/app/cita/[token]/vj-portal.tsx`

## Archivos a Modificar (3)
10. `src/app/cita/[token]/client-portal.tsx` — agregar tab "Reuniones"
11. `src/app/cita/[token]/page.tsx` — cargar datos de sesiones/anuncios
12. `src/app/admin/layout.tsx` — agregar "Sesiones" al sidebar

---

## Orden de Implementación

```
Fase 1 (M) → Fase 2 (L) → Fase 3 (L) → Fase 4 (M)
  DB + APIs    Admin Panel   Client Portal   Visual Polish
```

Fase 1-2 primero: Henry puede crear sesiones y anuncios de inmediato.
Fase 3 después: Los clientes ven todo desde su portal.
Fase 4: Pulido visual final.

---
---

# Plan L: Wizard I-589 Parte B y C para Asilo

## Status: PENDIENTE APROBACIÓN

## El Problema

Los clientes de Asilo Defensivo y Asilo Afirmativo necesitan llenar las Partes B y C del Formulario I-589. Actualmente solo existe la Sección A (datos personales). Las partes B (motivos de asilo, daños sufridos, temores) y C (información adicional, antecedentes) faltan y Henry las necesita antes de reunirse con el cliente.

## Servicios que aplican
- `asilo-defensivo` (Asilo Defensivo)
- `asilo-afirmativo` (Asilo Afirmativo)

## La Solución

Wizard paso a paso en `/cita/[token]` — mismo patrón que "Mi Historia" de visa juvenil, pero con las preguntas del I-589 Partes B y C. Tab visible solo para clientes de asilo.

---

## Estructura del Wizard (5 pasos)

### Paso 1: Motivos de la Solicitud (Parte B.1)
- **Checkboxes**: ¿Por qué solicita asilo? (múltiple selección)
  - Raza
  - Religión
  - Nacionalidad
  - Opinión política
  - Pertenencia a grupo social determinado
  - Convención contra la Tortura
- **B.1A**: ¿Ha sufrido daño, maltrato o amenazas? (Sí/No)
  - Si sí → textarea con guía: Qué pasó, Cuándo, Quién lo causó, Por qué cree que ocurrió
- **B.1B**: ¿Teme sufrir daño si regresa? (Sí/No)
  - Si sí → textarea con guía: Qué teme, Quién lo haría, Por qué

### Paso 2: Antecedentes y Organizaciones (Parte B.2-4)
- **B.2**: ¿Arrestado/detenido/condenado en otro país? (Sí/No + detalles)
- **B.3A**: ¿Pertenencia a organizaciones (políticas, religiosas, militares, etc.)? (Sí/No + detalles por persona)
- **B.3B**: ¿Sigue participando actualmente? (Sí/No + detalles)
- **B.4**: ¿Teme ser sometido a tortura? (Sí/No + detalles: naturaleza, quién, por qué)

### Paso 3: Solicitudes Previas y Viajes (Parte C.1-2)
- **C.1**: ¿Ha solicitado asilo/refugio antes en EE.UU.? (Sí/No + decisión, qué pasó, número A)
- **C.2A**: ¿Viajó por otros países antes de entrar a EE.UU.? (Sí/No)
- **C.2B**: ¿Estatus legal en otro país? (Sí/No)
  - Si sí a C.2A o C.2B → detalles por país: nombre, duración, estatus, razón de salida, derecho a regresar, si pidió asilo allí

### Paso 4: Antecedentes Penales e Historial (Parte C.3-6)
- **C.3**: ¿Ha causado daño a alguien por raza/religión/nacionalidad/grupo/opinión? (Sí/No + detalles)
- **C.4**: ¿Regresó al país de daño después de salir? (Sí/No + fechas, propósito, duración)
- **C.5**: ¿Presenta solicitud más de 1 año después de llegar? (Sí/No + por qué no la presentó antes)
- **C.6**: ¿Delitos en EE.UU.? (Sí/No + detalles: qué pasó, fechas, condena, lugar)

### Paso 5: Revisión y Envío
- Resumen de todas las respuestas organizadas por sección
- Indicadores de campos vacíos/requeridos
- Botón "Enviar a mi consultor"

---

## Modelo de Datos

Reutiliza `case_form_submissions` con nuevos `form_type`:
- `i589_part_b1` — Motivos y daños (Paso 1)
- `i589_part_b2` — Antecedentes y organizaciones (Paso 2)
- `i589_part_c1` — Solicitudes previas y viajes (Paso 3)
- `i589_part_c2` — Antecedentes penales e historial (Paso 4)

Status flow: `draft` → `submitted` → `approved` / `needs_correction`

No necesita tablas nuevas — misma tabla `case_form_submissions`.

---

## Subtareas (3 fases)

### Fase 1: Wizard del Cliente (L)
- [ ] 1.1 Componente `I589Wizard` en `src/app/cita/[token]/i589-wizard.tsx`
  - 5 pasos con navegación Next/Back
  - Preguntas guiadas con texto de ayuda del I-589
  - Patrón Sí/No → campo condicional (solo mostrar textarea si responde Sí)
  - Auto-save (solo si hay datos reales, mismo patrón que Mi Historia)
  - Validación: al menos los campos obligatorios del I-589 (motivos, B.1A, B.1B)
- [ ] 1.2 Agregar tab "Formulario I-589" en `client-portal.tsx`
  - Solo visible para `asilo-defensivo` o `asilo-afirmativo`
  - Icono: FileText o ClipboardList
- [ ] 1.3 Actualizar `page.tsx` para cargar form_submissions de i589
- [ ] 1.4 Actualizar progreso: agregar step "I-589 B/C" a barra de asilo
- [ ] 1.5 Reutilizar API existente `POST /api/client-story` (ya soporta cualquier form_type válido)
  - Solo agregar los nuevos form_types a `validTypes` array

### Fase 2: Admin Review (M)
- [ ] 2.1 Componente `I589Review` en `src/app/admin/cases/[id]/i589-review.tsx`
  - Muestra respuestas del I-589 B y C organizadas por sección
  - Botones Aprobar / Pedir Correcciones (mismo patrón que ClientStoryReview)
  - DataRow para cada campo con label descriptivo
- [ ] 2.2 Agregar tab "I-589" en `admin-case-view.tsx`
  - Solo visible para servicios de asilo
  - Badge amarillo cuando hay submissions pendientes de revisión
- [ ] 2.3 Filtrar submissions de i589 en el tab

### Fase 3: Polish (S)
- [ ] 3.1 Empty states con instrucciones claras
- [ ] 3.2 Textos de guía en cada pregunta (del PDF oficial)
- [ ] 3.3 Indicador de progreso dentro del wizard

---

## Archivos a Crear (2)
1. `src/app/cita/[token]/i589-wizard.tsx` — Wizard completo
2. `src/app/admin/cases/[id]/i589-review.tsx` — Review en admin

## Archivos a Modificar (4)
3. `src/app/cita/[token]/client-portal.tsx` — Tab "Formulario I-589" para asilo
4. `src/app/cita/[token]/page.tsx` — Fetch i589 submissions
5. `src/app/admin/cases/[id]/admin-case-view.tsx` — Tab "I-589" para asilo
6. `src/app/api/client-story/route.ts` — Agregar form_types de i589 a validTypes

---

## Orden de Implementación

```
Fase 1 (L) → Fase 2 (M) → Fase 3 (S)
  Wizard       Admin Review   Polish
```

Fase 1 primero: los clientes pueden empezar a llenar inmediatamente.
Fase 2: Henry puede revisar y aprobar.
Fase 3: pulido final.

---
---

## Planes anteriores completados

### Chatbot Público con Voz Nativa (COMPLETADO)
- [x] Backend: system prompt + API chat + API lead + API ephemeral token
- [x] Frontend modo chat (WhatsApp-like + grabador audio)
- [x] Frontend modo llamada voz (Live API + Siri orb)
- [x] Conexión con agenda (create_lead → callback_requests)

---
---

# Plan XL: Landing Pública Premium — usalatinoprime.com

## Status: PENDIENTE APROBACIÓN

## El Problema

`usalatinoprime.com` hoy es solo un dispatcher al login. No hay landing pública. Henry quiere correr ADs (Meta, Google) y necesita una landing tipo Platzi: hero impactante, catálogo de servicios como e-commerce, páginas individuales por servicio con fases visuales, equipo, reseñas, próximos lanzamientos.

## Decisiones tomadas

| Pregunta | Decisión |
|---|---|
| URL de la landing | **Raíz** (`usalatinoprime.com/`). Anónimo → landing; staff/cliente logueado → su dashboard |
| Branding | Premium nuevo, tipo Platzi/Apple. NO el #F2A900/#002855 actual |
| Flexibilidad de fases | **Servicios separados** en el catálogo (no checkboxes) |
| Alcance | Landing completa + Sobre Nosotros + 5 páginas de servicio |
| Assets | Henry pasará: video, fotos equipo, precios reales, reseñas, bios |
| Pago | Sin checkout. CTA = botón WhatsApp |

## Arquitectura de rutas

```
/                                       → Landing principal (NUEVA)
/servicios/visa-juvenil-completa        → 3 fases + calculadora hijos
/servicios/visa-juvenil-i360            → solo fases I-360 + I-485
/servicios/visa-juvenil-i485            → solo fase I-485
/servicios/asilo-completo               → fase 1 + 2
/servicios/asilo-reforzamiento          → solo fase 2
/sobre-nosotros                         → equipo
/                                       → si hay sesión, redirige al dashboard según rol (actual)
```

Lógica del dispatcher en `/src/app/page.tsx`:
```tsx
if (user) {
  // Lógica existente: admin → /ceo, employee → /employee/contracts, client → /comunidad
}
return <LandingPage />   // visitante anónimo
```

## Estructura de la landing principal (`/`)

```
1. Navbar sticky transparente → opaco al scroll
   - Logo UsaLatinoPrime
   - Links: Servicios · Equipo · Reseñas · Iniciar sesión
   - CTA: "Hablar con un asesor" (WhatsApp)

2. Hero (full-bleed)
   - Headline impactante (h1 80-120px en desktop)
   - Subhead 1 línea
   - Video autoplay muted loop (mp4) o video con play button
   - 2 CTAs: "Ver servicios" (scroll) + "Hablar por WhatsApp"

3. Catálogo de servicios (5 cards)
   - Grid responsive: 3 cols desktop, 2 tablet, 1 mobile
   - Card: ícono + título + 1 línea descripción + precio "desde $X" + flecha
   - Hover: lift + glow sutil
   - Click → /servicios/{slug}

4. Sección "¿Por qué UsaLatinoPrime?" (diferenciadores)
   - 3-4 features: experiencia, equipo bilingüe, app móvil, plataforma 24/7
   - Iconos + título + descripción corta

5. Reseñas / Testimonios (carousel o grid)
   - 6 testimonios reales con foto, nombre, servicio
   - Estrellas + texto + servicio que tomó

6. Próximos lanzamientos
   - Sandbox de Utah (descripción + visual)
   - App DigiLegal (mockup móvil + "Próximamente en App Store / Play Store")

7. Sección equipo (preview con link a /sobre-nosotros)
   - 5 cards: Henry, Vanessa, Diana, Giuseppe, Mauricio
   - Foto circular + nombre + rol
   - "Conoce a todo el equipo →"

8. CTA final
   - "Empieza tu trámite hoy" + botón WhatsApp grande

9. Footer
   - Logo + descripción + links + redes + dirección + copyright
```

## Estructura de página de servicio (ej: `/servicios/visa-juvenil-completa`)

```
1. Navbar (mismo)

2. Hero específico
   - Breadcrumb: Inicio > Servicios > Visa Juvenil
   - Título del servicio
   - Descripción 2-3 líneas
   - Precio: "Desde $X · Plan a tu medida"
   - 2 CTAs: "Cotizar por WhatsApp" + "Ver fases ↓"

3. "¿En qué consiste?" (1 párrafo)

4. Línea de tiempo de fases (vertical, didáctico)
   - Misma visual que ve el cliente en su portal → familiaridad
   - Fase 1: Custodia (descripción, qué entrega Henry, tiempo estimado)
   - Fase 2: I-360
   - Fase 3: I-485
   - Cada fase con icono, color, número grande

5. Calculadora (SOLO en visa juvenil)
   - Input numérico "¿Cuántos hijos?" (1-10)
   - Precio recalculado en vivo
   - Texto: "$X por el primer hijo + $Y por cada hijo adicional"
   - Botón "Cotizar este precio por WhatsApp" → mensaje pre-llenado

6. Documentos que necesitas
   - Lista checklist visual

7. FAQ (3-5 preguntas comunes)

8. CTA final + Footer
```

## Estructura `/sobre-nosotros`

```
1. Hero del equipo
   - "El equipo detrás de UsaLatinoPrime"
   - Foto grupal (si la tienen) o composición de 5 fotos

2. Grid de equipo (5 cards detalladas)
   - Foto grande
   - Nombre + rol
   - 2-3 líneas de bio
   - Especialidad
   - Link LinkedIn opcional

3. Misión / Valores

4. Por qué nos eligen

5. CTA + Footer
```

## Diseño visual (estilo premium Platzi/Apple)

**Paleta nueva propuesta** (a confirmar con Henry):
- Background: `#0A0A0F` (carbón profundo) o `#FFFFFF` (claro)
- Acento principal: `#FFD60A` (dorado vibrante, más premium que F2A900)
- Acento secundario: `#0066FF` (azul saturado, energético)
- Texto: blanco puro / `#1A1A1F`
- Gradientes sutiles en cards: linear-gradient(135deg, rgba(255,214,10,0.08), rgba(0,102,255,0.04))

**Tipografía**:
- Display: Plus Jakarta Sans (ya cargado en el proyecto) o Inter Display
- Body: Inter
- Mono para precios/datos: JetBrains Mono (ya cargado)

**Estilo**:
- Bordes redondeados generosos (16-24px)
- Sombras suaves multi-capa
- Microinteracciones: hover lift, fade-in al scroll, parallax sutil en hero
- Animaciones con `framer-motion` (ya en deps?) o CSS

**Activar skill `frontend-design`** durante la implementación visual de cada componente.

## Componentes a crear

```
src/app/(landing)/                   ← route group para todo lo público
  layout.tsx                          ← navbar + footer + estilos landing
  page.tsx                            ← landing principal
  servicios/
    [slug]/page.tsx                   ← detalle por servicio (dinámico)
  sobre-nosotros/page.tsx

src/components/landing/
  navbar.tsx
  footer.tsx
  hero.tsx
  service-card.tsx
  service-catalog.tsx
  testimonials.tsx
  upcoming-products.tsx
  team-preview.tsx
  team-full.tsx
  phase-timeline.tsx                  ← reutiliza estilos del cliente portal
  visa-juvenil-calculator.tsx
  whatsapp-cta.tsx
  faq.tsx

src/lib/landing/
  services-catalog.ts                 ← data de los 5 servicios (precios, fases, descripciones)
  team-data.ts                        ← bios y datos del equipo
  testimonials-data.ts                ← reseñas reales

src/app/page.tsx                      ← MODIFICAR: render Landing si no hay user
```

## Modelo de datos

**Sin tablas nuevas**. Los datos del catálogo y equipo viven en archivos TS (`src/lib/landing/`). Si en el futuro Henry quiere editar precios desde admin, migramos a Supabase con una tabla `landing_services`.

## Lista de assets que necesito de Henry

### Críticos (sin esto no se puede entregar)
- [ ] **Video del hero** — MP4 (1080p, ~30 seg ideal, sin audio) o URL Vimeo/YouTube
- [ ] **5 fotos del equipo** — JPG/PNG, mínimo 800×800, fondo neutro idealmente
- [ ] **Precios reales** (los 5 servicios):
  - Visa Juvenil completa: base 1 hijo + cuánto suma cada hijo extra
  - Visa Juvenil I-360+I-485: base + lógica hijos
  - Visa Juvenil I-485: base + lógica hijos
  - Asilo completo: precio fijo
  - Asilo reforzamiento: precio fijo
- [ ] **Bios cortas equipo** — 2-3 líneas por persona, rol + algo personal
- [ ] **Reseñas** — mínimo 6: texto, nombre, servicio, estrellas (5/5 ideal)
- [ ] **Número WhatsApp para CTAs** — ¿Andrium (+1 267-787-4365) o uno general?

### Importantes (con placeholders si no llegan)
- [ ] Logo UsaLatinoPrime alta resolución (SVG ideal)
- [ ] Logo Sandbox Utah + descripción 1 párrafo
- [ ] Logo/mockup DigiLegal + descripción 1 párrafo
- [ ] FAQ por servicio (3-5 preguntas/respuestas comunes)
- [ ] Headline principal para el hero (puedo proponer 3 opciones)
- [ ] Misión/valores de la firma

## Plan de entrega (5 PRs)

### PR1: Esqueleto + Hero + Navbar/Footer (M, ~4-5 horas)
- [ ] Route group `(landing)` con layout
- [ ] Modificar `src/app/page.tsx` para dispatcher inteligente
- [ ] Navbar sticky con scroll behavior
- [ ] Footer con info legal
- [ ] Hero con video placeholder
- [ ] Setup tipografía + paleta nueva en globals
- [ ] Responsive básico

### PR2: Catálogo en home + 1 servicio piloto (L, ~6-8 horas)
- [ ] Componente `ServiceCatalog` con 5 cards
- [ ] Data en `services-catalog.ts`
- [ ] Página de servicio dinámica `/servicios/[slug]`
- [ ] Primera página completa: Visa Juvenil Completa
- [ ] Componente `PhaseTimeline` reutilizable
- [ ] Calculadora dinámica con número de hijos
- [ ] CTA WhatsApp con mensaje pre-llenado

### PR3: Resto de servicios (M, ~3-4 horas)
- [ ] 4 páginas restantes: VJ-i360, VJ-i485, Asilo completo, Asilo reforzamiento
- [ ] Datos en catalog
- [ ] FAQ por servicio

### PR4: Reseñas + Lanzamientos + Equipo (L, ~5-6 horas)
- [ ] Sección Testimonios con carousel o grid
- [ ] Sección Próximos Lanzamientos (Sandbox + DigiLegal)
- [ ] Preview equipo en home
- [ ] Página completa `/sobre-nosotros`

### PR5: SEO + Animaciones + Pulido final (M, ~3-4 horas)
- [ ] Metadata por página (title, description, OG image)
- [ ] sitemap.xml
- [ ] robots.txt
- [ ] Microanimaciones (fade-in al scroll, hover effects)
- [ ] Performance: lazy load del video, optimización de imágenes con next/image
- [ ] Accesibilidad: alt text, ARIA, focus states
- [ ] Test responsive en mobile/tablet/desktop

## Riesgos

1. **Sin assets reales no se ve bien** — la calidad de la landing depende 100% de las fotos y el video. Si no llegan, queda con placeholders feos.
2. **Precios sensibles** — son visibles públicamente y aparecen en ads. Cualquier cambio hay que coordinar.
3. **WhatsApp como único CTA** — funciona para arranque pero limita escalabilidad. Para v2 quizá un mini-formulario que envíe a WhatsApp con datos pre-cargados.
4. **El branding nuevo puede chocar con la app** — si abres la landing premium y luego vas al dashboard con paleta vieja, hay disonancia. Aceptable por ahora, pero quizá rediseñar la app en una v2.
5. **Conflicto con `/visa-juvenil-form`** — esa ruta ya existe (form público de visa juvenil). Hay que confirmar si es la misma o si seguirá funcionando paralela.

## Decisiones abiertas (preguntar antes de PR2)

- ¿Cómo se llama el botón principal del CTA? "Hablar con un asesor", "Iniciar trámite", "Cotizar ahora"
- ¿Hay un eslogan/frase de marca que deba aparecer siempre?
- ¿Sandbox Utah y DigiLegal aparecen "como cards" o como "banners destacados"?
- ¿La calculadora muestra precio total o solo "desde $X" para no asustar a la primera?

---

**Espero aprobación de Henry para empezar PR1.**

