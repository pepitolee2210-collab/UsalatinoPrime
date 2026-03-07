# Plan XL: Portal Cliente Unificado + Flujo Automatizado Visa Juvenil

## Resumen

Transformar `/cita/[token]` de una simple pagina de citas+upload en un **portal completo para clientes** con:
1. Documentos bidireccionales (Henry sube → cliente descarga, cliente sube → Henry revisa)
2. Formularios integrados de Visa Juvenil (3 documentos clave) para autoservicio
3. Automatizacion del flujo de trabajo actual de Henry (de 1.5h Zoom → 30min explicando el sistema)

**Problema actual:** Henry entra a Zoom 1.5h con cada cliente de Visa Juvenil, llenando manualmente 3 formularios con 3 agentes de ChatGPT. Quiere que los clientes lo hagan solos desde la plataforma.

---

## Arquitectura: Lo que existe vs lo que se necesita

### YA EXISTE:
- `/cita/[token]` — citas + upload de documentos del cliente
- `/visa-juvenil-form` — formulario publico (info menor, padres, abuso) → `visa_juvenil_submissions`
- `/miedo-creible` — formulario publico (miedo creible) → `credible_fear_submissions`
- `/portal` — dashboard con auth (Supabase) — casos, pagos, notificaciones
- Tabla `documents` con storage en Supabase bucket `case-documents`
- Upload directo via signed URLs (sin limite de 4.5MB)

### SE NECESITA:
- **Documentos de Henry → Cliente** en `/cita/[token]` (download section)
- **3 formularios integrados** en `/cita/[token]` para Visa Juvenil:
  1. Declaracion Jurada del Padre/Madre
  2. Miedo Creible (relato — ya existe el form, integrar al token)
  3. Testimonio/Testigos
- **Guardado parcial** (draft) para que clientes puedan pausar y continuar
- **Flujo guiado** paso a paso dentro del portal del cliente
- **Admin: subir documentos PARA el cliente** con visibilidad en su portal

---

## Decisiones de Diseno

| Decision | Eleccion | Razon |
|----------|----------|-------|
| Portal base | `/cita/[token]` (expandir, no crear nuevo) | Ya funciona, clientes lo conocen, no requiere login |
| Formularios | Embebidos como tabs/secciones en `/cita/[token]` | 1 sola URL para todo, mas simple para el cliente |
| Guardado parcial | JSONB `form_drafts` en tabla nueva `case_form_submissions` | Permite pausar/continuar sin perder datos |
| Docs de Henry→Cliente | Nuevo `document_key` prefix: `henry_*` | Reutiliza tabla `documents` existente |
| Formularios VJ | 3 steps tipo wizard dentro de cada tab | Menos abrumador que un form gigante |
| Agente IA | NO en esta fase | Primero los formularios, luego se puede agregar IA como mejora |

---

## Nuevas Tablas (1 migracion)

### `case_form_submissions`
```
id              UUID PK DEFAULT gen_random_uuid()
case_id         UUID FK → cases(id)
client_id       UUID FK → profiles(id)
form_type       TEXT NOT NULL CHECK (declaracion_jurada, miedo_creible, testimonio_testigos)
form_data       JSONB NOT NULL DEFAULT '{}'
status          TEXT CHECK (draft, submitted, reviewed, needs_correction, approved) DEFAULT 'draft'
admin_notes     TEXT
submitted_at    TIMESTAMPTZ
reviewed_at     TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

### Cambios en `documents`
- Agregar columna `direction` TEXT DEFAULT 'client_to_admin' CHECK (client_to_admin, admin_to_client)
- Los documentos subidos por Henry para el cliente tendran direction = 'admin_to_client'

---

## Subtareas (en orden de ejecucion)

### Fase 1: Documentos Bidireccionales (L) — Henry sube, cliente descarga
- [ ] **1.1** Migracion: agregar `direction` a tabla `documents` (default 'client_to_admin')
- [ ] **1.2** API: `POST /api/admin/client-documents` — Henry sube documento PARA un cliente (direction='admin_to_client')
- [ ] **1.3** API: `GET /api/client-documents?token=X` — cliente obtiene docs subidos por Henry
- [ ] **1.4** API: download signed URL para que cliente descargue
- [ ] **1.5** Admin UI: seccion "Subir documento para el cliente" en `/admin/cases/[id]`
- [ ] **1.6** Cliente UI: seccion "Documentos de su Consultor" en `/cita/[token]` con botones de descarga

### Fase 2: Base de Datos para Formularios (M)
- [ ] **2.1** Migracion: crear tabla `case_form_submissions`
- [ ] **2.2** RLS: cliente ve solo sus formularios, admin ve todos
- [ ] **2.3** API: `POST /api/case-forms/save` — guardar borrador (upsert)
- [ ] **2.4** API: `POST /api/case-forms/submit` — marcar como submitted
- [ ] **2.5** API: `GET /api/case-forms?token=X` — obtener formularios del caso

### Fase 3: Formulario Declaracion Jurada (L)
- [ ] **3.1** Definir campos del formulario (basado en el documento legal real)
- [ ] **3.2** Componente `DeclaracionJuradaForm` — wizard multi-step
- [ ] **3.3** Auto-guardado cada 30s o al cambiar de step
- [ ] **3.4** Integracion en `/cita/[token]` como tab/seccion
- [ ] **3.5** Preview/resumen antes de enviar

### Fase 4: Formulario Miedo Creible Integrado (M)
- [ ] **4.1** Adaptar formulario existente `/miedo-creible` como componente reutilizable
- [ ] **4.2** Integrarlo en `/cita/[token]` vinculado al caso
- [ ] **4.3** Soporte draft/guardado parcial via `case_form_submissions`
- [ ] **4.4** Pre-llenar datos del cliente (nombre, DOB, etc.) desde el caso

### Fase 5: Formulario Testimonio y Testigos (L)
- [ ] **5.1** Definir campos (basado en flujo de Henry con ChatGPT)
- [ ] **5.2** Componente `TestimonioForm` — seccion relato + seccion testigos
- [ ] **5.3** Auto-guardado + draft
- [ ] **5.4** Integracion en `/cita/[token]`

### Fase 6: Reestructurar `/cita/[token]` como Portal (L)
- [ ] **6.1** Layout con navegacion por tabs: Cita | Documentos | Formularios | Docs Henry
- [ ] **6.2** Indicadores de progreso: checkmarks verdes en tabs completados
- [ ] **6.3** Barra de progreso general: "3 de 6 pasos completados"
- [ ] **6.4** Responsive: funcionar bien en movil (clientes usan WhatsApp → abren link en celular)
- [ ] **6.5** Seccion de estado: "Tu caso esta en: [status]"

### Fase 7: Admin — Revision de Formularios (L)
- [ ] **7.1** Pagina `/admin/formularios-caso` — lista de formularios enviados por clientes
- [ ] **7.2** Vista detalle: ver respuestas del formulario formateadas
- [ ] **7.3** Acciones: aprobar, pedir correccion (con notas), archivar
- [ ] **7.4** Notificacion al cliente cuando Henry aprueba o pide correccion
- [ ] **7.5** Dashboard widget: "Formularios pendientes de revision"

---

## Flujo del Usuario (Visa Juvenil)

```
Henry genera link /cita/[token] → Cliente recibe por WhatsApp
→ Cliente abre portal unificado
→ Tab "Cita": agenda su cita de Zoom (30 min ahora, no 1.5h)
→ Tab "Formularios":
    → Paso 1: Declaracion Jurada (puede pausar y continuar)
    → Paso 2: Miedo Creible (relato completo)
    → Paso 3: Testimonio y Testigos
→ Tab "Documentos": sube sus 5 PDFs requeridos
→ Tab "Docs Henry": descarga documentos que Henry le envio
→ Henry revisa formularios en admin → aprueba o pide correcciones
→ Zoom de 30 min: Henry revisa lo que el cliente ya lleno, ajusta detalles
→ Proceso completado en 1 sesion
```

## Flujo de Henry (Admin)

```
Henry abre caso del cliente en admin
→ Sube documentos para el cliente (aparecen en su portal)
→ Revisa formularios enviados por el cliente
→ Aprueba o pide correcciones (cliente recibe notificacion)
→ Zoom de 30 min para finalizar detalles
→ Marca caso como completado
```

---

## Orden de Implementacion Recomendado

1. **Fase 1** (Docs bidireccionales) → impacto inmediato, Henry puede empezar a subir docs para clientes
2. **Fase 6** (Reestructurar portal) → el contenedor para todo lo demas
3. **Fase 2** (DB formularios) → base para los 3 formularios
4. **Fase 4** (Miedo Creible) → mas facil, ya existe el form
5. **Fase 3** (Declaracion Jurada) → formulario nuevo, mas complejo
6. **Fase 5** (Testimonio) → necesita definir campos con Henry
7. **Fase 7** (Admin revision) → Henry revisa lo enviado

**Nota:** Las Fases 3, 4 y 5 necesitan que Henry defina exactamente que campos/preguntas van en cada formulario. Los formularios existentes (`/visa-juvenil-form` y `/miedo-creible`) son un buen punto de partida pero Henry puede querer ajustar las preguntas.

---

## Riesgos y Mitigaciones

| Riesgo | Mitigacion |
|--------|-----------|
| Formularios muy largos asustan al cliente | Wizard multi-step + guardado parcial + barra de progreso |
| Cliente pierde progreso | Auto-guardado cada 30s + status "draft" |
| Henry no sabe que documentos tiene cada cliente | Dashboard con indicadores claros de completitud |
| Formularios necesitan campos diferentes segun caso | form_data es JSONB flexible |
| Clientes en celular | Design mobile-first, formularios adaptados a pantalla chica |
| Henry quiere cambiar preguntas despues | Formularios renderizados desde config, facil de modificar |

---

## Status: PENDIENTE APROBACION
Esperando aprobacion del plan antes de empezar a codear.
