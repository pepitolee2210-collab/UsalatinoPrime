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
