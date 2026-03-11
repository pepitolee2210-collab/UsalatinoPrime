# Plan XL: Sistema IA Completo — Wizard del Cliente + Chat de Henry

## Status: PENDIENTE APROBACION

---

## El Problema

Henry gasta 40-60 minutos por Zoom con cada cliente de Visa Juvenil:
- Recopila la historia de abandono (nombres, fechas, detalles)
- Pregunta por testigos y quién puede dar fe
- Pregunta si el padre coopera
- Con toda esa info va a ChatGPT y genera 5-10 documentos legales
- Esto no escala: con 32+ clientes activos, se le acaba el tiempo

## La Solución (2 partes conectadas)

### Parte A: El cliente llena su historia ANTES de la reunión
En `/cita/[token]` → nuevo tab "Mi Historia" → wizard guiado paso a paso donde el cliente:
1. Cuenta su relato de abandono (con preguntas guía de la IA)
2. Identifica sus testigos (nombre, relación, qué pueden declarar)
3. Indica si el padre coopera o no
4. Revisa todo antes de enviar

### Parte B: Henry revisa, corrige y genera documentos
En `/admin/cases/[id]` → nuevo tab "Chat IA" donde Henry:
1. Ve TODO lo que el cliente llenó (relato, testigos, docs subidos)
2. Puede corregir/editar lo que el cliente puso mal
3. Abre el chat y la IA YA TIENE todo el contexto
4. Pide documentos legales por nombre ("hazme la declaración jurada de la madre")
5. La IA genera en inglés legal con datos reales
6. Henry refina iterativamente
7. Guarda y descarga los documentos finales

### Resultado
- Reunión de Zoom: de 60 min → 15-20 min (solo revisar y orientar)
- Henry ya no tipea nada en ChatGPT manualmente
- Los documentos se generan con datos verificados del sistema

---

## Flujo Completo End-to-End

```
1. Se crea contrato → se genera caso + perfil del cliente
2. Cliente recibe link /cita/[token] por WhatsApp

3. CLIENTE en /cita/[token]:
   a. Tab "Cita": agenda su reunión con Henry
   b. Tab "Mis Documentos": sube pasaporte, acta nacimiento, etc.
   c. Tab "Mi Historia" (NUEVO):
      → Paso 1: Relato del abandono (preguntas guiadas por IA)
      → Paso 2: Testigos (quiénes, relación, qué vieron)
      → Paso 3: Padre/madre ausente (¿coopera? ¿dónde está?)
      → Paso 4: Revisión y envío
   d. Tab "Docs del Consultor": descarga docs que Henry le envía

4. HENRY en /admin/cases/[id]:
   a. Recibe notificación: "Cliente X completó su historia"
   b. Abre tab "Revisión Cliente" (NUEVO):
      → Ve el relato completo que el cliente escribió
      → Ve los testigos seleccionados
      → Ve si el padre coopera
      → Puede EDITAR/CORREGIR cualquier campo
      → Marca como "Revisado" cuando está conforme
   c. Abre tab "Chat IA" (NUEVO):
      → La IA ya sabe TODO: datos, documentos, relato, testigos
      → Henry pide: "Genera la declaración jurada de la madre"
      → IA genera en inglés legal con datos reales del caso
      → Henry: "Agrega que la abuela Beata vive en Panamá"
      → IA actualiza el documento
      → Henry guarda cada documento generado
   d. Tab "Documentos":
      → Documentos generados por la IA aparecen aquí
      → Botón descargar (PDF/Word)
      → Puede enviar al cliente (admin_to_client)
```

---

## Datos que Recopila el Wizard del Cliente

### Paso 1: Relato del Abandono
Preguntas guiadas (no un textarea vacío — preguntas específicas):
- ¿Cómo conociste al padre/madre de tu(s) hijo(s)?
- ¿Se casaron? ¿Vivieron juntos? ¿Cuánto tiempo?
- ¿Cuándo se separaron? ¿Por qué? (fecha aproximada)
- ¿Qué pasó después de la separación?
- ¿El padre/madre mantuvo contacto con el menor? ¿Cuándo fue la última vez?
- ¿Hubo apoyo económico? ¿Demanda de alimentos?
- ¿Hubo violencia, amenazas, o denuncias?
- ¿Cuándo y cómo llegaste a Estados Unidos?
- ¿Quién cuidó al menor durante ese tiempo?
- ¿Cómo afectó emocionalmente al menor el abandono?
- ¿Hay denuncias policiales, órdenes de protección, o documentos de tribunal?
- Cualquier otro detalle importante

Cada pregunta tiene:
- Texto guía explicando qué necesita el juez
- Ejemplo de respuesta esperada
- Campo de texto amplio
- Opción "No aplica"

**NOTA:** Si el caso tiene MÚLTIPLES hijos con padres diferentes, el relato se repite por cada hijo (cada uno es un caso SIJ separado).

### Paso 2: Situación del Padre/Madre Ausente (ADAPTATIVO)

**Pregunta clave que define el flujo:**
> "¿Tiene usted contacto con el padre/madre de su(s) hijo(s)? ¿Está dispuesto/a a cooperar con el proceso?"

**Opciones (el cliente elige UNA):**

#### Opción A: "Sí, el padre/madre coopera"
Campos que se muestran:
- Nombre completo del padre/madre
- País y ciudad donde vive
- Teléfono o email de contacto
- ¿Puede firmar documentos? (sí/no)
- ¿Puede legalizar/notarizar en su país? (sí/no)
→ **Genera**: Carta de cesión de custodia + consent email para que firme

#### Opción B: "Tengo contacto pero no sé si cooperará"
Campos que se muestran:
- Nombre completo del padre/madre
- País y ciudad donde vive
- Último contacto (cuándo, por qué medio)
- ¿Ha mencionado algo sobre el proceso? ¿Qué dijo?
→ **Henry decide** en la revisión si intenta cooperación o va por testimonio

#### Opción C: "No tengo contacto / desapareció"
Campos que se muestran:
- Nombre completo del padre/madre (si lo sabe)
- Último país/ciudad conocido
- ¿Cuándo fue el último contacto? (fecha aprox)
- ¿Sabe si tiene otra familia?
- ¿Sabe si está preso, deportado, o fallecido?
- ¿Tiene alguna denuncia contra él/ella?
→ **Genera**: Declaraciones juradas más fuertes, se busca publicación legal

#### Opción D: "El padre/madre falleció"
Campos que se muestran:
- Nombre completo
- Fecha de fallecimiento (aprox)
- ¿Tiene acta de defunción?
→ **Flujo diferente**: No se necesita custodia del padre, otro enfoque legal

#### Opción E: "Nunca lo conocí / no fue reconocido"
Campos que se muestran:
- ¿El menor tiene el apellido del padre? (sí/no)
- ¿Aparece en el acta de nacimiento? (sí/no)
- ¿Alguna vez tuvo contacto con el menor?
→ **Flujo más simple**: Abandono total desde nacimiento

### Paso 3: Testigos (1-3 testigos)
Por cada testigo:
- Nombre completo
- Relación con la familia (mamá, tía, prima, amiga, vecina, maestro, etc.)
- País y ciudad donde vive
- Teléfono o email
- ¿Qué etapa del proceso presenció? (convivencia, abandono, crianza actual)
- ¿Qué puede declarar? (resumen breve)

**Guía adaptativa según situación del padre:**
- Si padre coopera → "Escoja testigos que confirmen que usted crió solo/a al menor"
- Si padre ausente → "Escoja testigos que confirmen el abandono y la falta de contacto"
- Si padre falleció → "Escoja testigos que confirmen la situación familiar"

### Paso 4: Revisión
- Resumen de todo lo llenado, organizado por secciones
- Indicador visual de la situación del padre (coopera/ausente/fallecido/desconocido)
- El cliente puede volver a editar cualquier paso
- Botón "Enviar a mi consultor"
- Status: draft → submitted

---

## Modelo de Datos

### Opción elegida: Expandir `case_form_submissions` con nuevos form_types

No crear tabla nueva. Usar la tabla existente `case_form_submissions`:

```
form_type = 'client_story'     → El relato completo del cliente
form_type = 'client_witnesses' → Info de testigos
form_type = 'client_absent_parent' → Info del padre ausente
```

Cada uno guarda su data en `form_data` (JSONB). Status flow:
- `draft` → cliente está llenando
- `submitted` → cliente envió, esperando revisión de Henry
- `reviewed` → Henry revisó y está conforme
- `needs_correction` → Henry pidió correcciones (con admin_notes)
- `approved` → Henry aprobó, listo para generar documentos

### Nueva tabla: `case_chat_messages`
```sql
id              UUID PK DEFAULT gen_random_uuid()
case_id         UUID FK → cases(id) NOT NULL
role            TEXT NOT NULL CHECK (system, user, assistant)
content         TEXT NOT NULL
metadata        JSONB DEFAULT '{}'
created_at      TIMESTAMPTZ DEFAULT now()
```

---

## Subtareas (5 fases, en orden)

### Fase 1: Migración + API base (M)
- [ ] 1.1 Migración SQL: crear tabla `case_chat_messages` + RLS + índices
- [ ] 1.2 No necesita nueva tabla para wizard — usa `case_form_submissions` existente
- [ ] 1.3 API: `GET /api/ai/chat/history?case_id=X` — historial de mensajes
- [ ] 1.4 API: `POST /api/ai/chat` — enviar mensaje + recibir respuesta streamed

### Fase 2: System Prompt + Motor de Chat (L)
- [ ] 2.1 System prompt master (`src/lib/ai/prompts/chat-system.ts`):
  - Conocimiento legal SIJ (affidavits, custody, consent, perjury clauses)
  - Formato de documentos legales en inglés (Utah courts)
  - Instrucciones: conversar en español, docs en inglés
  - Asesoría estratégica: qué valoran los jueces, evidencia clave
  - **ADAPTATIVO por situación del padre:**
    - Padre coopera → sugiere: consent letter, custody relinquishment, consent email
    - Padre ausente → sugiere: affidavits fuertes de testigos, publicación legal
    - Padre fallecido → sugiere: documentos sin custodia, otro enfoque
    - Padre desconocido → sugiere: declaración de no reconocimiento, testigos de abandono total
  - La IA detecta la situación del padre desde los datos del wizard y ajusta las recomendaciones
- [ ] 2.2 Builder de contexto dinámico por caso:
  - Datos del cliente (nombre, DOB, pasaporte, dirección) desde `profiles`
  - Tipo de servicio desde `service_catalog`
  - form_data del caso (datos del formulario de intake)
  - Documentos subidos por el cliente (lista de nombres + categorías)
  - Relato del cliente (de `case_form_submissions` form_type='client_story')
  - Testigos (de `case_form_submissions` form_type='client_witnesses')
  - Info padre ausente (de `case_form_submissions` form_type='client_absent_parent')
  - henry_notes del caso
  - Menores vinculados (de form_data o contracts)
- [ ] 2.3 Gestión de historial: cargar últimos 30 msgs + system prompt
- [ ] 2.4 Streaming via SSE (ReadableStream en Next.js)
- [ ] 2.5 Guardar mensaje user + respuesta assistant en `case_chat_messages`

### Fase 3: Frontend — Chat de Henry en Admin (L)
- [ ] 3.1 Componente `CaseChat` (`src/app/admin/cases/[id]/case-chat.tsx`):
  - Lista de mensajes scrollable (burbujas user/assistant)
  - Input textarea (Enter envía, Shift+Enter newline)
  - Streaming: respuesta token por token
  - Auto-scroll al último mensaje
  - Indicador "escribiendo..."
  - Botón "Copiar" en cada bloque de documento generado
  - Botón "Guardar documento" → guarda en case_form_submissions como tipo IA
- [ ] 3.2 Panel lateral de contexto (sidebar colapsable):
  - Datos del cliente (nombre, teléfono, servicio)
  - Lista de docs subidos por el cliente (nombres + status)
  - Resumen del relato del cliente (si ya lo llenó)
  - Testigos registrados
  - Estado del padre ausente
- [ ] 3.3 Integración en admin-case-view.tsx:
  - Reemplazar tab "Docs IA" por tab "Chat IA"
  - Badge con número de mensajes
- [ ] 3.4 Templates de inicio rápido (ADAPTATIVOS según situación del padre):
  **Siempre visibles:**
  - "Generar declaración jurada de la madre/tutor"
  - "Generar declaración jurada de testigo"
  - "Analizar qué documentos faltan para este caso"
  - "Generar declaración jurada de la niña/niño"
  **Solo si padre coopera:**
  - "Generar carta de cesión de custodia voluntaria"
  - "Generar consent email para el padre"
  - "Generar acknowledgment of receipt"
  **Solo si padre ausente/sin contacto:**
  - "Generar declaración jurada reforzada (abandono total)"
  - "Generar declaración jurada de familiar cercano"
  - "Preparar publicación legal de notificación"
  **Solo si padre fallecido:**
  - "Preparar documentación sin custodia paterna"
- [ ] 3.5 Documentos generados:
  - Cuando la IA genera un documento, detectar bloques con formato legal
  - Botón "Guardar como documento del caso"
  - Botón "Descargar" (copiar texto, futuro: exportar PDF)
  - Documentos guardados aparecen en tab Documentos del caso

### Fase 4: Frontend — Wizard del Cliente en /cita/[token] (L)
- [ ] 4.1 Nuevo tab "Mi Historia" en ClientPortal (solo para visa-juvenil)
- [ ] 4.2 Componente `ClientStoryWizard` — ADAPTATIVO POR MENOR:
  - Si el caso tiene 1 menor → flujo lineal de 4 pasos
  - Si tiene 2+ menores con padres diferentes → SE REPITE por cada menor:
    → "Hijo 1: Juan (padre: Carlos)" → relato + padre + testigos
    → "Hijo 2: María (padre: Roberto)" → relato + padre + testigos
  - Paso 1: Relato del abandono POR MENOR (preguntas guiadas con ejemplos)
  - Paso 2: Situación del padre/madre ausente POR MENOR (adaptativo: coopera/ausente/fallecido/desconocido)
  - Paso 3: Testigos (pueden ser compartidos entre hijos o específicos)
  - Paso 4: Revisión completa de TODOS los menores + botón enviar
  - Los menores se cargan desde form_data del caso o desde el contrato (minors JSONB)
- [ ] 4.3 Auto-guardado: cada campo se guarda como draft en case_form_submissions
- [ ] 4.4 Barra de progreso: "Paso 2 de 4"
- [ ] 4.5 Pre-llenado inteligente desde documentos subidos:
  - Si el cliente ya subió pasaporte → auto-llenar nombre, DOB, nacionalidad
  - Si subió acta de nacimiento → auto-llenar datos del menor, padre
  - Datos vienen de form_data del caso (ya capturados en intake) o se extraen con Gemini Vision
  - El cliente solo CONFIRMA o CORRIGE los datos pre-llenados
- [ ] 4.6 Preguntas guiadas con:
  - Texto explicativo ("El juez necesita saber exactamente cuándo...")
  - Ejemplos de respuesta ("Ej: Nos separamos en marzo 2018 cuando...")
  - Validación: campos requeridos + longitud mínima
- [ ] 4.7 API endpoints:
  - `POST /api/client-story/save` — guarda draft (upsert en case_form_submissions)
  - `POST /api/client-story/submit` — marca como submitted
  - `GET /api/client-story?token=X` — carga datos guardados
- [ ] 4.8 Notificación a Henry cuando el cliente envía su historia

### Fase 5: Admin — Revisión del Relato del Cliente (M)
- [ ] 5.1 Nuevo tab "Revisión" en admin-case-view.tsx (o sección dentro de Formulario)
  - Muestra el relato completo del cliente (formateado, legible)
  - Muestra testigos con sus detalles
  - Muestra info del padre ausente
  - Status badge: draft / submitted / reviewed / needs_correction
- [ ] 5.2 Edición inline:
  - Henry puede editar cualquier campo directamente
  - Los cambios se guardan en case_form_submissions
  - Se registra quién editó (admin_notes)
- [ ] 5.3 Acciones:
  - "Marcar como revisado" → status = reviewed
  - "Pedir correcciones" → status = needs_correction + notas → notifica al cliente
  - "Aprobar" → status = approved
- [ ] 5.4 Indicador en el tab: badge rojo cuando hay historias pendientes de revisión

---

## Archivos a Crear/Modificar

### Crear (8 archivos):
1. `supabase/migrations/0XX_case_chat_messages.sql`
2. `src/app/api/ai/chat/route.ts` — chat endpoint con streaming
3. `src/app/api/ai/chat/history/route.ts` — historial
4. `src/lib/ai/prompts/chat-system.ts` — system prompt + context builder
5. `src/app/admin/cases/[id]/case-chat.tsx` — chat UI para Henry
6. `src/components/client/client-story-wizard.tsx` — wizard del cliente
7. `src/app/api/client-story/save/route.ts` — guardar draft del relato
8. `src/app/api/client-story/submit/route.ts` — enviar relato

### Modificar (4 archivos):
9. `src/app/admin/cases/[id]/admin-case-view.tsx` — agregar tabs Chat IA + Revisión
10. `src/app/admin/cases/[id]/page.tsx` — cargar chat history + client story
11. `src/app/cita/[token]/page.tsx` — agregar tab Mi Historia + pasar datos
12. `src/app/cita/[token]/client-portal.tsx` — nuevo tab con wizard

### Eliminar (después):
13. `src/app/admin/cases/[id]/admin-ai-forms.tsx` — reemplazado por Chat IA

---

## Decisiones Técnicas

| Decisión | Elección | Razón |
|----------|----------|-------|
| Modelo IA | Gemini (ya configurado) | Ya funciona, API key lista |
| Streaming | SSE via ReadableStream | UX tipo ChatGPT en tiempo real |
| Data del wizard | case_form_submissions (existente) | No crear tablas innecesarias |
| Data del chat | case_chat_messages (nueva) | Separar conversación de datos estructurados |
| Context window | Últimos 30 msgs + system prompt dinámico | Balance contexto/costo |
| Auto-guardado wizard | Debounced upsert cada 5s de inactividad | Cliente no pierde progreso |
| Docs generados | Guardados en case_form_submissions tipo AI | Reutiliza infra existente |

---

## Orden de Implementación Recomendado

```
Fase 1 (M) → Fase 2 (L) → Fase 3 (L) → Fase 4 (L) → Fase 5 (M)
  DB + APIs    System Prompt   Chat Henry    Wizard Cliente   Revisión Admin
```

**Por qué este orden:**
- Fase 1-3 primero: Henry puede usar el Chat IA de inmediato con los datos que YA existen
- Fase 4 después: Una vez que el chat funciona, agregamos el wizard para que los clientes llenen
- Fase 5 al final: La revisión conecta ambos mundos

**MVP funcional en Fases 1-3:** Henry ya puede chatear con la IA usando datos existentes del caso.

---

## Verificación Final
1. Cliente llena wizard en /cita → se guarda como draft → envía
2. Henry recibe notificación → abre Revisión → ve relato + testigos + padre
3. Henry corrige un detalle → guarda → marca como revisado
4. Henry abre Chat IA → la IA ya sabe todo (relato, testigos, docs, padre)
5. Henry pide "declaración jurada de la madre" → documento en inglés legal
6. Henry agrega detalle → la IA actualiza
7. Henry guarda documento → aparece en tab Documentos → descarga
8. Todo persiste: cierra y reabre → historial completo
9. `next build` sin errores
